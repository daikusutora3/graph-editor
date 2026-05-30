export const SUPPORTED_LOCALES = ["ja", "en", "zh-Hans"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "ja";
export const LOCALE_STORAGE_KEY = "graph-editor-locale";

export const LOCALE_ALIASES: Record<string, Locale> = {
  ja: "ja",
  "ja-jp": "ja",
  en: "en",
  "en-us": "en",
  "en-gb": "en",
  zh: "zh-Hans",
  "zh-cn": "zh-Hans",
  "zh-hans": "zh-Hans",
  "zh-sg": "zh-Hans",
};

export function toLocale(value: string | null | undefined): Locale | null {
  if (!value) {
    return null;
  }

  return LOCALE_ALIASES[value.toLowerCase()] ?? null;
}

export function detectBrowserLocale(
  languages: readonly string[] | undefined,
): Locale {
  for (const language of languages ?? []) {
    const locale = toLocale(language);
    if (locale) {
      return locale;
    }
  }

  return DEFAULT_LOCALE;
}

export const localeLabels: Record<Locale, string> = {
  ja: "日本語",
  en: "English",
  "zh-Hans": "简体中文",
};
