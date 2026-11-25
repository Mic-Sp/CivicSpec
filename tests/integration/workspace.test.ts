import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { AuthError } from "../../src/server/auth/errors";
import { createAuthService } from "../../src/server/auth/service";
import { createWorkspaceService, PreferenceInputError } from "../../src/server/workspace/preferences";

loadEnvConfig(process.cwd());

test("workspace authorization, privacy, and theme persistence in PostgreSQL", async context => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const prisma = new PrismaClient();
  const id = `workspace_test_${randomUUID()}`;
  const otherId = `${id}_other`;
  const secret = randomBytes(48).toString("base64url");
  const auth = createAuthService(prisma, { secret: () => secret });
  try {
    await prisma.user.create({ data: {
      id, email: `${id}@civicspec.local`, displayName: "Synthetic Workspace Test",
      roles: { create: [{ role: "ADMIN" }, { role: "REVIEWER" }] },
      priorityEligibility: { create: { status: "VERIFIED", attestationNote: "PRIVATE_PRIORITY_SENTINEL" } },
      partnerReferrals: { create: { partnerOrgName: "PRIVATE_REFERRAL_SENTINEL", status: "VERIFIED" } },
    } });
    await prisma.user.create({ data: { id: otherId, email: `${otherId}@civicspec.local`, displayName: "Synthetic Other Account", preference: { create: { theme: "LIGHT" } } } });
    const session = await auth.createSession(id);
    const service = createWorkspaceService(prisma, () => auth.resolveSession(session.token));

    await context.test("only authorized roles can become active; switching never grants roles", async () => {
      assert.equal((await service.read())?.activeRole, "ADMIN");
      const saved = await service.save({ expectedUserId: id, activeRole: "REVIEWER" });
      assert.deepEqual(saved.authorizedRoles.slice().sort(), ["ADMIN", "REVIEWER"]);
      assert.equal(saved.activeRole, "REVIEWER");
      assert.equal((await prisma.userPreference.findUniqueOrThrow({ where: { userId: id } })).activeRole, "REVIEWER");
      await assert.rejects(service.save({ expectedUserId: id, activeRole: "DEVELOPER" }), (error: unknown) => error instanceof AuthError && error.status === 403);
      await assert.rejects(service.save({ expectedUserId: id, activeRole: "PROBLEM_OWNER" }), (error: unknown) => error instanceof AuthError && error.status === 403);
      assert.equal(await prisma.userRole.count({ where: { userId: id } }), 2);
    });

    await context.test("Light/Dark/System persist without overwriting active-role preference", async () => {
      for (const [theme, expected] of [["light", "LIGHT"], ["dark", "DARK"], ["system", "SYSTEM"]] as const) {
        await service.save({ expectedUserId: id, theme });
        const stored = await prisma.userPreference.findUniqueOrThrow({ where: { userId: id } });
        assert.equal(stored.theme, expected); assert.equal(stored.activeRole, "REVIEWER");
        assert.equal((await service.read())?.theme, theme);
      }
      await service.save({ expectedUserId: id, theme: "dark" });
      await service.save({ expectedUserId: id, activeRole: "ADMIN" });
      assert.equal((await prisma.userPreference.findUniqueOrThrow({ where: { userId: id } })).theme, "DARK");
    });

    await context.test("forged actor/fields cannot change another account's preference", async () => {
      const before = await prisma.userPreference.findUniqueOrThrow({ where: { userId: otherId } });
      await assert.rejects(service.save({ expectedUserId: otherId, theme: "dark" }), (error: unknown) => error instanceof AuthError && error.status === 403);
      await assert.rejects(service.save({ expectedUserId: id, userId: otherId, theme: "dark" }), PreferenceInputError);
      assert.deepEqual(await prisma.userPreference.findUniqueOrThrow({ where: { userId: otherId } }), before);
    });

    await context.test("workspace DTO contains no confidential eligibility/referral attributes", async () => {
      const result = await service.read();
      assert.deepEqual(Object.keys(result!).sort(), ["activeRole", "theme", "user"]);
      assert.deepEqual(Object.keys(result!.user).sort(), ["displayName", "email", "id", "roles"]);
      assert.ok(!/PRIVATE_|priorityEligibility|partnerReferrals|attestation|github|passwordHash/.test(JSON.stringify(result)));
    });

    await context.test("revoked roles are ignored on read and rejected on write", async () => {
      await service.save({ expectedUserId: id, activeRole: "REVIEWER" });
      await prisma.userRole.deleteMany({ where: { userId: id, role: "REVIEWER" } });
      assert.equal((await service.read())?.activeRole, "ADMIN");
      await assert.rejects(service.save({ expectedUserId: id, activeRole: "REVIEWER" }), (error: unknown) => error instanceof AuthError && error.status === 403);
      assert.equal(await prisma.userRole.count({ where: { userId: id } }), 1);
    });

    await context.test("suspended, revoked-session, and roleless actors are enforced server-side", async () => {
      await prisma.user.update({ where: { id }, data: { isSuspended: true } });
      assert.equal(await service.read(), null);
      await assert.rejects(service.save({ expectedUserId: id, theme: "light" }), (error: unknown) => error instanceof AuthError && error.status === 401);
      await prisma.user.update({ where: { id }, data: { isSuspended: false } });
      await prisma.userRole.deleteMany({ where: { userId: id } });
      assert.equal((await service.read())?.activeRole, null);
      await assert.rejects(service.save({ expectedUserId: id, activeRole: "ADMIN" }), (error: unknown) => error instanceof AuthError && error.status === 403);
      await service.save({ expectedUserId: id, theme: "light" });
      await auth.revokeSession(session.token);
      assert.equal(await service.read(), null);
    });
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [id, otherId] } } });
    await prisma.$disconnect();
  }
});
