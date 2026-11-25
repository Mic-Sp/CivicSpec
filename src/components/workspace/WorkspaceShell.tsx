"use client";

import { createContext, useContext, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CodeXml, House, Menu, Settings, Clock3, CheckCircle2 } from "lucide-react";
import type { RoleType } from "@prisma/client";

import { signOutAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignedInIndicator } from "@/components/SignedInIndicator";
import { roleNames, workspaceContent, workspaceRoles } from "@/lib/workspace";
import type { AuthUser } from "@/server/auth/user";

const WorkspaceContext = createContext<{ user: AuthUser; activeRole: RoleType } | null>(null);
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("Workspace context is required.");
  return context;
}

function WorkspaceNavigation({ role }: { role: RoleType }) {
  const path = usePathname();
  return (
    <nav aria-label="Workspace navigation">
      <ul className="workspace-nav-list">
        <li><Link href="/app" aria-current={path === "/app" ? "page" : undefined}><House size={20} aria-hidden="true" />Dashboard</Link></li>
        <li><Link href="/app/account" aria-current={path === "/app/account" ? "page" : undefined}><Settings size={20} aria-hidden="true" />Account settings</Link></li>
      </ul>
      <h2 className="nav-role-heading">For {roleNames[role].toLowerCase()}s</h2>
      <ul className="workspace-nav-list planned-navigation">
        {workspaceContent[role].sections.map(section => <li key={section.name}><span><Clock3 size={18} aria-hidden="true" /><span>{section.name}<small>Coming soon</small></span></span></li>)}
      </ul>
    </nav>
  );
}

export function WorkspaceShell({ user, initialRole, children }: { user: AuthUser; initialRole: RoleType; children: React.ReactNode }) {
  const [activeRole, setActiveRole] = useState(initialRole);
  const [selection, setSelection] = useState(initialRole);
  const [status, setStatus] = useState("");
  const confirmed = useRef(initialRole);
  const revision = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const router = useRouter();
  function selectRole(role: RoleType) {
    setSelection(role);
    const version = ++revision.current;
    setStatus("Saving workspace role…");
    queue.current = queue.current.then(async () => {
      try {
        const response = await fetch("/api/workspace/preferences", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expectedUserId: user.id, activeRole: role }),
        });
        if (!response.ok) { if (response.status === 401 || response.status === 403) router.refresh(); throw new Error("Role denied"); }
        const result = await response.json();
        if (!user.roles.includes(result.activeRole)) throw new Error("Role denied");
        confirmed.current = result.activeRole;
        if (revision.current === version) {
          setActiveRole(result.activeRole);
          setSelection(result.activeRole);
          setStatus(`${roleNames[result.activeRole as RoleType]} workspace selected.`);
        }
      } catch {
        if (revision.current === version) { setActiveRole(confirmed.current); setSelection(confirmed.current); setStatus("The workspace role couldn’t be changed. Please try again."); }
      }
    });
  }
  return (
    <WorkspaceContext.Provider value={{ user, activeRole }}>
      <div className="workspace-shell">
        <a className="skip-link" href="#main-content">Skip to content</a>
        <header className="workspace-header">
          <div className="header-identity">
            <Link className="wordmark" href="/" aria-label="CivicSpec home"><CodeXml size={28} aria-hidden="true" /><span>CivicSpec</span></Link>
            <SignedInIndicator displayName={user.displayName} />
          </div>
          <div className="workspace-role-control">
            <label htmlFor="workspace-role">Workspace role</label>
            <select id="workspace-role" value={selection} disabled={user.roles.length < 2} onChange={event => selectRole(event.target.value as RoleType)} aria-describedby="role-help role-status">
              {workspaceRoles.filter(role => user.roles.includes(role)).map(role => <option key={role} value={role}>{roleNames[role]}</option>)}
            </select>
            <p id="role-help" className="field-help">Only your assigned roles are available.</p>
            <p id="role-status" className="role-save-status" role="status">{status}</p>
          </div>
          <ThemeToggle />
          <nav className="workspace-utilities" aria-label="Account utilities"><Link className="secondary-button" href="/app/account">Account settings</Link><form action={signOutAction}><button className="secondary-button" type="submit">Sign out</button></form></nav>
        </header>
        <div className="workspace-grid">
          <aside className="workspace-sidebar"><WorkspaceNavigation role={activeRole} /></aside>
          <div className="workspace-main-column">
            <details className="workspace-mobile-menu"><summary><Menu size={20} aria-hidden="true" />Workspace menu</summary><WorkspaceNavigation role={activeRole} /></details>
            <main id="main-content" tabIndex={-1}>{children}</main>
            <footer className="workspace-footer"><CheckCircle2 size={18} aria-hidden="true" /><span>Signed in as {user.displayName}</span></footer>
          </div>
        </div>
      </div>
    </WorkspaceContext.Provider>
  );
}
