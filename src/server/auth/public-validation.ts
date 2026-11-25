import "server-only";

import { z } from "zod";

import { participationTermsVersion, type AuthFormState } from "./form-state";

const email = z.string().trim().max(254, "Enter a valid email address.").toLowerCase()
  .pipe(z.email({ error: "Enter a valid email address." }));
const password = z.string().min(1, "Enter your password.").max(1024, "Enter a shorter password.")
  .refine(value => Buffer.byteLength(value, "utf8") <= 1024, "Enter a shorter password.");

export const signInSchema = z.object({ email, password, returnTo: z.unknown().optional() }).strict();
export const registrationSchema = z.object({
  displayName: z.string().trim().min(1, "Enter a name to use on CivicSpec.").max(80, "Use 80 characters or fewer.")
    .refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Enter a name without control characters."),
  email,
  password: z.string().min(8, "Use at least 8 characters.").max(128, "Use 128 characters or fewer.")
    .regex(/\p{Lu}/u, "Add at least one uppercase letter.")
    .regex(/\p{Ll}/u, "Add at least one lowercase letter.")
    .regex(/\p{Nd}/u, "Add at least one number.")
    .regex(/[\p{P}\p{S}]/u, "Add at least one symbol, such as !, @, or #."),
  returnTo: z.unknown().optional(),
}).strict();
export const onboardingSchema = z.object({
  intent: z.enum(["PROBLEM_OWNER", "DEVELOPER"], { error: "Choose problem owner or builder." }),
  acceptedTerms: z.literal("on", { error: "Acknowledge the participation terms to continue." }),
  termsVersion: z.literal(participationTermsVersion, { error: "Refresh this page to review the current participation terms." }),
  returnTo: z.unknown().optional(),
}).strict();

export function fieldErrors(error: z.ZodError): AuthFormState["fieldErrors"] {
  const errors: AuthFormState["fieldErrors"] = {};
  const allowed = new Set(["displayName", "email", "password", "intent", "acceptedTerms", "termsVersion"]);
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && allowed.has(key)) {
      const field = key as keyof typeof errors;
      errors[field] ??= issue.message;
    }
  }
  return errors;
}

// Repeated fields become arrays and fail validation, rather than choosing an
// attacker-controlled first/last value. Framework action metadata is not input.
export function authFormInput(form: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = Object.create(null);
  for (const key of new Set(form.keys())) {
    if (key.startsWith("$ACTION_")) continue;
    const values = form.getAll(key);
    result[key] = values.length === 1 ? values[0] : values;
  }
  return result;
}
