import type { DiscoveryAuthorRole, IntakeMode, SubmissionState } from "@prisma/client";

export const questions = [
  { key: "need", title: "Your need", text: "What is not working, and what outcome would help the people affected?" },
  { key: "workflow", title: "Current workflow", text: "How do you handle this today? Who uses the process, and which tools or resources do they use?" },
  { key: "scope", title: "Scope and constraints", text: "What should the first version do or leave out? What limits apply to time, resources, access, accessibility, hosting, or sensitive data?" },
  { key: "handoff", title: "Success and handoff", text: "How will you know the solution works, and who can maintain it after handoff?" },
] as const;
export type QuestionKey = typeof questions[number]["key"];
export const questionVersion = "discovery-v1";
export const unknownAnswer = "I don’t know yet.";
export const modeNames = { CHAT: "Chat with CivicSpec", WIZARD: "Guided form" } as const;

export type DiscoverySource = {
  id: string;
  sequenceNumber: number;
  inputMode: IntakeMode;
  authorRole: DiscoveryAuthorRole;
  questionKey: string | null;
  questionText: string | null;
  questionVersion: string | null;
  content: string | null;
  supersededById: string | null;
  createdAt: string;
};
export type Interview = {
  id: string;
  title: string;
  state: SubmissionState;
  mode: IntakeMode;
  step: number;
  revision: number;
  savedAt: string;
  canEdit: boolean;
  canSubmit: boolean;
  readOnlyReason: string | null;
  sources: DiscoverySource[];
};
export type InterviewChange = {
  requestId: string;
  revision: number;
  mode: IntakeMode;
  step: number;
  answer?: { key: QuestionKey; content: string; replaces: string | null };
  submit?: true;
};

const legacyKeys: Record<string, QuestionKey> = {
  "inventory.problem": "need",
  "inventory.scope": "scope",
  "inventory.acceptance": "handoff",
};

export function currentAnswers(sources: DiscoverySource[]) {
  const answers = new Map<QuestionKey, DiscoverySource>();
  for (const source of sources) {
    if (source.authorRole !== "STAKEHOLDER" || source.supersededById || !source.questionKey) continue;
    const key = questions.find(q => q.key === source.questionKey)?.key ?? legacyKeys[source.questionKey];
    if (key) answers.set(key, source);
  }
  return answers;
}

export function nextChatQuestion(answers: ReturnType<typeof currentAnswers>) {
  return questions.find(question => !answers.get(question.key)?.content);
}

export function isResolved(answer: DiscoverySource | undefined) {
  return Boolean(answer?.content && answer.content !== unknownAnswer);
}
