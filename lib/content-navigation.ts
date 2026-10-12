import type { AppLocale } from "./site-metadata";

/** Short labels used by both reading pages and the editor; no article prose. */
export const contentNavigationCopy = {
  ja: {
    guide: "ガイド",
    contents: "目次",
    articles: "記事",
    navigation: "ガイドと記事",
    languages: "表示言語",
    editor: "エディタを開く",
    lightTheme: "ライトモードに切り替え",
    darkTheme: "ダークモードに切り替え",
    relatedArticle: "この入力例を記事で読む",
    inputHelp: "入力形式をガイドで確認",
    newTab: "別タブで開きます",
  },
  en: {
    guide: "Guide",
    contents: "Contents",
    articles: "Articles",
    navigation: "Guide and articles",
    languages: "Language",
    editor: "Open editor",
    lightTheme: "Switch to light mode",
    darkTheme: "Switch to dark mode",
    relatedArticle: "Read about this example",
    inputHelp: "Check input formats in the guide",
    newTab: "Opens in a new tab",
  },
  "zh-Hans": {
    guide: "指南",
    contents: "目录",
    articles: "文章",
    navigation: "指南与文章",
    languages: "语言",
    editor: "打开编辑器",
    lightTheme: "切换到浅色模式",
    darkTheme: "切换到深色模式",
    relatedArticle: "阅读此示例的相关文章",
    inputHelp: "在指南中查看输入格式",
    newTab: "在新标签页中打开",
  },
} satisfies Record<AppLocale, unknown>;
