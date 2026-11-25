import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { SiteFrame } from "@/components/SiteFrame";
import { AuthForm } from "@/components/auth/AuthForm";
import { getCurrentUser } from "@/server/auth";
import { authDestination, onboardingLocation } from "@/server/auth/navigation";

export const metadata: Metadata = { title: "Sign in or create an account | CivicSpec", robots: { index: false, follow: false } };

export default async function AuthPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  // Both entry conventions use the same validator and /app fallback. Keep the
  // internal form field canonical so actions validate the destination again.
  const returnTo = authDestination(params.next ?? params.returnTo);
  const user = await getCurrentUser();
  if (user) redirect(user.roles.length ? returnTo : onboardingLocation(returnTo));
  const mode = params.mode === "register" ? "register" : "sign-in";
  const query = `returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <SiteFrame>
      <section className="auth-panel" aria-labelledby="auth-heading">
        <p className="eyebrow">Real needs. Real code. Real experience.</p>
        <nav className="auth-mode" aria-label="Account access">
          <Link href={`/auth?${query}`} aria-current={mode === "sign-in" ? "page" : undefined}>Sign in</Link>
          <Link href={`/auth?mode=register&${query}`} aria-current={mode === "register" ? "page" : undefined}>Create account</Link>
        </nav>
        <h1 id="auth-heading">{mode === "register" ? "Join CivicSpec" : "Welcome back"}</h1>
        <p className="panel-intro">{mode === "register" ? "Start with an account. You’ll choose how you’d like to participate next." : "Sign in to continue your community work."}</p>
        <AuthForm key={mode} mode={mode} returnTo={returnTo} />
      </section>
    </SiteFrame>
  );
}
