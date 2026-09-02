"use client";

import { useCallback, useEffect, useState } from "react";

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  toThemeMode,
  type ThemeMode,
} from "./theme-constants";

export type { ThemeMode } from "./theme-constants";

export function useThemeMode() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const initialTheme = readPreferredTheme();
    setTheme(initialTheme);
    applyThemeMode(initialTheme);

    const onStorage = (event: StorageEvent) => {
      if (event.key !== THEME_STORAGE_KEY) {
        return;
      }

      const nextTheme = toThemeMode(event.newValue) ?? readPreferredTheme();
      setTheme(nextTheme);
      applyThemeMode(nextTheme);
    };

    window.addEventListener("storage", onStorage);

    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateTheme = useCallback((nextTheme: ThemeMode) => {
    setTheme(nextTheme);
    applyThemeMode(nextTheme);
    writeStoredTheme(nextTheme);
  }, []);

  return { theme, setTheme: updateTheme };
}

function readPreferredTheme(): ThemeMode {
  const datasetTheme = toThemeMode(document.documentElement.dataset.theme);
  if (datasetTheme) {
    return datasetTheme;
  }

  const storedTheme = readStoredTheme();
  if (storedTheme) {
    return storedTheme;
  }

  return DEFAULT_THEME;
}

function applyThemeMode(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function readStoredTheme(): ThemeMode | null {
  try {
    return toThemeMode(window.localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return null;
  }
}

function writeStoredTheme(theme: ThemeMode) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Theme application should not depend on storage availability.
  }
}
