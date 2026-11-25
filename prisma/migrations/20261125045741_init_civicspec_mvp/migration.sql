-- CreateEnum
CREATE TYPE "RoleType" AS ENUM ('PROBLEM_OWNER', 'DEVELOPER', 'REVIEWER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "OwnerCategory" AS ENUM ('NONPROFIT_501C3', 'COMMUNITY_GROUP', 'INDIVIDUAL_NONCOMMERCIAL', 'COMMERCIAL_DEFERRED');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'NEEDS_INFO', 'VERIFIED', 'REJECTED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "IntakeMode" AS ENUM ('CHAT', 'WIZARD');

-- CreateEnum
CREATE TYPE "DiscoveryAuthorRole" AS ENUM ('STAKEHOLDER', 'ASSISTANT', 'REVIEWER', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('CONFIRMED', 'INFERRED', 'PROPOSED', 'DISPUTED', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "SubmissionState" AS ENUM ('DRAFT', 'SUBMITTED', 'TRIAGE_IN_PROGRESS', 'CLARIFICATION_REQUIRED', 'SPECIFICATION_DRAFTED', 'SPECIFICATION_REVIEW', 'STAKEHOLDER_CONFIRMATION', 'APPROVED', 'REJECTED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ProjectState" AS ENUM ('DRAFT', 'SPECIFICATION_REVIEW', 'STAKEHOLDER_CONFIRMATION', 'APPROVED', 'PUBLISHED', 'ASSIGNED', 'IN_PROGRESS', 'TECHNICAL_REVIEW', 'CHANGES_REQUESTED', 'STAKEHOLDER_ACCEPTANCE', 'COMPLETED', 'REJECTED', 'CANCELLED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ComplexityTier" AS ENUM ('FOUNDATIONAL', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "RoutingTier" AS ENUM ('MISSION_PRIORITY', 'PARTNER_PRIORITY', 'GENERAL_ACCESS');

-- CreateEnum
CREATE TYPE "GovernanceMode" AS ENUM ('FREE_FORK_CI', 'PAID_NATIVE_RULESETS');

-- CreateEnum
CREATE TYPE "RepoAccessStatus" AS ENUM ('NOT_GRANTED', 'PENDING_GRANT', 'ACTIVE_VERIFIED', 'PENDING_REVOKE', 'REVOKED', 'FAILED_RECONCILIATION');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('SANDBOX_CALIBRATION', 'TECHNICAL_REVIEW_PASSED', 'STAKEHOLDER_ACCEPTED', 'PRODUCTION_DEPLOYED', 'OPERATIONAL_ADOPTION');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT,
    "isSuspended" BOOLEAN NOT NULL DEFAULT false,
    "suspendReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "RoleType" NOT NULL,
    "grantedBy" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPreference" (
    "userId" TEXT NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "DeveloperProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "skills" TEXT[],
    "interests" TEXT[],
    "isPublicProfile" BOOLEAN NOT NULL DEFAULT false,
    "githubUserId" TEXT,
    "githubUsername" TEXT,
    "githubVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeveloperProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriorityEligibility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "attestationNote" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PriorityEligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerReferral" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "partnerOrgName" TEXT NOT NULL,
    "cohortLabel" TEXT,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "consentRecorded" BOOLEAN NOT NULL DEFAULT false,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerReferral_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SandboxCalibration" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "prNumber" INTEGER,
    "headSha" TEXT,
    "branchName" TEXT,
    "testsPassed" BOOLEAN NOT NULL DEFAULT false,
    "secretsClean" BOOLEAN NOT NULL DEFAULT false,
    "workflowValid" BOOLEAN NOT NULL DEFAULT false,
    "passed" BOOLEAN NOT NULL DEFAULT false,
    "failureReason" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SandboxCalibration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "legalName" TEXT NOT NULL,
    "websiteUrl" TEXT,
    "category" "OwnerCategory" NOT NULL,
    "einOrRegistration" TEXT,
    "noncommercialAttest" BOOLEAN NOT NULL DEFAULT false,
    "eligibilityStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProblemSubmission" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "title" TEXT NOT NULL,
    "state" "SubmissionState" NOT NULL DEFAULT 'DRAFT',
    "privacyNoticeAckAt" TIMESTAMP(3),
    "aiEscalationReason" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProblemSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscoveryDraftState" (
    "submissionId" TEXT NOT NULL,
    "preferredMode" "IntakeMode" NOT NULL DEFAULT 'CHAT',
    "currentWizardStep" INTEGER NOT NULL DEFAULT 1,
    "pendingDraftJson" JSONB,
    "lastSavedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoveryDraftState_pkey" PRIMARY KEY ("submissionId")
);

-- CreateTable
CREATE TABLE "DiscoverySourceRecord" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "inputMode" "IntakeMode" NOT NULL,
    "authorRole" "DiscoveryAuthorRole" NOT NULL,
    "authorUserId" TEXT,
    "questionKey" TEXT,
    "questionVersion" TEXT,
    "questionText" TEXT,
    "content" TEXT NOT NULL,
    "isRedacted" BOOLEAN NOT NULL DEFAULT false,
    "redactionReason" TEXT,
    "supersededById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscoverySourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectProfile" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "structuredData" JSONB NOT NULL,
    "modelId" TEXT,
    "promptVersion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "opaqueSlug" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "state" "ProjectState" NOT NULL DEFAULT 'DRAFT',
    "complexity" "ComplexityTier" NOT NULL DEFAULT 'FOUNDATIONAL',
    "category" TEXT NOT NULL,
    "requiredSkills" TEXT[],
    "estimatedHoursMin" INTEGER,
    "estimatedHoursMax" INTEGER,
    "hasDefectWindow" BOOLEAN NOT NULL DEFAULT false,
    "defectWindowDays" INTEGER NOT NULL DEFAULT 14,
    "licenseSpdx" TEXT NOT NULL DEFAULT 'MIT',
    "maintenanceOwner" TEXT,
    "publishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnonymousProjectProfile" (
    "projectId" TEXT NOT NULL,
    "publicTitle" TEXT NOT NULL,
    "sanitizedProblem" TEXT NOT NULL,
    "sanitizedObjective" TEXT NOT NULL,
    "sanitizedScope" TEXT NOT NULL,
    "sanitizedCriteria" TEXT NOT NULL,
    "communityImpact" TEXT NOT NULL,
    "dependenciesSummary" TEXT,
    "anonymizedById" TEXT,
    "anonymizedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AnonymousProjectProfile_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "Specification" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "isActiveApproved" BOOLEAN NOT NULL DEFAULT false,
    "title" TEXT NOT NULL,
    "problemStatement" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "targetUsers" TEXT NOT NULL,
    "scopeInclusions" TEXT[],
    "scopeExclusions" TEXT[],
    "technicalConstraints" TEXT[],
    "deliverables" TEXT[],
    "acceptanceCriteria" TEXT[],
    "testingRequirements" TEXT NOT NULL,
    "securityNotes" TEXT NOT NULL,
    "documentationReqs" TEXT NOT NULL,
    "definitionOfDone" TEXT NOT NULL,
    "plainLanguageSummary" TEXT NOT NULL,
    "ownerConfirmedAt" TIMESTAMP(3),
    "techApprovedById" TEXT,
    "techApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Specification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Requirement" (
    "id" TEXT NOT NULL,
    "specificationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "status" "ClaimStatus" NOT NULL DEFAULT 'PROPOSED',
    "supersededById" TEXT,

    CONSTRAINT "Requirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequirementSource" (
    "requirementId" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "verifiedByHuman" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "RequirementSource_pkey" PRIMARY KEY ("requirementId","sourceRecordId")
);

-- CreateTable
CREATE TABLE "ReadinessChecklist" (
    "projectId" TEXT NOT NULL,
    "ownerEligibilityOk" BOOLEAN NOT NULL DEFAULT false,
    "scopeAndCriteriaOk" BOOLEAN NOT NULL DEFAULT false,
    "provenanceVerifiedOk" BOOLEAN NOT NULL DEFAULT false,
    "anonymizationApproved" BOOLEAN NOT NULL DEFAULT false,
    "reviewerCapacityBooked" BOOLEAN NOT NULL DEFAULT false,
    "termsAndLicenseSet" BOOLEAN NOT NULL DEFAULT false,
    "repoControlsVerified" BOOLEAN NOT NULL DEFAULT false,
    "signedOffById" TEXT,
    "signedOffAt" TIMESTAMP(3),

    CONSTRAINT "ReadinessChecklist_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "RoutingPolicy" (
    "projectId" TEXT NOT NULL,
    "missionWindowOpens" TIMESTAMP(3) NOT NULL,
    "partnerWindowOpens" TIMESTAMP(3) NOT NULL,
    "generalWindowOpens" TIMESTAMP(3) NOT NULL,
    "requiresApplication" BOOLEAN NOT NULL DEFAULT false,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingPolicy_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "ProjectAssignment" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "matchedTier" "RoutingTier" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "identityUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "unlockedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "withdrawReason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryTemplate" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "githubTemplateRepo" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "hasGitleaksWorkflow" BOOLEAN NOT NULL DEFAULT true,
    "hasCiTestWorkflow" BOOLEAN NOT NULL DEFAULT true,
    "hasDeployButton" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryReference" (
    "projectId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "governanceMode" "GovernanceMode" NOT NULL DEFAULT 'FREE_FORK_CI',
    "githubRepoId" TEXT NOT NULL,
    "githubOwner" TEXT NOT NULL,
    "githubRepoName" TEXT NOT NULL,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "gitleaksVerified" BOOLEAN NOT NULL DEFAULT false,
    "ciWorkflowVerified" BOOLEAN NOT NULL DEFAULT false,
    "branchRulesVerified" BOOLEAN NOT NULL DEFAULT false,
    "runbookVerified" BOOLEAN NOT NULL DEFAULT false,
    "provisionedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryReference_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "RepositoryAccessGrant" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "githubUsername" TEXT NOT NULL,
    "permission" TEXT NOT NULL,
    "status" "RepoAccessStatus" NOT NULL DEFAULT 'PENDING_GRANT',
    "lastError" TEXT,
    "grantedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "RepositoryAccessGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GitHubIssueReference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "githubIssueId" TEXT NOT NULL,
    "issueNumber" INTEGER NOT NULL,
    "specVersion" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GitHubIssueReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PullRequestReference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "githubPrId" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "authorUsername" TEXT NOT NULL,
    "headSha" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "ciChecksPassed" BOOLEAN NOT NULL DEFAULT false,
    "gitleaksPassed" BOOLEAN NOT NULL DEFAULT false,
    "mergedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PullRequestReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "specVersion" INTEGER NOT NULL,
    "deliveredSha" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "isInvalidated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcceptanceRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "acceptedById" TEXT NOT NULL,
    "specVersion" INTEGER NOT NULL,
    "deliveredSha" TEXT NOT NULL,
    "notes" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AcceptanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContributionRecord" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "developerId" TEXT NOT NULL,
    "specVersion" INTEGER NOT NULL,
    "acceptedSha" TEXT NOT NULL,
    "prNumber" INTEGER NOT NULL,
    "neutralTitle" TEXT NOT NULL,
    "neutralSummary" TEXT NOT NULL,
    "verifiedSkills" TEXT[],
    "completedAt" TIMESTAMP(3) NOT NULL,
    "isRevoked" BOOLEAN NOT NULL DEFAULT false,
    "revocationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContributionRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilestoneEvidence" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "milestone" "MilestoneType" NOT NULL,
    "evidenceNote" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilestoneEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationShare" (
    "id" TEXT NOT NULL,
    "contributionId" TEXT NOT NULL,
    "opaqueToken" TEXT NOT NULL,
    "publicName" TEXT NOT NULL,
    "showSkills" BOOLEAN NOT NULL DEFAULT true,
    "showMilestones" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RepositoryHandoff" (
    "projectId" TEXT NOT NULL,
    "handoffMethod" TEXT NOT NULL,
    "maintenanceOwner" TEXT NOT NULL,
    "runbookDelivered" BOOLEAN NOT NULL DEFAULT false,
    "defectWindowEndsAt" TIMESTAMP(3),
    "publicReleaseOk" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RepositoryHandoff_pkey" PRIMARY KEY ("projectId")
);

-- CreateTable
CREATE TABLE "SupporterLink" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "externalUrl" TEXT NOT NULL,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupporterLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedWebhookEvent" (
    "deliveryId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedWebhookEvent_pkey" PRIMARY KEY ("deliveryId")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "rationale" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserRole_userId_role_key" ON "UserRole"("userId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperProfile_userId_key" ON "DeveloperProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperProfile_githubUserId_key" ON "DeveloperProfile"("githubUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PriorityEligibility_userId_key" ON "PriorityEligibility"("userId");

-- CreateIndex
CREATE INDEX "SandboxCalibration_userId_passed_idx" ON "SandboxCalibration"("userId", "passed");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverySourceRecord_supersededById_key" ON "DiscoverySourceRecord"("supersededById");

-- CreateIndex
CREATE UNIQUE INDEX "DiscoverySourceRecord_submissionId_sequenceNumber_key" ON "DiscoverySourceRecord"("submissionId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectProfile_submissionId_revisionNumber_key" ON "ProjectProfile"("submissionId", "revisionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Project_opaqueSlug_key" ON "Project"("opaqueSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Specification_projectId_versionNumber_key" ON "Specification"("projectId", "versionNumber");

-- CreateIndex
CREATE INDEX "ProjectAssignment_projectId_status_idx" ON "ProjectAssignment"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryTemplate_slug_key" ON "RepositoryTemplate"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "RepositoryReference_githubRepoId_key" ON "RepositoryReference"("githubRepoId");

-- CreateIndex
CREATE INDEX "RepositoryAccessGrant_projectId_userId_status_idx" ON "RepositoryAccessGrant"("projectId", "userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "GitHubIssueReference_githubIssueId_key" ON "GitHubIssueReference"("githubIssueId");

-- CreateIndex
CREATE UNIQUE INDEX "PullRequestReference_githubPrId_key" ON "PullRequestReference"("githubPrId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationShare_contributionId_key" ON "VerificationShare"("contributionId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationShare_opaqueToken_key" ON "VerificationShare"("opaqueToken");

-- CreateIndex
CREATE INDEX "AuditEvent_entityType_entityId_idx" ON "AuditEvent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPreference" ADD CONSTRAINT "UserPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeveloperProfile" ADD CONSTRAINT "DeveloperProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriorityEligibility" ADD CONSTRAINT "PriorityEligibility_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerReferral" ADD CONSTRAINT "PartnerReferral_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SandboxCalibration" ADD CONSTRAINT "SandboxCalibration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSubmission" ADD CONSTRAINT "ProblemSubmission_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProblemSubmission" ADD CONSTRAINT "ProblemSubmission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoveryDraftState" ADD CONSTRAINT "DiscoveryDraftState_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ProblemSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoverySourceRecord" ADD CONSTRAINT "DiscoverySourceRecord_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ProblemSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscoverySourceRecord" ADD CONSTRAINT "DiscoverySourceRecord_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "DiscoverySourceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectProfile" ADD CONSTRAINT "ProjectProfile_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ProblemSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "ProblemSubmission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnonymousProjectProfile" ADD CONSTRAINT "AnonymousProjectProfile_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Specification" ADD CONSTRAINT "Specification_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Requirement" ADD CONSTRAINT "Requirement_specificationId_fkey" FOREIGN KEY ("specificationId") REFERENCES "Specification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementSource" ADD CONSTRAINT "RequirementSource_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequirementSource" ADD CONSTRAINT "RequirementSource_sourceRecordId_fkey" FOREIGN KEY ("sourceRecordId") REFERENCES "DiscoverySourceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadinessChecklist" ADD CONSTRAINT "ReadinessChecklist_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutingPolicy" ADD CONSTRAINT "RoutingPolicy_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAssignment" ADD CONSTRAINT "ProjectAssignment_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryReference" ADD CONSTRAINT "RepositoryReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryAccessGrant" ADD CONSTRAINT "RepositoryAccessGrant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RepositoryReference"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GitHubIssueReference" ADD CONSTRAINT "GitHubIssueReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RepositoryReference"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PullRequestReference" ADD CONSTRAINT "PullRequestReference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "RepositoryReference"("projectId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceRecord" ADD CONSTRAINT "AcceptanceRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcceptanceRecord" ADD CONSTRAINT "AcceptanceRecord_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionRecord" ADD CONSTRAINT "ContributionRecord_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContributionRecord" ADD CONSTRAINT "ContributionRecord_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilestoneEvidence" ADD CONSTRAINT "MilestoneEvidence_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "ContributionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationShare" ADD CONSTRAINT "VerificationShare_contributionId_fkey" FOREIGN KEY ("contributionId") REFERENCES "ContributionRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RepositoryHandoff" ADD CONSTRAINT "RepositoryHandoff_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupporterLink" ADD CONSTRAINT "SupporterLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
