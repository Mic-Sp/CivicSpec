"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { ListChecks, MessageSquare } from "lucide-react";
import { createDraftAction } from "@/app/app/(workspace)/owner/actions";
import { initialOwnerState, privacyNoticeVersion, recordingNotice } from "@/lib/owner-intake";
import { OwnerFieldError, OwnerFormFeedback } from "./OwnerFormFeedback";

export function NewRequestForm({ organizations, draftToken }: { organizations: { id: string; legalName: string }[]; draftToken: string }) {
  const [state, action, pending] = useActionState(createDraftAction, initialOwnerState, "/app/submissions/new");
  const [title, setTitle] = useState("");
  const [organizationId, setOrganizationId] = useState(organizations[0]?.id ?? "");
  const [mode, setMode] = useState("");
  const [privacy, setPrivacy] = useState(false);
  const [noncommercial, setNoncommercial] = useState(false);
  const described = (field: string, base?: string) => [base, state.fieldErrors[field] && `${field}-error`].filter(Boolean).join(" ") || undefined;
  return <form action={action} className="auth-form owner-form" noValidate aria-busy={pending} onReset={event => event.preventDefault()}>
    <input type="hidden" name="draftToken" value={draftToken} /><input type="hidden" name="privacyNoticeVersion" value={privacyNoticeVersion} />
    <OwnerFormFeedback state={state} />
    <section className="participation-terms" id="recording-notice" aria-labelledby="recording-heading">
      <h2 id="recording-heading">Before we record your request</h2><p>{recordingNotice}</p>
      <p>This covers your original chat messages, guided-form answers, and follow-up questions. Saved answers stay with this request so you can resume across sessions. Unassigned builders and public visitors cannot see the originals.</p>
      <p>You can switch modes later and continue with the answers you’ve saved.</p>
    </section>
    <label className="terms-choice" htmlFor="privacyAck"><input type="checkbox" id="privacyAck" name="privacyAck" required checked={privacy} onChange={event => setPrivacy(event.target.checked)} aria-invalid={Boolean(state.fieldErrors.privacyAck)} aria-describedby={described("privacyAck", "recording-notice")} /><span>I understand how this request’s original answers will be recorded and shared.</span></label>
    <OwnerFieldError field="privacyAck" message={state.fieldErrors.privacyAck} />
    <div className="form-field"><label htmlFor="organizationId">Eligibility record</label><select id="organizationId" name="organizationId" value={organizationId} onChange={event => setOrganizationId(event.target.value)} aria-invalid={Boolean(state.fieldErrors.organizationId)} aria-describedby={described("organizationId")}>
      {organizations.map(organization => <option key={organization.id} value={organization.id}>{organization.legalName}</option>)}
    </select><OwnerFieldError field="organizationId" message={state.fieldErrors.organizationId} /></div>
    <div className="form-field"><label htmlFor="title">Working title</label><input id="title" name="title" value={title} onChange={event => setTitle(event.target.value)} required maxLength={160} aria-invalid={Boolean(state.fieldErrors.title)} aria-describedby={described("title", "title-help")} /><p id="title-help" className="field-help">Use a short, non-identifying description of the need. Do not include private information.</p><OwnerFieldError field="title" message={state.fieldErrors.title} /></div>
    <fieldset id="preferredMode" className="role-options" tabIndex={-1} aria-invalid={Boolean(state.fieldErrors.preferredMode)} aria-describedby={described("preferredMode", "mode-help")}><legend>How would you like to start?</legend>
      {([{ value: "CHAT", label: "Chat with CivicSpec", description: "A conversational interview, one question at a time.", icon: MessageSquare }, { value: "WIZARD", label: "Guided form", description: "Structured questions you can work through at your own pace.", icon: ListChecks }] as const).map(({ value, label, description, icon: Icon }) => <label className="role-choice" key={value}><input type="radio" name="preferredMode" value={value} required checked={mode === value} onChange={() => setMode(value)} /><Icon size={24} aria-hidden="true" /><span><strong>{label}</strong><span>{description}</span></span></label>)}
      <p id="mode-help" className="field-help">Both modes preserve your original answers and lead to the same human-reviewed specification. Neither mode requires the other.</p><OwnerFieldError field="preferredMode" message={state.fieldErrors.preferredMode} />
    </fieldset>
    <label className="terms-choice" htmlFor="noncommercialPurpose"><input id="noncommercialPurpose" name="noncommercialPurpose" type="checkbox" required checked={noncommercial} onChange={event => setNoncommercial(event.target.checked)} aria-invalid={Boolean(state.fieldErrors.noncommercialPurpose)} aria-describedby={described("noncommercialPurpose")} /><span>I confirm this request serves a noncommercial purpose, has no commercial beneficiaries, does not replace paid work, and will not exploit volunteers or impose unreasonable obligations.</span></label>
    <OwnerFieldError field="noncommercialPurpose" message={state.fieldErrors.noncommercialPurpose} />
    <div className="owner-actions"><button type="submit" className="primary-button" disabled={pending}>{pending ? "Creating your draft…" : "Create private draft"}</button><Link className="secondary-button" href="/app/submissions">Decline and return without saving</Link></div>
    <p className="form-status" role="status">{pending ? "Saving your acknowledgment and draft." : ""}</p>
  </form>;
}
