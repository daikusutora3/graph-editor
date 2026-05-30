import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_TITLE,
  SITE_URL,
  SOCIAL_IMAGE,
  appLanguageAlternates,
  appLocaleMetadata,
  appLocalePaths,
  createAppStructuredData,
  getAppLocaleUrl,
  getAppPathUrl,
  type AppLocale,
} from "../../lib/site-metadata";
import { createVerification } from "./harness";

const root = process.cwd();
const { expect, finish } = createVerification("Release");

function readText(path: string) {
  return readFileSync(join(root, path), "utf8");
}

function expectFile(path: string) {
  expect(existsSync(join(root, path)), `${path} should exist`);
}

for (const path of [
  "out/index.html",
  "out/en.html",
  "out/zh-hans.html",
  "out/404.html",
  "out/manifest.webmanifest",
  "out/robots.txt",
  "out/sitemap.xml",
  "out/_headers",
  "out/brand/graph-editor-logo.webp",
  "out/brand/graph-editor-logo-dark.webp",
  "out/brand/graph-editor-logo-180.png",
]) {
  expectFile(path);
}

const wrangler = readText("wrangler.jsonc");
expect(
  /"directory"\s*:\s*"\.\/out"/.test(wrangler),
  "wrangler.jsonc should serve ./out as static assets",
);
expect(
  /"not_found_handling"\s*:\s*"404-page"/.test(wrangler),
  "wrangler.jsonc should use the exported 404 page",
);

const indexHtml = readText("out/index.html");
expect(indexHtml.includes(APP_NAME), "out/index.html should include app name");
expect(
  indexHtml.includes(APP_TITLE),
  "out/index.html should include app title",
);
expect(
  indexHtml.includes(APP_DESCRIPTION),
  "out/index.html should include the public app description",
);
expect(
  indexHtml.includes(`property="og:locale" content="ja_JP"`),
  "out/index.html should set the root Open Graph locale",
);
expect(
  indexHtml.includes("og:locale:alternate"),
  "out/index.html should advertise alternate Open Graph locales",
);
expect(
  indexHtml.includes(`property="og:title" content="${APP_TITLE}"`),
  "out/index.html should keep Open Graph title aligned with public metadata",
);
expect(
  indexHtml.includes(`property="og:description" content="${APP_DESCRIPTION}"`),
  "out/index.html should keep Open Graph description aligned with public metadata",
);
expect(
  indexHtml.includes(`name="twitter:title" content="${APP_TITLE}"`),
  "out/index.html should keep Twitter title aligned with public metadata",
);
expect(
  indexHtml.includes(`name="twitter:description" content="${APP_DESCRIPTION}"`),
  "out/index.html should keep Twitter description aligned with public metadata",
);
expect(
  indexHtml.includes(SOCIAL_IMAGE),
  "out/index.html should include the social image",
);
expect(
  indexHtml.includes(createAppStructuredData("ja").description),
  "out/index.html should align JSON-LD description with public metadata",
);

const localeHtmlPaths: Record<AppLocale, string> = {
  ja: "out/index.html",
  en: "out/en.html",
  "zh-Hans": "out/zh-hans.html",
};

const localeOpenGraphLocales: Record<AppLocale, string> = {
  ja: "ja_JP",
  en: "en_US",
  "zh-Hans": "zh_CN",
};

for (const locale of Object.keys(localeHtmlPaths) as AppLocale[]) {
  const html = readText(localeHtmlPaths[locale]);
  const metadata = appLocaleMetadata[locale];
  const canonicalUrl = getAppLocaleUrl(locale);
  const structuredData = createAppStructuredData(locale);

  expect(
    html.includes(`<title>${metadata.title}</title>`),
    `${localeHtmlPaths[locale]} should include the localized title`,
  );
  expect(
    html.includes(`name="description" content="${metadata.description}"`),
    `${localeHtmlPaths[locale]} should include the localized description`,
  );
  expect(
    html.includes(`rel="canonical" href="${canonicalUrl}"`),
    `${localeHtmlPaths[locale]} should include the localized canonical URL`,
  );
  expect(
    html.includes(
      `property="og:locale" content="${localeOpenGraphLocales[locale]}"`,
    ),
    `${localeHtmlPaths[locale]} should include the localized Open Graph locale`,
  );
  expect(
    html.includes(
      `name="twitter:description" content="${metadata.description}"`,
    ),
    `${localeHtmlPaths[locale]} should include the localized Twitter description`,
  );
  expect(
    html.includes(`<html lang="${locale}" data-locale="${locale}"`),
    `${localeHtmlPaths[locale]} should include the localized html lang`,
  );
  expect(
    html.includes(`"description":"${structuredData.description}"`),
    `${localeHtmlPaths[locale]} should include the localized JSON-LD description`,
  );
  expect(
    html.includes(`"url":"${structuredData.url}"`),
    `${localeHtmlPaths[locale]} should include the localized JSON-LD URL`,
  );
  expect(
    html.includes(`"inLanguage":"${locale}"`),
    `${localeHtmlPaths[locale]} should include the localized JSON-LD language`,
  );
  expect(
    !html.includes("featureList"),
    `${localeHtmlPaths[locale]} should keep JSON-LD lean and avoid featureList drift`,
  );

  for (const [language, path] of Object.entries(appLanguageAlternates)) {
    const url = getAppPathUrl(path);
    expect(
      html.includes(`rel="alternate" hrefLang="${language}" href="${url}"`),
      `${localeHtmlPaths[locale]} should link the ${language} alternate URL`,
    );
  }
}

const manifest = JSON.parse(readText("out/manifest.webmanifest")) as {
  description?: string;
  name?: string;
  start_url?: string;
  icons?: unknown[];
};
expect(manifest.name === APP_NAME, "manifest should use the app name");
expect(
  manifest.description === APP_DESCRIPTION,
  "manifest should use the public app description",
);
expect(manifest.start_url === "/", "manifest should start at /");
expect(
  Array.isArray(manifest.icons) && manifest.icons.length >= 2,
  "manifest should include app icons",
);

const robots = readText("out/robots.txt");
expect(
  robots.includes(`${SITE_URL}/sitemap.xml`),
  "robots.txt should point to the public sitemap URL",
);
expect(
  robots.includes("User-Agent: *"),
  "robots.txt should include the default crawler rule",
);

const sitemap = readText("out/sitemap.xml");
expect(sitemap.includes(SITE_URL), "sitemap.xml should include SITE_URL");
for (const locale of Object.keys(appLocalePaths) as AppLocale[]) {
  expect(
    sitemap.includes(`<loc>${getAppLocaleUrl(locale)}</loc>`),
    `sitemap.xml should include the ${locale} URL`,
  );
}
for (const [language, path] of Object.entries(appLanguageAlternates)) {
  const url = getAppPathUrl(path);
  expect(
    sitemap.includes(`hreflang="${language}" href="${url}"`),
    `sitemap.xml should include the ${language} alternate URL`,
  );
}

const headers = readText("out/_headers");
expect(
  headers.includes("X-Content-Type-Options: nosniff"),
  "_headers should include nosniff",
);
expect(
  headers.includes(
    "Permissions-Policy: camera=(), microphone=(), geolocation=()",
  ),
  "_headers should keep browser capability restrictions",
);

finish();
