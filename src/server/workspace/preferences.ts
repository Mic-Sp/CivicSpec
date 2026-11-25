import "server-only";

import { z } from "zod";
import type { PrismaClient, ThemePreference as DatabaseTheme } from "@prisma/client";

import { selectWorkspaceRole } from "@/lib/workspace";
import type { ThemePreference } from "@/lib/theme";
import { AuthError } from "@/server/auth/errors";
import { authUserSelect, projectAuthUser, type AuthUser } from "@/server/auth/user";

const preferenceSelect = { theme: true, activeRole: true } as const;
const actor = z.string().min(1).max(128);
const mutation = z.union([
  z.object({ expectedUserId: actor, theme: z.enum(["light", "dark", "system"]) }).strict(),
  z.object({ expectedUserId: actor, activeRole: z.enum(["ADMIN", "REVIEWER", "PROBLEM_OWNER", "DEVELOPER"]) }).strict(),
]);
const databaseThemes: Record<ThemePreference, DatabaseTheme> = { light: "LIGHT", dark: "DARK", system: "SYSTEM" };
const clientThemes: Record<DatabaseTheme, ThemePreference> = { LIGHT: "light", DARK: "dark", SYSTEM: "system" };

export class PreferenceInputError extends Error {}

export function createWorkspaceService(database: Pick<PrismaClient, "userPreference" | "$transaction">, resolveUser: () => Promise<AuthUser | null>) {
  return {
    async read() {
      const user = await resolveUser();
      if (!user) return null;
      const preference = await database.userPreference.findUnique({ where: { userId: user.id }, select: preferenceSelect });
      const identity: AuthUser = Object.freeze({ id: user.id, email: user.email, displayName: user.displayName, roles: Object.freeze([...user.roles]) });
      return { user: identity, theme: clientThemes[preference?.theme ?? "SYSTEM"], activeRole: selectWorkspaceRole(identity.roles, preference?.activeRole ?? null) };
    },
    async save(input: unknown) {
      const parsed = mutation.safeParse(input);
      if (!parsed.success) throw new PreferenceInputError("Invalid preference.");
      const user = await resolveUser();
      if (!user) throw new AuthError(401);
      // Bind delayed or cross-tab requests to the session's actual actor. This
      // identifier is a consistency check, never the source of authentication.
      if (parsed.data.expectedUserId !== user.id) throw new AuthError(403);
      return database.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: user.id }, select: authUserSelect });
        if (!current || current.isSuspended) throw new AuthError(401);
        const change = parsed.data;
        if ("activeRole" in change && !current.roles.some(({ role }) => role === change.activeRole)) throw new AuthError(403);
        const fields = "theme" in change ? { theme: databaseThemes[change.theme] } : { activeRole: change.activeRole };
        const saved = await tx.userPreference.upsert({
          where: { userId: current.id }, create: { userId: current.id, ...fields }, update: fields, select: preferenceSelect,
        });
        const authorized = projectAuthUser(current).roles;
        return { theme: clientThemes[saved.theme], activeRole: selectWorkspaceRole(authorized, saved.activeRole), authorizedRoles: authorized };
      });
    },
  };
}
