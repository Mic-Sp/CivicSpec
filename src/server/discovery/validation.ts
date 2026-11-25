import "server-only";
import { z } from "zod";
import { privacyNoticeVersion } from "@/lib/owner-intake";

const text = (max: number, message: string) => z.string().trim().min(1, message).max(max, `Use ${max} characters or fewer.`)
  .refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Remove control characters.");
const optionalText = (max: number) => z.string().trim().max(max, `Use ${max} characters or fewer.`)
  .refine(value => !/[\u0000-\u001f\u007f]/.test(value), "Remove control characters.").default("");
export const eligibilitySchema = z.object({
  expectedUserId: text(128, "Refresh the page and try again."),
  organizationId: z.string().max(128).default(""),
  revision: z.string().datetime().or(z.literal("")).default(""),
  category: z.enum(["NONPROFIT_501C3", "COMMUNITY_GROUP", "INDIVIDUAL_NONCOMMERCIAL", "COMMERCIAL_DEFERRED"], { error: "Choose the type of owner." }),
  legalName: text(160, "Enter an organization or request name."),
  einOrRegistration: optionalText(80),
  websiteUrl: optionalText(500).refine(value => {
    if (!value) return true;
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password; } catch { return false; }
  }, "Enter an http or https website without credentials, or leave it blank."),
  noncommercialAttest: z.enum(["on", "off"]).optional().transform(value => value === "on"),
}).strict();

export const newRequestSchema = z.object({
  draftToken: z.string().max(256),
  organizationId: text(128, "Choose your eligibility record."),
  title: text(160, "Enter a working title."),
  preferredMode: z.enum(["CHAT", "WIZARD"], { error: "Choose Chat with CivicSpec or Guided form." }),
  privacyNoticeVersion: z.literal(privacyNoticeVersion, { error: "Refresh the page to review the current recording notice." }),
  privacyAck: z.literal("on", { error: "Acknowledge the recording and sharing notice before creating a draft." }),
  noncommercialPurpose: z.literal("on", { error: "Confirm this request serves a noncommercial purpose without commercial beneficiaries, exploitation, unreasonable volunteer obligations, or replacement of paid work." }),
}).strict();

export class OwnerInputError extends Error {
  constructor(public readonly fieldErrors: Record<string, string>, message = "Check the highlighted details and try again.") { super(message); }
}
export function parseOwnerInput<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (parsed.success) return parsed.data;
  const fields: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0];
    if (typeof key === "string") fields[key] ??= issue.message;
  }
  throw new OwnerInputError(fields);
}
