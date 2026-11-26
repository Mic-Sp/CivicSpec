import { createHmac, randomUUID } from "node:crypto";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../src/server/auth/password";

const prisma = new PrismaClient();
const emails = Array.from({ length: 2 }, () => `discovery_${randomUUID()}@civicspec.local`);
const password = "CivicSpecPilot123!";
const submissionId = randomUUID();
const organizationId = randomUUID();
const path = `/app/submissions/${submissionId}/interview`;
const ids: string[] = [];

test.beforeAll(async () => {
  const passwordHash = await hashPassword(password);
  for (const email of emails) {
    const user = await prisma.user.create({ data: {
      email, displayName: "Synthetic Discovery Owner", passwordHash, roles: { create: { role: "PROBLEM_OWNER" } },
    } });
    ids.push(user.id);
  }
  await prisma.organization.create({ data: {
    id: organizationId, legalName: "Synthetic Discovery Group", category: "COMMUNITY_GROUP",
    noncommercialAttest: true, eligibilityStatus: "PENDING", members: { create: { userId: ids[0] } },
  } });
  await prisma.problemSubmission.create({ data: {
    id: submissionId, ownerId: ids[0], organizationId, title: "Synthetic Interview Workspace",
    privacyNoticeAckAt: new Date(), draftState: { create: { preferredMode: "CHAT" } },
  } });
});

test.afterAll(async () => {
  await prisma.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
  await prisma.problemSubmission.deleteMany({ where: { id: submissionId } });
  await prisma.organization.deleteMany({ where: { id: organizationId } });
  await prisma.user.deleteMany({ where: { id: { in: ids } } });
  const pairs = [["sign-in-global", "global"], ...emails.map(email => ["sign-in-account", email]),
    ...ids.flatMap(id => [["discovery-account", id], ["preferences-account", id]])];
  const keys = pairs.map(([scope, identity]) => createHmac("sha256", process.env.CIVICSPEC_BROWSER_AUTH_SECRET!)
    .update(`auth-limit:${scope}:${identity}`).digest("hex"));
  await prisma.authRateLimit.deleteMany({ where: { key: { in: keys } } });
  await prisma.$disconnect();
});

async function signIn(page: Page, index = 0) {
  await page.goto("/auth");
  await page.getByLabel("Email", { exact: true }).fill(emails[index]);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app$/);
}

const mode = (page: Page, name: string) => page.getByRole("group", { name: "Discovery mode" }).getByRole("button", { name });
const original = "We count boxes by hand.\nA weekly list would help.";

test("saves, discards, and resumes both modes with stable original records and corrections", async ({ page }) => {
  await signIn(page);
  await page.goto(path);
  await page.getByLabel("Your answer", { exact: true }).fill(original);
  await mode(page, "Guided form").click();
  const prompt = page.getByRole("dialog", { name: "You have an unsaved answer" });
  await expect(prompt).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(prompt).toBeHidden();
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue(original);
  await mode(page, "Guided form").click();
  await prompt.getByRole("button", { name: "Save answer and continue" }).click();
  await expect(page.getByRole("heading", { name: /Step 1 of 5/ })).toBeFocused();
  await expect(page.getByRole("status").filter({ hasText: "Switched to Guided form" })).toBeVisible();
  const firstRecords = await prisma.discoverySourceRecord.findMany({ where: { submissionId }, orderBy: { sequenceNumber: "asc" } });
  expect(firstRecords.map(record => record.authorRole)).toEqual(["ASSISTANT", "STAKEHOLDER"]);
  expect(firstRecords[1].content).toBe(original);

  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Step 2 of 5/ })).toBeFocused();
  await page.getByLabel("Your answer", { exact: true }).fill("Discard this unsaved answer.");
  await mode(page, "Chat with CivicSpec").click();
  await prompt.getByRole("button", { name: "Discard unsaved answer" }).click();
  await expect(mode(page, "Chat with CivicSpec")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#discovery-question")).toContainText("How do you handle this today?");
  await expect(page.getByLabel("Your answer", { exact: true })).toHaveValue("");
  expect(await prisma.discoverySourceRecord.count({ where: { submissionId } })).toBe(2);

  await mode(page, "Guided form").click();
  await expect(page.getByRole("heading", { name: /Step 2 of 5/ })).toBeFocused();
  await page.getByLabel("Your answer", { exact: true }).fill("Volunteers use a shared notebook.");
  await page.getByRole("button", { name: "Save and continue", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Step 3 of 5/ })).toBeFocused();
  await page.reload();
  await expect(page.getByRole("heading", { name: /Step 3 of 5/ })).toBeVisible();
  await mode(page, "Chat with CivicSpec").click();
  await expect(page.locator("#discovery-question")).toContainText("What should the first version do");
  await mode(page, "Guided form").click();
  await expect(page.getByRole("heading", { name: /Step 3 of 5/ })).toBeFocused();

  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Step 2 of 5/ })).toBeFocused();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Step 1 of 5/ })).toBeFocused();
  await page.getByRole("button", { name: "Correct saved answer", exact: true }).click();
  await expect(page.getByLabel("Revised answer", { exact: true })).toHaveValue(original);
  await page.getByLabel("Revised answer", { exact: true }).fill("Staff now count boxes once per week.");
  await page.getByRole("button", { name: "Save correction" }).click();
  const history = page.getByRole("region", { name: "Discovery history" });
  await expect(history.getByRole("link", { name: "View correction" })).toBeVisible();
  await expect(history).toContainText("We count boxes by hand.");
  await expect(history).toContainText("Staff now count boxes once per week.");
  const records = await prisma.discoverySourceRecord.findMany({ where: { submissionId }, orderBy: { sequenceNumber: "asc" } });
  expect(records.map(record => record.sequenceNumber)).toEqual([1, 2, 3, 4]);
  expect(records[1].id).toBe(firstRecords[1].id);
  expect(records[1].supersededById).toBe(records[3].id);
  expect(records[3].inputMode).toBe("WIZARD");
});

test("another problem owner sees the same neutral screen for an owned-by-others or missing request", async ({ page }) => {
  await signIn(page, 1);
  for (const url of [path, "/app/submissions/missing-discovery/interview"]) {
    await page.goto(url);
    await expect(page.getByRole("heading", { name: /could not be found/i })).toBeVisible();
    expect(await page.content()).not.toMatch(/Synthetic Interview Workspace|Staff now count|shared notebook/);
  }
});

test("both modes and the pending-input dialog reflow in Light and Dark without losing the draft", async ({ page }) => {
  test.slow();
  await signIn(page);
  await page.goto(path);
  for (const name of ["Chat with CivicSpec", "Guided form"]) {
    await mode(page, name).click();
    await expect(mode(page, name)).toHaveAttribute("aria-pressed", "true");
    // First wizard step may contain a saved answer. Use the correction editor when it does.
    const correct = page.getByRole("button", { name: "Correct saved answer", exact: true });
    if (await correct.isVisible()) await correct.click();
    const answer = page.locator("#discovery-answer");
    await answer.fill("Unsaved answer retained while changing appearance.");
    const heading = await page.locator("#interview-heading").innerText();
    for (const theme of ["Light", "Dark"]) {
      const radio = page.getByRole("banner").getByRole("radio", { name: theme, exact: true });
      await radio.focus();
      await page.keyboard.press("Space");
      await expect(page.locator("html")).toHaveAttribute("data-theme", theme.toLowerCase());
      await expect(radio).toBeFocused();
      await expect(answer).toHaveValue("Unsaved answer retained while changing appearance.");
      await expect(page.locator("#interview-heading")).toHaveText(heading);
      for (const width of [320, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
        for (const control of await page.locator("main button, main a, main textarea").all()) {
          if (await control.isVisible()) expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        }
        const scan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(scan.violations).toEqual([]);
        await mode(page, name === "Guided form" ? "Chat with CivicSpec" : "Guided form").click();
        const dialog = page.getByRole("dialog");
        await expect(dialog.getByRole("button", { name: "Keep editing" })).toBeFocused();
        const modalScan = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        expect(modalScan.violations).toEqual([]);
        await page.keyboard.press("Escape");
        await expect(dialog).toBeHidden();
      }
    }
    await mode(page, name === "Guided form" ? "Chat with CivicSpec" : "Guided form").click();
    await page.getByRole("dialog").getByRole("button", { name: "Discard unsaved answer" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
  }
});
