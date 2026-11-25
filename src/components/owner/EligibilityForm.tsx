"use client";
import { useActionState, useState } from "react";
import { attestEligibilityAction } from "@/app/app/(workspace)/owner/actions";
import { initialOwnerState, ownerCategories } from "@/lib/owner-intake";
import { OwnerFieldError, OwnerFormFeedback } from "./OwnerFormFeedback";

type Values = { id: string; revision: string; legalName: string; category: string; websiteUrl: string; einOrRegistration: string; noncommercialAttest: boolean };
export function EligibilityForm({ initial, accountId }: { initial: Values; accountId: string }) {
  const [state, action, pending] = useActionState(attestEligibilityAction, initialOwnerState, "/app/owner/eligibility");
  const [values, setValues] = useState(initial);
  const describe = (field: string) => state.fieldErrors[field] ? `${field}-error` : undefined;
  return <form action={action} className="auth-form owner-form" noValidate aria-busy={pending} onReset={event => event.preventDefault()}>
    <input type="hidden" name="expectedUserId" value={accountId} /><input type="hidden" name="organizationId" value={initial.id} /><input type="hidden" name="revision" value={initial.revision} />
    <OwnerFormFeedback state={state} />
    <div className="form-field"><label htmlFor="category">Owner type</label>
      <select id="category" name="category" value={values.category} onChange={event => setValues({ ...values, category: event.target.value })} required aria-invalid={Boolean(describe("category"))} aria-describedby={describe("category")}>
        <option value="">Choose an owner type</option>{Object.entries(ownerCategories).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select><OwnerFieldError field="category" message={state.fieldErrors.category} />
    </div>
    {([ ["legalName", "Organization or request name", 160], ["einOrRegistration", "EIN or registration reference (optional)", 80], ["websiteUrl", "Website (optional)", 500] ] as const).map(([field, label, max]) => <div className="form-field" key={field}>
      <label htmlFor={field}>{label}</label><input id={field} name={field} type={field === "websiteUrl" ? "url" : "text"} maxLength={max} required={field === "legalName"} value={values[field]} onChange={event => setValues({ ...values, [field]: event.target.value })} aria-invalid={Boolean(describe(field))} aria-describedby={`${field}-help${describe(field) ? ` ${describe(field)}` : ""}`} />
      <p id={`${field}-help`} className="field-help">{field === "legalName" ? "Individuals can use a short name for their community request. A legal personal name is not required." : field === "einOrRegistration" ? "Provide only a public organizational reference. Do not enter Social Security numbers, personal records, or credentials." : "Use an http or https address, or leave this blank. We do not contact or fetch this website."}</p>
      <OwnerFieldError field={field} message={state.fieldErrors[field]} />
    </div>)}
    <label className="terms-choice" htmlFor="noncommercialAttest"><input id="noncommercialAttest" name="noncommercialAttest" type="checkbox" checked={values.noncommercialAttest} onChange={event => setValues({ ...values, noncommercialAttest: event.target.checked })} aria-describedby="attestation-help" /><span>I attest that this organization or individual request serves a noncommercial community purpose.</span></label>
    <p id="attestation-help" className="field-help">If you cannot attest, your eligibility will be marked Deferred and new requests will be blocked. Eligible submissions are reviewed by a person; this form does not verify you automatically. Changing reviewed details requires a new review.</p>
    <button type="submit" className="primary-button" disabled={pending}>{pending ? "Saving eligibility…" : "Submit eligibility details"}</button>
    <p className="form-status" role="status">{pending ? "Saving your eligibility details." : ""}</p>
  </form>;
}
