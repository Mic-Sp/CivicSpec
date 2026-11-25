import type { Metadata } from "next";
import { ThemeToggle } from "@/components/ThemeToggle";
import { signOutAction } from "@/app/auth/actions";
import { roleNames } from "@/lib/workspace";
import { requireWorkspace } from "@/server/workspace/request";

export const metadata: Metadata = { title: "Account settings | CivicSpec", robots: { index: false, follow: false } };
export default async function AccountPage() {
  const { user } = await requireWorkspace("/app/account");
  return (
    <div className="account-settings">
      <p className="eyebrow">Your CivicSpec account</p><h1>Account settings</h1>
      <p className="workspace-introduction">Review your account details, access, and appearance.</p>
      <section className="workspace-panel" aria-labelledby="details-heading">
        <h2 id="details-heading">Account details</h2>
        <dl className="account-details"><div><dt>Name</dt><dd>{user.displayName}</dd></div><div><dt>Email</dt><dd>{user.email}</dd></div><div><dt>Authorized roles</dt><dd>{user.roles.map(role => roleNames[role]).sort().join(", ")}</dd></div></dl>
      </section>
      <section className="workspace-panel" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading">Appearance</h2><p>Your choice is saved with your account. System follows your device’s light or dark appearance.</p>
        <ThemeToggle label="Account appearance" showStatus={false} />
      </section>
      <section className="workspace-panel" aria-labelledby="session-heading">
        <h2 id="session-heading">Your session</h2><p>Sign out when you finish, especially on a shared device.</p>
        <form action={signOutAction}><button className="secondary-button" type="submit">Sign out of CivicSpec</button></form>
      </section>
    </div>
  );
}
