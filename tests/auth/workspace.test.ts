import assert from "node:assert/strict";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import type { RoleType, ThemePreference as DatabaseTheme } from "@prisma/client";

import { selectWorkspaceRole, workspaceContent } from "../../src/lib/workspace";
import { THEME_STORAGE_KEY, themeInitializationScript } from "../../src/lib/theme";
import { AuthError } from "../../src/server/auth/errors";
import type { AuthUser } from "../../src/server/auth/user";
import { createWorkspaceService, PreferenceInputError } from "../../src/server/workspace/preferences";
import { createPreferencePost } from "../../src/server/workspace/http";

function fixture(roles: RoleType[] = ["DEVELOPER"]) {
  const user = { id: "workspace-test", email: "test@civicspec.local", displayName: "Synthetic Workspace User", roles,
    priorityEligibility: { status: "VERIFIED", attestationNote: "PRIVATE_PRIORITY_SENTINEL" }, partnerReferrals: [{ partnerOrgName: "PRIVATE_REFERRAL_SENTINEL" }] };
  let authenticated: AuthUser | null = user;
  const current = { id: user.id, email: user.email, displayName: user.displayName, isSuspended: false, roles: roles.map(role => ({ role })) };
  let preference: { theme: DatabaseTheme; activeRole: RoleType | null } | null = null;
  const writes: unknown[] = [];
  const reads: unknown[] = [];
  const delegate = {
    findUnique: async (args: unknown) => { reads.push(args); return preference; },
    upsert: async ({ create, update }: { create: { theme?: DatabaseTheme; activeRole?: RoleType }; update: { theme?: DatabaseTheme; activeRole?: RoleType } }) => {
      writes.push({ create, update });
      preference = { ...(preference ?? { theme: create.theme ?? "SYSTEM", activeRole: create.activeRole ?? null }), ...update };
      return preference;
    },
  };
  const tx = { $queryRaw: async () => [{ id: user.id }], user: { findUnique: async () => current }, userPreference: delegate };
  const database = { userPreference: delegate, $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as Parameters<typeof createWorkspaceService>[0];
  const service = createWorkspaceService(database, async () => authenticated);
  return { user, current, service, writes, reads, logout: () => { authenticated = null; }, stored: () => preference,
    setPreference: (value: typeof preference) => { preference = value; } };
}

test("active role is always an assigned role, including stale/forged preference fallbacks", () => {
  assert.equal(selectWorkspaceRole(["ADMIN", "REVIEWER"], "REVIEWER"), "REVIEWER");
  assert.equal(selectWorkspaceRole(["DEVELOPER"], "ADMIN"), "DEVELOPER");
  assert.equal(selectWorkspaceRole([], "ADMIN"), null);
  assert.equal(selectWorkspaceRole(["REVIEWER", "ADMIN"], null), "ADMIN");
  for (const role of ["ADMIN", "REVIEWER", "PROBLEM_OWNER", "DEVELOPER"] as const) {
    assert.ok(workspaceContent[role].sections.length > 0);
    assert.ok(!/MISSION_PRIORITY|PARTNER_PRIORITY|priority eligibility|partner referral|justice.impacted/i.test(JSON.stringify(workspaceContent[role])));
  }
});

test("workspace reads select only own theme/role and explicitly project basic identity", async () => {
  const f = fixture();
  const result = await f.service.read();
  assert.deepEqual(result, { user: { id: f.user.id, email: f.user.email, displayName: f.user.displayName, roles: ["DEVELOPER"] }, theme: "system", activeRole: "DEVELOPER" });
  assert.ok(!/PRIVATE_|eligibility|referral/i.test(JSON.stringify(result)));
  assert.deepEqual(f.reads, [{ where: { userId: f.user.id }, select: { theme: true, activeRole: true } }]);
  f.setPreference({ theme: "DARK", activeRole: "ADMIN" });
  assert.equal((await f.service.read())?.activeRole, "DEVELOPER");
  f.logout(); assert.equal(await f.service.read(), null);
});

test("theme writes persist all three values and do not overwrite the selected role", async () => {
  const f = fixture(["ADMIN", "REVIEWER"]);
  await f.service.save({ expectedUserId: f.user.id, activeRole: "REVIEWER" });
  for (const [theme, stored] of [["light", "LIGHT"], ["dark", "DARK"], ["system", "SYSTEM"]] as const) {
    const result = await f.service.save({ expectedUserId: f.user.id, theme });
    assert.deepEqual(result, { theme, activeRole: "REVIEWER", authorizedRoles: ["ADMIN", "REVIEWER"] });
    assert.deepEqual(f.stored(), { theme: stored, activeRole: "REVIEWER" });
  }
  assert.deepEqual(f.current.roles.map(role => role.role), ["ADMIN", "REVIEWER"]);
});

test("forged roles, other actors, unknown fields, and invalid themes never write", async () => {
  const f = fixture();
  for (const input of [
    { expectedUserId: f.user.id, activeRole: "ADMIN" }, { expectedUserId: f.user.id, activeRole: "REVIEWER" },
    { expectedUserId: "another-user", theme: "dark" },
  ]) await assert.rejects(f.service.save(input), (error: unknown) => error instanceof AuthError && error.status === 403);
  for (const input of [
    { expectedUserId: f.user.id, theme: "unknown" }, { expectedUserId: f.user.id, activeRole: "MISSION_PRIORITY" },
    { expectedUserId: f.user.id, theme: "dark", userId: "another-user" },
    { expectedUserId: f.user.id, theme: "light", roles: ["ADMIN"] }, { theme: "dark" },
  ]) await assert.rejects(f.service.save(input), PreferenceInputError);
  assert.equal(f.writes.length, 0);
});

test("role removal, no assigned roles, suspension, and missing authentication fail closed", async () => {
  const f = fixture(["ADMIN", "REVIEWER"]);
  f.current.roles = [{ role: "REVIEWER" }];
  await assert.rejects(f.service.save({ expectedUserId: f.user.id, activeRole: "ADMIN" }), (error: unknown) => error instanceof AuthError && error.status === 403);
  f.current.isSuspended = true;
  await assert.rejects(f.service.save({ expectedUserId: f.user.id, theme: "dark" }), (error: unknown) => error instanceof AuthError && error.status === 401);
  f.logout();
  await assert.rejects(f.service.save({ expectedUserId: f.user.id, theme: "dark" }), (error: unknown) => error instanceof AuthError && error.status === 401);
  const roleless = fixture([]);
  await assert.rejects(roleless.service.save({ expectedUserId: roleless.user.id, activeRole: "DEVELOPER" }), (error: unknown) => error instanceof AuthError && error.status === 403);
  assert.equal((await roleless.service.save({ expectedUserId: roleless.user.id, theme: "dark" })).theme, "dark");
});

test("account theme wins over stale local storage before paint; visitors retain local preference", () => {
  for (const [source, server, local, expected] of [
    ["account", "dark", "light", "dark"], ["account", "system", "dark", "system"], ["local", "system", "light", "light"],
  ]) {
    const dataset = { themeSource: source, theme: server };
    const storage = new Map([[THEME_STORAGE_KEY, local]]);
    runInNewContext(themeInitializationScript, { document: { documentElement: { dataset } }, localStorage: { getItem: (key: string) => storage.get(key), setItem: (key: string, value: string) => storage.set(key, value) } });
    assert.equal(dataset.theme, expected);
    if (source === "account") assert.equal(storage.get(THEME_STORAGE_KEY), expected);
  }
  const dataset = { themeSource: "account", theme: "dark" };
  runInNewContext(themeInitializationScript, { document: { documentElement: { dataset } }, localStorage: { setItem: () => { throw new Error("blocked"); } } });
  assert.equal(dataset.theme, "dark");
});

test("preference HTTP handler enforces origin, authentication, schema, size, and generic errors", async () => {
  const f = fixture();
  let allowed = true;
  let user: AuthUser | null = f.user;
  const handler = createPreferencePost({ appUrl: "https://civicspec.invalid", resolveUser: async () => user, save: f.service.save, limit: async () => allowed });
  const request = (body: string, headers: Record<string, string> = {}) => new Request("https://civicspec.invalid/api/workspace/preferences", { method: "POST", headers: { origin: "https://civicspec.invalid", "content-type": "application/json", ...headers }, body });
  const valid = JSON.stringify({ expectedUserId: f.user.id, theme: "dark" });
  assert.equal((await handler(request(valid))).status, 200);
  assert.equal((await handler(request(valid, { origin: "https://evil.invalid" }))).status, 403);
  assert.equal((await handler(request(valid, { "sec-fetch-site": "cross-site" }))).status, 403);
  assert.equal((await handler(request("{}"))).status, 400);
  assert.equal((await handler(request("{"))).status, 400);
  assert.equal((await handler(request("x".repeat(1025)))).status, 413);
  assert.equal((await handler(request(valid, { "content-type": "text/plain" }))).status, 415);
  assert.equal((await handler(new Request("https://civicspec.invalid/api/workspace/preferences"))).status, 405);
  allowed = false; assert.equal((await handler(request(valid))).status, 429);
  user = null; assert.equal((await handler(request(valid))).status, 401);
  const broken = createPreferencePost({ appUrl: "https://civicspec.invalid", resolveUser: async () => f.user, save: async () => { throw new Error("PRIVATE_DATABASE_SENTINEL"); }, limit: async () => true });
  const failed = await broken(request(valid));
  assert.equal(failed.status, 503); assert.ok(!JSON.stringify(await failed.json()).includes("PRIVATE_"));
});
