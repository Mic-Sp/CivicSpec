export type AuthField = "displayName" | "email" | "password" | "intent" | "acceptedTerms" | "termsVersion";
export type AuthFormState = {
  status: "idle" | "error";
  message?: string;
  fieldErrors: Partial<Record<AuthField, string>>;
};

export type AuthFlowResult = { ok: true; redirectTo: string } | { ok: false; state: AuthFormState };
export const initialAuthState: AuthFormState = { status: "idle", fieldErrors: {} };
export const participationTermsVersion = "pilot-participation-v1";
export const loginFailure = "We couldn’t sign you in. Check your email and password and try again.";
export const registrationFailure = "We couldn’t create an account with these details. Try signing in or try again.";

export function authFormError(message: string, fieldErrors: AuthFormState["fieldErrors"] = {}): AuthFlowResult {
  return { ok: false, state: { status: "error", message, fieldErrors } };
}
