import { RoleType } from "@prisma/client";

import { createAuthService, type AuthDatabase } from "../../src/server/auth/service";

export function memoryAuth(passwordHash: string | null = null) {
  const roles: { role: RoleType }[] = [{ role: RoleType.REVIEWER }];
  const user = {
    id: "synthetic-test-user", email: "test@civicspec.local", displayName: "Synthetic Test User",
    isSuspended: false, passwordHash, roles,
    priorityEligibility: { status: "VERIFIED", attestationNote: "PRIVATE_PRIORITY_SENTINEL" },
    partnerReferrals: [{ status: "VERIFIED", partnerOrgName: "PRIVATE_REFERRAL_SENTINEL" }],
    suspendReason: "PRIVATE_SUSPENSION_SENTINEL",
    organizations: [{ legalName: "PRIVATE_ORGANIZATION_SENTINEL" }],
  };
  type Row = { id: string; userId: string; tokenHash: string; expiresAt: Date };
  const sessions = new Map<string, Row>();
  const reads: { model: string; args: unknown }[] = [];
  let time = Date.parse("2026-11-24T14:00:00.000Z");
  const database = {
    user: {
      findUnique: async (args: { where: { id?: string; email?: string } }) => {
        reads.push({ model: "user", args });
        return args.where.id === user.id || args.where.email === user.email ? user : null;
      },
    },
    session: {
      create: async ({ data }: { data: Omit<Row, "id"> }) => {
        const row = { ...data, id: `session-${sessions.size}` };
        sessions.set(data.tokenHash, row);
        return row;
      },
      findUnique: async (args: { where: { tokenHash: string } }) => {
        reads.push({ model: "session", args });
        const row = sessions.get(args.where.tokenHash);
        return row ? { ...row, user } : null;
      },
      deleteMany: async ({ where }: { where: { tokenHash?: string; userId?: string } }) => {
        let count = 0;
        for (const [key, row] of sessions) {
          if (where.tokenHash === key || where.userId === row.userId) { sessions.delete(key); count++; }
        }
        return { count };
      },
    },
  } as unknown as AuthDatabase;
  const service = createAuthService(database, { secret: () => "test-secret-".repeat(5), now: () => new Date(time) });
  return { user, sessions, reads, database, service, advance: (milliseconds: number) => { time += milliseconds; } };
}
