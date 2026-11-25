"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { authenticatePassword, endSession, getCurrentUser, startSession } from "@/server/auth";
import { AuthError } from "@/server/auth/errors";
import { type AuthFlowResult, type AuthFormState } from "@/server/auth/form-state";
import { requireAuthOrigin } from "@/server/auth/origin";
import { createPublicAuthFlows } from "@/server/auth/public-flows";
import { authFormInput } from "@/server/auth/public-validation";
import { createAuthRateLimit } from "@/server/auth/rate-limit";

async function submit(operation: "signIn" | "register" | "onboard", form: FormData): Promise<AuthFormState> {
  let result: AuthFlowResult;
  try {
    requireAuthOrigin(await headers(), env.APP_URL);
    const flows = createPublicAuthFlows({
      database: prisma, authenticatePassword, startSession, resolveUser: getCurrentUser,
      limit: createAuthRateLimit(prisma, env.AUTH_SECRET ?? ""),
    });
    result = await flows[operation](authFormInput(form));
  } catch (error) {
    // No passwords, emails, signing keys, database messages, or resource details.
    return {
      status: "error", fieldErrors: {},
      message: error instanceof AuthError
        ? "This request couldn’t be completed. Refresh the page and sign in again."
        : "We couldn’t complete your request. Please try again.",
    };
  }
  // Redirect throws in Next.js; keep it outside the error boundary.
  if (result.ok) redirect(result.redirectTo);
  return result.state;
}

export async function signInAction(_previous: AuthFormState, form: FormData) { return submit("signIn", form); }
export async function registerAction(_previous: AuthFormState, form: FormData) { return submit("register", form); }
export async function onboardAction(_previous: AuthFormState, form: FormData) { return submit("onboard", form); }

export async function signOutAction() {
  requireAuthOrigin(await headers(), env.APP_URL);
  await endSession();
  redirect("/");
}
