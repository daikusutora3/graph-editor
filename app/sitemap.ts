import type { MetadataRoute } from "next";

import {
  appLanguageAlternates,
  appLocalePaths,
  getAppLocaleUrl,
  getAppPathUrl,
  type AppLocale,
} from "@/lib/site-metadata";

export const dynamic = "force-static";

// Fixed at build time so every locale entry shares one timestamp.
const BUILD_DATE = new Date();

export default function sitemap(): MetadataRoute.Sitemap {
  return (Object.keys(appLocalePaths) as AppLocale[]).map((locale) => ({
    url: getAppLocaleUrl(locale),
    lastModified: BUILD_DATE,
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
