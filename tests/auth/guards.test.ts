import assert from "node:assert/strict";
import { test } from "node:test";

import { RoleType } from "@prisma/client";

import { AuthError, authActionFailure, authErrorResponse } from "../../src/server/auth/errors";
import { createAuthGuards } from "../../src/server/auth/guards";
import type { AuthUser } from "../../src/server/auth/user";

const user: AuthUser = { id: "synthetic", email: "test@civicspec.local", displayName: "Synthetic User", roles: [RoleType.DEVELOPER, RoleType.REVIEWER] };
const redirect = (location: string): never => { throw new Error(`REDIRECT:${location}`); };

test("anonymous API/action guards carry 401 without redirecting", async () => {
  const guards = createAuthGuards({ resolveUser: async () => null, redirect });
  for (const kind of ["api", "action"] as const) {
    await assert.rejects(guards.requireAuthentication({ kind }), (error: unknown) => {
      assert.ok(error instanceof AuthError);
      assert.equal(error.status, 401);
      assert.equal(error.message, "Unauthorized");
      return true;
    });
  }
});

test("anonymous page guards redirect to sign-in with validated return paths", async () => {
  const guards = createAuthGuards({ resolveUser: async () => null, redirect });
  await assert.rejects(guards.requireAuthentication({ kind: "page", returnTo: "/projects?x=1" }), /REDIRECT:\/auth\?returnTo=%2Fprojects%3Fx%3D1/);
  await assert.rejects(guards.requireAuthentication({ kind: "page", returnTo: "https://evil.invalid" }), /REDIRECT:\/auth\?returnTo=%2Fapp$/);
});

test("authorized multi-role accounts pass explicit role checks; all other cases deny", async () => {
  const guards = createAuthGuards({ resolveUser: async () => user, redirect });
  assert.equal(await guards.requireAuthentication(), user);
  assert.equal(await guards.requireRole(RoleType.DEVELOPER), user);
  assert.equal(await guards.requireRole([RoleType.ADMIN, RoleType.REVIEWER]), user);
  for (const required of [RoleType.ADMIN, RoleType.PROBLEM_OWNER, []]) {
    await assert.rejects(guards.requireRole(required), (error: unknown) => error instanceof AuthError && error.status === 403 && error.message === "Forbidden");
  }
  const admin = createAuthGuards({ resolveUser: async () => ({ ...user, roles: [RoleType.ADMIN] }), redirect });
  await assert.rejects(admin.requireRole(RoleType.REVIEWER), (error: unknown) => error instanceof AuthError && error.status === 403);
});

test("API and serializable action errors are generic and carry no resource/identity data", async () => {
  for (const status of [401, 403] as const) {
    const error = new AuthError(status);
    const response = authErrorResponse(error);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: status === 401 ? "Unauthorized" : "Forbidden" });
    assert.deepEqual(authActionFailure(error), { ok: false, status, error: error.message });
  }
});
