"use client";

import { useId, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

import {
  parseTheme,
  THEME_CHANGE_EVENT,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme";
import { useThemePreference } from "@/components/ThemeProvider";

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) {
      document.documentElement.dataset.theme = parseTheme(event.newValue);
      onChange();
    }
  };

  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): ThemePreference {
  return parseTheme(document.documentElement.getAttribute("data-theme"));
}

const choices = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeToggle({ label = "Appearance", showStatus = true }: { label?: string; showStatus?: boolean }) {
  const preference = useThemePreference();
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => preference.serverTheme ?? "system");
  const name = useId();

  return (
    <fieldset className="theme-toggle">
      <legend>{label}</legend>
      <div className="theme-options">
        {choices.map(({ value, label, icon: Icon }) => (
          <label className="theme-choice" key={value}>
            <input
              type="radio"
              name={name}
              value={value}
              checked={theme === value}
              onChange={() => preference.select(value)}
            />
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {preference.signedIn && showStatus && <p className="theme-save-status" role={preference.status === "error" ? "alert" : "status"}>
        {preference.status === "saving" ? "Saving appearance…" : preference.status === "saved" ? "Appearance saved." : preference.status === "error" ? "Couldn’t save appearance. Your saved choice was restored. Try again." : "Appearance syncs with your account."}
      </p>}
    </fieldset>
  );
}
