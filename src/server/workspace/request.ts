import "server-only";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { signInLocation } from "@/server/auth/return-path";
import { onboardingLocation } from "@/server/auth/navigation";
import { createWorkspaceService } from "./preferences";

export const workspaceService = createWorkspaceService(prisma, getCurrentUser);

export async function requireWorkspace(returnTo: string) {
  const state = await workspaceService.read();
  if (!state) redirect(signInLocation(returnTo));
  if (!state.activeRole) redirect(onboardingLocation(returnTo));
  return { ...state, activeRole: state.activeRole };
}
