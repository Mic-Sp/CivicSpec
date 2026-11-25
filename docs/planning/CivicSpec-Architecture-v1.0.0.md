# CivicSpec — System Architecture Specification

**Version:** 1.0.0  
**Date:** November 24, 2026  
**Baseline:** CivicSpec PRD v1.0.7 & UX/UI Specification v1.0.1  
**Target:** Release 2 Pilot-Ready MVP (Modular Monolith)  
**GitHub Hosting Tier:** GitHub Free for Organizations (`FREE_FORK_CI` governance mode with `PAID_NATIVE_RULESETS` upgrade adapter)

---

## 1. Architectural Pattern: Modular Monolith Spine

Consistent with PRD Section 21.1, CivicSpec Release 2 is structured as a single full-stack TypeScript application (**Next.js App Router + Prisma ORM + PostgreSQL + Octokit GitHub App + Structured LLM Gateway**) with strict internal module boundaries and server-enforced data projections. Logical subsystem boundaries do not require separate microservices or vector databases in Release 2.

```text
+-----------------------------------------------------------------------------------+
|                        Next.js App Router (UI & Route Handlers)                   |
|  - Semantic Light/Dark/System Theme Engine (NFR-051, tokens.css)                  |
|  - Role-Aware Shell & Server-Side DTO Projection Layer (FR-115, FR-125)           |
+---------+-------------------+-------------------+-------------------+-------------+
          |                   |                   |                   |
          v                   v                   v                   v
+-----------------+ +-------------------+ +-----------------+ +---------------------+
| Discovery & AI  | | Governance &      | | GitHub Adapter  | | Verification &      |
| Triage Engine   | | Routing Engine    | | (Octokit App)   | | Audit Ledger        |
| - Chat/Wizard   | | - 3-Tier Queue    | | - FREE_FORK_CI  | | - SHA-Bound Proofs  |
|   Sync (FR-146) | |   (FR-040/041)    | | - Gitleaks Gate | | - Unlisted Revocable|
| - Direct Context| | - DoR Gate        | | - Read-Only     | |   Shares (FR-078)   |
|   Loader (7.4)  | |   (FR-144)        | |   Fork PR Flow  | | - Append-Only Audit |
| - Zod Schema    | | - Atomic Claims   | | - Webhook HMAC  | |   Log (FR-091)      |
|   Validator     | |   (FR-044)        | |   Idempotency   | |                     |
+--------+--------+ +---------+---------+ +--------+--------+ +----------+----------+
         |                    |                    |                     |
         +--------------------+--------------------+---------------------+
                                       |
                                       v
                     +-----------------------------------+
                     | PostgreSQL (Prisma ORM)           |
                     | - Row-Level Projection Guards     |
                     | - Transactional State Machines    |
                     | - Idempotency & Webhook Event Log |
                     +-----------------------------------+
```

---

## 2. Core Architectural Subsystems

### 2.1 Server-Side Projection & Blind Discovery Guard (`FR-118`–`FR-126`, `NFR-043`–`NFR-044`)
* **Strict Data Isolation:** Unassigned builders and public visitors never query `Project`, `ProblemSubmission`, or `Organization` tables directly. All public and catalog queries read exclusively from `AnonymousProjectProfile`.
* **Progressive Disclosure Gate:** Restricted fields (`Organization` legal name, website, `DiscoverySourceRecord` verbatim transcripts, `RepositoryReference` URLs, and contact details) are stripped in server DTO mappers and unlocked only when a server-verified `ProjectAssignment` transitions to `ACTIVE` with `identityUnlocked = true`.
* **Confidential Tier Isolation:** `PriorityEligibility` (justice-impacted status) and `PartnerReferral` live in isolated tables excluded from all public, problem-owner, and shared-shell projections (`FR-042`, `NFR-009`).

### 2.2 Dual-Mode Discovery & Direct Full-Context AI Engine (`FR-009`, `FR-098`, `FR-103`, `FR-146`)
* **Unified Source Store:** Both **Chat Mode** and the **5-Step Guided Wizard** write to `DiscoverySourceRecord` under a single `ProblemSubmission` ID, recording `id` (stable source anchor), `sequenceNumber`, `inputMode`, `questionKey`, `questionVersion`, `questionText`, verbatim `content`, and `supersededById`.
* **Mode-Switching Synchronization (`FR-146`):** Switching between Chat and Wizard saves pending input or requires explicit discard confirmation, updates `DiscoveryDraftState.preferredMode`, and reloads from the exact same chronological record without creating duplicate submissions.
* **Direct Full-Context Injection (`Section 7.4`):** Release 2 avoids vector databases and embeddings. Before inference, the Context Assembler calculates exact token counts across chronological `DiscoverySourceRecord` rows and the current `ProjectProfile` (Living Project Profile). If total tokens exceed the configured model budget, generation halts cleanly and flags `aiEscalationReason = "CONTEXT_OVERFLOW"` for human reviewer intervention rather than truncating source history.
* **Schema & Provenance Validation (`FR-024`, `FR-102`, `FR-141`):** All LLM outputs pass strict Zod validation before persistence. Every extracted requirement links to `DiscoverySourceRecord` IDs and defaults to `ClaimStatus = PROPOSED` until confirmed by the stakeholder or human reviewer.

### 2.3 GitHub Governance Adapter (`FREE_FORK_CI` vs. `PAID_NATIVE_RULESETS`)
Because GitHub Free for Organizations restricts native branch protection rulesets and native secret scanning to public repositories, Release 2 encapsulates GitHub repository security behind `env.GITHUB_GOVERNANCE_MODE`:

1. **`FREE_FORK_CI` (Release 2 Default):**
   * Provisions a private repository inside `civicspec-org` from an approved `RepositoryTemplate` (`FR-059`).
   * Injects `.github/workflows/civicspec-security.yml` running **Gitleaks** secret scanning and template test suites, verifying workflow presence via the GitHub Contents API before marking `gitleaksVerified` and `ciWorkflowVerified` true.
   * Grants assigned developers **`pull` (`Read`) permission** on the upstream private repository (`FR-145`) with private organization forks enabled. Developers work in their private fork and submit PRs against upstream `main`. Because builders only hold `Read` permission upstream, GitHub physically prevents direct pushes to `main` and self-merges (`BR-007`). Only an authorized Technical Reviewer (`push`/`maintain`) or the CivicSpec GitHub App merges approved PRs.
2. **`PAID_NATIVE_RULESETS` (Future Upgrade Path):**
   * Switches via configuration flag when upgrading to GitHub Team/Enterprise or **GitHub for Nonprofits**, enabling native GitHub Rulesets and GitHub Secret Protection API checks without altering state machine logic.
3. **Public Sandbox Calibration Repository (`FR-139`, `FR-140`):**
   * Hosted as a **public** repository (`civicspec-org/sandbox-calibration`) containing only synthetic data and zero stakeholder secrets. Public visibility unlocks native GitHub branch protection and native secret scanning at `$0`, while the webhook handler verifies exact `headSha`, target branch, and unmodified baseline test workflow hashes.

### 2.4 Decoupled Transactional State Machines (`FR-060`, `Section 8`)
* `ProblemSubmission` (parent intake/decomposition) and `Project` (child execution) operate as separate state machines linked one-to-many.
* All state transitions execute inside `prisma.$transaction` blocks with optimistic concurrency checks (`version Int`), preventing double-claims (`FR-044`) and stale overwrites (`FR-146`).

---

## 3. Repository Directory Structure

Maps directly to the 55 screens in `CivicSpec-UX-UI-Spec-v1.0.1` (`UX-01` through `UX-55`):

```text
src/
├── app/
│   ├── (public)/                         # Unauthenticated public routes
│   │   ├── page.tsx                      # UX-01: Landing ("Real needs. Real code. Real experience.")
│   │   ├── how-it-works/page.tsx         # UX-02: Dual workflows, sandbox/bypass, blind discovery
│   │   ├── projects/
│   │   │   ├── page.tsx                  # UX-19: Anonymous general-release catalog
│   │   │   └── [opaqueSlug]/page.tsx     # UX-20: Sanitized project detail & eligibility-aware CTA
│   │   ├── verify/[opaqueToken]/page.tsx # UX-33: Unlisted, revocable external verification page
│   │   ├── guidelines/page.tsx           # UX-03: Community & volunteer guidelines
│   │   ├── privacy/page.tsx              # UX-03: Privacy & retention policy
│   │   ├── terms/page.tsx                # UX-03: Terms of participation
│   │   └── auth/page.tsx                 # UX-04: Auth sign-in/register/recovery
│   ├── app/                              # Authenticated role-aware shell
│   │   ├── layout.tsx                    # Shared shell, role switcher, Light/Dark/System toggle
│   │   ├── page.tsx                      # UX-07: Unified role task dashboard
│   │   ├── onboarding/page.tsx           # UX-05: Owner/Builder intent & terms acknowledgment
│   │   ├── account/page.tsx              # UX-06: Account, theme persistence, visibility, privacy
│   │   ├── report/page.tsx               # UX-48: Participant safety/exploitation reporting
│   │   ├── owner/
│   │   │   ├── eligibility/page.tsx      # UX-08: 501(c)(3) / noncommercial attestation
│   │   │   └── projects/page.tsx         # UX-15: Owner child projects & acceptance tracker
│   │   ├── submissions/
│   │   │   ├── page.tsx                  # UX-09: Owner drafts & active submissions
│   │   │   ├── new/page.tsx              # UX-10: Privacy notice & Chat vs. Wizard mode entry
│   │   │   └── [id]/
│   │   │       ├── page.tsx              # UX-13: Parent submission status & child breakdown
│   │   │       ├── interview/page.tsx    # UX-11: Dual-mode discovery + live LPP sidebar
│   │   │       └── profile/page.tsx      # UX-12: Living Project Profile & source inspection
│   │   ├── builder/
│   │   │   ├── profile/page.tsx          # UX-16: Skills, GitHub OAuth link, visibility
│   │   │   ├── readiness/page.tsx        # UX-17: Sandbox PR status or partner bypass
│   │   │   ├── eligibility/page.tsx      # UX-18: Confidential priority & partner referral
│   │   │   └── projects/page.tsx         # UX-22: Builder active/completed/withdrawn projects
│   │   ├── contributions/
│   │   │   ├── page.tsx                  # UX-31: Verified contribution ledger
│   │   │   └── [id]/share/page.tsx       # UX-32: Consent-controlled share link preview/revoke
│   │   ├── projects/[id]/                # Shared authorized project workspace
│   │   │   ├── overview/page.tsx         # UX-23: Unlocked identity, status, timeline
│   │   │   ├── specification/page.tsx    # UX-24: Versioned spec, criteria, source anchors
│   │   │   ├── confirm/page.tsx          # UX-14: Owner plain-language scope confirmation
│   │   │   ├── conversation/page.tsx     # UX-25: Authorized original chat & wizard transcript
│   │   │   ├── github/page.tsx           # UX-26: Repo/fork instructions, PRs, Gitleaks/CI SHA
│   │   │   ├── review/page.tsx           # UX-27: Technical review checklist & SHA evidence
│   │   │   ├── accept/page.tsx           # UX-28: Owner plain-language acceptance / correction
│   │   │   ├── handoff/page.tsx          # UX-29: Handoff owner, license, BR-039 defect window
│   │   │   ├── withdraw/page.tsx         # UX-30: Voluntary withdrawal & access revocation
│   │   │   └── assignment/page.tsx       # UX-21: Atomic claim/application confirmation
│   │   ├── reviewer/
│   │   │   ├── specifications/
│   │   │   │   ├── page.tsx              # UX-34: Reviewer spec queue
│   │   │   │   └── [id]/page.tsx         # UX-35: Split source/spec editor & anonymizer
│   │   │   └── implementations/
│   │   │       ├── page.tsx              # UX-36: Reviewer PR implementation queue
│   │   │       └── [id]/page.tsx         # UX-37: Exact head SHA & criteria sign-off
│   │   └── admin/
│   │       ├── page.tsx                  # UX-38: Admin operations dashboard
│   │       ├── intake/[id]/page.tsx      # UX-39: Noncommercial eligibility & decomposition
│   │       ├── projects/[id]/page.tsx    # UX-40: FR-144 Definition-of-Ready & publish gate
│   │       ├── people/page.tsx           # UX-41: Roles, partner referrals, restricted tier
│   │       ├── routing/page.tsx          # UX-42: Sequential window durations & precedence
│   │       ├── templates/page.tsx        # UX-43: Multi-language template & CI registry
│   │       ├── integrations/page.tsx     # UX-44: GitHub webhook & access reconciliation
│   │       ├── verification/page.tsx     # UX-45: Verification audit, correction & revocation
│   │       ├── audit/page.tsx            # UX-46: Append-only security & disclosure audit log
│   │       ├── analytics/page.tsx        # UX-47: Privacy-preserving pilot metrics
│   │       ├── reports/page.tsx          # UX-48: Moderation & safety triage
│   │       ├── privacy/page.tsx          # UX-49: Redaction, deletion & cache invalidation
│   │       └── handoff/page.tsx          # UX-50: Handoff & public release clearance
│   └── api/
│       └── webhooks/github/route.ts      # HMAC-verified, idempotent GitHub webhook receiver
├── server/
│   ├── auth/                             # Session resolution, RBAC, projection guards
│   ├── discovery/                        # Dual-mode state sync, LPP reducer, token budgeter
│   ├── ai/                               # Provider abstraction, Zod schemas, prompt templates
│   ├── github/                           # Octokit App client, FREE_FORK_CI & PAID adapters
│   ├── routing/                          # 3-tier window evaluator & atomic claim locking
│   └── verification/                     # Contribution ledger & opaque token resolver
└── styles/
    └── tokens.css                        # Semantic Light/Dark CSS custom properties (UX §3.1)
```

---

## 4. Non-Negotiable Server-Side Invariants

Every service method and API route handler must enforce these seven invariants:

1. **Atomic Project Claim & Ordered Routing (`FR-040`, `FR-043`, `FR-044`, `FR-139`):**
   * Inside `prisma.$transaction`:
     1. Confirm `DeveloperProfile.githubVerifiedAt !== null`.
     2. Confirm `SandboxCalibration.passed === true` **OR** an active `VERIFIED` `PartnerReferral`.
     3. Compute builder's highest confidential tier (`MISSION_PRIORITY` > `PARTNER_PRIORITY` > `GENERAL_ACCESS`) and verify `now >= RoutingPolicy[<tier>WindowOpens]`.
     4. Atomically update `Project` where `id = :projectId AND state = 'PUBLISHED' AND version = :expectedVersion` to `ASSIGNED` (`version + 1`), insert `ProjectAssignment` (`identityUnlocked = true`), record `AuditEvent` (`IDENTITY_DISCLOSED`), and enqueue `RepositoryAccessGrant` (`permission = "pull"` in `FREE_FORK_CI` mode).
2. **No Self-Approval or Self-Merge (`BR-007`):**
   * Reject any `Review` creation where `reviewerId` matches any active or historical `developerId` in `ProjectAssignment` for that project, regardless of multi-role permissions.
3. **SHA-Pinned Acceptance Invalidation (`FR-142`):**
   * When GitHub delivers a `pull_request` (`synchronize`) webhook updating `headSha`, mark all `Review` and `AcceptanceRecord` rows tied to prior SHAs as `isInvalidated = true` and revert `Project.state` from `TECHNICAL_REVIEW` or `STAKEHOLDER_ACCEPTANCE` back to `IN_PROGRESS`.
4. **Fail-Closed Publication Gate (`FR-144`, `FR-059`):**
   * Block `Project` transition from `APPROVED` to `PUBLISHED` unless every boolean flag on `ReadinessChecklist` is `true` **and** `RepositoryReference` confirms `gitleaksVerified`, `ciWorkflowVerified`, `branchRulesVerified`, and `runbookVerified` are all `true`.
5. **Withdrawal Access Revocation (`FR-127`, `FR-145`):**
   * On builder withdrawal, immediately set `ProjectAssignment.identityUnlocked = false`, revoke GitHub repository access (`RepoAccessStatus = PENDING_REVOKE -> REVOKED`), audit `IDENTITY_ACCESS_REVOKED`, and block project reassignment if revocation enters `FAILED_RECONCILIATION`.
6. **Bounded Support Cutoff (`BR-039`):**
   * Transitioning `Project.state` to `COMPLETED` records `RepositoryHandoff` with `defectWindowEndsAt = hasDefectWindow ? completedAt + 14 days : null`. Once expired, block defect reopening and route new requests to `/app/submissions/new`.
7. **Webhook Idempotency & Signature Verification (`NFR-006`, `FR-055`):**
   * Verify `X-Hub-Signature-256` using HMAC-SHA256 before parsing payloads, and insert `X-GitHub-Delivery` into `ProcessedWebhookEvent` inside the handler transaction to ignore duplicate deliveries safely.