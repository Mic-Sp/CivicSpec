import assert from "node:assert/strict";
import { test } from "node:test";

import { RoleType } from "@prisma/client";

import { AuthError } from "../../src/server/auth/errors";
import { hashPassword } from "../../src/server/auth/password";
import { createAuthService, sessionMaxAge } from "../../src/server/auth/service";
import { sessionTokenHash } from "../../src/server/auth/session-token";
import { authUserSelect, projectAuthUser } from "../../src/server/auth/user";
import { memoryAuth } from "./fixtures";

test("password authentication rejects wrong, unknown, unset, and suspended accounts generically", async () => {
  const fixture = memoryAuth(await hashPassword("CivicSpecPilot123!"));
  assert.deepEqual(await fixture.service.authenticatePassword(" TEST@CIVICSPEC.LOCAL ", "CivicSpecPilot123!"), projectAuthUser(fixture.user));
  assert.equal(await fixture.service.authenticatePassword(fixture.user.email, "wrong password"), null);
  assert.equal(await fixture.service.authenticatePassword("missing@civicspec.local", "CivicSpecPilot123!"), null);
  assert.equal(await fixture.service.authenticatePassword("", "CivicSpecPilot123!"), null);
  assert.equal(await fixture.service.authenticatePassword(null, "CivicSpecPilot123!"), null);
  assert.equal(await fixture.service.authenticatePassword(fixture.user.email, {}), null);
  fixture.user.isSuspended = true;
  assert.equal(await fixture.service.authenticatePassword(fixture.user.email, "CivicSpecPilot123!"), null);
  fixture.user.isSuspended = false;
  fixture.user.passwordHash = null;
  assert.equal(await fixture.service.authenticatePassword(fixture.user.email, "CivicSpecPilot123!"), null);
});

test("shared credential/session projections allow only identity and authorized roles", async () => {
  const fixture = memoryAuth(await hashPassword("CivicSpecPilot123!"));
  fixture.user.roles.push({ role: RoleType.ADMIN }, { role: RoleType.REVIEWER });
  Object.assign(fixture.user.roles[0], { referral: "PRIVATE_NESTED_ROLE_SENTINEL" });
  const expected = { id: fixture.user.id, email: fixture.user.email, displayName: fixture.user.displayName, roles: [RoleType.REVIEWER, RoleType.ADMIN] };
  const credentialUser = await fixture.service.authenticatePassword(fixture.user.email, "CivicSpecPilot123!");
  const session = await fixture.service.createSession(fixture.user.id);
  const resolved = await fixture.service.resolveSession(session.token);
  for (const user of [credentialUser, session.user, resolved]) {
    assert.deepEqual(user, expected);
    assert.ok(!/PRIVATE_|priority|referral|passwordHash|suspendReason|organization/i.test(JSON.stringify(user)));
    assert.equal(Object.isFrozen(user), true);
    assert.equal(Object.isFrozen(user?.roles), true);
  }
  assert.deepEqual(authUserSelect, { id: true, email: true, displayName: true, isSuspended: true, roles: { select: { role: true } } });
  assert.deepEqual(fixture.reads[0].args, {
    where: { email: fixture.user.email }, select: { ...authUserSelect, passwordHash: true },
  });
  const sessionQuery = fixture.reads.find(read => read.model === "session");
  assert.deepEqual(sessionQuery?.args, {
    where: { tokenHash: sessionTokenHash(session.token) },
    select: { expiresAt: true, user: { select: authUserSelect } },
  });
});

test("sessions are random, signed opaque tokens; only hashes are persisted", async () => {
  const fixture = memoryAuth();
  const first = await fixture.service.createSession(fixture.user.id);
  const second = await fixture.service.createSession(fixture.user.id);
  assert.notEqual(first.token, second.token);
  assert.match(first.token, /^v1\.[\w-]{43}\.[\w-]{43}$/);
  assert.ok(!first.token.includes(fixture.user.id) && !first.token.includes(fixture.user.email));
  assert.equal(fixture.sessions.size, 2);
  const stored = fixture.sessions.get(sessionTokenHash(first.token));
  assert.equal(stored?.tokenHash.length, 64);
  assert.ok(!JSON.stringify([...fixture.sessions.values()]).includes(first.token));
  assert.equal(await fixture.service.resolveSession(first.token) !== null, true);
});

test("missing, malformed, tampered, and differently signed cookies never reach the database", async () => {
  const fixture = memoryAuth();
  const session = await fixture.service.createSession(fixture.user.id);
  const otherKey = createAuthService(fixture.database, { secret: () => "different-secret-".repeat(4) });
  const lookups = fixture.reads.length;
  for (const token of [undefined, "", "malformed", session.token + ".extra", session.token.replace("v1.", "v2."), `v1.${session.token[3] === "A" ? "B" : "A"}${session.token.slice(4)}`]) {
    assert.equal(await fixture.service.resolveSession(token), null);
  }
  assert.equal(await otherKey.resolveSession(session.token), null);
  assert.equal(fixture.reads.length, lookups);
});

test("suspension and role changes affect an existing session on its next lookup", async () => {
  const fixture = memoryAuth();
  const session = await fixture.service.createSession(fixture.user.id);
  assert.deepEqual((await fixture.service.resolveSession(session.token))?.roles, [RoleType.REVIEWER]);
  fixture.user.roles = [{ role: RoleType.DEVELOPER }];
  assert.deepEqual((await fixture.service.resolveSession(session.token))?.roles, [RoleType.DEVELOPER]);
  fixture.user.isSuspended = true;
  assert.equal(await fixture.service.resolveSession(session.token), null);
  await assert.rejects(fixture.service.createSession(fixture.user.id), (error: unknown) => error instanceof AuthError && error.status === 401);
});

test("expiry is enforced at the exact boundary and revocation is immediate/idempotent", async () => {
  const fixture = memoryAuth();
  const session = await fixture.service.createSession(fixture.user.id);
  fixture.advance(sessionMaxAge * 1000 - 1);
  assert.notEqual(await fixture.service.resolveSession(session.token), null);
  fixture.advance(1);
  assert.equal(await fixture.service.resolveSession(session.token), null);
  const other = await fixture.service.createSession(fixture.user.id);
  await fixture.service.revokeSession(other.token);
  await fixture.service.revokeSession(other.token);
  assert.equal(await fixture.service.resolveSession(other.token), null);
  await fixture.service.revokeUserSessions(fixture.user.id);
  assert.equal(fixture.sessions.size, 0);
});

test("missing users or signing secrets cannot create sessions", async () => {
  const fixture = memoryAuth();
  await assert.rejects(fixture.service.createSession("missing"), (error: unknown) => error instanceof AuthError && error.status === 401);
  const noKey = createAuthService(fixture.database, { secret: () => "" });
  await assert.rejects(noKey.createSession(fixture.user.id), /AUTH_SECRET/);
  assert.equal(fixture.sessions.size, 0);
});

test("database failures reject instead of allowing cached or cookie-only authentication", async () => {
  const fixture = memoryAuth();
  const session = await fixture.service.createSession(fixture.user.id);
  fixture.database.session.findUnique = () => { throw new Error("database unavailable"); };
  await assert.rejects(fixture.service.resolveSession(session.token), /database unavailable/);
});
