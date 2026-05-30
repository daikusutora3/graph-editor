import type { Metadata } from "next";
import Script from "next/script";

import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
} from "@/features/graph-editor/ui/theme-constants";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
} from "@/features/graph-editor/i18n/locale";
import { messagesByLocale } from "@/features/graph-editor/i18n/messages";

import "./globals.css";

const appLocaleMetadata = Object.fromEntries(
  Object.entries(messagesByLocale).map(([locale, messages]) => [
    locale,
    {
      description: messages.app.description,
      title: messages.app.title,
    },
  ]),
);

const appInitScript = `
(() => {
  try {
    const stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    const theme =
      stored === "light" || stored === "dark"
        ? stored
        : ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch {
    document.documentElement.dataset.theme = ${JSON.stringify(DEFAULT_THEME)};
    document.documentElement.style.colorScheme = ${JSON.stringify(DEFAULT_THEME)};
  }
})();

(() => {
  const supported = new Set(["ja", "en", "zh-Hans"]);
  const appMetadata = ${JSON.stringify(appLocaleMetadata)};
  const aliases = new Map([
    ["ja", "ja"],
    ["ja-jp", "ja"],
    ["en", "en"],
    ["en-us", "en"],
    ["en-gb", "en"],
    ["zh", "zh-Hans"],
    ["zh-cn", "zh-Hans"],
    ["zh-hans", "zh-Hans"],
    ["zh-sg", "zh-Hans"],
  ]);
  const toLocale = (value) =>
    value ? aliases.get(String(value).toLowerCase()) ?? null : null;
  const detectLocale = () => {
    const stored = toLocale(window.localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)}));
    if (stored && supported.has(stored)) return stored;
    for (const language of navigator.languages || []) {
      const locale = toLocale(language);
      if (locale && supported.has(locale)) return locale;
    }
    return ${JSON.stringify(DEFAULT_LOCALE)};
  };

  try {
    const locale = detectLocale();
    document.documentElement.lang = locale;
    document.documentElement.dataset.locale = locale;
    const metadata = appMetadata[locale] ?? appMetadata[${JSON.stringify(DEFAULT_LOCALE)}];
    document.title = metadata.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", metadata.description);
  } catch {
    document.documentElement.lang = ${JSON.stringify(DEFAULT_LOCALE)};
    document.documentElement.dataset.locale = ${JSON.stringify(DEFAULT_LOCALE)};
    const metadata = appMetadata[${JSON.stringify(DEFAULT_LOCALE)}];
    document.title = metadata.title;
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute("content", metadata.description);
  }
})();
`;

export const metadata: Metadata = {
  title: messagesByLocale[DEFAULT_LOCALE].app.title,
  description: messagesByLocale[DEFAULT_LOCALE].app.description,
  icons: {
    icon: [
      {
        url: "/brand/graph-editor-logo.webp",
        type: "image/webp",
      },
    ],
    shortcut: [
      {
        url: "/brand/graph-editor-logo.webp",
        type: "image/webp",
      },
    ],
    apple: [
      {
        url: "/brand/graph-editor-logo-180.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body>
        <Script
          id="app-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: appInitScript }}
        />
        {children}
      </body>
    </html>
  );
}
