"use client";

import { createContext, useContext, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { applyTheme, type ThemePreference } from "@/lib/theme";

type SaveStatus = "idle" | "saving" | "saved" | "error";
const ThemeContext = createContext<{ signedIn: boolean; serverTheme: ThemePreference | null; status: SaveStatus; select: (theme: ThemePreference) => void }>({ signedIn: false, serverTheme: null, status: "idle", select: applyTheme });
export const useThemePreference = () => useContext(ThemeContext);

export function ThemeProvider({ accountId, accountTheme, children }: { accountId: string | null; accountTheme: ThemePreference | null; children: React.ReactNode }) {
  const [status, setStatus] = useState<SaveStatus>("idle");
  const currentActor = useRef(accountId);
  const confirmed = useRef(accountTheme ?? "system");
  const revision = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const router = useRouter();

  useLayoutEffect(() => {
    currentActor.current = accountId;
    revision.current++;
    if (accountTheme) { confirmed.current = accountTheme; applyTheme(accountTheme); }
    return () => { currentActor.current = null; };
  }, [accountId, accountTheme]);

  function select(theme: ThemePreference) {
    applyTheme(theme);
    if (!accountId) return;
    const actor = accountId;
    const version = ++revision.current;
    setStatus("saving");
    // Serialize writes so rapid Light/Dark/System selection cannot save an older
    // choice after a newer one. Each request is bound to the authenticated actor.
    queue.current = queue.current.then(async () => {
      if (currentActor.current !== actor) return;
      try {
        const response = await fetch("/api/workspace/preferences", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expectedUserId: actor, theme }),
        });
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) router.refresh();
          throw new Error("Preference save failed");
        }
        confirmed.current = theme;
        if (revision.current === version && currentActor.current === actor) setStatus("saved");
      } catch {
        if (revision.current === version && currentActor.current === actor) {
          applyTheme(confirmed.current);
          setStatus("error");
        }
      }
    });
  }

  return <ThemeContext.Provider value={{ signedIn: Boolean(accountId), serverTheme: accountTheme, status, select }}>{children}</ThemeContext.Provider>;
}
