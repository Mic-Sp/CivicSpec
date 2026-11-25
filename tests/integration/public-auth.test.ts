import assert from "node:assert/strict";
import { createHmac, randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";

import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";

import { AuthError } from "../../src/server/auth/errors";
import { loginFailure, participationTermsVersion, registrationFailure } from "../../src/server/auth/form-state";
import { createPublicAuthFlows } from "../../src/server/auth/public-flows";
import { createAuthRateLimit } from "../../src/server/auth/rate-limit";
import { createAuthService } from "../../src/server/auth/service";
import { hashPassword } from "../../src/server/auth/password";

loadEnvConfig(process.cwd());

test("public auth and onboarding database security", async (context) => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const prisma = new PrismaClient();
  const prefix = `flow_test_${randomUUID()}`;
  const emails = ["main", "concurrent", "owner", "rollback", "policy-invalid", "policy-max", "legacy"].map(name => `${prefix}_${name}@civicspec.local`);
  const secret = randomBytes(48).toString("base64url");
  const auth = createAuthService(prisma, { secret: () => secret });
  let token: string | undefined;
  const dependencies = {
    database: prisma,
    authenticatePassword: auth.authenticatePassword,
    resolveUser: () => auth.resolveSession(token),
    startSession: async (userId: string) => { const session = await auth.createSession(userId); token = session.token; return session.user; },
    limit: async () => true,
  };
  const flows = createPublicAuthFlows(dependencies);
  const password = "Aa1!bcde";
  const registration = (email: string) => ({ displayName: "Synthetic Public Flow Test", email, password, returnTo: "/app?source=registration" });
  const onboarding = { intent: "DEVELOPER", acceptedTerms: "on", termsVersion: participationTermsVersion, returnTo: "/app" };
  const rateIdentity = `${prefix}-rate`;
  const rateKey = (identity: string) => createHmac("sha256", secret).update(`auth-limit:sign-in-account:${identity}`).digest("hex");
  try {
    await context.test("8-character registration atomically creates a working password and SYSTEM preference without roles", async () => {
      const result = await flows.register(registration(emails[0].toUpperCase()));
      assert.deepEqual(result, { ok: true, redirectTo: "/app/onboarding?returnTo=%2Fapp%3Fsource%3Dregistration" });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] }, include: { preference: true, roles: true } });
      assert.equal(user.preference?.theme, "SYSTEM"); assert.equal(user.roles.length, 0);
      assert.ok(user.passwordHash?.startsWith("scrypt$"));
      assert.notEqual(await auth.authenticatePassword(emails[0], password), null);
    });

    await context.test("each invalid password policy case creates no database account or session", async () => {
      const before = await prisma.session.count();
      for (const password of ["Aa1!bcd", "aa1!bcde", "AA1!BCDE", "Aa!!bcde", "Aa12bcde", "Aa1 bcde", "Aa1!" + "x".repeat(125)]) {
        const result = await flows.register({ ...registration(emails[4]), password });
        assert.equal(result.ok, false);
        if (!result.ok) assert.ok(result.state.fieldErrors.password);
        assert.equal(await prisma.user.count({ where: { email: emails[4] } }), 0);
      }
      assert.equal(await prisma.session.count(), before);
    });

    await context.test("128-character registration passwords remain valid", async () => {
      const password = "Aa1!" + "x".repeat(124);
      assert.equal((await flows.register({ ...registration(emails[5]), password })).ok, true);
      assert.notEqual(await auth.authenticatePassword(emails[5], password), null);
    });

    await context.test("an existing password without the new composition requirements still signs in", async () => {
      const password = "legacy password";
      await prisma.user.create({ data: { email: emails[6], displayName: "Synthetic Legacy Account", passwordHash: await hashPassword(password), roles: { create: { role: "DEVELOPER" } } } });
      assert.deepEqual(await flows.signIn({ email: emails[6], password }), { ok: true, redirectTo: "/app" });
    });

    await context.test("duplicate registration does not overwrite credentials or issue a session", async () => {
      const before = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] } });
      const sessionCount = await prisma.session.count({ where: { userId: before.id } });
      const result = await flows.register({ ...registration(emails[0]), password: "Different123! attempted password" });
      assert.deepEqual(result, { ok: false, state: { status: "error", message: registrationFailure, fieldErrors: {} } });
      assert.deepEqual(await prisma.user.findUniqueOrThrow({ where: { email: emails[0] } }), before);
      assert.equal(await prisma.session.count({ where: { userId: before.id } }), sessionCount);
    });

    await context.test("parallel duplicate registrations create exactly one account", async () => {
      const results = await Promise.all([flows.register(registration(emails[1])), flows.register(registration(emails[1]))]);
      assert.equal(results.filter(result => result.ok).length, 1);
      assert.equal(await prisma.user.count({ where: { email: emails[1] } }), 1);
    });

    await context.test("generic failures cover unknown, wrong-password, and suspended users", async () => {
      const expected = { ok: false, state: { status: "error", message: loginFailure, fieldErrors: {} } };
      for (const email of [emails[0], `${prefix}_missing@civicspec.local`]) assert.deepEqual(await flows.signIn({ email, password: "Wrong password" }), expected);
      await prisma.user.update({ where: { email: emails[0] }, data: { isSuspended: true } });
      assert.deepEqual(await flows.signIn({ email: emails[0], password }), expected);
      await prisma.user.update({ where: { email: emails[0] }, data: { isSuspended: false } });
    });

    await context.test("forged privileged roles, alternate identities, and missing terms write nothing", async () => {
      await flows.signIn({ email: emails[0], password });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] } });
      for (const input of [{ ...onboarding, intent: "ADMIN" }, { ...onboarding, intent: "REVIEWER" }, { ...onboarding, userId: "another-user" }, { ...onboarding, acceptedTerms: undefined }]) assert.equal((await flows.onboard(input)).ok, false);
      assert.equal(await prisma.userRole.count({ where: { userId: user.id } }), 0);
      assert.equal(await prisma.auditEvent.count({ where: { entityId: user.id } }), 0);
    });

    await context.test("parallel onboarding grants one role and one terms receipt", async () => {
      const results = await Promise.all([flows.onboard(onboarding), flows.onboard({ ...onboarding, intent: "PROBLEM_OWNER" })]);
      assert.ok(results.every(result => result.ok));
      const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] }, include: { roles: true } });
      assert.equal(user.roles.length, 1);
      assert.ok(["DEVELOPER", "PROBLEM_OWNER"].includes(user.roles[0].role));
      const receipts = await prisma.auditEvent.findMany({ where: { entityId: user.id, action: "PARTICIPATION_TERMS_ACCEPTED" } });
      assert.equal(receipts.length, 1);
      assert.deepEqual(receipts[0].metadata, { termsVersion: participationTermsVersion, initialRole: user.roles[0].role, voluntary: true, noncommercial: true });
      await flows.onboard(onboarding);
      assert.equal(await prisma.userRole.count({ where: { userId: user.id } }), 1);
      assert.equal(await prisma.auditEvent.count({ where: { entityId: user.id } }), 1);
      assert.deepEqual(await flows.signIn({ email: emails[0], password, returnTo: "//evil.invalid" }), { ok: true, redirectTo: "/app" });
      assert.deepEqual(await flows.signIn({ email: emails[0], password, returnTo: "/app?from=safe#next" }), { ok: true, redirectTo: "/app?from=safe#next" });
    });

    await context.test("owner onboarding grants only owner access", async () => {
      await flows.register(registration(emails[2]));
      await flows.onboard({ ...onboarding, intent: "PROBLEM_OWNER" });
      const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[2] }, include: { roles: true } });
      assert.deepEqual(user.roles.map(role => role.role), ["PROBLEM_OWNER"]);
      assert.equal(await prisma.developerProfile.count({ where: { userId: user.id } }), 0);
    });

    await context.test("failed receipt persistence rolls back role and developer profile", async () => {
      await flows.register(registration(emails[3]));
      const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[3] } });
      const failingDatabase = prisma.$extends({ query: { auditEvent: { create() { throw new Error("Synthetic receipt failure"); } } } });
      // Prisma extensions retain the same runtime transaction/query contract but
      // expose different overloaded generic types from the base client.
      const failingFlows = createPublicAuthFlows({ ...dependencies, database: failingDatabase as unknown as Parameters<typeof createPublicAuthFlows>[0]["database"] });
      await assert.rejects(failingFlows.onboard(onboarding), /Synthetic receipt failure/);
      assert.equal(await prisma.userRole.count({ where: { userId: user.id } }), 0);
      assert.equal(await prisma.developerProfile.count({ where: { userId: user.id } }), 0);
      assert.equal(await prisma.auditEvent.count({ where: { entityId: user.id } }), 0);
      await prisma.user.update({ where: { id: user.id }, data: { isSuspended: true } });
      const staleUser = { id: user.id, email: user.email, displayName: user.displayName, roles: [] };
      const stale = createPublicAuthFlows({ ...dependencies, resolveUser: async () => staleUser });
      await assert.rejects(stale.onboard(onboarding), (error: unknown) => error instanceof AuthError && error.status === 401);
    });

    await context.test("database throttles are atomic across instances and reset at the boundary", async () => {
      let now = new Date();
      const first = createAuthRateLimit(prisma, secret, () => now);
      const second = createAuthRateLimit(prisma, secret, () => now);
      const allowed = await Promise.all(Array.from({ length: 20 }, (_, index) => (index % 2 ? first : second)("sign-in-account", rateIdentity)));
      assert.equal(allowed.filter(Boolean).length, 10);
      assert.equal(await second("sign-in-account", rateIdentity), false);
      const stored = await prisma.authRateLimit.findUniqueOrThrow({ where: { key: rateKey(rateIdentity) } });
      assert.ok(!stored.key.includes(rateIdentity));
      now = new Date(stored.resetsAt);
      assert.equal(await first("sign-in-account", rateIdentity), true);
    });
  } finally {
    // Test teardown removes only this run's isolated synthetic records. Runtime
    // audit receipts are append-only and are never updated/deleted by the flow.
    const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
    const ids = users.map(user => user.id);
    await prisma.auditEvent.deleteMany({ where: { entityId: { in: ids }, action: "PARTICIPATION_TERMS_ACCEPTED" } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.authRateLimit.deleteMany({ where: { key: rateKey(rateIdentity) } });
    await prisma.$disconnect();
  }
});
