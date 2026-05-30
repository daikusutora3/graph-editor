import type { Metadata } from "next";
import Script from "next/script";

import {
  APP_DESCRIPTION,
  APP_DESCRIPTION_JA,
  APP_ICON,
  APP_NAME,
  APP_TITLE,
  APPLE_TOUCH_ICON,
  SITE_URL,
  SOCIAL_IMAGE,
  appLocaleMetadata,
  structuredData,
} from "@/lib/site-metadata";
import {
  DEFAULT_THEME,
  SUPPORTED_THEME_MODES,
  THEME_STORAGE_KEY,
} from "@/features/graph-editor/ui/theme-constants";
import {
  DEFAULT_LOCALE,
  LOCALE_ALIASES,
  LOCALE_STORAGE_KEY,
  SUPPORTED_LOCALES,
} from "@/features/graph-editor/i18n/locale";

import "./globals.css";

const appInitScript = `
(() => {
  try {
    const stored = window.localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    const supportedThemes = new Set(${JSON.stringify(SUPPORTED_THEME_MODES)});
    const theme =
      supportedThemes.has(stored)
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
  const supported = new Set(${JSON.stringify(SUPPORTED_LOCALES)});
  const appMetadata = ${JSON.stringify(appLocaleMetadata)};
  const aliases = new Map(Object.entries(${JSON.stringify(LOCALE_ALIASES)}));
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
  metadataBase: new URL(SITE_URL),
  applicationName: APP_NAME,
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION_JA,
  keywords: [
    "Graph Editor",
    "graph theory",
    "graph drawing",
    "graph visualization",
    "edge list",
    "adjacency matrix",
    "network diagram",
    "グラフ理論",
    "グラフ描画",
  ],
  authors: [{ name: "daikusutora" }],
  creator: "daikusutora",
  publisher: "daikusutora",
  category: "graph theory",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      {
        url: APP_ICON,
        type: "image/webp",
      },
    ],
    shortcut: [
      {
        url: APP_ICON,
        type: "image/webp",
      },
    ],
    apple: [
      {
        url: APPLE_TOUCH_ICON,
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  openGraph: {
    type: "website",
    locale: "ja_JP",
    alternateLocale: ["en_US", "zh_CN"],
    url: "/",
    siteName: APP_NAME,
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [
      {
        url: SOCIAL_IMAGE,
        width: 512,
        height: 512,
        alt: "Graph Editor icon",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    images: [SOCIAL_IMAGE],
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
        {children}
      </body>
    </html>
  );
}
