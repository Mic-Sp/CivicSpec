import { createHmac, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient, type UserPreference } from "@prisma/client";

const prisma = new PrismaClient();
const run = `workspace_browser_${randomUUID()}`;
const emails = [`${run}@civicspec.local`];
const participantName = `Synthetic ${"Participant".repeat(7)}`.slice(0, 80);
const seedLocals = ["admin", "owner", "reviewer", "builder-open", "builder-priority", "builder-partner"];
const snapshots = new Map<string, UserPreference | null>();
const seedIds = new Map<string, string>();
const userIds = new Set<string>();

test.beforeAll(async () => {
  for (const local of seedLocals) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: `${local}@civicspec.local` }, select: { id: true, preference: true } });
    seedIds.set(local, user.id); userIds.add(user.id); snapshots.set(user.id, user.preference);
  }
  await prisma.userPreference.upsert({ where: { userId: seedIds.get("admin")! }, create: { userId: seedIds.get("admin")!, activeRole: "ADMIN", theme: "SYSTEM" }, update: { activeRole: "ADMIN", theme: "SYSTEM" } });
});

test.afterAll(async () => {
  const owned = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  for (const user of owned) userIds.add(user.id);
  await prisma.auditEvent.deleteMany({ where: { entityId: { in: owned.map(user => user.id) }, action: "PARTICIPATION_TERMS_ACCEPTED" } });
  await prisma.user.deleteMany({ where: { id: { in: owned.map(user => user.id) } } });
  // Restore only the synthetic seed preferences exercised by this suite.
  for (const [userId, preference] of snapshots) {
    if (preference) await prisma.userPreference.upsert({ where: { userId }, create: preference, update: { theme: preference.theme, activeRole: preference.activeRole, updatedAt: preference.updatedAt } });
    else await prisma.userPreference.deleteMany({ where: { userId } });
  }
  const secret = process.env.CIVICSPEC_BROWSER_AUTH_SECRET!;
  const pairs = [
    ["sign-in-global", "global"], ["registration-global", "global"],
    ...seedLocals.map(local => ["sign-in-account", `${local}@civicspec.local`]),
    ...emails.map(email => ["registration-account", email]),
    ...emails.map(email => ["sign-in-account", email]),
    ...[...userIds].flatMap(id => [["preferences-account", id], ["onboarding-account", id]]),
  ];
  const keys = pairs.map(([scope, identity]) => createHmac("sha256", secret).update(`auth-limit:${scope}:${identity}`).digest("hex"));
  await prisma.authRateLimit.deleteMany({ where: { key: { in: keys } } });
  await prisma.$disconnect();
});

async function signIn(page: Page, local: string) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(`${local}@civicspec.local`);
  await page.getByLabel("Password", { exact: true }).fill("CivicSpecPilot123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}
async function signOut(page: Page) {
  await page.locator(".workspace-header").getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
}
async function postPreference(page: Page, payload: unknown) {
  return page.evaluate(async body => {
    const response = await fetch("/api/workspace/preferences", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  }, payload);
}

test("workspace/account routes require authentication and roleless accounts go to onboarding", async ({ page }) => {
  await page.goto("/app/account");
  await expect(page).toHaveURL(/\/auth\?returnTo=/);
  await page.goto("/auth?mode=register");
  await page.getByLabel("Name to use on CivicSpec").fill(participantName);
  await page.getByLabel("Email", { exact: true }).fill(emails[0]);
  await page.getByLabel("Password", { exact: true }).fill("Aa1!bcde");
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await expect(page.getByRole("banner").locator(".signed-in-indicator")).toHaveText(`Signed in as ${participantName}`);
  await page.getByRole("banner").getByRole("button", { name: "Sign out", exact: true }).click();
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(emails[0]);
  await page.getByLabel("Password", { exact: true }).fill("Aa1!bcde");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await page.goto("/app/account");
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await page.getByRole("radio", { name: /I want to build/ }).check();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to CivicSpec" }).click();
  await expect(page.getByRole("heading", { name: "Builder dashboard", exact: true })).toBeVisible();
  await page.goto("/app/account");
  await expect(page.getByRole("heading", { name: "Account settings", exact: true })).toBeVisible();
  await signOut(page);
});

test("multi-role selection uses only assigned roles, persists, and never grants another role", async ({ page }) => {
  await signIn(page, "admin");
  const select = page.getByLabel("Workspace role", { exact: true });
  await expect(select.locator("option")).toHaveText(["Administrator", "Reviewer"]);
  await select.selectOption("REVIEWER");
  await expect(page.getByRole("heading", { name: "Reviewer dashboard", exact: true })).toBeVisible();
  await expect(page.locator(".workspace-sidebar")).toContainText("Specification queue");
  const id = seedIds.get("admin")!;
  expect((await prisma.userPreference.findUniqueOrThrow({ where: { userId: id } })).activeRole).toBe("REVIEWER");
  const denied = await postPreference(page, { expectedUserId: id, activeRole: "DEVELOPER" });
  expect(denied).toEqual({ status: 403, body: { error: "Forbidden" } });
  expect(await prisma.userRole.count({ where: { userId: id } })).toBe(2);
  await page.reload();
  await expect(select).toHaveValue("REVIEWER");
  await expect(page.getByRole("heading", { name: "Reviewer dashboard", exact: true })).toBeVisible();
  await select.selectOption("ADMIN");
  await expect(page.getByRole("heading", { name: "Administrator dashboard", exact: true })).toBeVisible();
  await expect(page.locator(".workspace-sidebar")).toContainText("People and roles");
  await signOut(page);
});

test("single-role seeded accounts show only their role and shared views omit confidential details", async ({ page }) => {
  for (const local of ["builder-open", "builder-priority", "builder-partner", "owner", "reviewer"]) {
    await signIn(page, local);
    const selector = page.getByLabel("Workspace role", { exact: true });
    await expect(selector.locator("option")).toHaveCount(1);
    await expect(selector).toBeDisabled();
    const content = await page.locator("body").innerText();
    expect(content).not.toMatch(/MISSION_PRIORITY|PARTNER_PRIORITY|priority eligibility|partner referral|justice.impacted|Example Community Food Pantry|Synthetic Workforce Partner/i);
    const id = seedIds.get(local)!;
    expect((await postPreference(page, { expectedUserId: id, activeRole: "ADMIN" })).status).toBe(403);
    for (const href of await page.locator('.workspace-shell a[href^="/app"]').evaluateAll(links => links.map(link => link.getAttribute("href")))) expect(["/app", "/app/account"]).toContain(href);
    await signOut(page);
  }
});

test("account themes save in PostgreSQL without resetting drafts, focus, URL, or session", async ({ page, context }) => {
  await signIn(page, "admin");
  await page.goto("/app/account?draft=retained");
  const initialCookie = (await context.cookies()).find(cookie => cookie.name.includes("civicspec-session"))!.value;
  await page.locator("main").evaluate(main => {
    const input = document.createElement("input"); input.id = "unsaved-fixture"; input.value = "Unsaved draft remains";
    input.setAttribute("aria-label", "Unsaved test fixture"); main.append(input);
  });
  const group = page.getByRole("group", { name: "Account appearance", exact: true });
  for (const [theme, database] of [["Light", "LIGHT"], ["Dark", "DARK"], ["System", "SYSTEM"]] as const) {
    const radio = group.getByRole("radio", { name: theme, exact: true });
    await radio.focus(); await page.keyboard.press("Space");
    await expect(page.getByText("Appearance saved.", { exact: true })).toBeVisible();
    await expect(radio).toBeFocused();
    await expect(page.locator("#unsaved-fixture")).toHaveValue("Unsaved draft remains");
    await expect(page).toHaveURL(/\/app\/account\?draft=retained$/);
    expect((await prisma.userPreference.findUniqueOrThrow({ where: { userId: seedIds.get("admin")! } })).theme).toBe(database);
    expect((await context.cookies()).find(cookie => cookie.name.includes("civicspec-session"))!.value).toBe(initialCookie);
  }
  await group.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(page.getByText("Appearance saved.", { exact: true })).toBeVisible();
  // Contradict the server preference to ensure stale local data never wins on reload.
  await page.evaluate(() => localStorage.setItem("civicspec-theme", "light"));
  await page.addInitScript(() => {
    new MutationObserver((_, observer) => {
      if (document.body) { (window as unknown as { themeAtBody: string | undefined }).themeAtBody = document.documentElement.dataset.theme; observer.disconnect(); }
    }).observe(document, { childList: true, subtree: true });
  });
  await page.reload();
  expect(await page.evaluate(() => (window as unknown as { themeAtBody: string }).themeAtBody)).toBe("dark");
  expect(await page.evaluate(() => localStorage.getItem("civicspec-theme"))).toBe("dark");
  await expect(group.getByRole("radio", { name: "Dark", exact: true })).toBeChecked();
  expect((await postPreference(page, { expectedUserId: seedIds.get("owner")!, theme: "light" })).status).toBe(403);
  await signOut(page);
});

test("failed theme persistence restores the saved preference without navigation", async ({ page }) => {
  await signIn(page, "admin"); await page.goto("/app/account");
  const group = page.getByRole("group", { name: "Account appearance", exact: true });
  await group.getByRole("radio", { name: "Light", exact: true }).check();
  await expect(page.getByText("Appearance saved.", { exact: true })).toBeVisible();
  await page.route("**/api/workspace/preferences", route => route.fulfill({ status: 503, json: { error: "Unavailable" } }));
  await group.getByRole("radio", { name: "Dark", exact: true }).check();
  await expect(page.getByRole("banner").getByRole("alert")).toContainText("Your saved choice was restored");
  await expect(group.getByRole("radio", { name: "Light", exact: true })).toBeChecked();
  await expect(page).toHaveURL(/\/app\/account$/);
  await page.unroute("**/api/workspace/preferences");
  await signOut(page);
});

test("workspace/account reflow, keyboard navigation, and Light/Dark accessibility at 320/768/1440px", async ({ page }) => {
  await signIn(page, "admin");
  for (const path of ["/app", "/app/account"]) {
    await page.goto(path);
    for (const theme of ["Light", "Dark"]) {
      const group = page.locator(".workspace-header").getByRole("group", { name: "Appearance", exact: true });
      await group.getByRole("radio", { name: theme, exact: true }).check();
      // Selecting an already-active radio needs no write; the account value is authoritative.
      await expect.poll(async () => (await prisma.userPreference.findUniqueOrThrow({ where: { userId: seedIds.get("admin")! } })).theme).toBe(theme.toUpperCase());
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        for (const control of await page.locator(".workspace-header a, .workspace-header button, .workspace-header select, .theme-choice").all()) {
          if (await control.isVisible()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
      }
      const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(scan.violations).toEqual([]);
    }
  }
  await page.setViewportSize({ width: 320, height: 1000 });
  const menu = page.locator(".workspace-mobile-menu summary");
  await menu.focus(); await page.keyboard.press("Enter");
  await expect(page.getByRole("navigation", { name: "Workspace navigation" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Workspace navigation" }).getByRole("link", { name: "Dashboard", exact: true })).toBeVisible();
  await signOut(page);
});

test("public entry recognizes authentication and opens the workspace directly", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Create an account", exact: true })).toBeVisible();
  await expect(page.getByRole("banner").locator(".signed-in-indicator")).toHaveCount(0);
  await signIn(page, "admin");
  await page.goto("/");
  await expect(page.getByRole("link", { name: "Open workspace", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create an account", exact: true })).toHaveCount(0);
  await page.getByRole("link", { name: "Open workspace", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await signOut(page);
});

test("public and workspace headers show only the display name and reflow with long names", async ({ page }) => {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(emails[0]);
  await page.getByLabel("Password", { exact: true }).fill("Aa1!bcde");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.setViewportSize({ width: 320, height: 1000 });
  for (const path of ["/", "/app"]) {
    await page.goto(path);
    const header = page.getByRole("banner");
    await expect(header.locator(".signed-in-indicator")).toHaveText(`Signed in as ${participantName}`);
    await expect(header).not.toContainText(emails[0]);
    for (const theme of ["Light", "Dark"]) {
      await header.getByRole("radio", { name: theme, exact: true }).check();
      await expect(page.getByText("Appearance saved.", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      for (const control of await header.locator("a, button, select, .theme-choice").all()) {
        if (!await control.isVisible()) continue;
        const box = (await control.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(44);
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(320);
      }
      expect((await new AxeBuilder({ page }).include("header").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    }
  }
  await page.screenshot({ path: "test-results/auth/header-mobile-dark.png", fullPage: true });
  await signOut(page);
  await expect(page.getByRole("banner").locator(".signed-in-indicator")).toHaveCount(0);
});
