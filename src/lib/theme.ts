export const THEME_STORAGE_KEY = "civicspec-theme";
export const THEME_CHANGE_EVENT = "civicspec-theme-change";

export type ThemePreference = "light" | "dark" | "system";

export function parseTheme(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

// Static, trusted source only. CSS resolves System and tracks OS changes directly.
// Running in <head> applies saved overrides before themed content can paint.
export const themeInitializationScript = `(() => {
  let theme = "system";
  try {
    const saved = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    if (saved === "light" || saved === "dark") theme = saved;
  } catch {}
  document.documentElement.dataset.theme = theme;
})();`;
