import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import type { PrismaClient, RoleType } from "@prisma/client";
import { canStartPrivateDraft, privacyNoticeVersion } from "../../src/lib/owner-intake";
import { AuthError } from "../../src/server/auth/errors";
import type { AuthUser } from "../../src/server/auth/user";
import { createDraftTokens } from "../../src/server/discovery/draft-token";
import { createOwnerService, OwnerGateError, SubmissionUnavailableError } from "../../src/server/discovery/owner-service";
import { eligibilitySchema, OwnerInputError, parseOwnerInput } from "../../src/server/discovery/validation";

const tokens = createDraftTokens(randomBytes(48).toString("base64url"));
const eligibleInput = { expectedUserId: "owner-a", category: "COMMUNITY_GROUP", legalName: "Synthetic Community Group", noncommercialAttest: "on" };
function fixture() {
  let user: AuthUser | null = { id: "owner-a", email: "a@civicspec.local", displayName: "Synthetic A", roles: ["PROBLEM_OWNER"] };
  const current = { id: "owner-a", email: "a@civicspec.local", displayName: "Synthetic A", isSuspended: false, roles: [{ role: "PROBLEM_OWNER" as RoleType }] };
  const organization = { id: "org-a", legalName: "Synthetic A", category: "COMMUNITY_GROUP" as const, noncommercialAttest: true, eligibilityStatus: "VERIFIED" as string, einOrRegistration: null, websiteUrl: null, updatedAt: new Date("2026-01-01T00:00:00Z") };
  const queries: Record<string, unknown>[] = [];
  const writes: { kind: string; data: Record<string, unknown> }[] = [];
  let exists = false;
  const tx = {
    $queryRaw: async () => [], user: { findUnique: async () => current },
    organization: {
      findMany: async (args: Record<string, unknown>) => { queries.push(args); return [organization]; },
      findFirst: async (args: { where: { id: string; members: unknown } }) => { queries.push(args); return args.where.id === organization.id ? organization : null; },
      create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ kind: "organization", data }); return { id: "created-org" }; },
      update: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ kind: "organization", data }); return { id: organization.id }; },
    },
    problemSubmission: {
      findMany: async (args: Record<string, unknown>) => { queries.push(args); return []; },
      findFirst: async (args: { where: { id: string; ownerId: string } }) => { queries.push(args); return args.where.id === "saved" || exists ? { id: args.where.id } : null; },
      create: async ({ data }: { data: Record<string, unknown> }) => { exists = true; writes.push({ kind: "draft", data }); return { id: data.id }; },
    },
    auditEvent: { create: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ kind: "audit", data }); } },
  };
  const database = { ...tx, $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx) } as unknown as PrismaClient;
  const service = createOwnerService(database, async () => user, tokens);
  const draft = { draftToken: tokens.mint(current.id), organizationId: organization.id, title: "Synthetic intake", preferredMode: "CHAT", privacyAck: "on", privacyNoticeVersion, noncommercialPurpose: "on" };
  return { service, current, organization, queries, writes, draft, login: (value: AuthUser | null) => { user = value; } };
}

test("pilot gate admits only attested noncommercial private drafts and blocks rejected/deferred records", () => {
  for (const category of ["NONPROFIT_501C3", "COMMUNITY_GROUP", "INDIVIDUAL_NONCOMMERCIAL", "COMMERCIAL_DEFERRED"] as const) {
    for (const eligibilityStatus of ["PENDING", "NEEDS_INFO", "VERIFIED", "REJECTED", "DEFERRED"] as const) {
      assert.equal(canStartPrivateDraft({ category, noncommercialAttest: true, eligibilityStatus }), category !== "COMMERCIAL_DEFERRED" && ["PENDING", "NEEDS_INFO", "VERIFIED"].includes(eligibilityStatus));
      assert.equal(canStartPrivateDraft({ category, noncommercialAttest: false, eligibilityStatus }), false);
    }
  }
});

test("eligibility validation rejects injected verification fields, unsafe websites, and oversized details", () => {
  assert.equal(parseOwnerInput(eligibilitySchema, eligibleInput).noncommercialAttest, true);
  assert.equal(parseOwnerInput(eligibilitySchema, { ...eligibleInput, noncommercialAttest: undefined }).noncommercialAttest, false);
  for (const change of [{ eligibilityStatus: "VERIFIED" }, { verifiedById: "admin" }, { userId: "other" }, { websiteUrl: "javascript:alert(1)" }, { websiteUrl: "https://user:password@example.invalid" }, { legalName: "x".repeat(161) }, { einOrRegistration: "x\nsecret" }, { category: ["COMMUNITY_GROUP", "NONPROFIT_501C3"] }]) assert.throws(() => parseOwnerInput(eligibilitySchema, { ...eligibleInput, ...change }), OwnerInputError);
});

test("draft tokens are unpredictable, tamper-resistant, account-bound, and stable on replay", () => {
  const token = tokens.mint("owner-a");
  assert.notEqual(token, tokens.mint("owner-a"));
  assert.equal(tokens.read("owner-a", token), token.split(".")[0]);
  assert.equal(tokens.read("owner-b", token), null);
  assert.equal(tokens.read("owner-a", `${token.slice(0, -1)}${token.endsWith("A") ? "B" : "A"}`), null);
  assert.equal(tokens.read("owner-a", "not-a-token"), null);
});

test("every owner service operation rejects unauthenticated or non-owner callers before resource lookup", async () => {
  for (const roles of [null, [], ["DEVELOPER"], ["REVIEWER"], ["ADMIN"]] as const) {
    const f = fixture();
    f.login(roles === null ? null : { id: f.current.id, email: f.current.email, displayName: f.current.displayName, roles });
    for (const operation of [() => f.service.eligibility(), () => f.service.list(), () => f.service.get("saved"), () => f.service.attest(eligibleInput), () => f.service.createDraft(f.draft)]) await assert.rejects(operation(), (error: unknown) => error instanceof AuthError && error.status === (roles === null ? 401 : 403));
    assert.equal(f.queries.length, 0); assert.equal(f.writes.length, 0);
  }
});

test("owner reads scope every resource in the query and omit private/internal relations", async () => {
  const f = fixture();
  await f.service.eligibility(); await f.service.list(2); await f.service.get("saved");
  assert.deepEqual(f.queries[0].where, { members: { some: { userId: "owner-a" } } });
  assert.deepEqual(f.queries[1].where, { ownerId: "owner-a" }); assert.equal(f.queries[1].skip, 20);
  assert.deepEqual(f.queries[2].where, { id: "saved", ownerId: "owner-a" });
  assert.ok(!/priorityEligibility|partnerReferral|sourceRecords|reviewNotes|verifiedById|repository|organizations/.test(JSON.stringify(f.queries)));
  await assert.rejects(f.service.get("foreign"), SubmissionUnavailableError);
  await assert.rejects(f.service.get("missing"), SubmissionUnavailableError);
});

test("attestation defers commercial/unattested records and never self-verifies", async () => {
  for (const fields of [eligibleInput, { ...eligibleInput, category: "COMMERCIAL_DEFERRED" }, { ...eligibleInput, noncommercialAttest: undefined }]) {
    const f = fixture(); await f.service.attest(fields);
    const data = f.writes[0].data;
    assert.equal(data.eligibilityStatus, fields.category === "COMMERCIAL_DEFERRED" || !fields.noncommercialAttest ? "DEFERRED" : "PENDING");
    assert.equal(data.verifiedAt, null); assert.equal(data.verifiedById, null);
    assert.equal(f.writes[1].kind, "audit");
    assert.ok(!/legalName|einOrRegistration|websiteUrl/.test(JSON.stringify(f.writes[1].data.metadata)));
  }
});

test("unchanged verified details preserve the decision; changed or stale details cannot retain verification", async () => {
  const f = fixture();
  const input = { ...eligibleInput, legalName: f.organization.legalName, organizationId: f.organization.id, revision: f.organization.updatedAt.toISOString() };
  await f.service.attest(input); assert.equal(f.writes.length, 0);
  await f.service.attest({ ...input, legalName: "Changed synthetic details" }); assert.equal(f.writes[0].data.eligibilityStatus, "PENDING");
  const stale = fixture(); await assert.rejects(stale.service.attest({ ...input, revision: "2025-01-01T00:00:00Z" }), OwnerInputError); assert.equal(stale.writes.length, 0);
});

test("privacy version, acknowledgment, purpose, mode, and actor token are mandatory before any draft write", async () => {
  const f = fixture();
  for (const change of [{ privacyAck: undefined }, { privacyNoticeVersion: "old" }, { noncommercialPurpose: undefined }, { preferredMode: "OTHER" }, { ownerId: "owner-b" }, { draftToken: tokens.mint("owner-b") }]) await assert.rejects(f.service.createDraft({ ...f.draft, ...change }), OwnerInputError);
  assert.equal(f.writes.length, 0);
  await f.service.createDraft(f.draft); await f.service.createDraft(f.draft);
  assert.equal(f.writes.filter(write => write.kind === "draft").length, 1);
  assert.equal(f.writes.filter(write => write.kind === "audit").length, 1);
  const data = f.writes[0].data;
  assert.equal(data.ownerId, "owner-a"); assert.equal(data.state, "DRAFT"); assert.ok(data.privacyNoticeAckAt instanceof Date);
  assert.deepEqual(Object.keys(data).sort(), ["draftState", "id", "organizationId", "ownerId", "privacyNoticeAckAt", "state", "title"]);
});

test("draft creation rechecks membership, latest eligibility, suspension, and role revocation", async () => {
  const f = fixture();
  await assert.rejects(f.service.attest({ ...eligibleInput, expectedUserId: "owner-b" }), AuthError);
  await assert.rejects(f.service.createDraft({ ...f.draft, organizationId: "other-org" }), AuthError);
  f.organization.noncommercialAttest = false; await assert.rejects(f.service.createDraft(f.draft), OwnerGateError);
  f.organization.noncommercialAttest = true; f.organization.eligibilityStatus = "REJECTED"; await assert.rejects(f.service.createDraft(f.draft), OwnerGateError);
  f.current.roles = []; await assert.rejects(f.service.createDraft(f.draft), (error: unknown) => error instanceof AuthError && error.status === 403);
  f.current.isSuspended = true; await assert.rejects(f.service.attest(eligibleInput), (error: unknown) => error instanceof AuthError && error.status === 401);
  assert.equal(f.writes.length, 0);
});
