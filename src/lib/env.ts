import "server-only";

import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const postgresUrl = z.url().refine(
  (value) => ["postgresql:", "postgres:"].includes(new URL(value).protocol),
  "Must be a PostgreSQL connection URL",
);

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Non-secret local placeholders allow scaffolding without provisioned services.
  DATABASE_URL: postgresUrl.default(
    "postgresql://civicspec:local-only@localhost:5432/civicspec?pgbouncer=true",
  ),
  DIRECT_URL: postgresUrl.default(
    "postgresql://civicspec:local-only@localhost:5432/civicspec",
  ),
  APP_URL: z.url().refine(
    (value) => ["http:", "https:"].includes(new URL(value).protocol),
    "Must be an HTTP(S) URL",
  ).default("http://localhost:3000"),
  // Auth is inactive. No shared default signing secret is provided.
  AUTH_SECRET: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(32).optional(),
  ),
  GITHUB_GOVERNANCE_MODE: z.enum([
    "FREE_FORK_CI",
    "PAID_NATIVE_RULESETS",
  ]).default("FREE_FORK_CI"),
  GITHUB_APP_ID: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().regex(/^\d+$/).optional(),
  ),
  GITHUB_APP_PRIVATE_KEY: optionalText,
  GITHUB_WEBHOOK_SECRET: optionalText,
  GITHUB_OAUTH_CLIENT_ID: optionalText,
  GITHUB_OAUTH_CLIENT_SECRET: optionalText,
  GITHUB_ORG: z.string().min(1).default("civicspec-org"),
  AI_PROVIDER: z.enum(["disabled", "openai", "anthropic", "google"]).default("disabled"),
  AI_MODEL: optionalText,
  AI_MAX_CONTEXT_TOKENS: z.coerce.number().int().positive().default(32000),
  OPENAI_API_KEY: optionalText,
  ANTHROPIC_API_KEY: optionalText,
  GOOGLE_GENERATIVE_AI_API_KEY: optionalText,
});

const parsed = serverEnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Report field names only; values and Zod's full error object may contain secrets.
  const fields = [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))];
  throw new Error(`Invalid server environment variables: ${fields.join(", ")}`);
}

export const env = Object.freeze(parsed.data);
