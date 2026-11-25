import type { Metadata } from "next";
import Link from "next/link";
import { SavedTime } from "@/components/owner/SubmissionSummary";
import { OwnerStatusBadge } from "@/components/owner/OwnerStatusBadge";
import { getOwnerSubmission, requireOwnerPage } from "@/server/discovery/owner-request";

export const metadata: Metadata = { title: "Discovery draft | CivicSpec", robots: { index: false, follow: false } };
export default async function InterviewPlaceholder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwnerPage(`/app/submissions/${encodeURIComponent(id)}/interview`);
  const submission = await getOwnerSubmission(id);
  return <div className="owner-view"><p className="eyebrow">Your discovery request</p><h1>{submission.title}</h1><OwnerStatusBadge status={submission.state} />
    <section className="workspace-panel"><h2>Interactive discovery is coming next</h2><p>Your saved starting mode: <strong>{submission.draftState?.preferredMode === "WIZARD" ? "Guided form" : "Chat with CivicSpec"}</strong>.</p><p>Last saved: <SavedTime date={submission.draftState?.lastSavedAt ?? submission.updatedAt} /></p><p>{submission.privacyNoticeAckAt ? "Your recording and sharing acknowledgment is saved with this request." : "A recording acknowledgment is required before any interview answers can be collected."}</p><p>The interview will be available in the next update. No chat turns, guided-form answers, or AI calls are created on this page.</p></section>
    <div className="owner-actions"><Link className="primary-button" href="/app/submissions">Save and exit</Link><Link className="secondary-button" href={`/app/submissions/${encodeURIComponent(id)}`}>Inspect request status</Link></div>
  </div>;
}
