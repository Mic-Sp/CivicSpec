import type { OwnerCategory, VerificationStatus } from "@prisma/client";

export const ownerCategories: Record<OwnerCategory, string> = {
  NONPROFIT_501C3: "501(c)(3) nonprofit",
  COMMUNITY_GROUP: "Community group",
  INDIVIDUAL_NONCOMMERCIAL: "Individual with a noncommercial need",
  COMMERCIAL_DEFERRED: "Commercial business or commercial-benefit request",
};
export const privacyNoticeVersion = "discovery-recording-v1";
export const recordingNotice = "We save this conversation to help define your project. Relevant messages may be shared with assigned builders and authorized reviewers. Please do not include passwords, personal records or confidential information.";
export const commercialExplanation = "Commercial businesses and commercial-benefit projects are deferred to a post-pilot release. This pilot supports noncommercial community needs only, including requests submitted through otherwise eligible people or groups.";

export function canStartPrivateDraft(organization: { category: OwnerCategory; noncommercialAttest: boolean; eligibilityStatus: VerificationStatus }) {
  return organization.category !== "COMMERCIAL_DEFERRED" && organization.noncommercialAttest
    && ["PENDING", "NEEDS_INFO", "VERIFIED"].includes(organization.eligibilityStatus);
}

export type OwnerFormState = { status: "idle" | "error"; message?: string; fieldErrors: Record<string, string> };
export const initialOwnerState: OwnerFormState = { status: "idle", fieldErrors: {} };
