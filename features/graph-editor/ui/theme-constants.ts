export type ThemeMode = "light" | "dark";

export const DEFAULT_THEME: ThemeMode = "light";
export const THEME_STORAGE_KEY = "graph-editor-theme";

export function toThemeMode(
  value: string | null | undefined,
): ThemeMode | null {
  return value === "light" || value === "dark" ? value : null;
}
