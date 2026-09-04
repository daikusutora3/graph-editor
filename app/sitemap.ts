import type { MetadataRoute } from "next";

import {
  appGuideLanguageAlternates,
  appLanguageAlternates,
  getAppGuideUrl,
  appLocalePaths,
  getAppLocaleUrl,
  getAppPathUrl,
  type AppLocale,
} from "@/lib/site-metadata";

export const dynamic = "force-static";

// Fixed at build time so every locale entry shares one timestamp.
const BUILD_DATE = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = Object.keys(appLocalePaths) as AppLocale[];
  const toAbsolute = (alternates: Record<string, string>) =>
    Object.fromEntries(
      Object.entries(alternates).map(([language, path]) => [
        language,
        getAppPathUrl(path),
      ]),
    );

  return [
    ...locales.map((locale) => ({
      url: getAppLocaleUrl(locale),
      lastModified: BUILD_DATE,
      changeFrequency: "monthly" as const,
      priority: locale === "ja" ? 1 : 0.9,
      alternates: { languages: toAbsolute(appLanguageAlternates) },
    })),
    ...locales.map((locale) => ({
      url: getAppGuideUrl(locale),
      lastModified: BUILD_DATE,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: { languages: toAbsolute(appGuideLanguageAlternates) },
    })),
  ];
}
