import "server-only";

import { createHmac } from "node:crypto";

import type { PrismaClient } from "@prisma/client";

const limits = {
  "sign-in-global": 200,
  "sign-in-account": 10,
  "registration-global": 100,
  "registration-account": 3,
  "onboarding-account": 10,
  "preferences-account": 120,
  "owner-intake-account": 30,
  "discovery-account": 120,
} as const;
export type AuthLimitScope = keyof typeof limits;

export function createAuthRateLimit(database: Pick<PrismaClient, "$queryRaw">, secret: string, now = () => new Date()) {
  if (Buffer.byteLength(secret, "utf8") < 32) throw new Error("AUTH_SECRET is required for authentication rate limits.");
  return async (scope: AuthLimitScope, identity = "global"): Promise<boolean> => {
    const key = createHmac("sha256", secret).update(`auth-limit:${scope}:${identity}`).digest("hex");
    const timestamp = now();
    const resetsAt = new Date(timestamp.getTime() + 10 * 60 * 1000);
    // Atomic across workers and instances; never trust a client-supplied IP header.
    const rows = await database.$queryRaw<{ hits: number }[]>`
      INSERT INTO "AuthRateLimit" ("key", "hits", "resetsAt") VALUES (${key}, 1, ${resetsAt})
      ON CONFLICT ("key") DO UPDATE SET
        "hits" = CASE WHEN "AuthRateLimit"."resetsAt" <= ${timestamp} THEN 1 ELSE LEAST("AuthRateLimit"."hits" + 1, 1000000) END,
        "resetsAt" = CASE WHEN "AuthRateLimit"."resetsAt" <= ${timestamp} THEN ${resetsAt} ELSE "AuthRateLimit"."resetsAt" END
      RETURNING "hits"
    `;
    return rows[0].hits <= limits[scope];
  };
}
