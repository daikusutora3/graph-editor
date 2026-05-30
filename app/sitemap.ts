import type { MetadataRoute } from "next";

import {
  appLanguageAlternates,
  appLocalePaths,
  getAppLocaleUrl,
  getAppPathUrl,
  type AppLocale,
} from "@/lib/site-metadata";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return (Object.keys(appLocalePaths) as AppLocale[]).map((locale) => ({
    url: getAppLocaleUrl(locale),
    changeFrequency: "monthly",
    priority: locale === "ja" ? 1 : 0.9,
    alternates: {
      languages: Object.fromEntries(
        Object.entries(appLanguageAlternates).map(([language, path]) => [
          language,
          getAppPathUrl(path),
        ]),
      ),
    },
  }));
}
