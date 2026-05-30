import type { Metadata } from "next";

export const SITE_URL = "https://graph-editor.daikusutora3.workers.dev";

export const APP_NAME = "Graph Editor";

export const APP_ICON = "/brand/graph-editor-logo.webp";
export const SOCIAL_IMAGE = APP_ICON;
export const APPLE_TOUCH_ICON = "/brand/graph-editor-logo-180.png";

export const appLocaleMetadata = {
  ja: {
    description:
      "ブラウザ上でグラフ理論の図を作成・編集・配置・書き出しできるアプリです。",
    title: APP_NAME,
  },
  en: {
    description:
      "Create, edit, arrange, and export graph theory diagrams directly in the browser.",
    title: APP_NAME,
  },
  "zh-Hans": {
    description: "直接在浏览器中创建、编辑、排布并导出图论图形。",
    title: APP_NAME,
  },
} as const;

export type AppLocale = keyof typeof appLocaleMetadata;

export const DEFAULT_APP_LOCALE: AppLocale = "ja";

export const appRouteLocaleParams = ["en", "zh-hans"] as const;

export type AppRouteLocaleParam = (typeof appRouteLocaleParams)[number];

export const appRouteParamLocales: Record<AppRouteLocaleParam, AppLocale> = {
  en: "en",
  "zh-hans": "zh-Hans",
};

export const appLocalePaths: Record<AppLocale, string> = {
  ja: "/",
  en: "/en",
  "zh-Hans": "/zh-hans",
};

export const appLanguageAlternates: Record<string, string> = {
  ja: appLocalePaths.ja,
  en: appLocalePaths.en,
  "zh-Hans": appLocalePaths["zh-Hans"],
  "x-default": appLocalePaths[DEFAULT_APP_LOCALE],
};

const appOpenGraphLocales: Record<AppLocale, string> = {
  ja: "ja_JP",
  en: "en_US",
  "zh-Hans": "zh_CN",
};

export const APP_PUBLIC_TITLE = appLocaleMetadata.ja.title;
export const APP_PUBLIC_DESCRIPTION = appLocaleMetadata.ja.description;
export const APP_TITLE = APP_PUBLIC_TITLE;
export const APP_DESCRIPTION = APP_PUBLIC_DESCRIPTION;

export const appRootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: APP_NAME,
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
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
};

export function getAppLocaleUrl(locale: AppLocale) {
  return getAppPathUrl(appLocalePaths[locale]);
}

export function getAppPathUrl(path: string) {
  return path === "/" ? SITE_URL : new URL(path, SITE_URL).toString();
}

export function getAppLocaleFromParam(param: string): AppLocale {
  return (
    appRouteParamLocales[param as AppRouteLocaleParam] ?? DEFAULT_APP_LOCALE
  );
}

export function createAppStructuredData(locale: AppLocale) {
  const localeMetadata = appLocaleMetadata[locale];

  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: APP_NAME,
    alternateName: "Graph Editor by daikusutora",
    applicationCategory: "DesignApplication",
    operatingSystem: "Any",
    url: getAppLocaleUrl(locale),
    image: `${SITE_URL}${SOCIAL_IMAGE}`,
    description: localeMetadata.description,
    inLanguage: locale,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  } as const;
}

export function createAppPageMetadata(locale: AppLocale): Metadata {
  const localeMetadata = appLocaleMetadata[locale];
  const alternateLocales = Object.values(appOpenGraphLocales).filter(
    (value) => value !== appOpenGraphLocales[locale],
  );

  return {
    title: {
      absolute: localeMetadata.title,
    },
    description: localeMetadata.description,
    alternates: {
      canonical: appLocalePaths[locale],
      languages: appLanguageAlternates,
    },
    openGraph: {
      type: "website",
      locale: appOpenGraphLocales[locale],
      alternateLocale: alternateLocales,
      url: appLocalePaths[locale],
      siteName: APP_NAME,
      title: localeMetadata.title,
      description: localeMetadata.description,
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
      title: localeMetadata.title,
      description: localeMetadata.description,
      images: [SOCIAL_IMAGE],
    },
  };
}
