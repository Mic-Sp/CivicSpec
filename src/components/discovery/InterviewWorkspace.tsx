"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AlertCircle, ListChecks, MessageSquare } from "lucide-react";
import type { IntakeMode } from "@prisma/client";
import { saveInterview } from "@/app/app/(workspace)/submissions/[id]/interview/actions";
import { SavedTime } from "@/components/owner/SubmissionSummary";
import { OwnerStatusBadge } from "@/components/owner/OwnerStatusBadge";
import { currentAnswers, isResolved, modeNames, nextChatQuestion, questions, unknownAnswer,
  type Interview, type InterviewChange, type QuestionKey } from "@/lib/discovery";
import { AnswerOverview, DiscoveryHistory } from "./DiscoverySources";

type Destination = { mode: IntakeMode; step: number; exit?: true };

export function InterviewWorkspace({ initial, accountId }: { initial: Interview; accountId: string }) {
  const [draft, setDraft] = useState(initial);
  const [pending, setPending] = useState(false);
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<QuestionKey | null>(null);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [error, setError] = useState("");
  const [announcement, setAnnouncement] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const editor = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const focusAfterSave = useRef(false);
  const running = useRef(false);
  const lastChange = useRef<InterviewChange | null>(null);
  const router = useRouter();

  const answers = currentAnswers(draft.sources);
  const question = editing ? questions.find(item => item.key === editing) :
    draft.mode === "CHAT" ? nextChatQuestion(answers) : questions[draft.step - 1];
  const previous = question && answers.get(question.key);
  const reviewing = !question && draft.canEdit;
  const dirty = Boolean(question && (editing ? text !== (previous?.content ?? "") : text.length));
  const complete = questions.every(({ key }) => isResolved(answers.get(key)));

  useEffect(() => {
    const prompt = dialog.current;
    if (destination && prompt && !prompt.open) prompt.showModal();
    if (!destination && prompt?.open) prompt.close();
    // The native dialog restores focus when it closes. Move focus after that
    // restoration, once the destination heading has rendered.
    if (!destination && focusAfterSave.current) {
      focusAfterSave.current = false;
      heading.current?.focus();
    }
  }, [destination, draft.revision]);

  useEffect(() => { if (editing) editor.current?.focus(); }, [editing]);

  function correct(key: QuestionKey) {
    if (running.current) return;
    setError("");
    setEditing(key);
    setText(answers.get(key)?.content ?? "");
  }

  async function commit(target: Destination, content?: string, submit?: true) {
    if (running.current) return;
    if (content !== undefined && !content.trim()) {
      setError("Enter an answer, choose I don’t know yet, or discard the unsaved text.");
      return;
    }
    if (target.exit && content === undefined) {
      router.push("/app/submissions");
      return;
    }
    const payload = {
      revision: draft.revision, mode: target.mode, step: target.step, submit,
      answer: question && content !== undefined ? { key: question.key, content, replaces: previous?.id ?? null } : undefined,
    };
    const retry = lastChange.current;
    const requestId = retry && JSON.stringify({ ...retry, requestId: undefined }) === JSON.stringify(payload)
      ? retry.requestId : crypto.randomUUID();
    const change = { ...payload, requestId };
    lastChange.current = change;
    setError("");
    setAnnouncement("Saving discovery…");
    running.current = true;
    setPending(true);
    try {
      const result = await saveInterview(draft.id, accountId, change);
      if (!result.ok) {
        setError(result.message);
        setAnnouncement("");
        return;
      }
      focusAfterSave.current = !target.exit;
      setDraft(result.interview);
      setDestination(null);
      setText("");
      setEditing(null);
      lastChange.current = null;
      setAnnouncement(submit ? "Request submitted for review." :
        target.mode !== draft.mode ? `Switched to ${modeNames[target.mode]}. Progress saved.` : "Discovery saved.");
      if (target.exit) router.push("/app/submissions");
    } catch {
      setError("We couldn’t confirm this save. Your text is still here. Try again.");
      setAnnouncement("");
    } finally {
      running.current = false;
      setPending(false);
    }
  }

  function navigate(target: Destination) {
    if (dirty) {
      setError("");
      setDestination(target);
    } else void commit(target);
  }

  function cancelNavigation() {
    setDestination(null);
    setError("");
  }

  const here = { mode: draft.mode, step: draft.step };
  const next = { ...here, step: draft.mode === "WIZARD" && !editing ? Math.min(5, draft.step + 1) : draft.step };
  const title = !draft.canEdit ? "Review saved discovery" : editing ? `Correct ${question?.title.toLowerCase()}` :
    draft.mode === "WIZARD" ? `Step ${draft.step} of 5 · ${question?.title ?? "Review"}` :
    reviewing ? "Review captured answers" : "Chat with CivicSpec";

  return <div className="discovery-view owner-view">
    <h1>{draft.title}</h1>
    <div className="discovery-meta"><OwnerStatusBadge status={draft.state} /><p>Last saved <SavedTime date={new Date(draft.savedAt)} /></p></div>
    {draft.canEdit && <div className="owner-actions" role="group" aria-label="Discovery mode">
      {(["CHAT", "WIZARD"] as const).map(mode => {
        const Icon = mode === "CHAT" ? MessageSquare : ListChecks;
        return <button type="button" className="secondary-button discovery-mode" key={mode} aria-pressed={mode === draft.mode}
          disabled={pending} onClick={() => { if (mode !== draft.mode) navigate({ mode, step: draft.step }); }}>
          <Icon size={18} aria-hidden="true" />{modeNames[mode]}
        </button>;
      })}
    </div>}
    <p className="form-status" role="status">{announcement}</p>
    {error && !destination && <p className="form-errors" role="alert"><AlertCircle size={18} aria-hidden="true" /> {error}</p>}
    <div className="discovery-grid">
      <section className="workspace-panel discovery-editor" aria-labelledby="interview-heading" aria-busy={pending}>
        <h2 id="interview-heading" ref={heading} tabIndex={-1}>{title}</h2>
        {draft.readOnlyReason && <p>{draft.readOnlyReason}</p>}
        {question && draft.canEdit && <>
          {draft.mode === "CHAT" && !editing && <p className="field-help">CivicSpec asks the next unanswered question using what you’ve already saved.</p>}
          <p id="discovery-question">{question.text}</p>
          {previous && !editing ? <>
            <p className="verbatim">{previous.content ?? "This answer is restricted."}</p>
            <p className="field-help">Already saved in {modeNames[previous.inputMode]}.</p>
            <div className="owner-actions">
              <button type="button" className="secondary-button" disabled={pending} onClick={() => correct(question.key)}>Correct saved answer</button>
              <button type="button" className="primary-button" disabled={pending} onClick={() => navigate(next)}>Continue</button>
            </div>
          </> : <form onSubmit={event => { event.preventDefault(); void commit(next, text); }}>
            <div className="form-field">
              <label htmlFor="discovery-answer">{editing ? "Revised answer" : "Your answer"}</label>
              <textarea ref={editor} id="discovery-answer" value={text} onChange={event => setText(event.target.value)}
                aria-describedby="discovery-question discovery-answer-help" maxLength={4000} rows={5} readOnly={pending} />
              <p id="discovery-answer-help" className="field-help">Do not include passwords, personal records, or confidential information.</p>
            </div>
            <div className="owner-actions">
              <button type="submit" className="primary-button" disabled={pending}>
                {editing ? "Save correction" : draft.mode === "CHAT" ? "Send answer" : "Save and continue"}
              </button>
              {editing ? <button type="button" className="secondary-button" disabled={pending}
                onClick={() => { setEditing(null); setText(""); heading.current?.focus(); }}>Cancel correction</button>
                : <button type="button" className="secondary-button" disabled={pending || dirty}
                  onClick={() => void commit(next, unknownAnswer)}>I don’t know yet</button>}
            </div>
          </form>}
        </>}
        {reviewing && <>
          <p>Check the original answers and resolve any missing information before sending the request for human review.</p>
          <AnswerOverview sources={draft.sources} onCorrect={pending ? undefined : correct} />
          {!draft.canSubmit && <p>Owner eligibility must be verified before this request can be submitted for review.</p>}
          {!complete && <p>Unresolved sections are listed above. You can save and return later.</p>}
          <button type="button" className="primary-button" disabled={pending || !draft.canSubmit || !complete}
            onClick={() => void commit(here, undefined, true)}>Submit for review</button>
        </>}
        <div className="owner-actions">
          {draft.canEdit && draft.mode === "WIZARD" && draft.step > 1 &&
            <button type="button" className="secondary-button" disabled={pending}
              onClick={() => navigate({ ...here, step: draft.step - 1 })}>Back</button>}
          {draft.canEdit ? <button type="button" className="secondary-button" disabled={pending}
            onClick={() => navigate({ ...here, exit: true })}>Save and exit</button>
            : <Link className="secondary-button" href="/app">Back to dashboard</Link>}
        </div>
      </section>
      <aside className="workspace-panel discovery-profile" aria-labelledby="profile-heading">
        <h2 id="profile-heading">Living project profile</h2>
        <AnswerOverview sources={draft.sources} />
      </aside>
    </div>
    <DiscoveryHistory sources={draft.sources} />
    <dialog ref={dialog} className="workspace-panel discovery-dialog" aria-labelledby="pending-heading"
      onCancel={event => { event.preventDefault(); if (!pending) cancelNavigation(); }}>
      <h2 id="pending-heading">You have an unsaved answer</h2>
      <p>Save it before continuing, discard the unsaved text, or stay here to finish your answer.</p>
      {error && destination && <p className="form-errors" role="alert">{error}</p>}
      <div className="owner-actions">
        <button type="button" className="secondary-button" disabled={pending} onClick={cancelNavigation}>Keep editing</button>
        <button type="button" className="primary-button" disabled={pending} onClick={() => destination && void commit(destination, text)}>Save answer and continue</button>
        <button type="button" className="secondary-button" disabled={pending} onClick={() => destination && void commit(destination)}>Discard unsaved answer</button>
      </div>
    </dialog>
  </div>;
}
