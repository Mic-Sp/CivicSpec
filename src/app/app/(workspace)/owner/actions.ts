"use server";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import type { OwnerFormState } from "@/lib/owner-intake";
import { getCurrentUser } from "@/server/auth";
import { AuthError } from "@/server/auth/errors";
import { requireAuthOrigin } from "@/server/auth/origin";
import { authFormInput } from "@/server/auth/public-validation";
import { createAuthRateLimit } from "@/server/auth/rate-limit";
import { ownerService } from "@/server/discovery/owner-request";
import { OwnerGateError } from "@/server/discovery/owner-service";
import { OwnerInputError } from "@/server/discovery/validation";

async function submit(kind: "attest" | "createDraft", form: FormData): Promise<OwnerFormState> {
  let id: string;
  try {
    requireAuthOrigin(await headers(), env.APP_URL);
    const user = await getCurrentUser();
    if (!user) throw new AuthError(401);
    if (!user.roles.includes("PROBLEM_OWNER")) throw new AuthError(403);
    if (!await createAuthRateLimit(prisma, env.AUTH_SECRET ?? "")("owner-intake-account", user.id)) return { status: "error", message: "Too many requests. Please wait 10 minutes and try again.", fieldErrors: {} };
    id = await ownerService[kind](authFormInput(form));
  } catch (error) {
    if (error instanceof OwnerInputError) return { status: "error", message: error.message, fieldErrors: error.fieldErrors };
    if (error instanceof OwnerGateError) return { status: "error", message: error.message, fieldErrors: {} };
    return { status: "error", message: error instanceof AuthError ? "This action is unavailable. Sign in with an authorized problem owner account and try again." : "We couldn’t save your request. Please try again.", fieldErrors: {} };
  }
  revalidatePath("/app/submissions");
  revalidatePath("/app/submissions/new");
  revalidatePath("/app/owner/eligibility");
  redirect(kind === "attest" ? `/app/owner/eligibility?record=${encodeURIComponent(id)}&saved=1` : `/app/submissions/${encodeURIComponent(id)}/interview`);
}
export async function attestEligibilityAction(_previous: OwnerFormState, form: FormData) { return submit("attest", form); }
export async function createDraftAction(_previous: OwnerFormState, form: FormData) { return submit("createDraft", form); }
