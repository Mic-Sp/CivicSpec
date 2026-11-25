"use client";
import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import type { OwnerFormState } from "@/lib/owner-intake";

const names: Record<string, string> = { category: "Owner type", legalName: "Organization or request name", websiteUrl: "Website", einOrRegistration: "Registration reference", organizationId: "Eligibility record", title: "Working title", preferredMode: "Discovery mode", privacyAck: "Recording acknowledgment", noncommercialPurpose: "Noncommercial purpose" };
export function OwnerFormFeedback({ state }: { state: OwnerFormState }) {
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => { if (state.status === "error") summary.current?.focus(); }, [state]);
  if (state.status !== "error") return null;
  return <div ref={summary} id="owner-form-errors" className="form-errors" role="alert" aria-labelledby="owner-errors-heading" tabIndex={-1}>
    <h2 id="owner-errors-heading"><AlertCircle size={20} aria-hidden="true" />Please check your details</h2>
    <p>{state.message}</p><ul>{Object.entries(state.fieldErrors).filter(([key]) => key in names).map(([key, message]) => <li key={key}><a href={`#${key}`}>{names[key]}: {message}</a></li>)}</ul>
  </div>;
}
export function OwnerFieldError({ field, message }: { field: string; message?: string }) {
  return message ? <p id={`${field}-error`} className="field-error"><AlertCircle size={18} aria-hidden="true" /><span>{message}</span></p> : null;
}
