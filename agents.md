# AGENTS.md — CivicSpec Engineering Contract

This repository implements **CivicSpec**, an AI-assisted conversational requirements engineering and micro-project platform connecting eligible noncommercial problem owners with justice-impacted, underserved, and non-traditional developers.

**Tagline:** *"Real needs. Real code. Real experience."*

## 1. Source-of-Truth Documents

Before writing or modifying code, consult these authoritative specifications in the repository:

1. **`docs/planning/CivicSpec-PRD-v1.0.7.md`** — Normative functional requirements (`FR-001`–`FR-146`), nonfunctional requirements (`NFR-001`–`NFR-051`), and business rules (`BR-001`–`BR-039`).
2. **`docs/planning/CivicSpec-UX-UI-Spec-v1.0.1.md`** — All 55 screen contracts (`UX-01`–`UX-55`), dual-mode intake behavior, accessibility standards, and state labels.
3. **`docs/planning/CivicSpec-Architecture-v1.0.0.md`** — Modular monolith layout, subsystem boundaries, and server-side invariants.
4. **`prisma/schema.prisma`** — Authoritative PostgreSQL/Prisma data model.
5. **`src/styles/tokens.css`** — Semantic Light/Dark/System CSS custom properties.

If a prompt conflicts with a security, privacy, or governance invariant in PRD v1.0.7, **stop and flag the conflict** rather than silently weakening controls.

## 2. Release 2 (Pilot MVP) Scope Guardrails

Do **NOT** build deferred features into Release 2:

* **Noncommercial Only (`FR-130`, `FR-134`):** Release 2 admits verified 501(c)(3) nonprofits, eligible community groups, and noncommercial individuals only. Commercial businesses and commercial-benefit projects must be blocked/deferred before AI triage or publication.
* **No Vector DB / Embeddings (`Section 7.4`):** Release 2 uses **direct full-context injection** only. Do not introduce Pinecone, pgvector, embedding pipelines, or semantic search (`FR-104`, `FR-106`, `FR-110` are deferred to Release 3).
* **No Payments or Escrow (`FR-083`–`FR-087`):** All engineering workflows are 100% volunteer-first and free. Never require financial data or add payment processing. Donations/supporter links (`P1`) are strictly external, voluntary, and never influence routing, review, or verification.
* **Modular Monolith:** Keep all subsystems inside the single Next.js App Router + Prisma TypeScript codebase (`src/server/*`). Do not split into microservices.

## 3. Non-Negotiable Server-Side Invariants

Every API route, Server Action, and service method **must** enforce these rules server-side (never rely on client UI hiding):

1. **Blind Discovery & Strict DTO Projections (`FR-118`–`FR-126`, `NFR-043`–`NFR-044`):**
   * Unassigned builders and public routes must query **`AnonymousProjectProfile`** only—never expose `Organization` names, URLs, `DiscoverySourceRecord` transcripts, or identifying GitHub repository URLs before confirmed assignment.
   * Never ship restricted fields to the browser only to hide them with CSS.
2. **Confidential Priority Tier Isolation (`FR-006`, `FR-040`–`FR-042`, `NFR-009`):**
   * `PriorityEligibility` (justice-impacted status) and `PartnerReferral` are strictly separate confidential records.
   * Never expose priority status, queue tier, or justice involvement in public profiles, shared app shells, owner views, GitHub issues, or verification links.
   * Enforce ordered routing precedence server-side: `MISSION_PRIORITY` (Tier 1) > `PARTNER_PRIORITY` (Tier 2) > `GENERAL_ACCESS` (Tier 3). Dual-eligible users resolve to their highest tier.
3. **Atomic Project Claims & Readiness Gate (`FR-043`, `FR-044`, `FR-139`):**
   * Wrap live claims in `prisma.$transaction` with optimistic locking (`Project.version`).
   * Reject claims unless the builder has:
     1. Verified GitHub identity (`DeveloperProfile.githubVerifiedAt !== null`), **AND**
     2. Passed `SandboxCalibration` (`passed === true`) **OR** an admin-verified `PartnerReferral`, **AND**
     3. Current server time `>= RoutingPolicy[<tier>WindowOpens]`.
   * Unlock `identityUnlocked = true`, write `AuditEvent("IDENTITY_DISCLOSED")`, and enqueue `RepositoryAccessGrant` atomically.
4. **No Self-Approval or Self-Merge (`BR-007`, `FR-070`):**
   * Reject any `Review` submission where `reviewerId` matches any active or historical `developerId` on `ProjectAssignment` for that project—even if the user holds both `DEVELOPER` and `REVIEWER` roles.
5. **SHA-Pinned Acceptance & Invalidation (`FR-142`):**
   * Bind `Review`, `AcceptanceRecord`, and `ContributionRecord` to the exact `specVersion` and `deliveredSha`.
   * On any GitHub `pull_request` (`synchronize`) webhook updating `headSha`, invalidate prior approvals (`isInvalidated = true`) and revert `TECHNICAL_REVIEW` or `STAKEHOLDER_ACCEPTANCE` back to `IN_PROGRESS`.
6. **Fail-Closed Publication Gate (`FR-144`, `FR-059`):**
   * Never transition `Project.state` from `APPROVED` to `PUBLISHED` unless every boolean flag on `ReadinessChecklist` is `true` **and** `RepositoryReference` verifies `gitleaksVerified`, `ciWorkflowVerified`, `branchRulesVerified`, and `runbookVerified`.
7. **Withdrawal & Revocation Reconciliation (`FR-127`, `FR-145`):**
   * Voluntary withdrawal is always permitted with zero financial penalty. Immediately set `identityUnlocked = false`, revoke GitHub repo access, and audit the event. If revocation enters `FAILED_RECONCILIATION`, block project reassignment and alert admins.
8. **Bounded Responsibility Cutoff (`BR-039`):**
   * Transitioning `Project` to `COMPLETED` ends developer responsibility by default, or starts a pre-agreed fixed 14-calendar-day defect window (`RepositoryHandoff.defectWindowEndsAt`) strictly limited to original acceptance criteria. Never silently reopen completed projects; route new feature requests to `/app/submissions/new`.
9. **Webhook Security & Idempotency (`FR-055`, `NFR-006`):**
   * Always verify `X-Hub-Signature-256` with HMAC-SHA256 before parsing payloads. Record `X-GitHub-Delivery` in `ProcessedWebhookEvent` inside the transaction to handle duplicate deliveries idempotently.

## 4. Dual-Mode Discovery & AI Engineering Rules

* **Unified Source Store (`FR-009`, `FR-098`, `FR-146`):**
  * Chat mode and the 5-Step Guided Wizard must share a single `ProblemSubmission` ID, `DiscoveryDraftState`, and chronological `DiscoverySourceRecord` table.
  * Store verbatim stakeholder wording with `inputMode`, `questionKey`, `questionVersion`, `questionText`, and stable `id`. Never overwrite originals with summaries or fabricate chat quotes from wizard answers.
  * Switching modes mid-draft must persist pending input (or require explicit discard confirmation) and restore state without creating duplicate submissions.
* **Direct Full-Context Token Guard (`Section 7.4`):**
  * Load the full authorized chronological `DiscoverySourceRecord` history + current `ProjectProfile` into model context.
  * Enforce a configurable token ceiling. If context overflows, **halt generation** and set `aiEscalationReason = "CONTEXT_OVERFLOW"` for human review. **Never silently truncate history.**
* **Prompt-Injection Defense & Schema Validation (`FR-024`, `NFR-040`, `NFR-050`):**
  * Treat all stakeholder text as untrusted data delimited from system instructions.
  * Validate all AI outputs with **Zod** before saving. Reject malformed outputs without losing saved stakeholder answers.
  * Tag AI-extracted requirements as `PROPOSED` or `INFERRED` linked to `DiscoverySourceRecord` IDs (`RequirementSource.verifiedByHuman = false`). Never auto-approve or auto-publish AI output.
  * Reject stale AI responses if the underlying submission revision advanced while inference was in flight (`FR-146`).

## 5. GitHub Free Organization Governance (`FREE_FORK_CI`)

Release 2 runs on **GitHub Free for Organizations**, where native branch protection rulesets and native secret scanning are restricted to public repositories. Abstract all repository governance behind `env.GITHUB_GOVERNANCE_MODE`:

* **`FREE_FORK_CI` (Release 2 Default):**
  * Provision private project repos in `civicspec-org` from approved multi-language templates (`RepositoryTemplate`).
  * Bundle and verify `.github/workflows/civicspec-security.yml` running **Gitleaks** + template tests on every PR.
  * Grant assigned builders **`pull` (`Read`) permission** on the upstream private repository (`FR-145`) with private forks enabled. Builders submit PRs from private forks; GitHub physically blocks direct pushes to `main` and self-merges (`BR-007`).
  * Verify `gitleaksPassed` and `ciChecksPassed` against the exact PR `headSha` before allowing `TECHNICAL_REVIEW` or merge.
* **`PAID_NATIVE_RULESETS` (Future Upgrade Path):**
  * Keep adapter interfaces clean so upgrading to GitHub Team or **GitHub for Nonprofits** enables native rulesets and secret protection via configuration toggle.
* **Public Sandbox Repository (`FR-139`, `FR-140`):**
  * Host the synthetic sandbox calibration repo publicly (`civicspec-org/sandbox-calibration`) to leverage free native branch protection and secret scanning.
  * Never run untrusted PR head code in privileged `pull_request_target` jobs. Verify that baseline test and workflow files were not tampered with.

## 6. UI/UX, Theming & Accessibility Rules

* **Semantic Tokens Only (`NFR-051`, `src/styles/tokens.css`):**
  * Always use CSS custom properties from `src/styles/tokens.css` (`--color-canvas`, `--color-surface`, `--color-action-bg`, `--color-text-primary`, etc.). **Never hardcode hex colors** in components.
  * Support **Light / Dark / System** themes across all routes, dialogs, code blocks, error states, and `/verify/[opaqueToken]`. Switching themes must never reset drafts, focus, route, or auth state.
* **WCAG 2.2 AA Baseline (`NFR-023`–`NFR-027`):**
  * Minimum interactive target height: `44px` (`--control-min-height`).
  * Visible `:focus-visible` outlines (`3px solid var(--color-focus-ring)`), full keyboard operability, reflow at `320px` width without horizontal page scrolling, and `prefers-reduced-motion` support.
  * Never convey status by color alone—always pair semantic color with text + icon.
* **Plain Language & Dignity:**
  * Use plain language in problem-owner flows ("technical need", "builder", "review", "accepted").
  * Never display "certified engineer" (use "verified contribution") or equate sandbox calibration / merged PRs with completed production experience (`FR-143`).
  * Unlisted verification pages (`/verify/[opaqueToken]`) must include `noindex, nofollow` headers and return a generic unavailable state when revoked or invalid.

## 7. Implementation Sequence & Testing Requirements

Follow this incremental build order and ship security/authorization tests **alongside** every increment (never deferred):

1. **Foundation & Shell (`E1`):** Auth, multi-role RBAC, `src/styles/tokens.css` Light/Dark/System theme persistence, shared role-aware layout, and `AuditEvent` logger.
2. **Dual-Mode Intake & Provenance (`E2`, `E11`, `E13`):** Noncommercial eligibility gate, Chat + 5-Step Wizard unified on `DiscoverySourceRecord`, mode switching, direct full-context token budgeter, and Living Project Profile.
3. **AI Triage, Review & Anonymization (`E3`, `E4`, `E12`):** Zod-validated spec generation, parent-to-child decomposition, split reviewer editor, owner confirmation, and `AnonymousProjectProfile` sanitization.
4. **Readiness, Routing & GitHub Adapter (`E5`, `E6`):** Public sandbox calibration webhook, partner referral bypass, 3-tier confidential queue, atomic claims, `FREE_FORK_CI` repo provisioning (Gitleaks + Read-only fork grants), and `FR-144` Definition-of-Ready gate.
5. **SHA-Pinned Review, Handoff & Verification (`E7`, `E8`, `E9`):** Technical review (no self-approval), stakeholder acceptance, `BR-039` handoff/defect cutoff, `ContributionRecord`, unlisted revocable `/verify/[opaqueToken]`, and admin operations.

### Mandatory Test Coverage per PR

* **Authorization & Leakage Negative Tests:** Verify unassigned users cannot read `DiscoverySourceRecord`, `Organization`, or `RepositoryReference` via direct API calls; verify `PriorityEligibility` never appears in public/owner/shell payloads.
* **Concurrency & Idempotency Tests:** Simultaneous project claims (exactly one succeeds), duplicate GitHub webhook deliveries, and stale AI/edit revision rejection.
* **GitHub Security Tests:** Untrusted PR modifying sandbox tests fails calibration; new commit SHA invalidates prior technical/stakeholder approvals; failed repo revocation blocks reassignment.
* **Dual-Mode & Theme Tests:** Chat-to-wizard-to-chat switching preserves verbatim records and source IDs; theme toggling retains unsaved draft input and focus.