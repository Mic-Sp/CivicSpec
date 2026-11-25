"use client";

import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

import type { AuthField, AuthFormState } from "@/server/auth/form-state";

const fieldNames: Record<AuthField, string> = {
  displayName: "Name", email: "Email", password: "Password", intent: "Role choice",
  acceptedTerms: "Participation acknowledgement", termsVersion: "Participation terms",
};
const fieldIds: Record<AuthField, string> = {
  displayName: "displayName", email: "email", password: "password", intent: "intent",
  acceptedTerms: "acceptedTerms", termsVersion: "participation-terms",
};

export function FormErrors({ state }: { state: AuthFormState }) {
  const summary = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (state.status === "error") summary.current?.focus();
  }, [state]);
  if (state.status !== "error") return null;
  return (
    <div id="form-errors" className="form-errors" role="alert" aria-labelledby="form-errors-heading" tabIndex={-1} ref={summary}>
      <h2 id="form-errors-heading"><AlertCircle size={20} aria-hidden="true" /> Please check your details</h2>
      <p>{state.message}</p>
      {Object.entries(state.fieldErrors).length > 0 && (
        <ul>{Object.entries(state.fieldErrors).map(([key, message]) => (
          <li key={key}><a href={`#${fieldIds[key as AuthField]}`}>{fieldNames[key as AuthField]}: {message}</a></li>
        ))}</ul>
      )}
    </div>
  );
}

export function FieldError({ field, message }: { field: AuthField; message?: string }) {
  return message ? <p id={`${field}-error`} className="field-error"><AlertCircle size={18} aria-hidden="true" /><span>{message}</span></p> : null;
}
