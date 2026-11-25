import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EligibilityForm } from "@/components/owner/EligibilityForm";
import { OwnerStatusBadge } from "@/components/owner/OwnerStatusBadge";
import { commercialExplanation, ownerCategories } from "@/lib/owner-intake";
import { ownerService, requireOwnerPage } from "@/server/discovery/owner-request";

export const metadata: Metadata = { title: "Owner eligibility | CivicSpec", robots: { index: false, follow: false } };
export default async function EligibilityPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireOwnerPage("/app/owner/eligibility");
  const params = await searchParams;
  const organizations = await ownerService.eligibility();
  const selected = params.record === "new" ? undefined : params.record ? organizations.find(organization => organization.id === params.record) : organizations[0];
  if (params.record && params.record !== "new" && !selected) notFound();
  const commercial = selected && (selected.category === "COMMERCIAL_DEFERRED" || !selected.noncommercialAttest);
  return <div className="owner-view"><p className="eyebrow">Problem owner workspace</p><h1>Owner eligibility</h1>
    <p className="workspace-introduction">The pilot supports eligible nonprofits, community groups, and individuals with noncommercial community needs. A person reviews eligibility before live project approval or publication.</p>
    {params.saved === "1" && <p className="owner-notice" role="status">Eligibility details saved. Your current status is shown below.</p>}
    {organizations.length > 0 && <section className="workspace-panel" aria-labelledby="eligibility-records-heading"><h2 id="eligibility-records-heading">Your eligibility records</h2><ul className="owner-records">{organizations.map(organization => <li key={organization.id}><Link href={`/app/owner/eligibility?record=${encodeURIComponent(organization.id)}`}>{organization.legalName}</Link><span>{ownerCategories[organization.category]}</span><OwnerStatusBadge status={organization.eligibilityStatus} /></li>)}</ul><Link className="secondary-button" href="/app/owner/eligibility?record=new">Add another eligibility record</Link></section>}
    <section className="workspace-panel" aria-labelledby="eligibility-details-heading"><h2 id="eligibility-details-heading">{selected ? "Review or update eligibility" : "Tell us who this request serves"}</h2>
      {selected && <p>Current verification status: <OwnerStatusBadge status={selected.eligibilityStatus} /></p>}
      {commercial ? <p className="owner-notice">{commercialExplanation}</p> : selected?.eligibilityStatus === "DEFERRED" ? <p className="owner-notice">This eligibility record is deferred. New requests using it are blocked until another review.</p> : selected?.eligibilityStatus === "REJECTED" ? <p className="owner-notice">This eligibility record was rejected. Update relevant details for another review. New requests using this record are blocked.</p> : selected?.eligibilityStatus === "NEEDS_INFO" ? <p className="owner-notice">Additional information is needed. Review and update your details for a person to check again.</p> : <p>Eligible records with Pending review or Needs information status can be used for private drafts. Live approval and publication require verification.</p>}
      <EligibilityForm accountId={user.id} key={`${selected?.id ?? "new"}:${selected?.updatedAt.toISOString() ?? ""}`} initial={{ id: selected?.id ?? "", revision: selected?.updatedAt.toISOString() ?? "", category: selected?.category ?? "", legalName: selected?.legalName ?? "", einOrRegistration: selected?.einOrRegistration ?? "", websiteUrl: selected?.websiteUrl ?? "", noncommercialAttest: selected?.noncommercialAttest ?? false }} />
    </section><div className="owner-actions"><Link className="secondary-button" href="/app/submissions">My submissions</Link><Link className="secondary-button" href="/app/submissions/new">New request</Link></div>
  </div>;
}
