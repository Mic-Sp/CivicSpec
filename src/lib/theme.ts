export const THEME_STORAGE_KEY = "civicspec-theme";
export const THEME_CHANGE_EVENT = "civicspec-theme-change";

export type ThemePreference = "light" | "dark" | "system";

export function parseTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(theme: ThemePreference) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_STORAGE_KEY, theme); } catch { /* Storage may be blocked. */ }
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

// Static, trusted source only. CSS resolves System and tracks OS changes directly.
// Running in <head> applies saved overrides before themed content can paint.
export const themeInitializationScript = `(() => {
  const root = document.documentElement;
  const account = root.dataset.themeSource === "account";
  let theme = "system";
  const serverTheme = root.dataset.theme;
  if (account && (serverTheme === "light" || serverTheme === "dark")) theme = serverTheme;
  try {
    if (account) localStorage.setItem(${JSON.stringify(THEME_STORAGE_KEY)}, theme);
    else {
      const saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
      if (saved === "light" || saved === "dark") theme = saved;
    }
  } catch {}
  root.dataset.theme = theme;
})();`;
