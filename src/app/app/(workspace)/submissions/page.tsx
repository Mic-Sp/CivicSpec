import type { Metadata } from "next";
import Link from "next/link";
import { SubmissionSummary } from "@/components/owner/SubmissionSummary";
import { ownerService, requireOwnerPage } from "@/server/discovery/owner-request";

export const metadata: Metadata = { title: "My submissions | CivicSpec", robots: { index: false, follow: false } };
export default async function SubmissionsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireOwnerPage("/app/submissions");
  const params = await searchParams;
  const result = await ownerService.list(typeof params.page === "string" ? Number(params.page) : 1);
  return <div className="owner-view"><p className="eyebrow">Problem owner workspace</p><h1>My submissions</h1><p className="workspace-introduction">Resume private drafts, follow active requests, and inspect the separate state of each child micro-project.</p>
    <div className="owner-actions"><Link className="primary-button" href="/app/submissions/new">New request</Link><Link className="secondary-button" href="/app/owner/eligibility">Owner eligibility</Link></div>
    {result.submissions.length ? <div className="submission-list">{result.submissions.map(submission => <SubmissionSummary key={submission.id} submission={submission} />)}</div> : <section className="workspace-panel"><h2>No submissions on this page</h2><p>Start by checking your eligibility, then create a private request. No discovery answers are recorded until you acknowledge the recording notice.</p></section>}
    <nav className="owner-actions" aria-label="Submission pages">{result.page > 1 && <Link className="secondary-button" href={`/app/submissions?page=${result.page - 1}`}>Previous page</Link>}{result.hasNext && <Link className="secondary-button" href={`/app/submissions?page=${result.page + 1}`}>Next page</Link>}</nav>
  </div>;
}
