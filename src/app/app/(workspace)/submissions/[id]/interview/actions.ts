"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { AuthError } from "@/server/auth/errors";
import { requireAuthOrigin } from "@/server/auth/origin";
import { createAuthRateLimit } from "@/server/auth/rate-limit";
import { createInterviewService, InterviewError } from "@/server/discovery/interview";
import { SubmissionUnavailableError } from "@/server/discovery/owner-service";

export async function saveInterview(id: string, expectedUserId: string, input: unknown) {
  try {
    requireAuthOrigin(await headers(), env.APP_URL);
    const user = await getCurrentUser();
    if (!user || user.id !== expectedUserId || !user.roles.includes("PROBLEM_OWNER")) throw new AuthError(403);
    if (!await createAuthRateLimit(prisma, env.AUTH_SECRET ?? "")("discovery-account", user.id)) {
      return { ok: false as const, message: "Too many saves. Wait a few minutes and retry." };
    }
    const interview = await createInterviewService(prisma, async () => user).change(id, input);
    revalidatePath("/app/submissions");
    return { ok: true as const, interview };
  } catch (error) {
    if (error instanceof InterviewError) return { ok: false as const, message: error.message };
    if (error instanceof AuthError || error instanceof SubmissionUnavailableError) {
      return { ok: false as const, message: "This request is unavailable." };
    }
    return { ok: false as const, message: "We couldn’t save these changes. Try again." };
  }
}
