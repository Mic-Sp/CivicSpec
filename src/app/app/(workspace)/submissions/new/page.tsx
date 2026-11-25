import type { Metadata } from "next";
import Link from "next/link";
import { NewRequestForm } from "@/components/owner/NewRequestForm";
import { OwnerStatusBadge } from "@/components/owner/OwnerStatusBadge";
import { canStartPrivateDraft, commercialExplanation } from "@/lib/owner-intake";
import { draftTokens, ownerService, requireOwnerPage } from "@/server/discovery/owner-request";

export const metadata: Metadata = { title: "New request | CivicSpec", robots: { index: false, follow: false } };
export default async function NewRequestPage() {
  const user = await requireOwnerPage("/app/submissions/new");
  const organizations = await ownerService.eligibility();
  const eligible = organizations.filter(canStartPrivateDraft);
  return <div className="owner-view"><p className="eyebrow">A noncommercial community need</p><h1>New request</h1>
    <p className="workspace-introduction">Choose how to describe your need. Both modes keep one request and lead to human review. No payment or donation is required.</p>
    {eligible.length ? <section className="workspace-panel"><h2>Your private draft</h2><p>Pending eligibility can support a private draft; verification is required before live approval or publication.</p><NewRequestForm organizations={eligible.map(({ id, legalName }) => ({ id, legalName }))} draftToken={draftTokens().mint(user.id)} /></section> : <section className="workspace-panel" aria-labelledby="eligibility-needed-heading"><h2 id="eligibility-needed-heading">Check owner eligibility first</h2><p>{organizations.some(organization => organization.category === "COMMERCIAL_DEFERRED" || !organization.noncommercialAttest) ? commercialExplanation : "Submit your owner type and noncommercial-purpose attestation before creating a request. Rejected or deferred records need another review."}</p><ul className="owner-records">{organizations.map(organization => <li key={organization.id}><span>{organization.legalName}</span><OwnerStatusBadge status={organization.eligibilityStatus} /></li>)}</ul><Link className="primary-button" href="/app/owner/eligibility">Review owner eligibility</Link><p>This entry has not recorded a draft or discovery answers.</p></section>}
    <div className="owner-actions"><Link className="secondary-button" href="/app/submissions">Back to my submissions</Link></div>
  </div>;
}
