# CivicSpec — UX/UI Specification

**Version:** 1.0.1 | **Baseline:** CivicSpec PRD v1.0.5 | **Target:** Full Release 2 pilot MVP
**Status:** Stakeholder-refined design; implementation details pending validation | **Author role:** Sally — simulated BMad UX Expert

## 1. Purpose and scope

Design a working, accessible service for real participants, not a separate demonstration. CivicSpec turns technical needs into bounded, human-approved engineering projects. Pilot owners are verified 501(c)(3) nonprofits, eligible community groups and noncommercial individuals. Commercial work is deferred. Developers participate voluntarily; optional donations are not a prerequisite or influence on any workflow. The Next Chapter showcase follows MVP readiness; no partnership is assumed.

Normative requirements remain in PRD v1.0.5. This document defines interaction behavior and proposes visual/layout decisions, not a new technology stack. P0 screens are pilot required; P1 screens are optional; P2 is post-pilot. Direct authorized full-context AI processing is P0; vector retrieval, semantic/indexed search and retrieval document ingestion are P2. Multiple approved repository templates, private development, approved public release, sandbox or verified partner bypass, three ordered access tiers, separate lifecycles and shareable verification are P0.

## 2. Experience principles

Choice of guided conversation or structured wizard before technical configuration; progressive disclosure; plain language for owners; technical depth for builders; evidence over claims; consent and dignity; consistent interaction; recoverable workflows. Never show justice involvement or partner eligibility publicly. Never equate a sandbox pass or merged PR with production experience. Design for low bandwidth and keyboard-only use. All wireframes use fictional content.

## 3. Visual system (approved direction; proposed tokens)

| Token | Value / application |
|---|---|
| Brand dark | #183C37, brand surfaces with white text |
| Action | #116B5B, primary button with white text |
| Brand tint | #DDF3E9, light accents with dark text |
| Text | #172B35 |
| Secondary text | #465A64 |
| Surface | #FFFFFF |
| Canvas | #F5F7F8 |
| Border | #D5DCDE decorative; stronger #637780 for essential control boundaries |
| Error | #9F2424 text on #FFF1F0 |
| Warning | #7A4B00 text on #FFF4DC |
| Success | #176044 text on #E5F5EC |
| Focus | #235AC4, 3px outline, 2px offset; contrasting alternative on dark surfaces |

Typography: Inter or system sans-serif; monospace for identifiers, SHAs and code. Body 16px/1.5; small metadata 14px/1.5; H1 32/40, H2 24/32, H3 20/28. Spacing scale 4,8,12,16,24,32,48,64px. Radius 8px controls, 12px panels. Use icon plus text, never color alone. Minimum proposed control height 44px; no decorative animation required. Light and dark themes are P0 for pilot. Brand mark concept: code brackets with check mark; approved tagline “Real needs. Real code. Real experience.” Final logo not approved. Verify actual contrast in implemented states.

### 3.1 Theme contract (P0)

Use semantic CSS tokens rather than hard-coded component colors. Default to system preference; provide Light / Dark / System in the public header and authenticated account settings. Persist explicit preference locally for visitors and to account settings for signed-in users; apply before first paint where feasible. Theme changes must not reset drafts, focus, routing or authentication. No confidential data in theme storage. Both themes cover all routes, dialogs, code blocks, charts, error states, focus indicators and verification pages.

| Semantic token | Light | Dark (proposed) |
|---|---|---|
| Canvas | #F5F7F8 | #101C20 |
| Surface | #FFFFFF | #17282D |
| Primary text | #172B35 | #E9F3F0 |
| Secondary text | #465A64 | #B5C9C9 |
| Action background / text | #116B5B / #FFFFFF | #8FD6B5 / #102D27 |
| Accent surface / text | #DDF3E9 / #183C37 | #25483F / #DDF3E9 |
| Essential boundary | #637780 | #839C9F |
| Focus | #235AC4 | #A8C7FF |
| Error surface / text | #FFF1F0 / #9F2424 | #45272B / #FFC0C0 |
| Warning surface / text | #FFF4DC / #7A4B00 | #40351F / #FFE0A0 |
| Success surface / text | #E5F5EC / #176044 | #203D32 / #A9E8C8 |

Validate contrast for actual foreground/background pairings, hover, disabled, selected and focus states in both themes; respect forced colors and reduced motion.

## 4. Information architecture and responsive shell

Public: Home, How it works, Explore projects (general-release anonymous listings only), About, Guidelines, Privacy, Terms, Help, verification link. Optional Support page. Signed-in shell: role switcher (authorized roles only), Home/Tasks, role navigation, account/help, theme selector, sign out. One shared project workspace with permitted tabs; no duplicated role-specific applications. Desktop >=1200px: 240px navigation, flexible content, optional 320px context panel. 768–1199px: compact navigation, context drawer. <768px: single column, menu, stacked cards, tabs wrap or accessible select. At 320px no horizontal page scrolling; code/data tables may use labelled contained scrolling. Main text max 76 characters per line. Sticky actions must not obscure keyboard focus. Route paths below are proposed, opaque IDs never contain names.

| Workspace | Navigation |
|---|---|
| Owner | Tasks, My submissions, New request, My projects, Help |
| Builder | Tasks, Explore, Readiness, My projects, Contributions, Profile |
| Reviewer | Tasks, Specification queue, Implementation queue, Review history |
| Admin | Operations, Intake, Projects, People, Routing, Templates/integrations, Verification, Audit, Analytics |
| Assigned project | Overview, Specification, Stakeholder conversation, GitHub, Review & acceptance, Handoff; Contributions when available; Documents/AI assistant conditional P1 |

Role switch does not grant permissions. A user with multiple roles cannot approve their own implementation. All routes, tabs, actions, downloads, metadata and counts use server-authorized projections; hidden UI is not an access control. Browser history, caches and notifications must not leak restricted identity. On access loss clear restricted client state, show neutral access message and return to safe navigation.

## 5. Screen inventory and interaction contracts

Each row defines the minimum view and primary behavior. Every data view supports loading, empty, recoverable failure, stale state and unauthorized handling. Actions require authoritative server confirmation; never optimistic success for approval, assignment, verification or external integration. IDs are UX identifiers; route names are proposals.

| ID / route | Role / priority | Content, action, gating and recovery |
|---|---|---|
| UX-01 / | Public P0 | Mission, eligible pilot audience, two CTAs Submit a need / Explore projects, how it works, no payment required, clear pilot limitations; no partner endorsements without consent. |
| UX-02 /how-it-works | Public P0 | Owner and builder steps, sandbox/bypass explanation, blind assignment and withdrawal, volunteer terms, FAQ. |
| UX-03 /guidelines, /privacy, /terms, /help, /about | Public P0 | Accessible policy pages, version dates, contact/report route; policy content must be approved before launch. |
| UX-04 /auth | Public P0 | Register, sign in, recovery, logout; accessible validation, generic errors, password manager support; preserve safe return path. Authentication method TBD. |
| UX-05 /app/onboarding | Participant P0 | Choose owner or builder intent, acknowledge terms, resume; reviewer/admin roles assigned only by authorized operator. |
| UX-06 /app/account | Participant P0 | Account details, theme preference, visibility settings, authorized roles, sign out, privacy request route; reauthentication for sensitive changes where appropriate. |
| UX-07 /app | Participant P0 | Next required action, pending tasks, status, recent authorized activity; multi-role switch; no confidential tier in shared shell. |
| UX-08 /app/owner/eligibility | Owner P0 | Owner type, noncommercial purpose attestation, minimum evidence requested by admin; pending/verified/needs info/deferred; commercial request cannot proceed to live approval. |
| UX-09 /app/submissions | Owner P0 | Drafts, active intake, approved submissions and child projects; resume/create; status and last saved time. |
| UX-10 /app/submissions/new | Owner P0 | Plain-language introduction, recording/sharing notice, no credentials warning, acknowledge before recording; choose chat or guided wizard; save and exit. |
| UX-11 /app/submissions/:id/interview | Owner P0 | Persistent chat OR guided wizard, shared profile, mode switch, unresolved questions, retry/escalate, save/resume, submit for review when eligible. See section 6. |
| UX-12 /app/submissions/:id/profile | Owner/reviewer P0 | Living profile, sources, unknowns, conflicts, version; request correction; reviewer edits with rationale; no silent scope updates. |
| UX-13 /app/submissions/:id | Owner/reviewer P0 | Parent status, child projects, review decisions, next actions, original transcript for authorized users; distinct child states. |
| UX-14 /app/projects/:id/confirm | Owner P0 | Plain-language specification, in/out scope, deliverables, success criteria, maintenance/licensing and defect terms; confirm exact version or request revision. |
| UX-15 /app/owner/projects | Owner P0 | Child progress, review and acceptance tasks, handoff, project history; no confidential builder eligibility. |
| UX-16 /app/builder/profile | Builder P0 | Skills, interests, experience, professional visibility, verified GitHub connection and reconnect; save without sensitive eligibility. |
| UX-17 /app/builder/readiness | Builder P0 | Sandbox task, instructions, GitHub PR link, checks tied to head SHA, retry, pass status; or verified referral bypass. No ranking. |
| UX-18 /app/builder/eligibility | Builder P0 | Optional private priority request and partner referral, consent, pending/needs info/verified states; no detailed criminal history requested by default; separate attributes. |
| UX-19 /projects | Public / builder P0 | Anonymous cards, category/skills/complexity/availability filters, accessible list; server filters routing windows; no private counts or hidden data. |
| UX-20 /projects/:id | Public / builder P0 | Anonymous objective, requirements, scope, acceptance, effort, dependencies, skills, impact, licensing and handoff; claim/apply only if eligible; explain readiness gate without exposing tiers. |
| UX-21 /app/projects/:id/assignment | Builder P0 | Review participation terms, confirm claim or submit application; pending approval does not disclose identity; conflict or access provisioning status and recovery. |
| UX-22 /app/builder/projects | Builder P0 | Active/pending/completed/withdrawn assignments, next steps; no unrelated private project information. |
| UX-23 /app/projects/:id/overview | Assigned participants P0 | Authorized identity, status, scope version, next action, timeline, links to context; show access provisioning failures separately. |
| UX-24 /app/projects/:id/specification | Authorized participants P0 | Structured versioned requirements, acceptance criteria and source links; prior revisions clearly superseded; scope change request/review. |
| UX-25 /app/projects/:id/conversation | Authorized participants P0 | Original relevant discovery record (chat and verbatim wizard answers with question context), author, timestamp, source ID; jump-to-source anchor; clear redaction placeholders; no indexed search in P0. |
| UX-26 /app/projects/:id/github | Authorized participants P0 | Template/version, repo/issue/PR, checks, SHA, sync status, reconnect/retry/report, runbook; deployment only through approved paths. |
| UX-27 /app/projects/:id/review | Assigned participants P0 | Criteria/test evidence, revision feedback, technical decision; role-dependent controls; exact specification and SHA; stale approval warning. |
| UX-28 /app/projects/:id/accept | Owner P0 | Delivered revision, safe preview/runbook, plain criteria, accept or request in-scope correction; new feature routed to intake. |
| UX-29 /app/projects/:id/handoff | Authorized participants P0 | Maintainer, ownership/licensing, transfer/fork/retain, handoff status, completion date, optional defect expiry, safe deployment information. |
| UX-30 /app/projects/:id/withdraw | Builder P0 | Explain voluntary withdrawal and revoked future access, optional reason, confirm; no financial penalty; safe reassignment pending reconciliation. |
| UX-31 /app/contributions | Builder P0 | Completed evidence, distinct milestones, private details, share controls, corrections/revocation status; sandbox separated. |
| UX-32 /app/contributions/:id/share | Builder P0 | Approved public-field preview, explicit opt-in, copy link, disable, correction request; no restricted data or eligibility. |
| UX-33 /verify/:opaqueToken | External verifier P0 | Minimal stakeholder-safe record, approved developer name, contribution description, dates, verified milestones and status, allowed evidence only; invalid/disabled links generic; revoked shared record clearly marked per policy. |
| UX-34 /app/reviewer/specifications | Reviewer P0 | Assigned queue, risk/scope status, next action, reviewer capacity; filter and open. |
| UX-35 /app/reviewer/specifications/:id | Reviewer P0 | Split source/spec editor, assumptions, conflicts, scope/decomposition, anonymous preview, rationale, approve/request changes/escalate; exact version. |
| UX-36 /app/reviewer/implementations | Reviewer P0 | Assigned PRs, changes requested, stale checks, review history; no self-approval. |
| UX-37 /app/reviewer/implementations/:id | Reviewer P0 | Exact head/delivered SHA, trusted check evidence, criteria, review rationale, request changes or approve; invalidate on relevant revision changes. |
| UX-38 /app/admin | Admin P0 | Action queues, blocked integrations, reviewer capacity, moderation, operational counts; sensitive fields restricted further. |
| UX-39 /app/admin/intake/:id | Admin P0 | Eligibility and risk review, request info, approve/reject/escalate with rationale, child decomposition; commercial deferral. |
| UX-40 /app/admin/projects/:id | Admin P0 | Definition of ready, approvals, reviewer assignment, template, provisioning, routing, access status, publish/cancel/reassign; fail closed. |
| UX-41 /app/admin/people | Admin P0 | Roles, restrictions, organization moderation, consent-based referrals; separate restricted eligibility view with specific permission. |
| UX-42 /app/admin/routing | Authorized admin P0 | Configure sequential mission, partner, general windows; preview effective timestamps; validate precedence, audit changes; durations TBD. |
| UX-43 /app/admin/templates | Admin P0 | Multiple approved template versions, compatibility, CI/runbook/deploy and native security checks, disable unsafe templates; provisioning attempts. |
| UX-44 /app/admin/integrations | Admin P0 | GitHub health, failed jobs/events, grant/revoke reconciliation, retry with correlation ID, block unsafe transition; never display secrets. |
| UX-45 /app/admin/verification | Admin P0 | Evidence inspection, correct/revoke with rationale, versioned audit, public-safe preview; no arbitrary certification. |
| UX-46 /app/admin/audit | Authorized admin P0 | Filter consequential events, actor/action/time/reason, limited details; never raw credentials or unrestricted transcript exports. |
| UX-47 /app/admin/analytics | Admin P0 | Submission-to-approval, completion, review turnaround, failure metrics, aggregate mission outcomes with small-group suppression proposal; no donation metrics as success gate. |
| UX-48 /app/admin/reports and /app/report | Participant/admin P0 | Report unsafe work, exploitation or conduct; confirmation and admin triage, privacy-aware status; restricted moderation notes. |
| UX-49 /app/admin/privacy | Specifically authorized admin P0 | Correct/redact/delete per approved policy, preview affected sources, require rationale, invalidate affected approvals, clear derived context/caches. |
| UX-50 /app/admin/handoff | Admin P0 | Handoff, access revocation, optional public release approval, licensing and source/history/secrets review; private by default. |
| UX-51 /app/projects/:id/assistant | Assigned builder P1 | Optional grounded assistant using direct context, source links and uncertainty; cannot change scope or perform privileged actions. |
| UX-52 /app/projects/:id/documents | Authorized P1 | Approved attachments/references if enabled; no vector ingestion, validate and restrict files. |
| UX-53 /app/settings/support, /support | Optional P1 | External links, voluntary wording, validation/report/remove; no payments or routing influence. |
| UX-54 /app/notifications | Optional P1 | In-app/email preferences; safe generic notification text, no identity or private transcript leakage. |
| UX-55 /app/projects/:id/clarify | Optional P1 | Dedicated post-assignment question workflow; P0 uses approved controlled communication; material changes enter scope review. |

## 6. Detailed interaction design: owner discovery (dual-mode P0)

Entry: verify eligibility or allow private draft pending verification; never publish until verified. Before recording, show “We save this conversation to help define your project. Relevant messages may be shared with assigned builders and authorized reviewers. Please do not include passwords, personal records or confidential information.” Link approved privacy/retention policy. Record acknowledgment; decline returns to help without recording responses. Both modes display the same notice, covering original typed answers and AI follow-ups.

### 6.1 Intake mode choice

Offer equally prominent choices at entry: **Chat with CivicSpec** (adaptive interview with live profile) and **Guided form** (structured, step-by-step questions with optional conversational assistance). Explain that both produce the same human-reviewed specification and preserve original answers. Neither is required to use the other; a user may finish in the wizard without a chat-style interaction. Both use the same submission ID, authoritative source records, profile, context budget and approval gates. Remember the preferred mode for the draft; permit switching at any step. No separate submission is created by switching.

### 6.2 Chat mode

Desktop wireframe (mobile stacks with Profile tab):

```text
+------------------------------------------------------------------+
| CivicSpec / New request                 Saved 10:42   Save & exit |
+----------------------------------------+-------------------------+
| AI project analyst                     | Living project profile  |
| AI: Tell us what you need help with.   | Problem       Captured   |
| You: We track stock in Excel...        | Users         Captured   |
| AI: Do you want to keep Excel?         | Constraints   Needs info |
| You: Yes, volunteers know it.          | Success       Needs info |
| [Message...                    ] Send | Maintenance   Needs info |
| [I don't know] [Ask for help]          | View sources             |
+----------------------------------------+-------------------------+
| Review collected information  |  Submit for review (when ready)   |
+------------------------------------------------------------------+
```

Ask one focused question at a time by default; permit free text, “I don't know” and correction. No forced technical answers. Persist user turn before inference; indicate sending/saved/answer pending. Show streamed output only if accessible and safe; announce completed turn, not every token. Retain original wording and separate AI extraction. Resume with last confirmed question and draft. On timeout preserve message, offer retry without duplicate turn or manual review. On malformed output do not display it as approved. On context limit show “We need a reviewer to help narrow this request. Your conversation is saved.” No silent truncation. Owner can leave while processing and return to status. Profile uses Captured/Needs confirmation/Proposed/Disputed/Unresolved with textual explanation, not fake completion percentage. Submit presents summary and missing items; human reviewer can request clarification. No AI auto-publication. Owner confirms approved version and receives status, not internal raw risk scoring.

### 6.3 Guided wizard with optional conversational assistance

Proposed steps (adaptive, not a rigid questionnaire):

| Step | Owner-facing questions |
|---|---|
| 1. Your need | What is not working? What outcome would help? |
| 2. Current workflow | How do you handle this today? What tools and users are involved? |
| 3. Scope and constraints | What must stay the same? What data, access, accessibility or hosting constraints apply? |
| 4. Success and handoff | How will you know it works? Who maintains it? |
| 5. Review | Check captured answers, unresolved items, proposed scope and next steps. |

```text
+-----------------------------------------------------------+
| New request     [Chat] [Guided form]       Saved / Exit   |
| Step 2 of 5: Current workflow                              |
| How do you handle inventory today?                         |
| [ We use Excel ...                                  ]     |
| [I don't know]   [Help me answer]                          |
| Optional follow-up: Do you want to keep Excel?             |
| [Back]                         [Save and continue]        |
| Living profile: Problem captured / Constraints unresolved |
+-----------------------------------------------------------+
```

Use semantic labelled fields, back/next controls, optional examples and an explicit save action. Progress counts represent wizard sections visited, not AI understanding. AI may suggest context-specific follow-ups inline after saved answers; users can answer in fields, skip nonessential questions, mark unknown, or ask for help. No mandatory chat transcript interaction. When AI is unavailable, preserve structured answers and permit manual reviewer escalation. Required unresolved information blocks final approval, not draft saving or requesting help. Do not ask for information already captured in either mode. On mobile the profile is an accessible tab or disclosure; on desktop it accompanies the form.

### 6.4 Shared persistence and mode switching

Store original wizard answers verbatim, with stable source IDs, question text/version, author, timestamp, input mode and visibility, alongside chat turns in a shared chronological discovery record. Distinguish wizard answers, AI questions, stakeholder chat messages and derived profile values; do not manufacture conversational quotes from structured answers. Save edits as explicit corrections or superseding records under retention policy. Link every extracted binding requirement to supporting source IDs or an authorized human decision. Assigned builders see authorized original answers and messages with their question context; unassigned users see only the approved anonymous projection.

Before switching, persist pending input or offer an explicit discard confirmation; restore destination mode from the same saved state, including answered questions and unresolved items. Disable duplicate submissions while a save is pending; late AI results must be associated with their originating revision and cannot overwrite newer answers. Resume across devices using authoritative saved state. A user can switch back without losing or duplicating information. Both modes use the same direct authorized full-context processing in Release 2; no vector indexing is introduced. Human approval and stakeholder confirmation remain mandatory. Mode choice never affects eligibility, priority, review or financial obligations.

## 7. Detailed interaction design: specification and provenance

Reviewer split view: left source discovery record (chat and wizard answers), right editable structured specification; on mobile use source tab/drawer with return focus. Each requirement row shows ID, text, status, source anchors, version, conflict/supersession and confirmation. Selecting source scrolls to exact original message and highlights it without altering text. Redactions display “Part of this message is restricted” without revealing length/details unnecessarily. Source unavailable due to deletion: show unavailable and require review of affected binding requirement. Human review verifies meaning, not merely existing ID. Reviewer must resolve unsupported assumptions before binding. Save draft creates revision; approval freezes version. Any material edit after confirmation resets affected approvals and prompts participant acknowledgment. Concurrent edits reject stale version and show compare/reload, not overwrite. Decomposition creates independent children with dependencies and individual approval; parent completion is not implied.

Owner confirmation view uses everyday language, separate Included / Not included, testable outcomes, estimated effort, licensing/maintenance, deployment/handoff and optional defect window. Accept version or request change with reason. Show “This is the work a volunteer will agree to do; new requests need a new review.”

## 8. Detailed interaction design: developer readiness and anonymous discovery

Builder onboarding: profile -> verify GitHub identity -> readiness. Independent builders receive a sandbox ticket with synthetic data, instructions, expected branch/target, tests and PR requirements. Partner graduates request verified referral; pending referral does not bypass gate, can take sandbox path. Separate confidential justice-priority request, optional self/partner evidence method pending policy. Sandbox checklist reflects trusted exact head SHA results: branch, tests, clean PR, no conflict, no detected secret; failed checks show safe actionable reasons and retry. No production credentials or untrusted workflow controls. Never count sandbox as real experience. Recheck on new SHA. Invalid/spoofed/stale checks remain pending/failed. Verified bypass still requires GitHub identity and all project-specific checks.

Catalog cards: neutral ID, title, short problem, category, skills, effort range, complexity, impact, availability. Never show names, logos, website, exact location, identifying repo links, original source anchors or distinctive descriptions. Sort proposed by relevance to chosen filters and publication recency, not prestige/donation. General public receives general-release listings only; authorized ready/preview rules determined by backend, not UI. Mission priority then partner priority then general, highest applicable tier; server-controlled windows; exact durations pending. Show generic “Not available to claim yet” rather than revealing other people's eligibility. No unauthorized counts or hidden client payloads. Filters persist only non-sensitive values. Empty state: adjust filters or check later.

Detail page provides full sanitized requirements, criteria, constraints, dependencies, volunteer terms, licensing, maintenance and defect window before commitment. CTA Claim project or Apply, depending on approved policy. Disabled CTA explains readiness or availability and links to next action. Review terms, confirm; server atomically validates eligibility, readiness, current version, availability and claim concurrency. Application remains anonymous until assignment confirmed. On lost race show “This opportunity is no longer available” and catalog link. On pending external grant show assignment confirmed but repository setup pending, with retry handled by admin; do not suggest access exists. Identity and authorized context unlock only at confirmed assignment; repo grant separately verified. If authorization fails, no restricted data returned. Withdrawal always allowed, optional reason, no fee; explain future access removed and copied information cannot be recalled. Failed revoke prevents unsafe reassignment, admin resolves.

## 9. Detailed interaction design: assigned workspace and GitHub

```text
+------------------------------------------------------------------+
| CivicSpec / My projects / CS-024                In progress       |
| Inventory dashboard | Authorized owner: Example Food Pantry     |
| Next action: Implement issue #1                 Open GitHub       |
+------------------------------------------------------------------+
| Overview | Specification | Conversation | GitHub | Review | Handoff
+------------------------------------------------------------------+
| Approved spec v2     | Acceptance criteria       | Project status |
| REQ-04 Preserve Excel workflow [View source]     | Repo: ready    |
| REQ-05 Import validated CSV                      | PR: pending    |
| Out of scope: replace spreadsheet                | Review: none   |
+------------------------------------------------------------------+
```

Original stakeholder transcript is independently accessible, chronological, exact authorized wording with author and time; source anchors from spec. No public GitHub dump. Scope changes are requested through controlled communication or P1 dedicated clarification; new scope is not binding until approved and acknowledged. GitHub view shows approved template language/version, runbook, issue, PR, exact SHA, trusted check status and last sync time. External links clearly labelled. Repo is private; grant only assignment/authorized reviewer, verify effective permission. Failed integration presents pending/failure with safe retry/support; never mark successful based on UI alone. Public release optional after owner and maintainer approval, licensing and source/history review; sanitized artifact if original history unsafe. No direct UI action exposes deployment secrets or lets untrusted PR deploy.

## 10. Detailed interaction design: review, completion and handoff

Technical review checklist binds exact spec version and delivered SHA, shows each acceptance criterion, test evidence, result, reviewer note and trusted check status. Reject missing or stale evidence. Reviewer cannot self-approve even with multiple roles. Changes requested require rationale and return to implementation; code/spec change invalidates affected approval and stakeholder acceptance. Stakeholder receives safe deliverable preview and plain-language criteria; can accept exact delivered revision or request in-scope corrections. New feature button opens new intake linked to old project, not reopen silently. Dispute escalates admin, no automatic completion. Merge alone never completes. Completion waits for both approvals and durable evidence persistence; pending record generation displays pending, retry idempotently. Handoff separate status, includes maintenance owner, license, delivery method, runbook, access revocation and approved public release. BR-039 default responsibility ends at COMPLETED; optional pre-agreed fixed 14 calendar days limited to original acceptance criteria, show exact expiry/timezone. Unresolved defects go to designated maintainer; no forced volunteer work or automatic extension. Deployment/adoption require distinct evidence and cannot be inferred from merge or acceptance.

## 11. Detailed interaction design: verification

Private contribution detail: developer, role, approved spec version, accepted SHA, issue/PR/check/reviewer and acceptance references, completion date, handoff, milestone evidence. Evidence remains available if external links disappear; no unauthorized code retention. Share page is P0. Preview exact allowed public fields, opt-in, copy link, disable share. Suggested default is unlisted opaque URL with no indexing, not a guarantee of confidentiality; warn that recipients can copy. Public safe fields require stakeholder approval and developer consent; no owner identity unless separately approved and compatible with blind discovery, no restricted code/transcript/eligibility. Prefer neutral project description, developer-approved display name, role, skills supported by evidence, dates, current verification state. Show separate milestone labels: independently reviewed engineering, stakeholder accepted, deployed, adopted; unknown = Not verified, not failed. Sandbox and synthetic exercises never presented as real-world evidence. Revocation/correction by authorized admin with rationale and audit; public page current status only, no private reason. Disabled/invalid links neutral unavailable response; no enumeration. Share revocation cannot recall already copied data.

## 12. Admin and reviewer operations

Definition of ready gate (FR-144): verified eligible owner/noncommercial purpose, scope/feasibility, testable criteria, verified sources, anonymous preview approval, reviewer capacity reserved, licensing/maintenance/deploy/handoff terms, secure repository controls verified. Each row includes evidence, responsible actor, timestamp, status; publication disabled until server confirms all. Separate reviewer/admin action permissions. Reviewer queues show oldest actionable work and capacity; no arbitrary score. Admin can retry failed provisioning; native scanning, branch protection, trusted CI, README and applicable deploy config must be verified across all approved templates, no silent weaker fallback. Template registry versioned; exact catalog TBD. Routing policy editor shows ordered windows, validation and audit, no donation settings. Restricted eligibility review separate from general profile; consent/referral evidence minimal. Reports and moderation require reasons; reveal only authorized information. Privacy correction/redaction/delete workflow shows impacted references, required re-review and cache invalidation. Analytics aggregate mission outcomes; suppress small groups as proposed policy, no sensitive drill-down without authorization.

## 13. Lifecycle and UI state mapping

Submission lifecycle and micro-project lifecycle are separate (FR-060). Proposed UI labels below map to canonical states; exact exhaustive transition table belongs to architecture. Parent approval never approves children automatically. Cancellation/reopening requires authorized review and audit.

| Submission state | Owner label / action |
|---|---|
| DRAFT | Draft / resume |
| SUBMITTED | Submitted / view |
| TRIAGE_IN_PROGRESS | Gathering information / leave and return |
| CLARIFICATION_REQUIRED | Your answer needed / reply |
| SPECIFICATION_DRAFTED | Specification prepared / review when available |
| SPECIFICATION_REVIEW | Technical review / wait or respond |
| STAKEHOLDER_CONFIRMATION | Confirm requirements / confirm or request changes |
| APPROVED | Approved request / view child projects |
| REJECTED | Not approved / view shareable reason and help |
| CANCELLED / ARCHIVED | Closed / view authorized history |

| Project state | Main action / visible status |
|---|---|
| DRAFT / SPECIFICATION_REVIEW | Reviewer edits/checks |
| STAKEHOLDER_CONFIRMATION | Owner confirms exact version |
| APPROVED | Admin readiness/provisioning gate |
| PUBLISHED | Eligible builder claim/apply |
| ASSIGNED | Builder context unlocked; repo grant status distinct |
| IN_PROGRESS | Builder implementation |
| TECHNICAL_REVIEW | Reviewer evaluates exact revision |
| CHANGES_REQUESTED | Builder revises |
| STAKEHOLDER_ACCEPTANCE | Owner accepts or requests in-scope corrections |
| COMPLETED | Evidence and handoff; responsibility boundary |
| REJECTED / CANCELLED / ARCHIVED | Distinct history; no successful verification for cancelled/rejected |

Orthogonal statuses: assignment application pending/confirmed/withdrawn; readiness pending/pass/bypass; GitHub provisioning/grant/sync/revoke pending/verified/failed; routing window; handoff; defect window; deployment/adoption; verification sharing. Do not conflate them with lifecycle. Refresh from server on transition, show stale state if sync pending. Authorized activity timeline excludes sensitive eligibility and restricted details.

## 14. Component library and interaction rules

| Component | Required variants and behavior |
|---|---|
| Button/link | Primary, secondary, destructive, disabled with adjacent explanation, busy; links for navigation, buttons for actions; no double submits |
| Form field | Label, hint, required/optional, error linked by aria-describedby; preserve input; error summary links to fields |
| Status indicator | Text + icon; semantic colors; unknown/pending distinct from failure |
| Project card | Anonymous and authorized variants from different server projections; no hidden private props |
| Wizard field / step | Label, hint, optional/required, inline follow-up, unknown option, save/back/next, accessible progress; shared source record |
| Theme selector | Light/Dark/System, accessible selected state, persisted preference; no draft reset |
| Chat message | Author, timestamp, message ID, original text, redaction, retry; safe rendering of untrusted text |
| Requirement row | ID, status, source links, version, supersession, reviewer controls |
| Checklist | Evidence-driven read-only pass/fail/pending for security, human inputs only for authorized review decisions |
| Timeline | Chronological, text labels, timezone, no color-only meaning |
| Dialog | Accessible title, focus trap/return, Escape for cancel, explicit destructive confirmation |
| Table | Semantic headers, accessible sorting, responsive stacked equivalent or contained scroll |
| Toast/status | Nonblocking polite live region, persistent critical errors; no confidential text in notifications |
| Empty/error | Explain next step, retry/help, no raw stack traces or sensitive identifiers |
| Share preview | Exact public projection, consent, revoke, copy only after link exists |

Use skeletons sparingly with accessible loading text. Long operations have persistent state and safe leave/return. Retry never duplicate assignment, issues or records. Unauthorized responses generic and do not confirm existence. Rate-limit messages provide retry guidance without losing drafts. Session expiry returns to auth with safe route and saved server data. No automatic public posting, financial prompt or forced donation. External links open with clear destination and safe handling. No client-side secret storage.

## 15. Accessibility and content standards

Target WCAG 2.2 AA (PRD NFR-023–027). Reference: W3C https://www.w3.org/TR/WCAG22/ and https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/ . Proposed design checks: normal text contrast >=4.5:1, large text >=3:1, essential UI boundaries >=3:1; keyboard focus visible and not obscured; 44px preferred target size (above AA minimum of 24 CSS px subject to exceptions); reflow at 320 CSS px, 200% text zoom, no color-only indicators. Semantic headings, landmarks, skip link, meaningful page titles, accessible authentication supporting password managers and paste, no drag-only interaction. Both themes and both intake modes meet the same accessibility target. Wizard uses labelled field groups, step headings and error summaries; switching announces the destination and restores meaningful focus. Chat uses labelled transcript and polite status announcements; do not steal focus on each new message; provide jump to latest. Dialogs restore focus; error summary and inline messages; reduced motion; responsive data views; text alternatives for nondecorative images. Test with keyboard, screen reader (NVDA/VoiceOver), mobile touch, zoom and automated accessibility scanner. Automated checks do not prove conformance. Plain owner language: “technical need”, “builder”, “review”, “accepted”; explain PR/commit in owner views. Use “priority access” only in confidential settings, not public badges. Use “verified contribution” not “certified engineer.”

## 16. UX security and privacy acceptance tests

| Test | Expected behavior |
|---|---|
| Wizard-to-chat-to-wizard switch | Original answers and IDs persist; no duplicate submission or repeated answered question |
| AI response arrives after wizard answer correction | Stale output cannot overwrite newer profile; review required |
| Unassigned user requests wizard source record | Denied exactly as for chat transcript |
| Switch theme during unsaved intake | Inputs, focus and current mode retained |
| Both themes at 320px and keyboard-only | Core flows reflow, focus visible, semantic contrast verified |
| Unassigned user opens transcript URL or calls API | No content, identity, metadata or existence leak |
| Pending applicant opens repo | Denied until confirmed assignment and verified grant |
| Cross-project source link | Denied; no cached previous data |
| Browser back after withdrawal | Restricted content cleared; server denies new access |
| Concurrent claims | One confirmed; loser neutral unavailable state |
| Uncalibrated or unverified referral claims | Server denies; appropriate next step |
| Sandbox PR changes trusted tests or SHA | No pass from tampered/stale results |
| AI failure/invalid schema/context overflow | Saved chat remains; retry/manual review; no auto approval |
| AI source ID exists but does not support claim | Reviewer flags and resolves before approval |
| Redacted/deleted source | Placeholder or unavailable; affected requirements reviewed; caches cleared |
| Anonymous preview contains domain/logo/metadata | Publication blocked until reviewed and sanitized |
| Repository native control missing | Publication/assignment blocked; safe admin error |
| Access revoke fails | Unsafe reassignment blocked and admin alerted |
| Reviewer is contributor | Final approval denied |
| New SHA/spec after approval | Affected approval invalidated and UI indicates re-review |
| Merge without stakeholder acceptance | Not completed; no verified outcome |
| Duplicate webhook/retry | No duplicate visible record or transition |
| Private project verification shared | Only approved safe fields, no private code or identity |
| Share disabled/revoked | Correct unavailable/revoked state; no restricted info |
| Commercial submission through individual | Deferred/rejected from pilot based on purpose |
| New feature after completion | New submission, no automatic obligation |
| No donation info | Every P0 flow completes normally |
| Untrusted code/deployment | No secrets exposed, no privileged deployment from PR |

## 17. Usability validation plan

Recruit real eligible owners, independent builders, verified partner graduates if available, reviewers and admins after operational approval. Use synthetic data first for moderated tests, not a separate demo release. Tasks: owner submits and resumes in each intake mode, switches modes mid-draft, completes wizard without chatbot interaction, finds original answer sources, finds summary and confirms; test both themes; builder passes sandbox, evaluates anonymous opportunity, claims, locates original source, withdraws safely; reviewer identifies unsupported requirement, reviews exact SHA; admin handles failed provisioning/revocation; owner accepts and hands off; builder previews/shares verification; external verifier correctly interprets milestones. Proposed targets: at least 80% unassisted success per core task across initial small cohort; zero critical privacy/security failures; collect time, errors, confusion, satisfaction and reviewer workload; targets are provisional and not measured. Include participants with assistive technology and limited technical literacy. Track findings by severity, assign owner, retest. No pilot launch solely on design approval.

## 18. Traceability and implementation handoff

| PRD coverage | UX screens / section |
|---|---|
| FR-001–008 | UX-04–08,16,18,41; sections 4,8 |
| FR-009–027 | UX-09–13,35,39; section 6 |
| FR-028–035 | UX-12–14,24,35,40; section 7 |
| FR-036–047 | UX-17–22,30,42; section 8 |
| FR-048–059 | UX-23,26,29,40,43,44,50; sections 9,12 |
| FR-060–065 | UX-13,15,23,30,40,54,55; section 13 |
| FR-066–073 | UX-27–29,34–37,40; section 10 |
| FR-074–080 | UX-31–33,45; section 11 |
| FR-081–087 | UX-53 and all workflows; optional support only |
| FR-088–095 | UX-38–50; section 12; institutional reporting deferred |
| FR-096–117 | UX-10–13,24–25,35,49,51–52,55; sections 6–9; vector features deferred |
| FR-118–129 | UX-19–25,30,35,40,46; sections 8–9 |
| FR-130–138 | UX-08,39,41,47; pilot restriction and optional analytics |
| FR-139–140 | UX-17,26,37,43–44; sections 8–10,16 |
| FR-141–142 | UX-12,24,27,35,37; sections 7,10 |
| FR-143–145 | UX-29,31–33,40,44,50; sections 10–12 |
| NFR-001–050 / BR-001–039 | Cross-cutting sections 4,6–16; backend implementation remains architecture responsibility; NFR-042 post-pilot |

Suggested implementation order: shared shell/auth and permission-aware routes; dual-mode owner intake/profile and review; builder readiness/catalog/assignment; secure multi-template GitHub integration and workspace; technical and stakeholder acceptance; handoff and verification; admin tools alongside each increment; accessibility/security and recovery tests continuously. All P0 features remain full MVP target. Optional P1 screens are conditional, not launch dependencies.

## 19. Open decisions and limitations

Stakeholder approved green/teal professional direction, light and dark launch themes, dual-mode intake with shared live profile, shared CivicSpec workspace with GitHub integration, unlisted revocable verification links and tagline “Real needs. Real code. Real experience.” Remaining decisions: final logo, exact token values, navigation labels, public catalog access model, assignment claim vs application by complexity, exact priority durations, private eligibility evidence policy, authentication method, exact template catalog, reviewer authority and capacity, shareable public field policy, retention/redaction procedure, operational maintenance and reporting policy. Proposed UX defaults include 44px controls, system theme default, adaptive wizard step grouping, no indexed search for pilot, generic restricted-resource errors, small-group analytics suppression and one-question-at-a-time interview. These are design proposals, not additional approved PRD rules. No UI code, high-fidelity Figma assets, user testing, security audit, GitHub entitlement test or legal validation performed. Private repo native security availability, volunteer eligibility and participation policies remain launch gates. The source PRD remains unchanged. Dual-mode intake and launch theme support are stakeholder-approved UX scope extensions; the PM should synchronize the PRD before implementation, including original wizard answer provenance and dual-mode acceptance criteria.

## 20. Design definition of done

Both intake modes and both themes are implemented and tested; every P0 journey has an implemented accessible screen and server-authorized interaction; each state/error/recovery is testable; original stakeholder context is preserved and correctly disclosed; readiness, approval, repository controls and assignment are enforced; technical and stakeholder acceptance refer to exact revision; contribution sharing is consent-controlled and accurate; handoff ends obligations as agreed; no financial transaction required. All PRD pilot launch gates remain in force. Design sign-off authorizes architecture and implementation planning, not public launch.

## Revision history

- v1.0.0: Initial UX specification against PRD v1.0.5.
- v1.0.1: Incorporates all six stakeholder design decisions, including optional guided wizard alongside chat, shared original-answer provenance, theme persistence, and expanded accessibility and recovery tests.
