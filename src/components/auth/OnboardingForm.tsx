"use client";

import { useActionState, useState } from "react";
import { HeartHandshake, Wrench } from "lucide-react";

import { onboardAction } from "@/app/auth/actions";
import { FieldError, FormErrors } from "@/components/auth/FormErrors";
import { initialAuthState, participationTermsVersion } from "@/server/auth/form-state";

export function OnboardingForm({ returnTo }: { returnTo: string }) {
  const permalink = `/app/onboarding?returnTo=${encodeURIComponent(returnTo)}`;
  const [state, action, pending] = useActionState(onboardAction, initialAuthState, permalink);
  const [intent, setIntent] = useState("");
  const [accepted, setAccepted] = useState(false);
  return (
    <form action={action} className="auth-form" noValidate aria-busy={pending} onReset={event => event.preventDefault()}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="termsVersion" value={participationTermsVersion} />
      <FormErrors state={state} />
      <fieldset id="intent" className="role-options" tabIndex={-1}
        aria-invalid={Boolean(state.fieldErrors.intent)} aria-describedby={state.fieldErrors.intent ? "intent-error" : undefined}>
        <legend>How would you like to participate?</legend>
        <label className="role-choice">
          <input type="radio" name="intent" value="PROBLEM_OWNER" required checked={intent === "PROBLEM_OWNER"} onChange={event => setIntent(event.target.value)} />
          <HeartHandshake size={24} aria-hidden="true" />
          <span><strong>I have a community need</strong><span>Join as a problem owner to describe a noncommercial technical need.</span></span>
        </label>
        <label className="role-choice">
          <input type="radio" name="intent" value="DEVELOPER" required checked={intent === "DEVELOPER"} onChange={event => setIntent(event.target.value)} />
          <Wrench size={24} aria-hidden="true" />
          <span><strong>I want to build</strong><span>Join as a builder to contribute skills and gain meaningful experience.</span></span>
        </label>
        <FieldError field="intent" message={state.fieldErrors.intent} />
      </fieldset>
      <section id="participation-terms" className="participation-terms" aria-labelledby="terms-heading" tabIndex={-1}>
        <h2 id="terms-heading">Before you continue</h2>
        <ul>
          <li>Participation is voluntary and unpaid. No payment or donation is required.</li>
          <li>This pilot supports eligible nonprofits, community groups, and individuals working on noncommercial needs. Commercial work is excluded.</li>
          <li>You can withdraw. Choosing a role does not verify project eligibility or builder readiness.</li>
        </ul>
        <FieldError field="termsVersion" message={state.fieldErrors.termsVersion} />
      </section>
      <label className="terms-choice" htmlFor="acceptedTerms">
        <input id="acceptedTerms" name="acceptedTerms" type="checkbox" required checked={accepted} onChange={event => setAccepted(event.target.checked)}
          aria-invalid={Boolean(state.fieldErrors.acceptedTerms)}
          aria-describedby={`participation-terms${state.fieldErrors.acceptedTerms ? " acceptedTerms-error" : ""}`} />
        <span>I understand and agree to voluntary, unpaid participation for noncommercial community needs.</span>
      </label>
      <FieldError field="acceptedTerms" message={state.fieldErrors.acceptedTerms} />
      <button className="primary-button" type="submit" disabled={pending}>{pending ? "Saving your choice…" : "Continue to CivicSpec"}</button>
      <p className="form-status" role="status">{pending ? "Please wait while we save your choice." : ""}</p>
    </form>
  );
}
