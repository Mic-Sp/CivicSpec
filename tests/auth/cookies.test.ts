import assert from "node:assert/strict";
import { test } from "node:test";

import { createCookieAuth, type SessionCookieStore } from "../../src/server/auth/cookies";
import { sessionCookieSettings, sessionMaxAge } from "../../src/server/auth/service";
import { memoryAuth } from "./fixtures";

test("cookie issuance/rotation/logout use HttpOnly Lax root cookies with production Secure", async () => {
  for (const production of [false, true]) {
    const fixture = memoryAuth();
    const values = new Map<string, string>();
    const writes: Parameters<SessionCookieStore["set"]>[] = [];
    const store: SessionCookieStore = {
      get: name => values.has(name) ? { value: values.get(name)! } : undefined,
      set: (...args) => { writes.push(args); values.set(args[0], args[1]); },
    };
    const request = createCookieAuth(fixture.service, async () => store, production);
    assert.equal(await request.getCurrentUser(), null);
    const user = await request.startSession(fixture.user.id);
    assert.equal("token" in user, false);
    const [name, firstToken, options] = writes[0];
    assert.equal(name, production ? "__Host-civicspec-session" : "civicspec-session");
    assert.deepEqual(options, { httpOnly: true, secure: production, sameSite: "lax", path: "/", expires: new Date("2026-12-01T14:00:00.000Z"), maxAge: sessionMaxAge });
    assert.equal("domain" in options, false);
    assert.notEqual(await request.getCurrentUser(), null);
    await request.startSession(fixture.user.id);
    assert.notEqual(values.get(name), firstToken);
    assert.equal(await fixture.service.resolveSession(firstToken), null);
    assert.equal(fixture.sessions.size, 1);
    await request.endSession();
    assert.equal(fixture.sessions.size, 0);
    assert.equal(await request.getCurrentUser(), null);
    const clear = writes.at(-1)!;
    assert.equal(clear[1], "");
    assert.equal(clear[2].maxAge, 0);
    assert.equal(clear[2].expires.getTime(), 0);
    assert.equal(clear[2].secure, production);
  }
});

test("cookie write failure revokes the newly issued session", async () => {
  const fixture = memoryAuth();
  const request = createCookieAuth(fixture.service, async () => ({
    get: () => undefined,
    set: () => { throw new Error("cookie writes unavailable"); },
  }), false);
  await assert.rejects(request.startSession(fixture.user.id), /cookie writes unavailable/);
  assert.equal(fixture.sessions.size, 0);
});

test("production cookie settings cannot expose the cookie to JavaScript or sibling hosts", () => {
  const cookie = sessionCookieSettings(true);
  assert.equal(cookie.name.startsWith("__Host-"), true);
  assert.equal(cookie.options.httpOnly, true);
  assert.equal(cookie.options.secure, true);
  assert.equal("domain" in cookie.options, false);
});
