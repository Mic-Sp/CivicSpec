import { createHmac, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/server/auth/password";

const prisma = new PrismaClient();
const run = `owner_browser_${randomUUID()}`;
const emails = ["a", "b", "new"].map(name => `${run}_${name}@civicspec.local`);
const password = "CivicSpecPilot123!";
const actors: string[] = [];
const organizationIds: string[] = [];
const submissions: string[] = [];
const signInEmails = new Set<string>();

test.beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (let index = 0; index < 2; index++) {
    const user = await prisma.user.create({ data: { email: emails[index], displayName: `Synthetic Intake Owner ${index + 1}`, passwordHash, roles: { create: { role: "PROBLEM_OWNER" } } } });
    actors.push(user.id);
    const organization = await prisma.organization.create({ data: { legalName: `Synthetic Intake Group ${index + 1}`, category: "COMMUNITY_GROUP", noncommercialAttest: true, eligibilityStatus: "PENDING", members: { create: { userId: user.id } } } });
    organizationIds.push(organization.id);
    const submission = await prisma.problemSubmission.create({ data: { ownerId: user.id, organizationId: organization.id, title: index ? "PRIVATE_OTHER_OWNER_SUBMISSION" : "Synthetic saved request", state: index ? "SUBMITTED" : "DRAFT", privacyNoticeAckAt: new Date(), draftState: { create: { preferredMode: "CHAT" } }, sourceRecords: { create: { sequenceNumber: 1, inputMode: "CHAT", authorRole: "STAKEHOLDER", content: `PRIVATE_SOURCE_OWNER_${index + 1}` } } } });
    submissions.push(submission.id);
  }
  await prisma.project.create({ data: { opaqueSlug: `CS-${randomUUID()}`, submissionId: submissions[0], state: "PUBLISHED", category: "Synthetic", requiredSkills: [] } });
});
test.afterAll(async () => {
  const owned = await prisma.user.findMany({ where: { email: { in: emails } }, select: { id: true } });
  const ids = owned.map(user => user.id);
  const ownSubmissions = await prisma.problemSubmission.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
  const ownOrganizations = await prisma.organization.findMany({ where: { members: { some: { userId: { in: ids } } } }, select: { id: true } });
  await prisma.project.deleteMany({ where: { submissionId: { in: ownSubmissions.map(submission => submission.id) } } });
  await prisma.problemSubmission.deleteMany({ where: { ownerId: { in: ids } } });
  await prisma.organization.deleteMany({ where: { id: { in: ownOrganizations.map(organization => organization.id) } } });
  await prisma.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  const pairs = [
    ["sign-in-global", "global"], ["registration-global", "global"],
    ...[...signInEmails].map(email => ["sign-in-account", email]),
    ...emails.map(email => ["registration-account", email]),
    ...ids.flatMap(id => [["owner-intake-account", id], ["preferences-account", id], ["onboarding-account", id]]),
  ];
  const keys = pairs.map(([scope, identity]) => createHmac("sha256", process.env.CIVICSPEC_BROWSER_AUTH_SECRET!).update(`auth-limit:${scope}:${identity}`).digest("hex"));
  await prisma.authRateLimit.deleteMany({ where: { key: { in: keys } } });
  await prisma.$disconnect();
});
async function signIn(page: Page, email: string) {
  signInEmails.add(email);
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}
async function signOut(page: Page) {
  // Generic not-found pages intentionally omit authenticated workspace chrome.
  await page.goto("/app");
  await page.getByRole("banner").getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL("/");
}
async function fillDraft(page: Page, mode = "Guided form") {
  await page.getByLabel("Working title", { exact: true }).fill("Synthetic noncommercial request");
  await page.getByRole("radio", { name: new RegExp(mode) }).check();
}
async function acknowledge(page: Page) {
  await page.getByRole("checkbox", { name: /I understand how this request/ }).check();
  await page.getByRole("checkbox", { name: /I confirm this request serves/ }).check();
}

test("seeded owner sees verified nonprofit and linked child states with working sidebar links", async ({ page }) => {
  await signIn(page, "owner@civicspec.local");
  await page.goto("/app/owner/eligibility");
  await expect(page.getByLabel("Organization or request name", { exact: true })).toHaveValue("Example Community Food Pantry");
  await expect(page.locator("main .owner-status").first()).toHaveText("Verified");
  await page.locator(".workspace-sidebar").getByRole("link", { name: "My submissions", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Low-Stock Inventory Helper", exact: true })).toBeVisible();
  await expect(page.locator("main")).toContainText("CS-001"); await expect(page.locator("main")).toContainText("Published");
  await page.getByRole("link", { name: "Inspect request", exact: true }).first().click();
  await expect(page.getByRole("heading", { name: "Child micro-projects", exact: true })).toBeVisible();
  await signOut(page);
});

test("owner-only routes and cross-owner direct URLs never disclose another owner's data", async ({ page }) => {
  await page.goto("/app/submissions"); await expect(page).toHaveURL(/\/auth\?returnTo=/);
  await signIn(page, "builder-open@civicspec.local");
  for (const path of ["/app/owner/eligibility", "/app/submissions", "/app/submissions/new", `/app/submissions/${submissions[0]}`, `/app/submissions/${submissions[0]}/interview`]) {
    await page.goto(path); await expect(page.getByRole("heading", { name: /could not be found/i })).toBeVisible();
    expect(await page.content()).not.toMatch(/Synthetic saved request|PRIVATE_SOURCE_OWNER|Synthetic Intake Group/);
  }
  await signOut(page); await signIn(page, emails[0]);
  await page.goto("/app/submissions");
  await expect(page.getByRole("heading", { name: "Synthetic saved request" })).toBeVisible();
  expect(await page.content()).not.toMatch(/PRIVATE_OTHER_OWNER_SUBMISSION|PRIVATE_SOURCE_OWNER|Synthetic Intake Group 2/);
  for (const id of [submissions[1], "unknown-request"]) {
    await page.goto(`/app/submissions/${id}/interview`);
    await expect(page.getByRole("heading", { name: /could not be found/i })).toBeVisible();
    expect(await page.content()).not.toMatch(/PRIVATE_OTHER_OWNER_SUBMISSION|PRIVATE_SOURCE_OWNER/);
  }
  await page.goto(`/app/owner/eligibility?record=${organizationIds[1]}`);
  await expect(page.getByRole("heading", { name: /could not be found/i })).toBeVisible();
  await signOut(page);
});

test("notice decline creates nothing; missing acknowledgments preserve fields; both modes save only private drafts", async ({ page }) => {
  await signIn(page, emails[0]);
  const before = await prisma.problemSubmission.count({ where: { ownerId: actors[0] } });
  await page.goto("/app/submissions/new"); await fillDraft(page);
  await page.getByRole("link", { name: "Decline and return without saving" }).click();
  await expect(page).toHaveURL(/\/app\/submissions$/);
  expect(await prisma.problemSubmission.count({ where: { ownerId: actors[0] } })).toBe(before);
  for (const [label, mode] of [["Guided form", "WIZARD"], ["Chat with CivicSpec", "CHAT"]]) {
    await page.getByRole("main").getByRole("link", { name: "New request", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/submissions\/new$/);
    await fillDraft(page, label);
    await page.getByRole("button", { name: "Create private draft", exact: true }).click();
    await expect(page.getByRole("alert", { name: "Please check your details" })).toBeFocused();
    await expect(page.locator("#privacyAck-error")).toBeVisible(); await expect(page.locator("#noncommercialPurpose-error")).toBeVisible();
    await expect(page.getByLabel("Working title", { exact: true })).toHaveValue("Synthetic noncommercial request");
    await acknowledge(page); await page.getByRole("button", { name: "Create private draft", exact: true }).click();
    await expect(page).toHaveURL(/\/app\/submissions\/[^/]+\/interview$/);
    await expect(page.getByRole("group", { name: "Discovery mode" }).getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    const id = new URL(page.url()).pathname.split("/")[3];
    const saved = await prisma.problemSubmission.findUniqueOrThrow({ where: { id }, include: { draftState: true } });
    expect(saved.state).toBe("DRAFT"); expect(saved.privacyNoticeAckAt).not.toBeNull(); expect(saved.draftState?.preferredMode).toBe(mode);
    expect(await prisma.discoverySourceRecord.count({ where: { submissionId: id } })).toBe(0);
    await page.reload();
    await expect(page.getByRole("group", { name: "Discovery mode" }).getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Save and exit", exact: true }).click(); await expect(page).toHaveURL(/\/app\/submissions$/);
  }
  expect(await prisma.problemSubmission.count({ where: { ownerId: actors[0] } })).toBe(before + 2);
  await signOut(page);
});

test("a stale entry form cannot bypass a newly deferred commercial eligibility record", async ({ page }) => {
  await signIn(page, emails[0]); await page.goto("/app/submissions/new");
  await fillDraft(page); await acknowledge(page);
  const before = await prisma.problemSubmission.count({ where: { ownerId: actors[0] } });
  await prisma.organization.update({ where: { id: organizationIds[0] }, data: { category: "COMMERCIAL_DEFERRED", eligibilityStatus: "DEFERRED" } });
  await page.getByRole("button", { name: "Create private draft", exact: true }).click();
  await expect(page.getByRole("alert", { name: "Please check your details" })).toContainText("deferred to a post-pilot release");
  expect(await prisma.problemSubmission.count({ where: { ownerId: actors[0] } })).toBe(before);
  await page.reload(); await expect(page.getByRole("heading", { name: "Check owner eligibility first" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create private draft", exact: true })).toHaveCount(0);
  await prisma.organization.update({ where: { id: organizationIds[0] }, data: { category: "COMMUNITY_GROUP", eligibilityStatus: "PENDING" } });
  await signOut(page);
});

test("a newly registered problem owner attests, sees pending status, and commercial/unattested records are deferred", async ({ page }) => {
  await page.goto("/auth?mode=register");
  await page.getByLabel("Name to use on CivicSpec").fill("Synthetic Newly Registered Owner");
  await page.getByLabel("Email", { exact: true }).fill(emails[2]); await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/app\/onboarding/);
  await page.getByRole("radio", { name: /I have a community need/ }).check(); await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Continue to CivicSpec" }).click(); await expect(page).toHaveURL(/\/app$/);
  await page.goto("/app/submissions/new"); await expect(page.getByRole("heading", { name: "Check owner eligibility first" })).toBeVisible();
  await page.getByRole("link", { name: "Review owner eligibility", exact: true }).click();
  await page.getByLabel("Owner type", { exact: true }).selectOption("INDIVIDUAL_NONCOMMERCIAL");
  await page.getByLabel("Organization or request name", { exact: true }).fill("Synthetic Community Need");
  await page.getByRole("checkbox", { name: /I attest that/ }).check();
  await page.getByRole("button", { name: "Submit eligibility details" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Eligibility details saved" })).toBeVisible();
  await expect(page.locator("main .owner-status").first()).toHaveText("Pending review");
  const record = new URL(page.url()).searchParams.get("record")!;
  await page.goto("/app/submissions/new"); await expect(page.getByRole("button", { name: "Create private draft", exact: true })).toBeVisible();
  await page.goto(`/app/owner/eligibility?record=${record}`);
  await page.getByRole("checkbox", { name: /I attest that/ }).uncheck();
  await page.getByRole("button", { name: "Submit eligibility details" }).click();
  await expect(page.locator("main .owner-status").first()).toHaveText("Deferred");
  await expect(page.locator("main")).toContainText("deferred to a post-pilot release");
  await page.getByLabel("Owner type", { exact: true }).selectOption("COMMERCIAL_DEFERRED"); await page.getByRole("checkbox", { name: /I attest that/ }).check();
  await page.getByRole("button", { name: "Submit eligibility details" }).click(); await expect(page.locator("main .owner-status").first()).toHaveText("Deferred");
  await expect.poll(async () => (await prisma.organization.findUniqueOrThrow({ where: { id: record } })).category).toBe("COMMERCIAL_DEFERRED");
  await page.goto("/app/submissions/new"); await expect(page.getByRole("heading", { name: "Check owner eligibility first" })).toBeVisible();
  await signOut(page);
});

test("all owner views reflow, preserve theme drafts/focus, and pass Light/Dark accessibility scans", async ({ page }) => {
  await signIn(page, emails[0]);
  const paths = ["/app/owner/eligibility", "/app/submissions", "/app/submissions/new", `/app/submissions/${submissions[0]}`, `/app/submissions/${submissions[0]}/interview`];
  for (const path of paths) {
    await page.goto(path);
    for (const theme of ["Light", "Dark"]) {
      const radio = page.getByRole("banner").getByRole("radio", { name: theme, exact: true });
      await radio.focus(); await page.keyboard.press("Space");
      await expect.poll(() => page.locator("html").getAttribute("data-theme")).toBe(theme.toLowerCase());
      await expect(radio).toBeFocused();
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      }
      for (const control of await page.locator("main a, main button, main select, main input:not([type=hidden]):not([type=checkbox]):not([type=radio]), main .terms-choice, main .role-choice").all()) if (await control.isVisible()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      expect((await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([]);
    }
  }
  await page.goto("/app/submissions/new"); await fillDraft(page);
  await page.getByRole("checkbox", { name: /I understand how this request/ }).check();
  const url = page.url();
  await page.getByRole("banner").getByRole("radio", { name: "Light", exact: true }).focus(); await page.keyboard.press("Space");
  await expect(page.getByLabel("Working title", { exact: true })).toHaveValue("Synthetic noncommercial request");
  await expect(page.getByRole("radio", { name: /Guided form/ })).toBeChecked(); await expect(page.getByRole("checkbox", { name: /I understand how this request/ })).toBeChecked();
  await expect(page).toHaveURL(url);
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.screenshot({ path: "test-results/auth/owner-new-request-light-320.png", fullPage: true });
  await signOut(page);
});
