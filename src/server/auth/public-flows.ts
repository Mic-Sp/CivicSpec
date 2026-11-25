import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import { AuthError } from "./errors";
import { authFormError, loginFailure, participationTermsVersion, registrationFailure, type AuthFlowResult } from "./form-state";
import { authDestination, onboardingLocation } from "./navigation";
import { hashPassword } from "./password";
import { fieldErrors, onboardingSchema, registrationSchema, signInSchema } from "./public-validation";
import type { AuthLimitScope } from "./rate-limit";
import { signInLocation } from "./return-path";
import { authUserSelect, type AuthUser } from "./user";

type PublicAuthDatabase = Pick<PrismaClient, "user" | "$transaction">;
const throttled = () => authFormError("Too many attempts. Please wait 10 minutes and try again.");

export function createPublicAuthFlows(dependencies: {
  database: PublicAuthDatabase;
  authenticatePassword: (email: unknown, password: unknown) => Promise<AuthUser | null>;
  startSession: (userId: string) => Promise<AuthUser>;
  resolveUser: () => Promise<AuthUser | null>;
  limit: (scope: AuthLimitScope, identity?: string) => Promise<boolean>;
}) {
  return {
    async signIn(input: unknown): Promise<AuthFlowResult> {
      if (!await dependencies.limit("sign-in-global")) return throttled();
      const parsed = signInSchema.safeParse(input);
      if (!parsed.success) return authFormError(loginFailure, fieldErrors(parsed.error));
      if (!await dependencies.limit("sign-in-account", parsed.data.email)) return throttled();
      const user = await dependencies.authenticatePassword(parsed.data.email, parsed.data.password);
      if (!user) return authFormError(loginFailure);
      try {
        await dependencies.startSession(user.id);
      } catch (error) {
        if (error instanceof AuthError) return authFormError(loginFailure);
        throw error;
      }
      return { ok: true, redirectTo: user.roles.length ? authDestination(parsed.data.returnTo) : onboardingLocation(parsed.data.returnTo) };
    },

    async register(input: unknown): Promise<AuthFlowResult> {
      if (!await dependencies.limit("registration-global")) return throttled();
      const parsed = registrationSchema.safeParse(input);
      if (!parsed.success) return authFormError("Check the highlighted details and try again.", fieldErrors(parsed.error));
      const { displayName, email, password, returnTo } = parsed.data;
      if (!await dependencies.limit("registration-account", email)) return throttled();
      const passwordHash = await hashPassword(password);
      let user;
      try {
        user = await dependencies.database.user.create({
          data: { displayName, email, passwordHash, preference: { create: { theme: "SYSTEM" } } },
          select: authUserSelect,
        });
      } catch (error) {
        // Includes concurrent duplicate requests. Never log the existing user in,
        // change their password, or reveal database/constraint details.
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return authFormError(registrationFailure);
        throw error;
      }
      await dependencies.startSession(user.id);
      return { ok: true, redirectTo: onboardingLocation(returnTo) };
    },

    async onboard(input: unknown): Promise<AuthFlowResult> {
      const user = await dependencies.resolveUser();
      if (!user) return { ok: true, redirectTo: signInLocation("/app/onboarding") };
      if (!await dependencies.limit("onboarding-account", user.id)) return throttled();
      const parsed = onboardingSchema.safeParse(input);
      if (!parsed.success) return authFormError("Check your role choice and participation acknowledgement.", fieldErrors(parsed.error));
      const { intent, returnTo } = parsed.data;
      const result = await dependencies.database.$transaction(async (tx) => {
        // Serialize parallel onboarding requests for the same account. Identity
        // comes exclusively from the validated session, never a form field.
        await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
        const current = await tx.user.findUnique({ where: { id: user.id }, select: authUserSelect });
        if (!current || current.isSuspended) throw new AuthError(401);
        if (current.roles.length) return "already-onboarded";
        await tx.userRole.create({ data: { userId: current.id, role: intent } });
        if (intent === "DEVELOPER") {
          await tx.developerProfile.upsert({
            where: { userId: current.id }, update: {},
            create: { userId: current.id, skills: [], interests: [], isPublicProfile: false },
          });
        }
        await tx.auditEvent.create({ data: {
          actorId: current.id, action: "PARTICIPATION_TERMS_ACCEPTED", entityType: "User", entityId: current.id,
          rationale: "Participant acknowledged voluntary, unpaid, noncommercial pilot participation.",
          metadata: { termsVersion: participationTermsVersion, initialRole: intent, voluntary: true, noncommercial: true },
        } });
        return "completed";
      });
      if (result === "already-onboarded") return { ok: true, redirectTo: "/app" };
      await dependencies.startSession(user.id);
      return { ok: true, redirectTo: authDestination(returnTo) };
    },
  };
}
