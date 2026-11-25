import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";

import { loadEnvConfig } from "@next/env";
import { PrismaClient, RoleType } from "@prisma/client";

import { AuthError } from "../../src/server/auth/errors";
import { createAuthGuards } from "../../src/server/auth/guards";
import { hashPassword, verifyPassword } from "../../src/server/auth/password";
import { createAuthService, sessionMaxAge } from "../../src/server/auth/service";
import { sessionTokenHash } from "../../src/server/auth/session-token";

loadEnvConfig(process.cwd());

test("Neon/PostgreSQL authentication integration", async (context) => {
  assert.notEqual(process.env.NODE_ENV, "production", "Run auth database tests only against a development/test database.");
  assert.ok(process.env.DATABASE_URL, "Set DATABASE_URL before running database tests.");
  const prisma = new PrismaClient();
  const userId = `auth_test_${randomUUID()}`;
  const email = `${userId}@civicspec.local`;
  const secret = randomBytes(48).toString("base64url");
  let time = Date.now();
  const service = createAuthService(prisma, { secret: () => secret, now: () => new Date(time) });

  try {
    await context.test("all six seeded accounts accept the development password", async () => {
      for (const local of ["admin", "reviewer", "owner", "builder-priority", "builder-partner", "builder-open"]) {
        const user = await service.authenticatePassword(`${local}@civicspec.local`, "CivicSpecPilot123!");
        assert.ok(user, `Seeded ${local} credentials work`);
        assert.deepEqual(Object.keys(user).sort(), ["displayName", "email", "id", "roles"]);
      }
    });

    await prisma.user.create({
      data: {
        id: userId, email, displayName: "Synthetic Auth Integration Test",
        passwordHash: await hashPassword("Integration-only password!"),
        roles: { create: { role: RoleType.DEVELOPER } },
        priorityEligibility: { create: { status: "VERIFIED", attestationNote: "PRIVATE_PRIORITY_SENTINEL" } },
        partnerReferrals: { create: { status: "VERIFIED", partnerOrgName: "PRIVATE_REFERRAL_SENTINEL", consentRecorded: true } },
      },
    });
    const session = await service.createSession(userId);

    await context.test("database stores only token hashes and resolves an allowlisted user", async () => {
      const stored = await prisma.session.findUniqueOrThrow({ where: { tokenHash: sessionTokenHash(session.token) } });
      assert.ok(stored.tokenHash !== session.token);
      assert.equal(stored.userId, userId);
      assert.deepEqual(Object.keys(stored).sort(), ["createdAt", "expiresAt", "id", "tokenHash", "userId"]);
      assert.deepEqual(await service.resolveSession(session.token), { id: userId, email, displayName: "Synthetic Auth Integration Test", roles: [RoleType.DEVELOPER] });
      const credentialUser = await service.authenticatePassword(email, "Integration-only password!");
      assert.deepEqual(Object.keys(credentialUser!).sort(), ["displayName", "email", "id", "roles"]);
      assert.equal(await service.authenticatePassword(email, "wrong password"), null);
    });

    await context.test("suspension immediately rejects an already-issued session and password", async () => {
      await prisma.user.update({ where: { id: userId }, data: { isSuspended: true } });
      assert.equal(await service.resolveSession(session.token), null);
      assert.equal(await service.authenticatePassword(email, "Integration-only password!"), null);
      await assert.rejects(service.createSession(userId), (error: unknown) => error instanceof AuthError && error.status === 401);
      await prisma.user.update({ where: { id: userId }, data: { isSuspended: false } });
    });

    await context.test("guards deny unauthorized roles and immediately observe role revocation", async () => {
      const guards = createAuthGuards({
        resolveUser: () => service.resolveSession(session.token),
        redirect: (): never => { throw new Error("Unexpected page redirect"); },
      });
      await guards.requireRole(RoleType.DEVELOPER);
      await assert.rejects(guards.requireRole(RoleType.ADMIN), (error: unknown) => error instanceof AuthError && error.status === 403 && error.message === "Forbidden");
      await prisma.userRole.deleteMany({ where: { userId } });
      assert.deepEqual((await service.resolveSession(session.token))?.roles, []);
      await assert.rejects(guards.requireRole(RoleType.DEVELOPER), (error: unknown) => error instanceof AuthError && error.status === 403);
    });

    await context.test("expiry and revocation invalidate persisted sessions", async () => {
      time = session.expiresAt.getTime();
      assert.equal(await service.resolveSession(session.token), null);
      const renewed = await service.createSession(userId);
      assert.equal(renewed.expiresAt.getTime(), time + sessionMaxAge * 1000);
      await service.revokeSession(renewed.token);
      await service.revokeSession(renewed.token);
      assert.equal(await service.resolveSession(renewed.token), null);
      const storedPassword = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
      assert.equal(await verifyPassword("Integration-only password!", storedPassword.passwordHash), true);
    });

    await context.test("user deletion cascades sessions and prevents subsequent authentication", async () => {
      const last = await service.createSession(userId);
      await prisma.user.delete({ where: { id: userId } });
      assert.equal(await prisma.session.count({ where: { userId } }), 0);
      assert.equal(await service.resolveSession(last.token), null);
      assert.equal(await service.authenticatePassword(email, "Integration-only password!"), null);
    });
  } finally {
    // Only this run's randomly namespaced fixtures are removed. Seed accounts stay untouched.
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  }
});
