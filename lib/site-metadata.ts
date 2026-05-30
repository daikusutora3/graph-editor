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
export const APP_DESCRIPTION_ZH_HANS = appLocaleMetadata["zh-Hans"].description;

export const structuredData = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: APP_NAME,
  alternateName: "Graph Editor by daikusutora",
  applicationCategory: "DesignApplication",
  operatingSystem: "Any",
  url: SITE_URL,
  image: `${SITE_URL}${SOCIAL_IMAGE}`,
  description: APP_PUBLIC_DESCRIPTION,
  inLanguage: ["ja", "en", "zh-Hans"],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
  featureList: [
    "辺リスト、隣接リスト、隣接行列、JSONを読み込み",
    "有向・無向、重み付き・重みなしグラフを編集",
    "グラフ理論のサンプルから開始",
    "レイアウトを適用してPNG画像を書き出し",
  ],
} as const;

export function getAppLocaleUrl(locale: AppLocale) {
  return getAppPathUrl(appLocalePaths[locale]);
}

export function getAppPathUrl(path: string) {
  return path === "/" ? SITE_URL : new URL(path, SITE_URL).toString();
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
