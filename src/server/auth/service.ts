import "server-only";

import type { PrismaClient } from "@prisma/client";

import { AuthError } from "./errors";
import { verifyPassword } from "./password";
import { newSessionToken, sessionTokenHash, validSessionToken } from "./session-token";
import { authUserSelect, projectAuthUser } from "./user";

export type AuthDatabase = Pick<PrismaClient, "user" | "session">;
export const sessionMaxAge = 7 * 24 * 60 * 60;

export function sessionCookieSettings(production: boolean) {
  return {
    name: production ? "__Host-civicspec-session" : "civicspec-session",
    options: { httpOnly: true, secure: production, sameSite: "lax", path: "/" } as const,
  };
}

export function createAuthService(database: AuthDatabase, config: {
  secret: () => string;
  now?: () => Date;
}) {
  const now = config.now ?? (() => new Date());

  return {
    async authenticatePassword(email: unknown, password: unknown) {
      if (typeof email !== "string" || typeof password !== "string") return null;
      const normalized = email.trim().toLowerCase();
      if (!normalized || normalized.length > 254) {
        await verifyPassword(password, null);
        return null;
      }
      const user = await database.user.findUnique({
        where: { email: normalized },
        select: { ...authUserSelect, passwordHash: true },
      });
      const valid = await verifyPassword(password, user?.passwordHash);
      return user && valid && !user.isSuspended ? projectAuthUser(user) : null;
    },

    async createSession(userId: string) {
      // Resolve the signing key before any database write. No fallback signing key.
      const token = newSessionToken(config.secret());
      const user = await database.user.findUnique({ where: { id: userId }, select: authUserSelect });
      if (!user || user.isSuspended) throw new AuthError(401);
      const expiresAt = new Date(now().getTime() + sessionMaxAge * 1000);
      await database.session.create({ data: { userId: user.id, tokenHash: sessionTokenHash(token), expiresAt } });
      return { token, expiresAt, user: projectAuthUser(user) };
    },

    async resolveSession(token: string | undefined) {
      if (!token || !validSessionToken(token, config.secret())) return null;
      const session = await database.session.findUnique({
        where: { tokenHash: sessionTokenHash(token) },
        select: { expiresAt: true, user: { select: authUserSelect } },
      });
      // Never cache this lookup: suspension and role removal take effect immediately.
      if (!session || session.expiresAt.getTime() <= now().getTime() || session.user.isSuspended) return null;
      return projectAuthUser(session.user);
    },

    async revokeSession(token: string | undefined) {
      if (token && validSessionToken(token, config.secret())) {
        await database.session.deleteMany({ where: { tokenHash: sessionTokenHash(token) } });
      }
    },

    async revokeUserSessions(userId: string) {
      await database.session.deleteMany({ where: { userId } });
    },
  };
}
