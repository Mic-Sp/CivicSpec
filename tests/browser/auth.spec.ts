import { createHash, createHmac, randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/server/auth/password";

const prisma = new PrismaClient();
const runId = `browser_test_${randomUUID()}`;
const emails = ["builder", "owner", "nojs", "password-policy", "legacy"].map(name => `${runId}_${name}@civicspec.local`);
const newPassword = "Aa1!bcde";
const seededPassword = "CivicSpecPilot123!";
const throttleIdentities: [string, string][] = [];

test.afterAll(async () => {
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = users.map(user => user.id);
  // Isolated browser-test fixture teardown only; production audit writes are append-only.
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: ids }, action: "PARTICIPATION_TERMS_ACCEPTED" } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  const secret = process.env.CIVICSPEC_BROWSER_AUTH_SECRET!;
  const keys = [
    ["sign-in-global", "global"], ["registration-global", "global"], ...throttleIdentities,
    ...ids.map(id => ["onboarding-account", id]),
  ].map(([scope, identity]) => createHmac("sha256", secret).update(`auth-limit:${scope}:${identity}`).digest("hex"));
  await prisma.authRateLimit.deleteMany({ where: { key: { in: keys } } });
  await prisma.$disconnect();
});

async function signIn(page: Page, email: string, returnTo = "/app") {
  throttleIdentities.push(["sign-in-account", email]);
  await page.goto(`/auth?returnTo=${encodeURIComponent(returnTo)}`);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(seededPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}

async function register(page: Page, email: string) {
  throttleIdentities.push(["registration-account", email]);
  await page.goto("/auth?mode=register");
  await page.getByLabel("Name to use on CivicSpec").fill("Synthetic Browser Participant");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/onboarding/);
}

test("protected pages redirect to sign-in and generic login errors preserve values/focus", async ({ page }) => {
  await page.goto("/app/onboarding");
  await expect(page).toHaveURL(/\/auth\?returnTo=/);
  await page.getByLabel("Email", { exact: true }).fill("admin@civicspec.local");
  throttleIdentities.push(["sign-in-account", "admin@civicspec.local"]);
  await page.getByLabel("Password", { exact: true }).fill("Incorrect password!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const summary = page.getByRole("alert", { name: "Please check your details" });
  await expect(summary).toBeFocused();
  const known = await summary.locator("p").textContent();
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue("Incorrect password!");
  await page.getByLabel("Email", { exact: true }).fill(`${runId}_missing@civicspec.local`);
  throttleIdentities.push(["sign-in-account", `${runId}_missing@civicspec.local`]);
  const failedLogin = page.waitForResponse(response => response.request().method() === "POST");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await failedLogin;
  await expect(summary).toBeFocused();
  await expect(summary.locator("p")).toHaveText(known!);
  await expect(page.getByLabel("Email", { exact: true })).toHaveAttribute("aria-describedby", "form-errors");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute("autocomplete", "current-password");
});

test("seeded multi-role sign-in honors safe paths, uses secure cookies, and signs out", async ({ page, context }) => {
  await signIn(page, "admin@civicspec.local", "/app?from=auth#ready");
  await expect(page).toHaveURL(/\/app\?from=auth#ready$/);
  await expect(page.getByText("Your access: Administrator, Reviewer.")).toBeVisible();
  const cookie = (await context.cookies()).find(item => item.name === "__Host-civicspec-session");
  expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: "Lax", path: "/" });
  const raw = cookie!.value;
  await page.goto("/app/onboarding");
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
  expect((await context.cookies()).some(item => item.name.includes("civicspec-session"))).toBe(false);
  expect(await prisma.session.count({ where: { tokenHash: createHash("sha256").update(raw).digest("hex") } })).toBe(0);
  await page.goto("/app");
  await expect(page).toHaveURL(/\/auth\?returnTo=/);
});

test("an external return path falls back to the internal app", async ({ page }) => {
  await signIn(page, "builder-open@civicspec.local", "//evil.invalid");
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Your access: Builder.")).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});

test("registration requires terms, rejects a tampered ADMIN grant, and completes builder onboarding", async ({ page }) => {
  await register(page, emails[0]);
  const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[0] }, include: { preference: true, roles: true } });
  expect(user.preference?.theme).toBe("SYSTEM"); expect(user.roles).toHaveLength(0);
  await page.getByRole("button", { name: "Continue to CivicSpec" }).click();
  await expect(page.getByRole("alert", { name: "Please check your details" })).toBeFocused();
  await expect(page.locator("#intent-error")).toBeVisible();
  await expect(page.locator("#acceptedTerms-error")).toBeVisible();
  await page.getByRole("radio", { name: /I want to build/ }).check();
  const missingTerms = page.waitForResponse(response => response.request().method() === "POST");
  await page.getByRole("button", { name: "Continue to CivicSpec" }).click();
  await missingTerms;
  await expect(page.locator("#intent-error")).toHaveCount(0);
  await expect(page.getByRole("radio", { name: /I want to build/ })).toBeChecked();
  await page.getByRole("checkbox").check();
  await page.locator("form.auth-form").evaluate(form => {
    form.querySelectorAll('[name="intent"]').forEach(input => input.removeAttribute("name"));
    const attack = document.createElement("input"); attack.type = "hidden"; attack.name = "intent"; attack.value = "ADMIN"; attack.id = "forged-intent"; form.append(attack);
  });
  const forgedSubmission = page.waitForResponse(response => response.request().method() === "POST");
  await page.getByRole("button", { name: "Continue to CivicSpec" }).click();
  await forgedSubmission;
  await expect(page.locator("#intent-error")).toBeVisible();
  expect(await prisma.userRole.count({ where: { userId: user.id } })).toBe(0);
  // Reload to remove deliberate DOM tampering before exercising the normal flow.
  await page.reload();
  await page.getByRole("radio", { name: /I want to build/ }).check();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to CivicSpec" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Your access: Builder.")).toBeVisible();
  expect((await prisma.userRole.findMany({ where: { userId: user.id } })).map(role => role.role)).toEqual(["DEVELOPER"]);
  expect(await prisma.auditEvent.count({ where: { entityId: user.id, action: "PARTICIPATION_TERMS_ACCEPTED" } })).toBe(1);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  // A second registration cannot overwrite or authenticate the existing account.
  await page.goto("/auth?mode=register");
  await page.getByLabel("Name to use on CivicSpec").fill("Another Synthetic Name");
  await page.getByLabel("Email", { exact: true }).fill(emails[0]);
  await page.getByLabel("Password", { exact: true }).fill("Different123! attempted password");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Please check your details" })).toContainText("Try signing in or try again");
  expect((await page.context().cookies()).some(cookie => cookie.name.includes("civicspec-session"))).toBe(false);
  expect(await prisma.user.count({ where: { email: emails[0] } })).toBe(1);
});

test("a new problem owner can complete onboarding without gaining builder or privileged roles", async ({ page }) => {
  await register(page, emails[1]);
  await page.getByRole("radio", { name: /I have a community need/ }).check();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to CivicSpec" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByText("Your access: Problem owner.")).toBeVisible();
  const user = await prisma.user.findUniqueOrThrow({ where: { email: emails[1] }, include: { roles: true } });
  expect(user.roles.map(role => role.role)).toEqual(["PROBLEM_OWNER"]);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});

test("registration explains and enforces every password requirement with accessible errors", async ({ page }) => {
  await page.goto("/auth?mode=register");
  const password = page.getByLabel("Password", { exact: true });
  await expect(password).toHaveAttribute("minlength", "8");
  await expect(password).toHaveAttribute("maxlength", "128");
  await expect(password).toHaveAttribute("aria-describedby", "password-help");
  await expect(page.locator("#password-help")).toContainText("8–128 characters");
  for (const requirement of ["uppercase letter", "lowercase letter", "number", "symbol"]) await expect(page.locator("#password-help")).toContainText(requirement);
  await page.getByLabel("Name to use on CivicSpec").fill("Synthetic Password Policy Test");
  await page.getByLabel("Email", { exact: true }).fill(emails[3]);
  const cases = [
    ["Aa1!bcd", "Use at least 8 characters."],
    ["aa1!bcde", "Add at least one uppercase letter."],
    ["AA1!BCDE", "Add at least one lowercase letter."],
    ["Aa!!bcde", "Add at least one number."],
    ["Aa12bcde", "Add at least one symbol, such as !, @, or #."],
    ["Aa1 bcde", "Add at least one symbol, such as !, @, or #."],
    ["Aa1!" + "x".repeat(125), "Use 128 characters or fewer."],
  ];
  // Bypass the HTML upper bound to prove the server also rejects 129 characters.
  await password.evaluate(input => input.removeAttribute("maxlength"));
  for (const [value, message] of cases) {
    await password.fill(value);
    const response = page.waitForResponse(response => response.request().method() === "POST");
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await response;
    await expect(page.locator("#password-error")).toHaveText(message);
    await expect(password).toHaveAttribute("aria-invalid", "true");
    await expect(password).toHaveAttribute("aria-describedby", "password-help password-error");
    await expect(page.getByRole("alert", { name: "Please check your details" })).toBeFocused();
    expect(await prisma.user.count({ where: { email: emails[3] } })).toBe(0);
  }
  await register(page, emails[3]);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});

test("an existing account can still sign in with a legacy password lacking composition", async ({ page }) => {
  const password = "legacy password";
  await prisma.user.create({ data: { email: emails[4], displayName: "Synthetic Legacy Account", passwordHash: await hashPassword(password), roles: { create: { role: "DEVELOPER" } } } });
  throttleIdentities.push(["sign-in-account", emails[4]]);
  await page.goto("/auth");
  await expect(page.getByLabel("Password", { exact: true })).not.toHaveAttribute("minlength");
  await page.getByLabel("Email", { exact: true }).fill(emails[4]);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});

test("both auth modes have accessible labels, linked errors, theme-safe drafts, focus, and 320px reflow", async ({ page }) => {
  for (const mode of ["sign-in", "register"]) {
    await page.goto(`/auth?mode=${mode}`);
    await page.getByLabel("Email", { exact: true }).fill("draft@civicspec.local");
    await page.getByLabel("Password", { exact: true }).fill("Draft password retained!");
    for (const theme of ["Light", "Dark"]) {
      await page.getByRole("radio", { name: theme, exact: true }).check();
      await expect(page.getByLabel("Email", { exact: true })).toHaveValue("draft@civicspec.local");
      await expect(page.getByLabel("Password", { exact: true })).toHaveValue("Draft password retained!");
      await page.setViewportSize({ width: 320, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const control of await page.locator('.auth-form input:not([type="hidden"]), .auth-form button, .auth-mode a').all()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.getByLabel("Email", { exact: true }).focus();
      expect(await page.getByLabel("Email", { exact: true }).evaluate(element => getComputedStyle(element).outlineWidth)).toBe("3px");
      const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(scan.violations).toEqual([]);
    }
  }
  await page.getByLabel("Name to use on CivicSpec").fill("");
  await page.getByLabel("Email", { exact: true }).fill("invalid-email");
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Please check your details" })).toBeFocused();
  for (const field of ["displayName", "email", "password"]) {
    await expect(page.locator(`#${field}`)).toHaveAttribute("aria-invalid", "true");
    await expect(page.locator(`#${field}-error`)).toBeVisible();
  }
});

test("onboarding remains accessible in both themes and at narrow widths", async ({ page }) => {
  await register(page, emails[2]);
  for (const theme of ["Light", "Dark"]) {
    await page.getByRole("radio", { name: theme, exact: true }).check();
    await page.setViewportSize({ width: 320, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    for (const choice of await page.locator(".role-choice, .terms-choice").all()) expect((await choice.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(scan.violations).toEqual([]);
  }
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
});

test("sign-in and sign-out work with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: test.info().project.use.baseURL });
  try {
    const page = await context.newPage();
    await signIn(page, "owner@civicspec.local");
    await expect(page).toHaveURL(/\/app$/);
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL("/");
  } finally { await context.close(); }
});
