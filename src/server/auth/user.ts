import "server-only";

import { Prisma, RoleType } from "@prisma/client";

// Never include eligibility, referrals, organizations, or other private relations.
export const authUserSelect = {
  id: true,
  email: true,
  displayName: true,
  isSuspended: true,
  roles: { select: { role: true } },
} satisfies Prisma.UserSelect;

type AuthUserRecord = Prisma.UserGetPayload<{ select: typeof authUserSelect }>;

export type AuthUser = Readonly<{
  id: string;
  email: string;
  displayName: string;
  roles: readonly RoleType[];
}>;

export function projectAuthUser(record: AuthUserRecord): AuthUser {
  // Explicit allowlist, including nested roles: never spread a database record.
  return Object.freeze({
    id: record.id,
    email: record.email,
    displayName: record.displayName,
    roles: Object.freeze([...new Set(record.roles.map(({ role }) => role))]),
  });
}
