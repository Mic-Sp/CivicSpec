import { env } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/server/auth";
import { createAuthRateLimit } from "@/server/auth/rate-limit";
import { createPreferencePost } from "@/server/workspace/http";
import { workspaceService } from "@/server/workspace/request";

export async function POST(request: Request) {
  return createPreferencePost({
    appUrl: env.APP_URL, resolveUser: getCurrentUser, save: workspaceService.save,
    limit: userId => createAuthRateLimit(prisma, env.AUTH_SECRET ?? "")("preferences-account", userId),
  })(request);
}
