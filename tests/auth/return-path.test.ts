import assert from "node:assert/strict";
import { test } from "node:test";

import { safeReturnPath, signInLocation } from "../../src/server/auth/return-path";

test("internal paths retain query strings and fragments and normalize dot segments", () => {
  for (const path of ["/", "/app", "/app/projects/CS-001?tab=review#criteria", "/search?q=two%20words", "/caf%C3%A9", "/app?url=https%3A%2F%2Fexample.invalid"]) {
    assert.equal(safeReturnPath(path), path);
  }
  assert.equal(safeReturnPath("/nested/../app"), "/app");
});

test("open redirects and malformed or encoded variants fall back to /app", () => {
  for (const path of [
    undefined, null, 123, {}, "", "app", "https://evil.invalid", "javascript:alert(1)",
    "//evil.invalid", "///evil.invalid", "//user@evil.invalid", "/\\evil.invalid", "\\evil.invalid",
    "/%2fevil.invalid", "/%2f%2fevil.invalid", "/%5cevil.invalid", "/%255cevil.invalid",
    "/%252f%252fevil.invalid", "/%25252525252fevil.invalid", "/.//evil.invalid", "/%2e%2e//evil.invalid",
    "/\nevil.invalid", "/\revil.invalid", "/\tevil.invalid", "/%0devil.invalid", "/%250aevil.invalid",
    "/app?x=%0d%0aLocation:https://evil.invalid", "/%", "/%zz", " /app", "/" + "x".repeat(2049),
  ]) assert.equal(safeReturnPath(path), "/app", String(path));
});

test("sign-in return paths are validated and encoded as one query parameter", () => {
  const location = new URL(signInLocation("/app?x=1&next=/projects#review"), "https://civicspec.invalid");
  assert.equal(location.pathname, "/auth");
  assert.deepEqual([...location.searchParams.keys()], ["returnTo"]);
  assert.equal(location.searchParams.get("returnTo"), "/app?x=1&next=/projects#review");
  assert.equal(signInLocation("//evil.invalid"), "/auth?returnTo=%2Fapp");
});
