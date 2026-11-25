import Link from "next/link";
import { OwnerStatusBadge } from "./OwnerStatusBadge";
import type { createOwnerService } from "@/server/discovery/owner-service";

type Submission = Awaited<ReturnType<ReturnType<typeof createOwnerService>["get"]>>;
export function SavedTime({ date }: { date: Date }) { return <time dateTime={date.toISOString()}>{date.toISOString().slice(0, 16).replace("T", " ")} UTC</time>; }
export function ChildProjects({ submission }: { submission: Submission }) {
  if (!submission.projects.length) return <p>No child micro-projects yet. Human review can define these later.</p>;
  return <ul className="child-projects">{submission.projects.map(project => <li id={`project-${project.id}`} key={project.id}>
    <h3><Link href={`/app/submissions/${encodeURIComponent(submission.id)}#project-${encodeURIComponent(project.id)}`}>{project.opaqueSlug}: {project.anonymousProfile?.publicTitle ?? "Micro-project"}</Link></h3><OwnerStatusBadge status={project.state} /><p>Last updated: <SavedTime date={project.updatedAt} /></p>
  </li>)}</ul>;
}
export function SubmissionSummary({ submission }: { submission: Submission }) {
  return <article className="workspace-panel submission-card"><h2>{submission.title}</h2><OwnerStatusBadge status={submission.state} />
    <p>Last saved: <SavedTime date={submission.draftState?.lastSavedAt ?? submission.updatedAt} /></p>
    <div className="owner-actions">{submission.state === "DRAFT" && <Link className="primary-button" href={`/app/submissions/${encodeURIComponent(submission.id)}/interview`}>Resume draft</Link>}<Link className="secondary-button" href={`/app/submissions/${encodeURIComponent(submission.id)}`}>Inspect request</Link></div>
    <ChildProjects submission={submission} />
  </article>;
}
