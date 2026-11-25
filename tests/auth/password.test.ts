import assert from "node:assert/strict";
import { test } from "node:test";

import { hashPassword, verifyPassword } from "../../src/server/auth/password";

test("password hashes have independent random salts and verify without plaintext storage", async () => {
  const password = "CivicSpecPilot123!";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.match(first, /^scrypt\$32768\$8\$3\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
  assert.ok(!first.includes(password));
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("CivicSpecPilot123?", first), false);
  assert.equal(await verifyPassword(password.toLowerCase(), first), false);
});

test("Unicode and long passwords verify without truncation", async () => {
  const password = "é🔐".repeat(30);
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password + "x", hash), false);
});

test("unset, malformed, altered, and unsupported-cost hashes fail closed", async () => {
  const hash = await hashPassword("valid password");
  for (const invalid of [null, undefined, "", "plaintext", hash + "$extra", hash.replace("32768", "999999999"), hash.replace("scrypt", "bcrypt"), hash.slice(0, -1)]) {
    assert.equal(await verifyPassword("valid password", invalid), false);
  }
});

test("empty and oversized password inputs are bounded", async () => {
  for (const password of ["", "x".repeat(1025), "🔐".repeat(257)]) {
    await assert.rejects(hashPassword(password), /Invalid password input/);
    assert.equal(await verifyPassword(password, null), false);
  }
});
