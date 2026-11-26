import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { loadEnvConfig } from "@next/env";
import { PrismaClient, type RoleType } from "@prisma/client";
import { currentAnswers, questions, type Interview, type InterviewChange } from "../../src/lib/discovery";
import { createInterviewService, InterviewError } from "../../src/server/discovery/interview";
import { SubmissionUnavailableError } from "../../src/server/discovery/owner-service";
import { AuthError } from "../../src/server/auth/errors";

loadEnvConfig(process.cwd());

test("dual-mode discovery transactions in PostgreSQL", async context => {
  const prisma = new PrismaClient();
  const ids = Array.from({ length: 5 }, () => randomUUID());
  const owner = ids[0];
  const roles: RoleType[] = ["PROBLEM_OWNER", "PROBLEM_OWNER", "REVIEWER", "ADMIN", "DEVELOPER"];
  const organizationId = randomUUID();
  const submissionIds = Array.from({ length: 4 }, () => randomUUID());
  const [submissionId, unacknowledgedId, wizardId, chatId] = submissionIds;
  const makeService = (index: number) => createInterviewService(prisma, async () => ({
    id: ids[index], email: `${ids[index]}@civicspec.local`, displayName: "Synthetic Discovery User", roles: [roles[index]],
  }));
  const service = makeService(0);
  const change = (draft: Interview, patch: Partial<InterviewChange> = {}): InterviewChange => ({
    revision: draft.revision, mode: draft.mode, step: draft.step, requestId: randomUUID(), ...patch,
  });
  let draft: Interview;
  try {
    await prisma.user.createMany({ data: ids.map(id => ({ id, email: `${id}@civicspec.local`, displayName: "Synthetic Discovery User" })) });
    await prisma.userRole.createMany({ data: ids.map((userId, index) => ({ userId, role: roles[index] })) });
    await prisma.organization.create({ data: {
      id: organizationId, legalName: "Synthetic Discovery Group", category: "COMMUNITY_GROUP",
      noncommercialAttest: true, eligibilityStatus: "VERIFIED", members: { create: { userId: owner } },
    } });
    for (const id of submissionIds) {
      await prisma.problemSubmission.create({ data: {
        id, ownerId: owner, organizationId, title: "Synthetic Discovery Request",
        privacyNoticeAckAt: id === unacknowledgedId ? null : new Date(),
        draftState: { create: { preferredMode: id === wizardId ? "WIZARD" : "CHAT" } },
      } });
    }

    await context.test("foreign owners, builders, and unassigned reviewers get the same denial as missing IDs", async () => {
      draft = await service.read(submissionId);
      for (const index of [1, 2, 4]) {
        for (const id of [submissionId, "missing"]) {
          await assert.rejects(makeService(index).read(id), SubmissionUnavailableError);
          await assert.rejects(makeService(index).change(id, change(draft)), SubmissionUnavailableError);
        }
      }
      assert.equal((await makeService(3).read(submissionId)).canEdit, false);
      await assert.rejects(makeService(3).change(submissionId, change(draft)), SubmissionUnavailableError);
      await assert.rejects(service.read(unacknowledgedId), SubmissionUnavailableError);
      await assert.rejects(service.change(unacknowledgedId, change(draft)), SubmissionUnavailableError);
      assert.equal(await prisma.discoverySourceRecord.count({ where: { submissionId } }), 0);
    });

    await context.test("retry-safe saves and mode round trips preserve wording, provenance, and wizard position", async () => {
      const payload = change(draft, { mode: "WIZARD", answer: { key: "need", content: "  We track stock by hand.\n", replaces: null } });
      const [first, retry] = await Promise.all([service.change(submissionId, payload), service.change(submissionId, payload)]);
      assert.deepEqual(retry, first);
      assert.equal(first.sources.length, 2);
      assert.equal(first.sources[0].authorRole, "ASSISTANT");
      assert.equal(first.sources[1].content, "  We track stock by hand.\n");
      assert.equal(first.sources[1].inputMode, "CHAT");
      const wizard = await service.change(submissionId, change(first, {
        step: 2, answer: { key: "workflow", content: "Volunteers share a notebook.", replaces: null },
      }));
      const chat = await service.change(submissionId, change(wizard, { mode: "CHAT" }));
      draft = await service.change(submissionId, change(chat, { mode: "WIZARD" }));
      assert.equal(draft.step, 2);
      assert.deepEqual(draft.sources, wizard.sources);
      assert.deepEqual(await makeService(0).read(submissionId), draft);
      assert.equal(draft.sources[2].questionText, questions[1].text);
      assert.ok(draft.sources[2].questionVersion);
      assert.equal(await prisma.projectProfile.count({ where: { submissionId } }), 2);
      await assert.rejects(service.change(submissionId, payload), /changed in another session/);
      assert.deepEqual(await service.read(submissionId), draft);
    });

    await context.test("corrections preserve original content and stale or foreign source IDs cannot change lineage", async () => {
      const original = draft.sources[1];
      await assert.rejects(service.change(submissionId, change(draft, {
        answer: { key: "need", content: "Wrong lineage", replaces: "foreign" },
      })), InterviewError);
      const oldRevision = draft;
      draft = await service.change(submissionId, change(draft, {
        answer: { key: "need", content: "Updated: staff track stock.", replaces: original.id },
      }));
      const latest = currentAnswers(draft.sources).get("need")!;
      assert.equal(latest.content, "Updated: staff track stock.");
      assert.equal(latest.inputMode, "WIZARD");
      assert.equal(draft.sources[1].supersededById, latest.id);
      assert.equal(draft.sources[1].content, original.content);
      assert.equal(draft.sources[1].questionText, original.questionText);
      await assert.rejects(service.change(submissionId, change(oldRevision, { mode: "CHAT" })), /changed in another session/);
      await prisma.discoverySourceRecord.update({ where: { id: latest.id }, data: { isRedacted: true } });
      const restricted = await service.read(submissionId);
      assert.equal(restricted.sources.at(-1)?.content, null);
      assert.equal(restricted.sources.at(-1)?.questionText, null);
    });

    await context.test("either mode can independently reach human review, gated by complete answers and verified eligibility", async () => {
      for (const id of [wizardId, chatId]) {
        let current = await service.read(id);
        await assert.rejects(service.change(id, change(current, { submit: true })), /unanswered sections/);
        for (const [index, question] of questions.entries()) {
          current = await service.change(id, change(current, {
            step: current.mode === "WIZARD" ? index + 2 : 1,
            answer: { key: question.key, content: `Synthetic answer ${index + 1}`, replaces: null },
          }));
        }
        assert.ok(current.sources.every(source => source.inputMode === current.mode));
        await prisma.organization.update({ where: { id: organizationId }, data: { eligibilityStatus: "PENDING" } });
        await assert.rejects(service.change(id, change(current, { submit: true })), /must be verified/);
        await prisma.organization.update({ where: { id: organizationId }, data: { eligibilityStatus: "VERIFIED" } });
        const submit = change(current, { submit: true });
        const saved = await service.change(id, submit);
        assert.equal(saved.state, "SUBMITTED");
        assert.equal(saved.canEdit, false);
        assert.deepEqual(await service.change(id, submit), saved);
        assert.equal(await prisma.auditEvent.count({ where: { entityId: id, action: "DISCOVERY_SUBMITTED" } }), 1);
        await assert.rejects(service.change(id, change(saved)), /can’t be edited/);
      }
    });

    await context.test("a stale session cannot write after owner-role revocation or suspension", async () => {
      await prisma.userRole.deleteMany({ where: { userId: owner } });
      await assert.rejects(service.change(submissionId, change(draft)), SubmissionUnavailableError);
      await prisma.user.update({ where: { id: owner }, data: { isSuspended: true } });
      await assert.rejects(service.change(submissionId, change(draft)), AuthError);
    });
  } finally {
    await prisma.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
    await prisma.problemSubmission.deleteMany({ where: { id: { in: submissionIds } } });
    await prisma.organization.deleteMany({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
});
