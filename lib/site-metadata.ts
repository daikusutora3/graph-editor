export const SITE_URL = "https://graph-editor.daikusutora3.workers.dev";

export const APP_NAME = "Graph Editor";

export const APP_ICON = "/brand/graph-editor-logo.webp";
export const SOCIAL_IMAGE = APP_ICON;
export const APPLE_TOUCH_ICON = "/brand/graph-editor-logo-180.png";

export const appLocaleMetadata = {
  ja: {
    description:
      "ブラウザ上でグラフ理論の図を作成・編集・配置・書き出しできるアプリです。",
    title: `${APP_NAME} | グラフ理論の図をブラウザで作成`,
  },
  en: {
    description:
      "Create, edit, arrange, and export graph theory diagrams directly in the browser.",
    title: `${APP_NAME} | Graph theory diagrams in the browser`,
  },
  "zh-Hans": {
    description: "直接在浏览器中创建、编辑、排布并导出图论图形。",
    title: `${APP_NAME} | 在浏览器中绘制图论图形`,
  },
} as const;

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
