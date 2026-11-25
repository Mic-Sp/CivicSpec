import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

import { SiteFrame } from "@/components/SiteFrame";
import { getCurrentUser } from "@/server/auth";

export default async function Home() {
  const user = await getCurrentUser();
  return (
    <SiteFrame signedIn={Boolean(user)} workspaceHref={user ? "/app" : undefined}>
        <section className="intro-panel" aria-labelledby="welcome-heading">
          <p className="eyebrow">Community needs. Shared possibility.</p>
          <h1 id="welcome-heading">Real needs. Real code. Real experience.</h1>
          <p className="intro-copy">
            A foundation for turning community technical needs into bounded,
            human-reviewed projects and meaningful experience for builders.
          </p>
          <p className="status-badge">
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>Sample status: Ready for review</span>
          </p>
          <p className="placeholder-note">
            CivicSpec is taking shape. This is a preview of our visual foundation.
          </p>
          <div className="landing-actions">{user ? <Link className="primary-button" href="/app">Continue to your workspace</Link> : <><Link className="primary-button" href="/auth?mode=register">Create an account</Link><Link className="secondary-button" href="/auth">Sign in</Link></>}</div>
        </section>
    </SiteFrame>
  );
}
