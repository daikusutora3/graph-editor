import type { ReactNode } from "react";

import { createAppStructuredData, type AppLocale } from "@/lib/site-metadata";
import {
  DEFAULT_THEME,
  SUPPORTED_THEME_MODES,
  THEME_STORAGE_KEY,
} from "@/features/graph-editor/ui/theme/theme-constants";

const themeInitScript = `
(() => {
  try {
    const stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    const supportedThemes = new Set(${JSON.stringify(SUPPORTED_THEME_MODES)});
    const theme =
      supportedThemes.has(stored)
        ? stored
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.style.colorScheme = ${JSON.stringify(DEFAULT_THEME)};
  }
})();
`;

export function LocaleRootLayout({
  children,
  locale,
}: {
  children: ReactNode;
  locale: AppLocale;
}) {
  return (
    <html lang={locale} data-locale={locale} suppressHydrationWarning>
      <head>
        {/* Plain inline script: runs before first paint and is hashed into
            the CSP at build time (next/script would re-inject it at runtime
            as an un-hashed inline script). */}
        <script
          id="app-init"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
      </head>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(createAppStructuredData(locale)),
          }}
        />
        {children}
      </body>
    </html>
  );
}
