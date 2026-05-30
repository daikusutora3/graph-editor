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

import "./globals.css";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://graph-editor.pages.dev"
).replace(/\/$/, "");
const APP_NAME = "Graph Editor";
const APP_TITLE = `${APP_NAME} | グラフ理論の図をブラウザで作成`;
const APP_DESCRIPTION =
  "Create, edit, arrange, and export graph theory diagrams directly in the browser.";
const APP_DESCRIPTION_JA =
  "ブラウザ上でグラフ理論の図を作成・編集・配置・書き出しできるアプリです。";
const SOCIAL_IMAGE = "/brand/graph-editor-logo.webp";

const appLocaleMetadata = {
  ja: {
    description: APP_DESCRIPTION_JA,
    title: APP_TITLE,
  },
  en: {
    description: APP_DESCRIPTION,
    title: `${APP_NAME} | Graph theory diagrams in the browser`,
  },
  "zh-Hans": {
    description: "直接在浏览器中创建、编辑、排布并导出图论图形。",
    title: `${APP_NAME} | 在浏览器中绘制图论图形`,
  },
};

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

const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: APP_NAME,
  alternateName: "Graph Editor by daikusutora",
  applicationCategory: "DesignApplication",
  operatingSystem: "Any",
  url: SITE_URL,
  image: `${SITE_URL}${SOCIAL_IMAGE}`,
  description: APP_DESCRIPTION,
  inLanguage: ["ja", "en", "zh-Hans"],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "Import edge lists, adjacency lists, adjacency matrices, and JSON",
    "Edit directed, undirected, weighted, and unweighted graphs",
    "Explore curated graph theory samples",
    "Apply graph layouts and export PNG images",
  ],
};

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
        url: SOCIAL_IMAGE,
        type: "image/webp",
      },
    ],
    shortcut: [
      {
        url: SOCIAL_IMAGE,
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
        alt: "Graph Editor logo",
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
