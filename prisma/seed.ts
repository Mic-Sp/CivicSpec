import {
  ClaimStatus,
  ComplexityTier,
  DiscoveryAuthorRole,
  GovernanceMode,
  IntakeMode,
  OwnerCategory,
  Prisma,
  PrismaClient,
  ProjectState,
  RoleType,
  SubmissionState,
  VerificationStatus,
} from "@prisma/client";

// DEVELOPMENT/TEST FIXTURES ONLY. All identities and approval evidence are synthetic.
// No GitHub repository, account verification, CI run, or AI output is real.
// The CLI loads .env. Do not import the Next.js server-only singleton into this CLI.
const prisma = new PrismaClient();
const prefix = "seed_civicspec_mvp_";
const id = (name: string) => `${prefix}${name}`;
const epoch = Date.parse("2026-11-24T14:00:00.000Z");
const at = (minutes: number) => new Date(epoch + minutes * 60_000);

async function seed() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Synthetic fixtures cannot be seeded in production mode.");
  }

  await prisma.$transaction(async (tx) => {
    // Upserts deliberately leave existing rows untouched: reruns preserve original
    // discovery text, append-only audit history, and subsequent workflow progress.
    const people = [
      { key: "admin", email: "admin@civicspec.local", name: "Synthetic Admin", roles: [RoleType.ADMIN, RoleType.REVIEWER] },
      { key: "reviewer", email: "reviewer@civicspec.local", name: "Synthetic Technical Reviewer", roles: [RoleType.REVIEWER] },
      { key: "owner", email: "owner@civicspec.local", name: "Synthetic Problem Owner", roles: [RoleType.PROBLEM_OWNER] },
      { key: "builder_one", email: "builder-priority@civicspec.local", name: "Synthetic Builder One", roles: [RoleType.DEVELOPER] },
      { key: "builder_two", email: "builder-partner@civicspec.local", name: "Synthetic Builder Two", roles: [RoleType.DEVELOPER] },
      { key: "builder_three", email: "builder-open@civicspec.local", name: "Synthetic Builder Three", roles: [RoleType.DEVELOPER] },
    ] as const;

    const users = new Map<string, string>();
    for (const person of people) {
      const user = await tx.user.upsert({
        where: { email: person.email },
        update: {},
        create: {
          id: id(person.key),
          email: person.email,
          displayName: person.name,
          // No seeded credentials, shared passwords, or login mechanisms.
          passwordHash: null,
          createdAt: at(0),
          updatedAt: at(0),
        },
      });
      users.set(person.key, user.id);
    }

    const userId = (key: string) => {
      const value = users.get(key);
      if (!value) throw new Error("Missing synthetic user fixture.");
      return value;
    };
    const adminId = userId("admin");
    const reviewerId = userId("reviewer");
    const ownerId = userId("owner");

    for (const person of people) {
      for (const role of person.roles) {
        await tx.userRole.upsert({
          where: { userId_role: { userId: userId(person.key), role } },
          update: {},
          create: {
            id: id(`role_${person.key}_${role.toLowerCase()}`),
            userId: userId(person.key),
            role,
            grantedBy: adminId,
            grantedAt: at(0),
          },
        });
      }
    }

    // Public/professional fields never include confidential tier or referral data.
    for (const [key, handle] of [
      ["builder_one", "synthetic-builder-one"],
      ["builder_two", "synthetic-builder-two"],
      ["builder_three", "synthetic-builder-three"],
    ]) {
      await tx.developerProfile.upsert({
        where: { userId: userId(key) },
        update: {},
        create: {
          id: id(`profile_${key}`),
          userId: userId(key),
          bio: "Synthetic pilot builder fixture. Not a real person or verified account.",
          skills: ["TypeScript", "Next.js", "PostgreSQL"],
          interests: ["Community tools"],
          isPublicProfile: false,
          githubUserId: `synthetic:${key}`,
          githubUsername: handle,
          githubVerifiedAt: at(5),
          createdAt: at(0),
          updatedAt: at(5),
        },
      });
    }

    // FR-006/FR-008: isolated confidential tables, never profile fields.
    await tx.priorityEligibility.upsert({
      where: { userId: userId("builder_one") },
      update: {},
      create: {
        id: id("priority_eligibility"),
        userId: userId("builder_one"),
        status: VerificationStatus.VERIFIED,
        attestationNote: "Synthetic eligibility fixture; no real personal history.",
        verifiedById: adminId,
        verifiedAt: at(5),
        createdAt: at(0),
        updatedAt: at(5),
      },
    });

    await tx.partnerReferral.upsert({
      where: { id: id("partner_referral") },
      update: {},
      create: {
        id: id("partner_referral"),
        userId: userId("builder_two"),
        partnerOrgName: "Synthetic Workforce Partner",
        cohortLabel: "Synthetic Pilot Cohort 01",
        status: VerificationStatus.VERIFIED,
        consentRecorded: true,
        verifiedById: adminId,
        verifiedAt: at(5),
        createdAt: at(0),
      },
    });

    await tx.sandboxCalibration.upsert({
      where: { id: id("sandbox_calibration") },
      update: {},
      create: {
        id: id("sandbox_calibration"),
        userId: userId("builder_one"),
        githubUsername: "synthetic-builder-one",
        prNumber: 1,
        headSha: "1111111111111111111111111111111111111111",
        branchName: "synthetic/calibration",
        testsPassed: true,
        secretsClean: true,
        workflowValid: true,
        passed: true,
        evaluatedAt: at(10),
      },
    });
    // Builder Two intentionally has a verified referral without a calibration.
    // Builder Three intentionally has neither readiness path.

    const organization = await tx.organization.upsert({
      where: { id: id("organization") },
      update: {},
      create: {
        id: id("organization"),
        legalName: "Example Community Food Pantry",
        category: OwnerCategory.NONPROFIT_501C3,
        noncommercialAttest: true,
        eligibilityStatus: VerificationStatus.VERIFIED,
        reviewNotes: "Synthetic nonprofit fixture; not a real eligibility determination.",
        verifiedById: adminId,
        verifiedAt: at(15),
        createdAt: at(0),
        updatedAt: at(15),
      },
    });

    await tx.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: organization.id, userId: ownerId } },
      update: {},
      create: { id: id("organization_member"), organizationId: organization.id, userId: ownerId },
    });

    const templates = [
      { slug: "nextjs-ts-starter", displayName: "Synthetic Next.js + TypeScript starter", language: "TypeScript", framework: "Next.js" },
      { slug: "python-fastapi-starter", displayName: "Synthetic Python + FastAPI starter", language: "Python", framework: "FastAPI" },
    ];
    let nextjsTemplateId = "";
    for (const template of templates) {
      const result = await tx.repositoryTemplate.upsert({
        where: { slug: template.slug },
        update: {},
        create: {
          id: id(`template_${template.slug}`),
          ...template,
          // .invalid is intentionally unusable as a GitHub organization name.
          githubTemplateRepo: `synthetic.invalid/${template.slug}`,
          templateVersion: "synthetic-v1",
          hasGitleaksWorkflow: true,
          hasCiTestWorkflow: true,
          hasDeployButton: false,
          isActive: true,
          createdAt: at(0),
        },
      });
      if (template.slug === "nextjs-ts-starter") nextjsTemplateId = result.id;
    }

    const submission = await tx.problemSubmission.upsert({
      where: { id: id("submission") },
      update: {},
      create: {
        id: id("submission"),
        ownerId,
        organizationId: organization.id,
        title: "Low-Stock Inventory Helper",
        state: SubmissionState.APPROVED,
        privacyNoticeAckAt: at(20),
        version: 1,
        createdAt: at(20),
        updatedAt: at(27),
      },
    });

    await tx.discoveryDraftState.upsert({
      where: { submissionId: submission.id },
      update: {},
      create: {
        submissionId: submission.id,
        preferredMode: IntakeMode.CHAT,
        currentWizardStep: 3,
        lastSavedAt: at(23),
      },
    });

    const sourceFixtures = [
      {
        inputMode: IntakeMode.CHAT,
        questionKey: "inventory.problem",
        questionText: "What inventory problem would you like to solve?",
        content: "Synthetic example: Example Community Food Pantry needs a list of items whose quantity is below a chosen minimum.",
        statement: "Show an item as low stock when its quantity is below its configured minimum.",
      },
      {
        inputMode: IntakeMode.WIZARD,
        questionKey: "inventory.scope",
        questionText: "What must the first version let a volunteer do?",
        content: "Synthetic example: Volunteers should enter an item name, a whole-number quantity, and a minimum quantity, then update quantities manually. We do not need supplier integration or personal information.",
        statement: "Allow item names and nonnegative whole-number quantities and minimums to be entered and updated manually.",
      },
      {
        inputMode: IntakeMode.CHAT,
        questionKey: "inventory.acceptance",
        questionText: "How will you know the helper is usable?",
        content: "Synthetic example: A volunteer should complete the inventory tasks using only a keyboard on a narrow phone screen, with low-stock text and an icon rather than color alone.",
        statement: "Support keyboard inventory tasks at 320px width and pair low-stock color with text and an icon.",
      },
    ];
    const sources: { id: string; statement: string }[] = [];
    for (const [index, fixture] of sourceFixtures.entries()) {
      const source = await tx.discoverySourceRecord.upsert({
        where: { submissionId_sequenceNumber: { submissionId: submission.id, sequenceNumber: index + 1 } },
        update: {},
        create: {
          id: id(`source_${index + 1}`),
          submissionId: submission.id,
          sequenceNumber: index + 1,
          inputMode: fixture.inputMode,
          authorRole: DiscoveryAuthorRole.STAKEHOLDER,
          authorUserId: ownerId,
          questionKey: fixture.questionKey,
          questionVersion: "synthetic-v1",
          questionText: fixture.questionText,
          content: fixture.content,
          createdAt: at(21 + index),
        },
      });
      sources.push({ id: source.id, statement: fixture.statement });
    }

    await tx.projectProfile.upsert({
      where: { submissionId_revisionNumber: { submissionId: submission.id, revisionNumber: 1 } },
      update: {},
      create: {
        id: id("living_profile_v1"),
        submissionId: submission.id,
        revisionNumber: 1,
        structuredData: {
          synthetic: true,
          title: "Low-Stock Inventory Helper",
          claims: sources.map((source) => ({
            statement: source.statement,
            status: ClaimStatus.CONFIRMED,
            sourceIds: [source.id],
          })),
          exclusions: ["Supplier integrations", "Personal information", "Payments"],
          openQuestions: [],
        },
        // Hand-authored fixture; no model was called and no AI approval is implied.
        modelId: null,
        promptVersion: null,
        createdAt: at(24),
      },
    });

    const project = await tx.project.upsert({
      where: { opaqueSlug: "CS-001" },
      update: {},
      create: {
        id: id("project"),
        opaqueSlug: "CS-001",
        submissionId: submission.id,
        state: ProjectState.PUBLISHED,
        complexity: ComplexityTier.FOUNDATIONAL,
        category: "Inventory tools",
        requiredSkills: ["TypeScript", "Next.js", "PostgreSQL"],
        estimatedHoursMin: 6,
        estimatedHoursMax: 10,
        hasDefectWindow: false,
        licenseSpdx: "MIT",
        maintenanceOwner: "Synthetic project maintainer",
        publishedAt: at(30),
        version: 1,
        createdAt: at(25),
        updatedAt: at(30),
      },
    });
    if (project.submissionId !== submission.id) {
      throw new Error("CS-001 belongs to another submission; seed transaction aborted.");
    }

    await tx.anonymousProjectProfile.upsert({
      where: { projectId: project.id },
      update: {},
      create: {
        projectId: project.id,
        publicTitle: "Low-Stock Inventory Helper (synthetic example)",
        sanitizedProblem: "A community service needs a simple way to identify low-stock inventory items.",
        sanitizedObjective: "Help volunteers maintain item quantities and identify replenishment needs.",
        sanitizedScope: "Manual item, quantity, and minimum entry; low-stock list; no personal data or external integrations.",
        sanitizedCriteria: "Items below their minimum display low-stock text and an icon. Forms support keyboard use and narrow screens.",
        communityImpact: "Less manual inventory checking for community volunteers.",
        dependenciesSummary: "Synthetic fixture only; no external accounts or services required.",
        anonymizedById: reviewerId,
        anonymizedAt: at(27),
        updatedAt: at(27),
      },
    });

    const specification = await tx.specification.upsert({
      where: { projectId_versionNumber: { projectId: project.id, versionNumber: 1 } },
      update: {},
      create: {
        id: id("specification_v1"),
        projectId: project.id,
        versionNumber: 1,
        isActiveApproved: true,
        title: "Low-Stock Inventory Helper — synthetic specification",
        problemStatement: "Synthetic community inventory is manually checked for replenishment needs.",
        objective: "Maintain item quantities and show items below their configured minimum.",
        targetUsers: "Authorized community volunteers using desktop and mobile browsers.",
        scopeInclusions: ["Manual item entry", "Quantity updates", "Low-stock list"],
        scopeExclusions: ["Personal information", "Supplier integrations", "Payments"],
        technicalConstraints: ["WCAG 2.2 AA", "320px reflow", "Synthetic data only"],
        deliverables: ["Inventory interface", "Tests", "Setup and handoff runbook"],
        acceptanceCriteria: sources.map((source) => source.statement),
        testingRequirements: "Test threshold boundaries, nonnegative integers, keyboard use, and 320px reflow.",
        securityNotes: "Synthetic fixtures only. Do not store personal data or expose restricted discovery records.",
        documentationReqs: "Document setup, quantity entry, and maintenance handoff.",
        definitionOfDone: "Original criteria reviewed by an independent reviewer and accepted by the owner.",
        plainLanguageSummary: "A small tool to show which inventory items need replenishing.",
        ownerConfirmedAt: at(26),
        techApprovedById: reviewerId,
        techApprovedAt: at(27),
        createdAt: at(25),
      },
    });

    for (const [index, source] of sources.entries()) {
      const requirement = await tx.requirement.upsert({
        where: { id: id(`requirement_${index + 1}`) },
        update: {},
        create: {
          id: id(`requirement_${index + 1}`),
          specificationId: specification.id,
          code: `REQ-0${index + 1}`,
          statement: source.statement,
          // Simulated owner/reviewer confirmation, never automatic AI approval.
          status: ClaimStatus.CONFIRMED,
        },
      });
      await tx.requirementSource.upsert({
        where: { requirementId_sourceRecordId: { requirementId: requirement.id, sourceRecordId: source.id } },
        update: {},
        create: { requirementId: requirement.id, sourceRecordId: source.id, verifiedByHuman: true },
      });
    }

    await tx.readinessChecklist.upsert({
      where: { projectId: project.id },
      update: {},
      create: {
        projectId: project.id,
        ownerEligibilityOk: true,
        scopeAndCriteriaOk: true,
        provenanceVerifiedOk: true,
        anonymizationApproved: true,
        reviewerCapacityBooked: true,
        termsAndLicenseSet: true,
        repoControlsVerified: true,
        signedOffById: adminId,
        signedOffAt: at(28),
      },
    });

    await tx.routingPolicy.upsert({
      where: { projectId: project.id },
      update: {},
      create: {
        projectId: project.id,
        // Fixed windows allow deterministic tests with an injected/frozen clock.
        missionWindowOpens: at(30),
        partnerWindowOpens: at(30 + 24 * 60),
        generalWindowOpens: at(30 + 48 * 60),
        requiresApplication: false,
        updatedById: adminId,
        updatedAt: at(28),
      },
    });

    await tx.repositoryReference.upsert({
      where: { projectId: project.id },
      update: {},
      create: {
        projectId: project.id,
        templateId: nextjsTemplateId,
        governanceMode: GovernanceMode.FREE_FORK_CI,
        githubRepoId: "synthetic:cs-001",
        githubOwner: "synthetic.invalid",
        githubRepoName: "cs-001-workspace",
        isPrivate: true,
        // Simulated publication evidence only; all gates must agree with PUBLISHED.
        gitleaksVerified: true,
        ciWorkflowVerified: true,
        branchRulesVerified: true,
        runbookVerified: true,
        provisionedAt: at(28),
      },
    });

    await tx.auditEvent.upsert({
      where: { id: id("initialization_audit") },
      update: {},
      create: {
        id: id("initialization_audit"),
        actorId: adminId,
        action: "SYNTHETIC_SEED_INITIALIZED",
        entityType: "SyntheticPilotFixture",
        entityId: id("v1"),
        rationale: "Development/test fixtures only. All approvals, GitHub checks, and nonprofit verification are simulated.",
        metadata: { synthetic: true, fixtureVersion: 1, externalServicesCalled: false },
        createdAt: at(30),
      },
    });
  }, { maxWait: 10_000, timeout: 120_000 });

  console.log("Synthetic pilot fixtures ready (v1). Existing fixture rows preserved; no external services called.");
}

seed()
  .catch((error: unknown) => {
    const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : "SEED_FAILED";
    // Do not log connection URLs, credentials, or raw database errors.
    console.error(`Synthetic seed failed (${code}). Check connection, migration status, and fixture keys.`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
