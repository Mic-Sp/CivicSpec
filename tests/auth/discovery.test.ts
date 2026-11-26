import assert from "node:assert/strict";
import { test } from "node:test";
import { currentAnswers, isResolved, nextChatQuestion, unknownAnswer, type DiscoverySource } from "../../src/lib/discovery";

function source(id: string, questionKey: string, fields: Partial<DiscoverySource> = {}): DiscoverySource {
  return {
    id, questionKey, sequenceNumber: 1, inputMode: "WIZARD", authorRole: "STAKEHOLDER",
    questionText: "Original prompt", questionVersion: "original-v1", content: "  Original wording\n",
    createdAt: "2026-01-01T00:00:00.000Z", supersededById: null, ...fields,
  };
}

test("chat skips sections answered in the guided form and recognizes legacy sources", () => {
  const sources = [source("a", "inventory.problem"), source("b", "scope"),
    source("prompt", "workflow", { authorRole: "ASSISTANT" })];
  const answers = currentAnswers(sources);
  assert.equal(answers.get("need"), sources[0]);
  assert.equal(answers.get("need")?.content, "  Original wording\n");
  assert.equal(nextChatQuestion(answers)?.key, "workflow");
});

test("superseded answers stay in history while the current answer controls progress", () => {
  const original = source("a", "need", { supersededById: "b" });
  const revision = source("b", "need", { content: unknownAnswer, inputMode: "CHAT" });
  const answers = currentAnswers([original, revision]);
  assert.equal(answers.get("need"), revision);
  assert.equal(original.content, "  Original wording\n");
  assert.equal(isResolved(revision), false);
  assert.equal(nextChatQuestion(answers)?.key, "workflow");
});

test("a restricted answer does not count as captured or resurrect an older answer", () => {
  const answers = currentAnswers([
    source("a", "need", { supersededById: "b" }),
    source("b", "need", { content: null, questionText: null }),
  ]);
  assert.equal(isResolved(answers.get("need")), false);
  assert.equal(nextChatQuestion(answers)?.key, "need");
});
