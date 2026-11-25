import { requireAuthentication } from "@/server/auth";

// Authentication boundary for every /app route, including onboarding. Pages and
// data services also resolve authentication on each request (layouts can persist).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAuthentication({ kind: "page", returnTo: "/app" });
  return children;
}
