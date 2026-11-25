"use client";
import Link from "next/link";
export function OwnerLoadError({ reset }: { reset: () => void }) {
  return <section className="workspace-panel"><h1>This view is unavailable</h1><p>We couldn’t load this view. Try again or return to your workspace.</p><div className="owner-actions"><button className="primary-button" onClick={reset}>Try again</button><Link className="secondary-button" href="/app">Back to dashboard</Link></div></section>;
}
