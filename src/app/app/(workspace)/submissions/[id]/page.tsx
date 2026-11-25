import type { Metadata } from "next";
import Link from "next/link";
import { ChildProjects, SavedTime } from "@/components/owner/SubmissionSummary";
import { OwnerStatusBadge } from "@/components/owner/OwnerStatusBadge";
import { getOwnerSubmission, requireOwnerPage } from "@/server/discovery/owner-request";

export const metadata: Metadata = { title: "Request status | CivicSpec", robots: { index: false, follow: false } };
export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireOwnerPage(`/app/submissions/${encodeURIComponent(id)}`);
  const submission = await getOwnerSubmission(id);
  return <div className="owner-view"><p className="eyebrow">Request status</p><h1>{submission.title}</h1><OwnerStatusBadge status={submission.state} /><p>Last saved: <SavedTime date={submission.draftState?.lastSavedAt ?? submission.updatedAt} /></p>
    <section className="workspace-panel"><h2>Child micro-projects</h2><p>Each child has its own lifecycle. A published child does not change the parent request’s state.</p><ChildProjects submission={submission} /></section>
    <div className="owner-actions">{submission.state === "DRAFT" && <Link className="primary-button" href={`/app/submissions/${encodeURIComponent(id)}/interview`}>Resume draft</Link>}<Link className="secondary-button" href="/app/submissions">Back to my submissions</Link></div>
  </div>;
}
