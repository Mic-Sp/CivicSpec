import "server-only";
import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { currentAnswers, isResolved, questions, questionVersion, type DiscoverySource, type Interview } from "@/lib/discovery";
import { canStartPrivateDraft } from "@/lib/owner-intake";
import { AuthError } from "@/server/auth/errors";
import type { AuthUser } from "@/server/auth/user";
import { SubmissionUnavailableError } from "./owner-service";

const changeSchema = z.object({
  requestId: z.uuid(),
  revision: z.number().int().positive().max(2147483646),
  mode: z.enum(["CHAT", "WIZARD"]),
  step: z.number().int().min(1).max(5),
  answer: z.object({
    key: z.enum(["need", "workflow", "scope", "handoff"]),
    content: z.string().max(4000).refine(value => Boolean(value.trim()) && !value.includes("\u0000")),
    replaces: z.string().min(1).max(128).nullable(),
  }).strict().optional(),
  submit: z.literal(true).optional(),
}).strict();

const select = {
  id: true, ownerId: true, organizationId: true, title: true, state: true,
  version: true, privacyNoticeAckAt: true, updatedAt: true,
  organization: { select: { category: true, noncommercialAttest: true, eligibilityStatus: true } },
  draftState: { select: { preferredMode: true, currentWizardStep: true, lastSavedAt: true, pendingDraftJson: true } },
} as const satisfies Prisma.ProblemSubmissionSelect;
type Submission = Prisma.ProblemSubmissionGetPayload<{ select: typeof select }>;
export class InterviewError extends Error {}

function writable(submission: Submission) {
  return submission.state === "DRAFT" && !!submission.organization && canStartPrivateDraft(submission.organization);
}

async function history(db: Prisma.TransactionClient, id: string): Promise<DiscoverySource[]> {
  const rows = await db.discoverySourceRecord.findMany({
    where: { submissionId: id }, orderBy: { sequenceNumber: "asc" },
    select: { id: true, sequenceNumber: true, inputMode: true, authorRole: true, questionKey: true,
      questionText: true, questionVersion: true, content: true, isRedacted: true, supersededById: true, createdAt: true },
  });
  return rows.map(({ isRedacted, content, questionText, createdAt, ...source }) => ({
    ...source, content: isRedacted ? null : content, questionText: isRedacted ? null : questionText,
    createdAt: createdAt.toISOString(),
  }));
}

export function createInterviewService(database: PrismaClient, resolveUser: () => Promise<AuthUser | null>) {
  async function actor() {
    const user = await resolveUser();
    if (!user) throw new AuthError(401);
    return user;
  }

  function access(user: AuthUser, id: string, write = false): Prisma.ProblemSubmissionWhereInput {
    if (!write && user.roles.includes("ADMIN")) return { id, privacyNoticeAckAt: { not: null } };
    if (!user.roles.includes("PROBLEM_OWNER")) throw new SubmissionUnavailableError();
    return { id, ownerId: user.id, privacyNoticeAckAt: { not: null } };
  }

  async function load(db: Prisma.TransactionClient, where: Prisma.ProblemSubmissionWhereInput) {
    const submission = await db.problemSubmission.findFirst({ where, select });
    if (!submission) throw new SubmissionUnavailableError();
    return submission;
  }

  async function snapshot(db: Prisma.TransactionClient, submission: Submission, user: AuthUser): Promise<Interview> {
    const ownsDraft = submission.ownerId === user.id && user.roles.includes("PROBLEM_OWNER");
    const canEdit = ownsDraft && writable(submission);
    let readOnlyReason = null;
    if (submission.state !== "DRAFT") readOnlyReason = "This request is outside draft discovery. You can inspect its saved history.";
    else if (!ownsDraft) readOnlyReason = "You’re viewing the owner’s saved discovery history.";
    else if (!canEdit) readOnlyReason = "Check your owner eligibility before continuing this draft.";
    return {
      id: submission.id, title: submission.title, state: submission.state,
      mode: submission.draftState?.preferredMode ?? "CHAT",
      step: Math.min(5, Math.max(1, submission.draftState?.currentWizardStep ?? 1)),
      revision: submission.version,
      savedAt: (submission.draftState?.lastSavedAt ?? submission.updatedAt).toISOString(),
      canEdit, canSubmit: canEdit && submission.organization?.eligibilityStatus === "VERIFIED",
      readOnlyReason, sources: await history(db, submission.id),
    };
  }

  return {
    async read(id: string) {
      const user = await actor();
      return database.$transaction(async tx => snapshot(tx, await load(tx, access(user, id)), user),
        { isolationLevel: "RepeatableRead" });
    },
    async change(id: string, input: unknown) {
      const user = await actor();
      const where = access(user, id, true);
      const parsed = changeSchema.safeParse(input);
      if (!parsed.success) throw new InterviewError("Check your answer and try again. Answers can contain up to 4,000 characters.");
      const change = parsed.data;
      // Includes the payload, so using a receipt for different content cannot acknowledge that content.
      const receipt = createHash("sha256").update(JSON.stringify(change)).digest("hex");
      return database.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
        const owner = await tx.user.findUnique({
          where: { id: user.id }, select: { isSuspended: true, roles: { where: { role: "PROBLEM_OWNER" }, select: { role: true } } },
        });
        if (!owner || owner.isSuspended) throw new AuthError(401);
        if (!owner.roles.length) throw new SubmissionUnavailableError();
        await tx.$queryRaw`SELECT "id" FROM "ProblemSubmission" WHERE "id" = ${id} AND "ownerId" = ${user.id} FOR UPDATE`;
        let submission = await load(tx, where);
        if (submission.organizationId) {
          await tx.$queryRaw`SELECT "id" FROM "Organization" WHERE "id" = ${submission.organizationId} FOR UPDATE`;
          submission = await load(tx, where);
        }
        const last = submission.draftState?.pendingDraftJson;
        if (last && typeof last === "object" && "interviewReceipt" in last && last.interviewReceipt === receipt) {
          return snapshot(tx, submission, user);
        }
        if (!writable(submission)) throw new InterviewError("This draft can’t be edited. Check the request status and your owner eligibility.");
        if (submission.version !== change.revision) throw new InterviewError("This draft changed in another session. Keep a copy of any unsaved text, then reload the latest draft.");
        const sources = await history(tx, id);
        const answers = currentAnswers(sources);
        const draft = submission.draftState;
        if (change.submit && change.answer) throw new InterviewError("Save your changes before submitting for review.");
        if (change.answer) {
          const answer = change.answer;
          const previous = answers.get(answer.key);
          if ((previous?.id ?? null) !== answer.replaces) throw new InterviewError("This answer changed. Reload the latest draft before correcting it.");
          if (previous?.content !== answer.content) {
            const question = questions.find(item => item.key === answer.key)!;
            const inputMode = draft?.preferredMode ?? "CHAT";
            const prompt = { submissionId: id, inputMode, questionKey: question.key, questionText: question.text, questionVersion };
            let sequenceNumber = sources.at(-1)?.sequenceNumber ?? 0;
            if (inputMode === "CHAT") {
              await tx.discoverySourceRecord.create({ data: {
                ...prompt, sequenceNumber: ++sequenceNumber, authorRole: "ASSISTANT", content: question.text,
              } });
            }
            const saved = await tx.discoverySourceRecord.create({ data: {
              ...prompt, sequenceNumber: ++sequenceNumber, authorRole: "STAKEHOLDER",
              authorUserId: user.id, content: answer.content,
            }, select: { id: true } });
            if (previous) {
              // Only the lineage pointer changes. Original content and question context stay intact.
              await tx.discoverySourceRecord.update({ where: { id: previous.id }, data: { supersededById: saved.id } });
            }
            const latest = currentAnswers(await history(tx, id));
            const profile = await tx.projectProfile.findFirst({ where: { submissionId: id }, orderBy: { revisionNumber: "desc" }, select: { revisionNumber: true } });
            await tx.projectProfile.create({ data: {
              submissionId: id, revisionNumber: (profile?.revisionNumber ?? 0) + 1,
              structuredData: { format: "manual-discovery-v1", sections: questions.map(({ key }) => {
                const source = latest.get(key);
                return { key, status: isResolved(source) ? "CAPTURED" : "UNRESOLVED", sourceIds: source ? [source.id] : [] };
              }) },
            } });
          }
        }
        if (change.submit) {
          if (submission.organization?.eligibilityStatus !== "VERIFIED") throw new InterviewError("Owner eligibility must be verified before you submit for review.");
          if (!questions.every(({ key }) => isResolved(answers.get(key)))) throw new InterviewError("Resolve the unanswered sections before submitting for review.");
          await tx.auditEvent.create({ data: { actorId: user.id, entityType: "ProblemSubmission", entityId: id, action: "DISCOVERY_SUBMITTED" } });
        }
        const savedAt = new Date();
        const fields = { preferredMode: change.mode, currentWizardStep: change.step, lastSavedAt: savedAt,
          pendingDraftJson: { ...(last && typeof last === "object" && !Array.isArray(last) ? last : {}), interviewReceipt: receipt } };
        await tx.discoveryDraftState.upsert({ where: { submissionId: id }, create: { submissionId: id, ...fields }, update: fields });
        await tx.problemSubmission.update({ where: { id }, data: { version: { increment: 1 }, ...(change.submit ? { state: "SUBMITTED" } : {}) } });
        return snapshot(tx, await load(tx, where), user);
      }, { timeout: 15000 });
    },
  };
}
