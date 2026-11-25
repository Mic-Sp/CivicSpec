import type { Metadata } from "next";
import { Dashboard } from "@/components/workspace/Dashboard";
import { requireWorkspace } from "@/server/workspace/request";

export const metadata: Metadata = { title: "Your dashboard | CivicSpec", robots: { index: false, follow: false } };
export default async function DashboardPage() {
  await requireWorkspace("/app");
  return <Dashboard />;
}
