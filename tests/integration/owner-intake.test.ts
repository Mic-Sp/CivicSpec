import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { test } from "node:test";
import { loadEnvConfig } from "@next/env";
import { PrismaClient, type OwnerCategory } from "@prisma/client";
import { privacyNoticeVersion } from "../../src/lib/owner-intake";
import { AuthError } from "../../src/server/auth/errors";
import { createAuthService } from "../../src/server/auth/service";
import { createDraftTokens } from "../../src/server/discovery/draft-token";
import { createOwnerService, OwnerGateError, SubmissionUnavailableError } from "../../src/server/discovery/owner-service";
import { OwnerInputError } from "../../src/server/discovery/validation";

loadEnvConfig(process.cwd());
test("owner intake eligibility, isolation, and atomic recording in PostgreSQL", async context => {
  assert.notEqual(process.env.NODE_ENV, "production");
  const prisma = new PrismaClient();
  const prefix = `owner_intake_${randomUUID()}`;
  const ids = ["a", "b", "builder", "admin"].map(name => `${prefix}_${name}`);
  const secret = randomBytes(48).toString("base64url");
  const tokens = createDraftTokens(secret);
  const auth = createAuthService(prisma, { secret: () => secret });
  const services: ReturnType<typeof createOwnerService>[] = [];
  const input = { expectedUserId: ids[0], legalName: "Synthetic private owner record", category: "COMMUNITY_GROUP", noncommercialAttest: "on" };
  let organizationId = ""; let otherOrganizationId = ""; let submissionId = "";
  const draft = (ownerIndex = 0, mode = "CHAT") => ({ draftToken: tokens.mint(ids[ownerIndex]), organizationId: ownerIndex === 0 ? organizationId : otherOrganizationId, title: `Synthetic request ${mode}`, preferredMode: mode, privacyAck: "on", privacyNoticeVersion, noncommercialPurpose: "on" });
  try {
    for (let index = 0; index < ids.length; index++) {
      await prisma.user.create({ data: { id: ids[index], email: `${ids[index]}@civicspec.local`, displayName: "Synthetic Intake Test", roles: { create: { role: index < 2 ? "PROBLEM_OWNER" : index === 2 ? "DEVELOPER" : "ADMIN" } } } });
      const session = await auth.createSession(ids[index]);
      services.push(createOwnerService(prisma, () => auth.resolveSession(session.token), tokens));
    }
    await context.test("seeded owner retains verified nonprofit; new attestations are pending, never self-verified", async () => {
      const seeded = await prisma.user.findUniqueOrThrow({ where: { email: "owner@civicspec.local" }, select: { id: true, email: true, displayName: true } });
      const seededService = createOwnerService(prisma, async () => ({ ...seeded, roles: ["PROBLEM_OWNER"] }), tokens);
      assert.ok((await seededService.eligibility()).some(record => record.legalName === "Example Community Food Pantry" && record.eligibilityStatus === "VERIFIED"));
      organizationId = await services[0].attest(input);
      otherOrganizationId = await services[1].attest({ ...input, expectedUserId: ids[1], legalName: "PRIVATE_OTHER_OWNER_RECORD" });
      const saved = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
      assert.equal(saved.eligibilityStatus, "PENDING"); assert.equal(saved.verifiedAt, null);
      assert.equal(await prisma.organizationMember.count({ where: { organizationId, userId: ids[0] } }), 1);
      for (const extra of [{ eligibilityStatus: "VERIFIED" }, { ownerId: ids[1] }, { verifiedAt: new Date().toISOString() }]) await assert.rejects(services[0].attest({ ...input, ...extra }), OwnerInputError);
    });
    await context.test("builders, admins without owner role, and unauthenticated callers are denied", async () => {
      for (const service of [services[2], services[3], createOwnerService(prisma, async () => null, tokens)]) {
        for (const operation of [() => service.eligibility(), () => service.list(), () => service.get("arbitrary"), () => service.attest(input), () => service.createDraft(draft())]) await assert.rejects(operation(), AuthError);
      }
    });
    await context.test("missing notice acknowledgment, stale notice, or commercial purpose records no draft or source data", async () => {
      for (const change of [{ privacyAck: undefined }, { privacyNoticeVersion: "stale" }, { noncommercialPurpose: undefined }, { preferredMode: "bad" }]) await assert.rejects(services[0].createDraft({ ...draft(), ...change }), OwnerInputError);
      assert.equal(await prisma.problemSubmission.count({ where: { ownerId: ids[0] } }), 0);
      assert.equal(await prisma.discoverySourceRecord.count({ where: { authorUserId: ids[0] } }), 0);
    });
    await context.test("both modes create exactly one DRAFT plus draft state, acknowledgment, and minimal audit receipt", async () => {
      for (const mode of ["CHAT", "WIZARD"]) {
        const data = draft(0, mode);
        const results = await Promise.all([services[0].createDraft(data), services[0].createDraft(data)]);
        assert.equal(results[0], results[1]); submissionId = results[0];
        const saved = await prisma.problemSubmission.findUniqueOrThrow({ where: { id: submissionId }, include: { draftState: true } });
        assert.equal(saved.ownerId, ids[0]); assert.equal(saved.state, "DRAFT"); assert.equal(saved.organizationId, organizationId);
        assert.ok(saved.privacyNoticeAckAt); assert.equal(saved.draftState?.preferredMode, mode); assert.equal(saved.draftState?.currentWizardStep, 1);
        assert.equal(await prisma.discoverySourceRecord.count({ where: { submissionId } }), 0);
        assert.equal(await prisma.projectProfile.count({ where: { submissionId } }), 0);
        const receipts = await prisma.auditEvent.findMany({ where: { entityId: submissionId } });
        assert.equal(receipts.length, 1);
        assert.deepEqual(receipts[0].metadata, { privacyNoticeVersion, preferredMode: mode, noncommercialPurpose: true });
      }
      assert.equal(await prisma.problemSubmission.count({ where: { ownerId: ids[0] } }), 2);
    });
    await context.test("owner queries isolate submissions, child states, eligibility evidence, and unknown IDs", async () => {
      const other = await services[1].createDraft(draft(1));
      await prisma.project.create({ data: { opaqueSlug: `CS-${randomUUID()}`, submissionId, category: "Synthetic", requiredSkills: ["TypeScript"], state: "PUBLISHED" } });
      const list = await services[0].list();
      assert.equal(list.submissions.length, 2); assert.ok(!JSON.stringify(list).includes(other));
      const detail = await services[0].get(submissionId); assert.equal(detail.projects[0].state, "PUBLISHED");
      assert.ok(!/sourceRecords|repository|priorityEligibility|partnerReferral|organizationId|ownerId/.test(JSON.stringify(detail)));
      await assert.rejects(services[0].get(other), SubmissionUnavailableError);
      await assert.rejects(services[0].get("unknown-request"), SubmissionUnavailableError);
      await assert.rejects(services[0].createDraft({ ...draft(), organizationId: otherOrganizationId }), AuthError);
      await assert.rejects(services[0].createDraft({ ...draft(), draftToken: tokens.mint(ids[1]) }), OwnerInputError);
      await assert.rejects(services[0].attest({ ...input, organizationId: otherOrganizationId, revision: new Date().toISOString() }), AuthError);
      await assert.rejects(services[0].attest({ ...input, expectedUserId: ids[1] }), AuthError);
      assert.ok(!(await services[0].eligibility()).some(record => record.id === otherOrganizationId));
    });
    await context.test("commercial category and absent attestation defer all otherwise eligible owner types", async () => {
      for (const category of ["COMMERCIAL_DEFERRED", "NONPROFIT_501C3", "COMMUNITY_GROUP", "INDIVIDUAL_NONCOMMERCIAL"] as OwnerCategory[]) {
        const id = await services[0].attest({ ...input, category, noncommercialAttest: category === "COMMERCIAL_DEFERRED" ? "on" : undefined });
        assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id } })).eligibilityStatus, "DEFERRED");
        await assert.rejects(services[0].createDraft({ ...draft(), organizationId: id }), OwnerGateError);
      }
    });
    await context.test("verified details remain verified unchanged; edits reset verification and stale edits fail", async () => {
      const record = await prisma.organization.update({ where: { id: organizationId }, data: { eligibilityStatus: "VERIFIED", verifiedAt: new Date(), verifiedById: ids[3], reviewNotes: "PRIVATE_ADMIN_NOTES" } });
      await services[0].attest({ ...input, organizationId, revision: record.updatedAt.toISOString() });
      assert.equal((await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } })).eligibilityStatus, "VERIFIED");
      assert.ok(!JSON.stringify(await services[0].eligibility()).includes("PRIVATE_ADMIN_NOTES"));
      await services[0].attest({ ...input, legalName: "Updated synthetic group", organizationId, revision: record.updatedAt.toISOString() });
      const updated = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId } });
      assert.equal(updated.eligibilityStatus, "PENDING"); assert.equal(updated.verifiedAt, null); assert.equal(updated.verifiedById, null);
      await assert.rejects(services[0].attest({ ...input, organizationId, revision: record.updatedAt.toISOString() }), OwnerInputError);
    });
    await context.test("draft writes reread eligibility and fail closed for rejected/deferred status", async () => {
      for (const eligibilityStatus of ["REJECTED", "DEFERRED"] as const) {
        await prisma.organization.update({ where: { id: organizationId }, data: { eligibilityStatus } });
        await assert.rejects(services[0].createDraft(draft()), OwnerGateError);
      }
      await prisma.organization.update({ where: { id: organizationId }, data: { eligibilityStatus: "NEEDS_INFO" } });
      assert.ok(await services[0].createDraft(draft()));
    });
    await context.test("audit failures roll back eligibility and draft writes atomically", async () => {
      const failing = prisma.$extends({ query: { auditEvent: { create() { throw new Error("Synthetic audit failure"); } } } });
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids[0] }, select: { id: true, email: true, displayName: true } });
      const service = createOwnerService(failing as unknown as PrismaClient, async () => ({ ...user, roles: ["PROBLEM_OWNER"] }), tokens);
      const before = await prisma.problemSubmission.count({ where: { ownerId: ids[0] } });
      await assert.rejects(service.createDraft(draft()), /Synthetic audit failure/);
      assert.equal(await prisma.problemSubmission.count({ where: { ownerId: ids[0] } }), before);
      await assert.rejects(service.attest({ ...input, legalName: "Rollback-only organization" }), /Synthetic audit failure/);
      assert.equal(await prisma.organization.count({ where: { legalName: "Rollback-only organization", members: { some: { userId: ids[0] } } } }), 0);
    });
    await context.test("role removal and suspension are checked again inside mutations", async () => {
      const user = await prisma.user.findUniqueOrThrow({ where: { id: ids[0] }, select: { id: true, email: true, displayName: true } });
      const stale = createOwnerService(prisma, async () => ({ ...user, roles: ["PROBLEM_OWNER"] }), tokens);
      await prisma.userRole.deleteMany({ where: { userId: ids[0] } });
      await assert.rejects(stale.createDraft(draft()), (error: unknown) => error instanceof AuthError && error.status === 403);
      await prisma.user.update({ where: { id: ids[0] }, data: { isSuspended: true } });
      await assert.rejects(stale.attest(input), (error: unknown) => error instanceof AuthError && error.status === 401);
    });
  } finally {
    const submissions = await prisma.problemSubmission.findMany({ where: { ownerId: { in: ids } }, select: { id: true } });
    const organizationIds = (await prisma.organization.findMany({ where: { members: { some: { userId: { in: ids } } } }, select: { id: true } })).map(record => record.id);
    await prisma.project.deleteMany({ where: { submissionId: { in: submissions.map(record => record.id) } } });
    await prisma.problemSubmission.deleteMany({ where: { ownerId: { in: ids } } });
    await prisma.organization.deleteMany({ where: { id: { in: organizationIds } } });
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
