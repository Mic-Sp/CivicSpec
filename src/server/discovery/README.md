# Owner intake entry (Step 4A)

The owner service protects eligibility records, submission lists, and individual
submission projections using the current authenticated PROBLEM_OWNER role.
Administrator status alone grants no owner access. Every resource query includes
the actor's owner ID or organization membership. Foreign and missing submission
IDs produce the same unavailable response. Pages also check the role before
reading data; the shared shell never receives organization or submission records.

Eligibility details use Organization/OrganizationMember, including individual
noncommercial requests (a request name is sufficient; no legal personal name is
required). Owners can add records or update records they belong to, but cannot
set verification decisions, reviewer notes, or verification timestamps. Commercial
categories and absent noncommercial attestation result in DEFERRED. Other new or
changed attestations are PENDING; unchanged details preserve a human decision.
An updatedAt revision prevents stale overwrites. Writes and their minimal audit
receipts are atomic. Internal reviewer notes and verification actor IDs are never
included in the owner DTO.

Following UX section 6, attested noncommercial PENDING/NEEDS_INFO records may
support private drafts. VERIFIED records also qualify. REJECTED, DEFERRED,
commercial, or unattested records cannot create drafts. Each new request must
separately acknowledge a noncommercial project purpose, including no commercial
beneficiaries, exploitation, unreasonable obligations, or substitution of paid
work. **A private draft is not approval:** future AI, review, and publication
increments must recheck current organization and project suitability, and require
verification for live approval/publication. Step 4A performs no AI processing,
publication, interviews, or GitHub operations.

The recording notice covers original chat messages, wizard answers, follow-ups,
saved state, and sharing with authorized reviewers/assigned builders. Both modes
require the same versioned acknowledgment before the first persistent draft write.
Decline is an ordinary navigation link; typing or changing entry controls does
not autosave. No raw entry text is included in audit metadata. The approved
privacy/retention policy route remains outside this increment; no unapproved
retention duration or policy is invented here.

Draft creation locks and rereads the account and organization, checks membership,
role, suspension, and eligibility, then writes one DRAFT ProblemSubmission,
DiscoveryDraftState, acknowledgment timestamp, and audit receipt in a transaction.
A random UUID signed for the current actor is the per-form retry key. Repeated
or parallel submissions of the same valid token return the existing owned draft.
Tampered/cross-account tokens fail; a client cannot select an existing unrelated
submission ID. Each independently opened new-request form can create a new draft.

Server Actions require the configured APP_URL origin, strict bounded Zod input,
current role, and the shared account throttle (30 mutations per ten minutes).
An eligibility form's expectedUserId must match the actual session actor; it
only detects delayed cross-account requests and never supplies authentication.
Client-supplied identity overrides, verification, and unknown fields are rejected. Auth and
unexpected failures return generic errors without database or resource details.
Forms retain values on validation errors and theme changes; field errors are
linked to labels and an accessible, focused summary.

The submissions list is paged in batches of 20. DTOs include parent state, saved
time, mode, and child state/opaque identifier/public title only. Original sources,
repository details, confidential builder eligibility, and referrals are excluded.
Request status and interview placeholder pages use the same scoped lookup.
The placeholder offers Save and exit and status inspection without collecting
answers or pretending that an interview is available.

Tests run through the existing commands:

```sh
npm test
npm run test:auth:db
npm run build
npm run test:auth:browser
```

Integration/browser fixtures use isolated synthetic users and clean up only their
own records. The seeded verified owner is inspected without changing its records.
Tests cover role and cross-owner denial, injected verification fields, commercial
and consent gates, stale decisions, atomic rollback, duplicate retries, both modes,
state projections, 44px controls, reflow, and Light/Dark axe accessibility checks.
