import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SiteFrame } from "@/components/SiteFrame";
import { OnboardingForm } from "@/components/auth/OnboardingForm";
import { requireAuthentication } from "@/server/auth";
import { authDestination, onboardingLocation } from "@/server/auth/navigation";

export const metadata: Metadata = { title: "Choose how to participate | CivicSpec", robots: { index: false, follow: false } };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const returnTo = authDestination((await searchParams).returnTo);
  const user = await requireAuthentication({ kind: "page", returnTo: onboardingLocation(returnTo) });
  if (user.roles.length) redirect("/app");
  return (
    <SiteFrame signedInDisplayName={user.displayName}>
      <section className="auth-panel onboarding-panel" aria-labelledby="onboarding-heading">
        <p className="eyebrow">Your place in the community</p>
        <h1 id="onboarding-heading">How will you take part?</h1>
        <p className="panel-intro">Choose a starting role and review the participation terms.</p>
        <OnboardingForm returnTo={returnTo} />
      </section>
    </SiteFrame>
  );
}
