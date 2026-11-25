import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";
import { requireWorkspace } from "@/server/workspace/request";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const workspace = await requireWorkspace("/app");
  return <WorkspaceShell key={`${workspace.user.id}:${workspace.user.roles.join(",")}`} user={workspace.user} initialRole={workspace.activeRole}>{children}</WorkspaceShell>;
}
