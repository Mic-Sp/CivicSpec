"use client";

import Link from "next/link";
import { CheckCircle2, Clock3, ListChecks } from "lucide-react";
import { useWorkspace } from "./WorkspaceShell";
import { roleNames, workspaceContent } from "@/lib/workspace";

export function Dashboard() {
  const { user, activeRole } = useWorkspace();
  const content = workspaceContent[activeRole];
  return (
    <div className="dashboard">
      <p className="eyebrow">Hello, {user.displayName}.</p>
      <h1>{content.title}</h1>
      <p className="workspace-introduction">{content.introduction}</p>
      <p className="authorized-access">Your access: {user.roles.map(role => roleNames[role]).sort().join(", ")}.</p>
      <section className="workspace-panel next-action" aria-labelledby="next-action-heading">
        <div className="panel-title"><ListChecks size={24} aria-hidden="true" /><h2 id="next-action-heading">Your next step</h2></div>
        <p>{content.next}</p>
        <Link className="primary-button" href="/app/account">Review account settings</Link>
      </section>
      <section className="dashboard-status" aria-labelledby="status-heading">
        <h2 id="status-heading">Workspace status</h2>
        <p className="status-badge"><CheckCircle2 size={20} aria-hidden="true" /><span>Account active</span></p>
        <div className="status-card-grid">
          {content.sections.map(section => <article key={section.name} className="workspace-panel status-card">
            <h3>{section.name}</h3><p className="planned-badge"><Clock3 size={18} aria-hidden="true" /><span>Coming soon</span></p><p>{section.description}</p>
          </article>)}
        </div>
      </section>
    </div>
  );
}
