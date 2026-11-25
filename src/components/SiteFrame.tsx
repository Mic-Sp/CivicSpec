import Link from "next/link";
import { CodeXml } from "lucide-react";

import { signOutAction } from "@/app/auth/actions";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignedInIndicator } from "@/components/SignedInIndicator";

export function SiteFrame({ children, signedInDisplayName, workspaceHref }: { children: React.ReactNode; signedInDisplayName?: string; workspaceHref?: string }) {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <div className="header-identity">
          <Link className="wordmark" href="/" aria-label="CivicSpec home">
            <CodeXml size={28} aria-hidden="true" /><span>CivicSpec</span>
          </Link>
          {signedInDisplayName !== undefined && <SignedInIndicator displayName={signedInDisplayName} />}
        </div>
        <div className="header-actions">
          <ThemeToggle />
          {workspaceHref && <Link className="primary-button" href={workspaceHref}>Open workspace</Link>}
          {signedInDisplayName !== undefined ? (
            <form action={signOutAction}><button className="secondary-button" type="submit">Sign out</button></form>
          ) : <Link className="secondary-button" href="/auth">Sign in</Link>}
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>{children}</main>
      <footer className="site-footer"><p>Built around community, accessibility, and opportunity.</p></footer>
    </div>
  );
}
