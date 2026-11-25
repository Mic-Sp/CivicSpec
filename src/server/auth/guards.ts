import "server-only";

import type { RoleType } from "@prisma/client";

import { AuthError } from "./errors";
import { signInLocation } from "./return-path";
import type { AuthUser } from "./user";

export type AuthContext = { kind: "page"; returnTo?: unknown } | { kind: "api" | "action" };

export function createAuthGuards(dependencies: {
  resolveUser: () => Promise<AuthUser | null>;
  redirect: (location: string) => never;
}) {
  async function requireAuthentication(context: AuthContext = { kind: "api" }): Promise<AuthUser> {
    const user = await dependencies.resolveUser();
    if (user) return user;
    if (context.kind === "page") return dependencies.redirect(signInLocation(context.returnTo));
    throw new AuthError(401);
  }

  async function requireRole(required: RoleType | readonly RoleType[], context?: AuthContext): Promise<AuthUser> {
    const user = await requireAuthentication(context);
    const allowed: readonly RoleType[] = typeof required === "string" ? [required] : required;
    // Any explicitly permitted role suffices; no implicit ADMIN or confidential-tier bypass.
    if (!allowed.some((role: RoleType) => user.roles.includes(role))) throw new AuthError(403);
    return user;
  }

  return { requireAuthentication, requireRole };
}
