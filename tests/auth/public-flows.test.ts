import assert from "node:assert/strict";
import { test } from "node:test";

import { Prisma, RoleType } from "@prisma/client";

import { AuthError } from "../../src/server/auth/errors";
import { loginFailure, participationTermsVersion, registrationFailure } from "../../src/server/auth/form-state";
import { authDestination } from "../../src/server/auth/navigation";
import { requireAuthOrigin } from "../../src/server/auth/origin";
import { verifyPassword } from "../../src/server/auth/password";
import { createPublicAuthFlows } from "../../src/server/auth/public-flows";
import { authFormInput, registrationSchema, signInSchema } from "../../src/server/auth/public-validation";
import type { AuthUser } from "../../src/server/auth/user";

function fixture() {
  const user = { id: "public-auth-test", email: "new@civicspec.local", displayName: "Synthetic User", isSuspended: false, roles: [] as { role: RoleType }[] };
  let authenticated: AuthUser | null = { ...user, roles: [] };
  let credentialsValid = true;
  let allowed = true;
  let duplicate = false;
  const creates: { data: Prisma.UserCreateInput }[] = [];
  const grants: { userId: string; role: RoleType }[] = [];
  const receipts: unknown[] = [];
  const sessions: string[] = [];
  const tx = {
    $queryRaw: async () => [{ id: user.id }],
    user: { findUnique: async () => user },
    userRole: { create: async ({ data }: { data: { userId: string; role: RoleType } }) => { grants.push(data); user.roles.push({ role: data.role }); } },
    developerProfile: { upsert: async () => ({}) },
    auditEvent: { create: async (args: unknown) => { receipts.push(args); } },
  };
  const database = {
    user: { create: async (args: { data: Prisma.UserCreateInput }) => {
      if (duplicate) throw new Prisma.PrismaClientKnownRequestError("private constraint", { code: "P2002", clientVersion: "test" });
      creates.push(args); return user;
    } },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
  } as unknown as Parameters<typeof createPublicAuthFlows>[0]["database"];
  const flows = createPublicAuthFlows({
    database,
    authenticatePassword: async () => credentialsValid ? authenticated : null,
    resolveUser: async () => authenticated,
    startSession: async (id) => { sessions.push(id); return authenticated!; },
    limit: async () => allowed,
  });
  return { flows, user, creates, grants, receipts, sessions,
    login: (value: AuthUser | null) => { authenticated = value; },
    invalidCredentials: () => { credentialsValid = false; },
    block: () => { allowed = false; }, duplicate: () => { duplicate = true; },
  };
}

const registration = { displayName: "  Synthetic Name  ", email: " NEW@CIVICSPEC.LOCAL ", password: "Aa1!bcde", returnTo: "/app?from=register" };
const onboarding = { intent: "DEVELOPER", acceptedTerms: "on", termsVersion: participationTermsVersion, returnTo: "/app" };

test("registration hashes passwords, normalizes identity, creates SYSTEM preference and no roles", async () => {
  const f = fixture();
  const result = await f.flows.register(registration);
  assert.deepEqual(result, { ok: true, redirectTo: "/app/onboarding?returnTo=%2Fapp%3Ffrom%3Dregister" });
  const data = f.creates[0].data;
  assert.equal(data.email, "new@civicspec.local");
  assert.equal(data.displayName, "Synthetic Name");
  assert.equal(await verifyPassword(registration.password, data.passwordHash), true);
  assert.deepEqual(data.preference, { create: { theme: "SYSTEM" } });
  assert.equal("roles" in data, false);
  assert.deepEqual(f.sessions, [f.user.id]);
});

test("duplicate registration uses a generic message and never creates a session", async () => {
  const f = fixture(); f.duplicate();
  assert.deepEqual(await f.flows.register(registration), { ok: false, state: { status: "error", message: registrationFailure, fieldErrors: {} } });
  assert.equal(f.sessions.length, 0);
});

test("invalid registration and injected privileges never reach account creation", async () => {
  const f = fixture();
  for (const input of [{ ...registration, password: "short" }, { ...registration, displayName: "" }, { ...registration, email: "bad" }, { ...registration, roles: ["ADMIN"] }]) {
    assert.equal((await f.flows.register(input)).ok, false);
  }
  assert.equal(f.creates.length, 0);
  assert.equal(f.sessions.length, 0);
});

test("registration accepts 8/128-character boundaries, Unicode classes, and the seed password", () => {
  for (const password of ["Aa1!bcde", "Aa1!" + "x".repeat(124), "Ää١!bcde", " Aa1!bcde ", "CivicSpecPilot123!"]) {
    const result = registrationSchema.safeParse({ ...registration, password });
    assert.equal(result.success, true);
    if (result.success) assert.equal(result.data.password, password);
  }
});

test("registration rejects every missing password requirement before account/session creation", async () => {
  const cases = [
    ["Aa1!bcd", "Use at least 8 characters."],
    ["Aa1!" + "x".repeat(125), "Use 128 characters or fewer."],
    ["aa1!bcde", "Add at least one uppercase letter."],
    ["AA1!BCDE", "Add at least one lowercase letter."],
    ["Aa!!bcde", "Add at least one number."],
    ["Aa12bcde", "Add at least one symbol, such as !, @, or #."],
    ["Aa1 bcde", "Add at least one symbol, such as !, @, or #."],
  ];
  const f = fixture();
  for (const [password, message] of cases) {
    const result = await f.flows.register({ ...registration, password });
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.state.fieldErrors.password, message);
  }
  assert.equal(f.creates.length, 0); assert.equal(f.sessions.length, 0);
});

test("sign-in validation does not impose registration composition or length minimums", () => {
  for (const password of ["old", "legacy password", "x".repeat(129)]) {
    assert.equal(signInSchema.safeParse({ email: "existing@civicspec.local", password }).success, true);
    assert.equal(registrationSchema.safeParse({ ...registration, password }).success, false);
  }
});

test("all failed credential lookups return the same generic login failure", async () => {
  const f = fixture(); f.invalidCredentials();
  for (const email of ["missing@civicspec.local", "suspended@civicspec.local", "known@civicspec.local"]) {
    assert.deepEqual(await f.flows.signIn({ email, password: "wrong password" }), { ok: false, state: { status: "error", message: loginFailure, fieldErrors: {} } });
  }
  assert.equal(f.sessions.length, 0);
});

test("sign-in honors safe paths; roleless accounts always go through onboarding", async () => {
  const f = fixture();
  f.login({ id: f.user.id, email: f.user.email, displayName: f.user.displayName, roles: [RoleType.REVIEWER] });
  assert.deepEqual(await f.flows.signIn({ email: f.user.email, password: "valid", returnTo: "/app?tab=work#next" }), { ok: true, redirectTo: "/app?tab=work#next" });
  for (const returnTo of ["https://evil.invalid", "//evil.invalid", "/%2fevil.invalid", "/auth", "/auth?returnTo=/auth", "/app/onboarding"]) {
    assert.deepEqual(await f.flows.signIn({ email: f.user.email, password: "valid", returnTo }), { ok: true, redirectTo: "/app" });
  }
  f.login({ id: f.user.id, email: f.user.email, displayName: f.user.displayName, roles: [] });
  assert.deepEqual(await f.flows.signIn({ email: f.user.email, password: "valid", returnTo: "/app?x=1" }), { ok: true, redirectTo: "/app/onboarding?returnTo=%2Fapp%3Fx%3D1" });
  assert.equal(authDestination(undefined), "/app");
});

test("onboarding grants only participant roles and stores versioned terms acknowledgement", async () => {
  for (const intent of ["PROBLEM_OWNER", "DEVELOPER"]) {
    const f = fixture();
    assert.deepEqual(await f.flows.onboard({ ...onboarding, intent }), { ok: true, redirectTo: "/app" });
    assert.deepEqual(f.grants, [{ userId: f.user.id, role: intent }]);
    assert.equal(f.receipts.length, 1);
    assert.match(JSON.stringify(f.receipts), /PARTICIPATION_TERMS_ACCEPTED/);
    assert.match(JSON.stringify(f.receipts), new RegExp(participationTermsVersion));
  }
});

test("privileged roles, forged identity, unknown fields, missing terms, and stale terms are rejected", async () => {
  const f = fixture();
  for (const input of [
    { ...onboarding, intent: "ADMIN" }, { ...onboarding, intent: "REVIEWER" }, { ...onboarding, intent: ["DEVELOPER", "ADMIN"] },
    { ...onboarding, userId: "another-account" }, { ...onboarding, role: "ADMIN" },
    { ...onboarding, acceptedTerms: undefined }, { ...onboarding, acceptedTerms: "false" }, { ...onboarding, termsVersion: "old-version" },
  ]) assert.equal((await f.flows.onboard(input)).ok, false);
  assert.equal(f.grants.length, 0); assert.equal(f.receipts.length, 0); assert.equal(f.sessions.length, 0);
});

test("onboarding rechecks authentication, suspension, and existing roles", async () => {
  const f = fixture(); f.login(null);
  assert.deepEqual(await f.flows.onboard(onboarding), { ok: true, redirectTo: "/auth?returnTo=%2Fapp%2Fonboarding" });
  f.login({ id: f.user.id, email: f.user.email, displayName: f.user.displayName, roles: [] });
  f.user.isSuspended = true;
  await assert.rejects(f.flows.onboard(onboarding), (error: unknown) => error instanceof AuthError && error.status === 401);
  f.user.isSuspended = false; f.user.roles.push({ role: RoleType.ADMIN });
  assert.deepEqual(await f.flows.onboard(onboarding), { ok: true, redirectTo: "/app" });
  assert.equal(f.grants.length, 0); assert.equal(f.receipts.length, 0);
});

test("throttled flows do not authenticate, register, or grant a role", async () => {
  const f = fixture(); f.block();
  for (const result of [await f.flows.signIn({ email: f.user.email, password: "password" }), await f.flows.register(registration), await f.flows.onboard(onboarding)]) {
    assert.equal(result.ok, false);
  }
  assert.equal(f.sessions.length, 0); assert.equal(f.creates.length, 0); assert.equal(f.grants.length, 0);
});

test("CSRF checks require the configured origin and reject cross-site or forwarded-host spoofing", () => {
  assert.doesNotThrow(() => requireAuthOrigin(new Headers({ origin: "https://civicspec.invalid", "sec-fetch-site": "same-origin" }), "https://civicspec.invalid"));
  for (const headers of [new Headers(), new Headers({ origin: "https://evil.invalid", "x-forwarded-host": "evil.invalid" }), new Headers({ origin: "https://civicspec.invalid", "sec-fetch-site": "cross-site" }), new Headers({ origin: "https://civicspec.invalid.evil.invalid" })]) {
    assert.throws(() => requireAuthOrigin(headers, "https://civicspec.invalid"), (error: unknown) => error instanceof AuthError && error.status === 403);
  }
});

test("duplicate form fields fail schema validation and prototype keys remain inert", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries(onboarding)) form.set(key, value);
  form.append("intent", "ADMIN"); form.set("__proto__", "untrusted"); form.set("$ACTION_ID_framework", "not input");
  const input = authFormInput(form);
  assert.equal(Object.getPrototypeOf(input), null);
  assert.deepEqual(input.intent, ["DEVELOPER", "ADMIN"]);
  assert.equal(input.__proto__, "untrusted");
  assert.equal("$ACTION_ID_framework" in input, false);
  const f = fixture(); assert.equal((await f.flows.onboard(input)).ok, false); assert.equal(f.grants.length, 0);
});
