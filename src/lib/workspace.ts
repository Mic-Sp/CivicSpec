import type { RoleType } from "@prisma/client";

export const workspaceRoles: readonly RoleType[] = ["ADMIN", "REVIEWER", "PROBLEM_OWNER", "DEVELOPER"];
export const roleNames: Record<RoleType, string> = { ADMIN: "Administrator", REVIEWER: "Reviewer", PROBLEM_OWNER: "Problem owner", DEVELOPER: "Builder" };

export function selectWorkspaceRole(authorized: readonly RoleType[], requested: RoleType | null): RoleType | null {
  return requested && authorized.includes(requested) ? requested : workspaceRoles.find(role => authorized.includes(role)) ?? null;
}

// Presentation-only descriptions. No private data, permissions, or live counts.
export const workspaceContent: Record<RoleType, { title: string; introduction: string; next: string; sections: readonly { name: string; description: string }[] }> = {
  PROBLEM_OWNER: {
    title: "Problem owner dashboard", introduction: "A place to turn community needs into bounded, human-reviewed projects.",
    next: "Review your account details. You’ll be able to describe a noncommercial technical need when guided intake opens.",
    sections: [{ name: "My submissions", description: "Save and develop your community’s technical needs." }, { name: "New request", description: "Start guided discovery for a noncommercial need." }, { name: "My projects", description: "Follow reviewed projects and provide stakeholder feedback." }],
  },
  DEVELOPER: {
    title: "Builder dashboard", introduction: "A place to contribute your skills and build meaningful experience.",
    next: "Review your account details. Builder readiness and project discovery will open in a future update.",
    sections: [{ name: "Explore projects", description: "Discover anonymous community opportunities." }, { name: "Readiness", description: "Prepare for an eligible implementation assignment." }, { name: "Contributions", description: "Inspect evidence from completed, independently reviewed work." }],
  },
  REVIEWER: {
    title: "Reviewer dashboard", introduction: "A place for independent review and clear, actionable feedback.",
    next: "Review your account details. Specification and implementation review queues will appear here when available.",
    sections: [{ name: "Specification queue", description: "Review scope, criteria, and source-supported requirements." }, { name: "Implementation queue", description: "Review implementation evidence for the exact delivered revision." }, { name: "Review history", description: "Follow your review decisions and feedback." }],
  },
  ADMIN: {
    title: "Administrator dashboard", introduction: "A place to support safe, accountable pilot operations.",
    next: "Review your account details. Operational tools will become available as pilot workflows are introduced.",
    sections: [{ name: "Operations", description: "Follow pilot operations and readiness." }, { name: "People and roles", description: "Manage authorized participation through reviewed processes." }, { name: "Audit", description: "Inspect consequential actions and their recorded rationale." }],
  },
};
