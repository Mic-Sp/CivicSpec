import { AlertCircle, CheckCircle2, Clock3, PauseCircle, XCircle } from "lucide-react";

const statuses = {
  PENDING: { label: "Pending review", tone: "warning", icon: Clock3 },
  NEEDS_INFO: { label: "Needs information", tone: "warning", icon: AlertCircle },
  VERIFIED: { label: "Verified", tone: "success", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", tone: "error", icon: XCircle },
  DEFERRED: { label: "Deferred", tone: "warning", icon: PauseCircle },
} as const;
export function OwnerStatusBadge({ status }: { status: string }) {
  const detail = statuses[status as keyof typeof statuses];
  const Icon = detail?.icon ?? Clock3;
  const label = detail?.label ?? status.toLowerCase().split("_").map(word => word[0]?.toUpperCase() + word.slice(1)).join(" ");
  return <span className={`owner-status owner-status-${detail?.tone ?? "neutral"}`}><Icon size={18} aria-hidden="true" />{label}</span>;
}
