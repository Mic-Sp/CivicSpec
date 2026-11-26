import { CheckCircle2, CircleHelp } from "lucide-react";
import { currentAnswers, isResolved, modeNames, questions, type DiscoverySource, type QuestionKey } from "@/lib/discovery";
import { SavedTime } from "@/components/owner/SubmissionSummary";

export function AnswerOverview({ sources, onCorrect }: { sources: DiscoverySource[]; onCorrect?: (key: QuestionKey) => void }) {
  const answers = currentAnswers(sources);
  return <dl className="discovery-overview">
    {questions.map(({ key, title }) => {
      const source = answers.get(key);
      const resolved = isResolved(source);
      const Icon = resolved ? CheckCircle2 : CircleHelp;
      return <div key={key}>
        <dt>{title}</dt>
        <dd>
          <span className="planned-badge"><Icon size={18} aria-hidden="true" />{resolved ? "Captured" : "Unresolved"}</span>
          {source?.content && <p className="verbatim">{source.content}</p>}
          {source && <a className="text-button" href={`#source-${source.id}`}>View source<span className="sr-only"> for {title}</span></a>}
          {onCorrect && <button type="button" className="secondary-button" onClick={() => onCorrect(key)}>
            {source ? "Correct" : "Answer"} {title.toLowerCase()}
          </button>}
        </dd>
      </div>;
    })}
  </dl>;
}

const roleNames = { STAKEHOLDER: "Owner answer", ASSISTANT: "CivicSpec question", REVIEWER: "Reviewer note", SYSTEM: "System entry" } as const;

export function DiscoveryHistory({ sources }: { sources: DiscoverySource[] }) {
  return <section className="workspace-panel discovery-history" aria-labelledby="history-heading">
    <h2 id="history-heading">Discovery history</h2>
    {sources.length === 0 ? <p>No answers have been saved.</p> : <ol>
      {sources.map(source => <li id={`source-${source.id}`} tabIndex={-1} key={source.id}>
        <h3>{roleNames[source.authorRole]} <span className="field-help">· {modeNames[source.inputMode]}</span></h3>
        <p className="field-help">Record {source.sequenceNumber} · <SavedTime date={new Date(source.createdAt)} /></p>
        {source.content !== null && source.questionText && source.authorRole !== "ASSISTANT" &&
          <p><strong>Question</strong> <span className="verbatim">{source.questionText}</span></p>}
        <p className="verbatim">{source.content ?? "This record is restricted."}</p>
        {source.supersededById && <a className="text-button" href={`#source-${source.supersededById}`}>View correction</a>}
      </li>)}
    </ol>}
  </section>;
}
