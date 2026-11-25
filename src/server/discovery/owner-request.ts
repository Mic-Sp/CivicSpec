import "server-only";
import { notFound } from "next/navigation";
import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, requireAuthentication } from "@/server/auth";
import { createDraftTokens } from "./draft-token";
import { createOwnerService, SubmissionUnavailableError } from "./owner-service";

export function draftTokens() { return createDraftTokens(env.AUTH_SECRET ?? ""); }
export const ownerService = createOwnerService(prisma, getCurrentUser, { mint: userId => draftTokens().mint(userId), read: (userId, token) => draftTokens().read(userId, token) });
export async function requireOwnerPage(returnTo: string) {
  const user = await requireAuthentication({ kind: "page", returnTo });
  if (!user.roles.includes("PROBLEM_OWNER")) notFound();
  return user;
}
export async function getOwnerSubmission(id: string) {
  try { return await ownerService.get(id); }
  catch (error) { if (error instanceof SubmissionUnavailableError) notFound(); throw error; }
}
