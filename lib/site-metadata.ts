import type { Metadata, Viewport } from "next";

export const SITE_URL = "https://graph-editor.daikusutora3.workers.dev";

export const APP_NAME = "Graph Editor";
export const AUTHOR_NAME = "daikusutora";
export const REPOSITORY_URL = "https://github.com/daikusutora3/graph-editor";

// Search engines (Google in particular) ignore WebP favicons, so the icons
// exposed through metadata are PNG plus a multi-size favicon.ico.
export const APP_ICON = "/brand/graph-editor-logo-512.png";
export const APP_ICON_192 = "/brand/graph-editor-logo-192.png";
export const APP_ICON_48 = "/brand/graph-editor-logo-48.png";
export const FAVICON = "/favicon.ico";
export const SOCIAL_IMAGE = APP_ICON;
export const APPLE_TOUCH_ICON = "/brand/graph-editor-logo-180.png";

export const appLocaleMetadata = {
  ja: {
    title: "Graph Editor | グラフ理論の図をブラウザで描く・配置・書き出し",
    description:
      "辺リストや隣接行列を貼るだけでグラフを描画。自動配置、辺の曲げ、色分け、PNG・JSON 書き出しに対応した無料のグラフ理論エディタです。",
    headline: "グラフ理論の図を、ブラウザで",
    tagline:
      "辺リストを貼る、サンプルから始める、直接描く。競技プログラミングや講義資料のためのグラフエディタです。",
    features: [
      "辺リスト・隣接リスト・隣接行列・親配列を自動判定して読み込み",
      "木・DAG・二部グラフ・円形・格子など 12 種類の自動配置",
      "頂点の色分け、辺の曲げ、重みやラベルの編集",
      "PNG 画像、テキスト形式、位置や色まで残る JSON で書き出し",
    ],
    ogImage: "/brand/og-ja.png",
    keywords: [
      "グラフ理論",
      "グラフ 描画",
      "グラフ エディタ",
      "辺リスト",
      "隣接行列",
      "隣接リスト",
      "競技プログラミング",
      "木 可視化",
      "Graph Editor",
    ],
  },
  en: {
    title: "Graph Editor | Draw, arrange, and export graph theory diagrams",
    description:
      "Paste an edge list or adjacency matrix and get a graph instantly. Free browser-based graph theory editor with automatic layouts, edge bending, colours, and PNG/JSON export.",
    headline: "Graph theory diagrams, in the browser",
    tagline:
      "Paste an edge list, start from a sample, or draw directly. Built for competitive programming and lecture material.",
    features: [
      "Auto-detects edge lists, adjacency lists, adjacency matrices, and parent arrays",
      "12 automatic layouts: tree, DAG, bipartite, circle, grid, and more",
      "Node colours, edge bending, weights, and labels",
      "Export to PNG, text formats, or lossless JSON with positions and colours",
    ],
    ogImage: "/brand/og-en.png",
    keywords: [
      "graph theory",
      "graph editor",
      "graph drawing",
      "graph visualization",
      "edge list",
      "adjacency matrix",
      "adjacency list",
      "competitive programming",
      "tree visualizer",
    ],
  },
  "zh-Hans": {
    title: "Graph Editor | 在浏览器中绘制、排布并导出图论图形",
    description:
      "粘贴边列表或邻接矩阵即可生成图。免费的浏览器图论编辑器，支持自动布局、边弯曲、着色以及 PNG/JSON 导出。",
    headline: "在浏览器中绘制图论图形",
    tagline: "粘贴边列表、从示例开始，或直接绘制。适合算法竞赛和课程资料。",
    features: [
      "自动识别边列表、邻接表、邻接矩阵和父数组",
      "树、DAG、二分图、圆形、网格等 12 种自动布局",
      "顶点着色、边弯曲、权重与标签编辑",
      "导出 PNG、文本格式或包含位置与颜色的无损 JSON",
    ],
    ogImage: "/brand/og-zh-hans.png",
    keywords: [
      "图论",
      "图论 绘图",
      "图 编辑器",
      "边列表",
      "邻接矩阵",
      "邻接表",
      "算法竞赛",
      "树 可视化",
      "Graph Editor",
    ],
  },
} as const;

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;

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

export const appGuidePaths: Record<AppLocale, string> = {
  ja: "/guide",
  en: "/en/guide",
  "zh-Hans": "/zh-hans/guide",
};

export const appGuideLanguageAlternates: Record<string, string> = {
  ja: appGuidePaths.ja,
  en: appGuidePaths.en,
  "zh-Hans": appGuidePaths["zh-Hans"],
  "x-default": appGuidePaths[DEFAULT_APP_LOCALE],
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

/** Browser chrome colour follows the app theme tokens in globals.css. */
export const appViewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9fafb" },
    { media: "(prefers-color-scheme: dark)", color: "#17171a" },
  ],
  width: "device-width",
  initialScale: 1,
};

export const appRootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: APP_NAME,
  title: {
    default: APP_TITLE,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords: [...appLocaleMetadata.ja.keywords],
  authors: [{ name: AUTHOR_NAME, url: REPOSITORY_URL }],
  creator: AUTHOR_NAME,
  publisher: AUTHOR_NAME,
  category: "graph theory",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  // Search engine ownership is verified by dropping the provider's HTML file
  // into public/ (e.g. public/google1234abcd.html); no tokens or env vars.
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: FAVICON, sizes: "48x48 32x32 16x16", type: "image/x-icon" },
      { url: APP_ICON_48, sizes: "48x48", type: "image/png" },
      { url: APP_ICON_192, sizes: "192x192", type: "image/png" },
      { url: APP_ICON, sizes: "512x512", type: "image/png" },
    ],
    shortcut: [{ url: FAVICON, type: "image/x-icon" }],
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

export const appAuthorStructuredData = {
  "@type": "Person",
  name: AUTHOR_NAME,
  url: REPOSITORY_URL,
  sameAs: ["https://github.com/daikusutora3"],
} as const;

export function createAppStructuredData(locale: AppLocale) {
  const localeMetadata = appLocaleMetadata[locale];

  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${getAppLocaleUrl(locale)}#app`,
    name: APP_NAME,
    alternateName: "Graph Editor by daikusutora",
    applicationCategory: "DesignApplication",
    applicationSubCategory: "Graph theory diagram editor",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    isAccessibleForFree: true,
    url: getAppLocaleUrl(locale),
    image: `${SITE_URL}${localeMetadata.ogImage}`,
    screenshot: `${SITE_URL}${localeMetadata.ogImage}`,
    description: localeMetadata.description,
    inLanguage: locale,
    featureList: [...localeMetadata.features],
    license: "https://opensource.org/licenses/MIT",
    sameAs: [REPOSITORY_URL],
    author: appAuthorStructuredData,
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
    keywords: [...localeMetadata.keywords],
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
          url: localeMetadata.ogImage,
          width: OG_IMAGE_SIZE.width,
          height: OG_IMAGE_SIZE.height,
          alt: localeMetadata.headline,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: localeMetadata.title,
      description: localeMetadata.description,
      images: [localeMetadata.ogImage],
    },
  };
}

export function getAppGuideUrl(locale: AppLocale) {
  return getAppPathUrl(appGuidePaths[locale]);
}

export function createGuidePageMetadata(
  locale: AppLocale,
  copy: { title: string; description: string },
): Metadata {
  const alternateLocales = Object.values(appOpenGraphLocales).filter(
    (value) => value !== appOpenGraphLocales[locale],
  );

  return {
    title: { absolute: copy.title },
    description: copy.description,
    keywords: [...appLocaleMetadata[locale].keywords],
    alternates: {
      canonical: appGuidePaths[locale],
      languages: appGuideLanguageAlternates,
    },
    openGraph: {
      type: "article",
      locale: appOpenGraphLocales[locale],
      alternateLocale: alternateLocales,
      url: appGuidePaths[locale],
      siteName: APP_NAME,
      title: copy.title,
      description: copy.description,
      images: [
        {
          url: appLocaleMetadata[locale].ogImage,
          width: OG_IMAGE_SIZE.width,
          height: OG_IMAGE_SIZE.height,
          alt: appLocaleMetadata[locale].headline,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
      images: [appLocaleMetadata[locale].ogImage],
    },
  };
}
