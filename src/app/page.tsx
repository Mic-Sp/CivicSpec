import { CheckCircle2, CodeXml } from "lucide-react";

import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="site-shell">
      <a className="skip-link" href="#main-content">Skip to content</a>
      <header className="site-header">
        <p className="wordmark">
          <CodeXml size={28} aria-hidden="true" />
          <span>CivicSpec</span>
        </p>
        <ThemeToggle />
      </header>
      <main id="main-content" tabIndex={-1}>
        <section className="intro-panel" aria-labelledby="welcome-heading">
          <p className="eyebrow">Community needs. Shared possibility.</p>
          <h1 id="welcome-heading">Real needs. Real code. Real experience.</h1>
          <p className="intro-copy">
            A foundation for turning community technical needs into bounded,
            human-reviewed projects and meaningful experience for builders.
          </p>
          <p className="status-badge">
            <CheckCircle2 size={20} aria-hidden="true" />
            <span>Sample status: Ready for review</span>
          </p>
          <p className="placeholder-note">
            CivicSpec is taking shape. This is a preview of our visual foundation.
          </p>
        </section>
      </main>
      <footer className="site-footer">
        <p>Built around community, accessibility, and opportunity.</p>
      </footer>
    </div>
  );
}
