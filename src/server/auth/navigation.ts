import { safeReturnPath } from "./return-path";

export function authDestination(value: unknown): string {
  const path = safeReturnPath(value);
  const pathname = new URL(path, "https://civicspec.invalid").pathname;
  // Auth/onboarding destinations otherwise create signed-in redirect loops.
  return pathname === "/auth" || pathname.startsWith("/auth/") || pathname === "/app/onboarding"
    ? "/app" : path;
}

export function onboardingLocation(returnTo: unknown): string {
  return `/app/onboarding?returnTo=${encodeURIComponent(authDestination(returnTo))}`;
}
