import "server-only";
import type { Prisma, PrismaClient } from "@prisma/client";
import { canStartPrivateDraft, commercialExplanation, privacyNoticeVersion } from "@/lib/owner-intake";
import { AuthError } from "@/server/auth/errors";
import { authUserSelect, type AuthUser } from "@/server/auth/user";
import { eligibilitySchema, newRequestSchema, OwnerInputError, parseOwnerInput } from "./validation";
import type { createDraftTokens } from "./draft-token";

export const organizationSelect = {
  id: true, legalName: true, category: true, websiteUrl: true, einOrRegistration: true,
  noncommercialAttest: true, eligibilityStatus: true, updatedAt: true,
} as const satisfies Prisma.OrganizationSelect;
const submissionSelect = {
  id: true, title: true, state: true, updatedAt: true, privacyNoticeAckAt: true,
  draftState: { select: { preferredMode: true, lastSavedAt: true } },
  projects: { orderBy: { createdAt: "asc" }, select: { id: true, opaqueSlug: true, state: true, updatedAt: true, anonymousProfile: { select: { publicTitle: true } } } },
} as const satisfies Prisma.ProblemSubmissionSelect;
export class SubmissionUnavailableError extends Error { constructor() { super("Request unavailable"); } }
export class OwnerGateError extends Error {}
export type OwnerOrganization = Prisma.OrganizationGetPayload<{ select: typeof organizationSelect }>;

export function createOwnerService(database: PrismaClient, resolveUser: () => Promise<AuthUser | null>, tokens: ReturnType<typeof createDraftTokens>) {
  async function actor() {
    const user = await resolveUser();
    if (!user) throw new AuthError(401);
    if (!user.roles.includes("PROBLEM_OWNER")) throw new AuthError(403);
    return user;
  }
  async function lockActor(tx: Prisma.TransactionClient, id: string) {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${id} FOR UPDATE`;
    const current = await tx.user.findUnique({ where: { id }, select: authUserSelect });
    if (!current || current.isSuspended) throw new AuthError(401);
    if (!current.roles.some(({ role }) => role === "PROBLEM_OWNER")) throw new AuthError(403);
  }
  async function organization(tx: Prisma.TransactionClient, userId: string, id: string) {
    const where = { id, members: { some: { userId } } };
    const own = await tx.organization.findFirst({ where, select: organizationSelect });
    if (!own) throw new AuthError(403);
    await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${own.id} FOR UPDATE`;
    const current = await tx.organization.findFirst({ where, select: organizationSelect });
    if (!current) throw new AuthError(403);
    return current;
  }
  return {
    async eligibility() {
      const user = await actor();
      return database.organization.findMany({ where: { members: { some: { userId: user.id } } }, select: organizationSelect, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    },
    async attest(input: unknown) {
      const user = await actor();
      const value = parseOwnerInput(eligibilitySchema, input);
      if (value.expectedUserId !== user.id) throw new AuthError(403);
      return database.$transaction(async tx => {
        await lockActor(tx, user.id);
        const current = value.organizationId ? await organization(tx, user.id, value.organizationId) : null;
        if (current && current.updatedAt.toISOString() !== value.revision) throw new OwnerInputError({}, "This eligibility record changed. Reload the page before editing it again.");
        const fields = { legalName: value.legalName, category: value.category, einOrRegistration: value.einOrRegistration || null, websiteUrl: value.websiteUrl || null, noncommercialAttest: value.noncommercialAttest };
        // Saving unchanged details must not undo an administrator's decision.
        if (current && Object.entries(fields).every(([key, field]) => current[key as keyof typeof fields] === field)) return current.id;
        const eligibilityStatus = value.category === "COMMERCIAL_DEFERRED" || !value.noncommercialAttest ? "DEFERRED" : "PENDING";
        const data = { ...fields, eligibilityStatus, verifiedById: null, verifiedAt: null, reviewNotes: null } as const;
        const saved = current
          ? await tx.organization.update({ where: { id: current.id }, data, select: { id: true } })
          : await tx.organization.create({ data: { ...data, members: { create: { userId: user.id } } }, select: { id: true } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "OWNER_ELIGIBILITY_ATTESTED", entityType: "Organization", entityId: saved.id, rationale: "Owner submitted pilot eligibility details for human verification.", metadata: { category: value.category, noncommercialAttest: value.noncommercialAttest, eligibilityStatus } } });
        return saved.id;
      });
    },
    async list(page = 1) {
      const user = await actor();
      const currentPage = Number.isInteger(page) && page > 0 && page <= 10000 ? page : 1;
      const rows = await database.problemSubmission.findMany({ where: { ownerId: user.id }, select: submissionSelect, orderBy: [{ updatedAt: "desc" }, { id: "desc" }], skip: (currentPage - 1) * 20, take: 21 });
      return { submissions: rows.slice(0, 20), hasNext: rows.length > 20, page: currentPage };
    },
    async get(id: string) {
      const user = await actor();
      const submission = await database.problemSubmission.findFirst({ where: { id, ownerId: user.id }, select: submissionSelect });
      if (!submission) throw new SubmissionUnavailableError();
      return submission;
    },
    async createDraft(input: unknown) {
      const user = await actor();
      const value = parseOwnerInput(newRequestSchema, input);
      const id = tokens.read(user.id, value.draftToken);
      if (!id) throw new OwnerInputError({}, "This draft form is no longer valid. Reload the page and try again.");
      return database.$transaction(async tx => {
        await lockActor(tx, user.id);
        const own = await organization(tx, user.id, value.organizationId);
        if (own.category === "COMMERCIAL_DEFERRED" || !own.noncommercialAttest) throw new OwnerGateError(commercialExplanation);
        if (!canStartPrivateDraft(own)) throw new OwnerGateError("Your eligibility record needs review before you can create another request. Check your eligibility status.");
        const existing = await tx.problemSubmission.findFirst({ where: { id, ownerId: user.id }, select: { id: true } });
        if (existing) return existing.id;
        const timestamp = new Date();
        const saved = await tx.problemSubmission.create({ data: {
          id, ownerId: user.id, organizationId: own.id, title: value.title, state: "DRAFT", privacyNoticeAckAt: timestamp,
          draftState: { create: { preferredMode: value.preferredMode, lastSavedAt: timestamp } },
        }, select: { id: true } });
        await tx.auditEvent.create({ data: { actorId: user.id, action: "DISCOVERY_DRAFT_CREATED", entityType: "ProblemSubmission", entityId: saved.id, rationale: "Owner acknowledged recording/sharing notice and noncommercial project purpose.", metadata: { privacyNoticeVersion, preferredMode: value.preferredMode, noncommercialPurpose: true } } });
        return saved.id;
      });
    },
  };
}
