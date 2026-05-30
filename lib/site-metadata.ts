export const SITE_URL = "https://graph-editor.daikusutora3.workers.dev";

export const APP_NAME = "Graph Editor";
export const APP_TITLE = `${APP_NAME} | グラフ理論の図をブラウザで作成`;
export const APP_DESCRIPTION =
  "Create, edit, arrange, and export graph theory diagrams directly in the browser.";
export const APP_DESCRIPTION_JA =
  "ブラウザ上でグラフ理論の図を作成・編集・配置・書き出しできるアプリです。";
export const APP_DESCRIPTION_ZH_HANS =
  "直接在浏览器中创建、编辑、排布并导出图论图形。";

export const SOCIAL_IMAGE = "/brand/graph-editor-logo.webp";
export const APPLE_TOUCH_ICON = "/brand/graph-editor-logo-180.png";

export const appLocaleMetadata = {
  ja: {
    description: APP_DESCRIPTION_JA,
    title: APP_TITLE,
  },
  en: {
    description: APP_DESCRIPTION,
    title: `${APP_NAME} | Graph theory diagrams in the browser`,
  },
  "zh-Hans": {
    description: APP_DESCRIPTION_ZH_HANS,
    title: `${APP_NAME} | 在浏览器中绘制图论图形`,
  },
} as const;

export const structuredData = {
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
} as const;
