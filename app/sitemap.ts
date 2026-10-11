import type { MetadataRoute } from "next";

import {
  ARTICLES_LAST_MODIFIED,
  GUIDE_LAST_MODIFIED,
  HOME_LAST_MODIFIED,
} from "@/lib/content-dates";
import { articleSlugs } from "@/lib/article-examples";
import {
  appGuideLanguageAlternates,
  appLanguageAlternates,
  getAppGuideUrl,
  appLocalePaths,
  getAppLocaleUrl,
  getAppPathUrl,
  getAppArticleUrl,
  getAppArticleLanguageAlternates,
  type AppLocale,
} from "@/lib/site-metadata";

export const dynamic = "force-static";

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
      lastModified: HOME_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: locale === "ja" ? 1 : 0.9,
      alternates: { languages: toAbsolute(appLanguageAlternates) },
    })),
    ...locales.map((locale) => ({
      url: getAppGuideUrl(locale),
      lastModified: GUIDE_LAST_MODIFIED,
      changeFrequency: "monthly" as const,
      priority: 0.7,
      alternates: { languages: toAbsolute(appGuideLanguageAlternates) },
    })),
    ...locales.flatMap((locale) => [
      {
        url: getAppArticleUrl(locale),
        lastModified: ARTICLES_LAST_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.7,
        alternates: {
          languages: toAbsolute(getAppArticleLanguageAlternates()),
        },
      },
      ...articleSlugs.map((slug) => ({
        url: getAppArticleUrl(locale, slug),
        lastModified: ARTICLES_LAST_MODIFIED,
        changeFrequency: "monthly" as const,
        priority: 0.6,
        alternates: {
          languages: toAbsolute(getAppArticleLanguageAlternates(slug)),
        },
      })),
    ]),
  ];
}
