import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";

import { createAuthGuards } from "./guards";
import { createCookieAuth } from "./cookies";
import { createAuthService } from "./service";

const service = createAuthService(prisma, { secret: () => {
  if (!env.AUTH_SECRET) throw new Error("AUTH_SECRET is required to use authentication.");
  return env.AUTH_SECRET;
} });
export const { getCurrentUser, startSession, endSession } = createCookieAuth(service, cookies, env.NODE_ENV === "production");

export const authenticatePassword = service.authenticatePassword;
export const { requireAuthentication, requireRole } = createAuthGuards({ resolveUser: getCurrentUser, redirect });
