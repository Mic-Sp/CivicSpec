import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { RoleType } from "@prisma/client";

import { SiteFrame } from "@/components/SiteFrame";
import { requireAuthentication } from "@/server/auth";
import { onboardingLocation } from "@/server/auth/navigation";

export const metadata: Metadata = { title: "Your account | CivicSpec", robots: { index: false, follow: false } };
const roleNames: Record<RoleType, string> = { PROBLEM_OWNER: "Problem owner", DEVELOPER: "Builder", REVIEWER: "Reviewer", ADMIN: "Administrator" };

export default async function AppPage() {
  const user = await requireAuthentication({ kind: "page", returnTo: "/app" });
  if (!user.roles.length) redirect(onboardingLocation("/app"));
  return (
    <SiteFrame signedIn>
      <section className="auth-panel account-ready" aria-labelledby="welcome-heading">
        <p className="eyebrow">Welcome to CivicSpec</p>
        <h1 id="welcome-heading">Hello, {user.displayName}.</h1>
        <p className="status-badge"><CheckCircle2 size={20} aria-hidden="true" /><span>Your account is ready</span></p>
        <p className="panel-intro">Your access: {user.roles.map(role => roleNames[role]).sort().join(", ")}.</p>
        <p>Your community workspace will take shape here as CivicSpec develops.</p>
      </section>
    </SiteFrame>
  );
}
