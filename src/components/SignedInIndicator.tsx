import { UserRound } from "lucide-react";

export function SignedInIndicator({ displayName }: { displayName: string }) {
  return (
    <p className="signed-in-indicator">
      <UserRound size={18} aria-hidden="true" />
      <span>Signed in as <strong>{displayName}</strong></span>
    </p>
  );
}
