"use client";

import { useActionState, useState } from "react";

import { registerAction, signInAction } from "@/app/auth/actions";
import { FieldError, FormErrors } from "@/components/auth/FormErrors";
import { initialAuthState } from "@/server/auth/form-state";

export function AuthForm({ mode, returnTo }: { mode: "sign-in" | "register"; returnTo: string }) {
  const registering = mode === "register";
  const permalink = `/auth?mode=${registering ? "register" : "sign-in"}&returnTo=${encodeURIComponent(returnTo)}`;
  const [state, action, pending] = useActionState(registering ? registerAction : signInAction, initialAuthState, permalink);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const genericLoginError = !registering && state.status === "error" && !Object.keys(state.fieldErrors).length;

  return (
    <form action={action} className="auth-form" noValidate aria-busy={pending} onReset={event => event.preventDefault()}>
      <input type="hidden" name="returnTo" value={returnTo} />
      <FormErrors state={state} />
      {registering && (
        <div className="form-field">
          <label htmlFor="displayName">Name to use on CivicSpec</label>
          <p id="name-help" className="field-help">Choose the name you’d like us to use. A legal name isn’t required.</p>
          <input id="displayName" name="displayName" type="text" autoComplete="nickname" required maxLength={80}
            value={name} onChange={event => setName(event.target.value)}
            aria-invalid={Boolean(state.fieldErrors.displayName)}
            aria-describedby={`name-help${state.fieldErrors.displayName ? " displayName-error" : ""}`} />
          <FieldError field="displayName" message={state.fieldErrors.displayName} />
        </div>
      )}
      <div className="form-field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false}
          required maxLength={254} value={email} onChange={event => setEmail(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors.email) || genericLoginError}
          aria-describedby={state.fieldErrors.email ? "email-error" : genericLoginError ? "form-errors" : undefined} />
        <FieldError field="email" message={state.fieldErrors.email} />
      </div>
      <div className="form-field">
        <label htmlFor="password">Password</label>
        {registering && <p id="password-help" className="field-help">Use 8–128 characters with at least one uppercase letter, one lowercase letter, one number, and one symbol (such as !, @, or #). Spaces are allowed but don’t count as symbols. Paste and password managers are welcome.</p>}
        <input id="password" name="password" type={showPassword ? "text" : "password"} autoComplete={registering ? "new-password" : "current-password"}
          required minLength={registering ? 8 : undefined} maxLength={registering ? 128 : 1024}
          value={password} onChange={event => setPassword(event.target.value)}
          aria-invalid={Boolean(state.fieldErrors.password) || genericLoginError}
          aria-describedby={[registering ? "password-help" : "", state.fieldErrors.password ? "password-error" : genericLoginError ? "form-errors" : ""].filter(Boolean).join(" ") || undefined} />
        <button type="button" className="text-button password-visibility" aria-pressed={showPassword} aria-controls="password"
          onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide password" : "Show password"}</button>
        <FieldError field="password" message={state.fieldErrors.password} />
      </div>
      <button className="primary-button" type="submit" disabled={pending}>
        {pending ? registering ? "Creating your account…" : "Signing you in…" : registering ? "Create account" : "Sign in"}
      </button>
      <p className="form-status" role="status">{pending ? "Please wait while we complete your request." : ""}</p>
    </form>
  );
}
