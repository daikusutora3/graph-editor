export const SUPPORTED_THEME_MODES = ["light", "dark"] as const;

export type ThemeMode = (typeof SUPPORTED_THEME_MODES)[number];

export const DEFAULT_THEME: ThemeMode = "light";
export const THEME_STORAGE_KEY = "graph-editor-theme";

export function toThemeMode(
  value: string | null | undefined,
): ThemeMode | null {
  if (value === undefined || value === null) {
    return null;
  }

  return isThemeMode(value) ? value : null;
}

function isThemeMode(value: string): value is ThemeMode {
  return SUPPORTED_THEME_MODES.some((theme) => theme === value);
}
