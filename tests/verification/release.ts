import {
  HEADERS_LINE_LIMIT,
  collectPageScriptHashes,
  parseHeaderRules,
  resolveHeaders,
} from "../../scripts/build-headers";
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
  getAppGuideUrl,
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
  "out/guide.html",
  "out/en/guide.html",
  "out/zh-hans/guide.html",
  "out/_redirects",
  // Search Console ownership; deleting it revokes the property.
  "out/googleca089be2699caf14.html",
  "out/manifest.webmanifest",
  "out/robots.txt",
  "out/sitemap.xml",
  "out/_headers",
  "out/brand/graph-editor-logo.webp",
  "out/brand/graph-editor-logo-dark.webp",
  "out/brand/graph-editor-logo-180.png",
  "out/brand/graph-editor-logo-48.png",
  "out/brand/graph-editor-logo-192.png",
  "out/brand/graph-editor-logo-512.png",
  "out/favicon.ico",
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
  /<link rel="icon" href="\/favicon\.ico"[^>]*type="image\/x-icon"/.test(
    indexHtml,
  ) &&
    /<link rel="icon" href="\/brand\/graph-editor-logo-192\.png"[^>]*type="image\/png"/.test(
      indexHtml,
    ) &&
    !/<link rel="(?:shortcut )?icon"[^>]*image\/webp/.test(indexHtml),
  "out/index.html should expose PNG/ICO favicons (search engines skip WebP)",
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

for (const [locale, page] of [
  ["ja", "out/index.html"],
  ["en", "out/en.html"],
  ["zh-Hans", "out/zh-hans.html"],
] as const) {
  const html = readText(page);
  expect(
    html.includes("<h1") && html.includes(appLocaleMetadata[locale].headline),
    `${page} should prerender the intro heading for crawlers`,
  );
  expect(
    html.includes(`content="${SITE_URL}${appLocaleMetadata[locale].ogImage}"`),
    `${page} should reference its 1200x630 social image`,
  );
  expect(
    html.includes('name="twitter:card" content="summary_large_image"'),
    `${page} should use the large summary card`,
  );
}

{
  const llms = readFileSync("out/llms.txt");
  const decoded = new TextDecoder("utf-8", { fatal: true }).decode(llms);
  expect(
    decoded.startsWith("# Graph Editor") && decoded.includes(SITE_URL),
    "out/llms.txt should be valid UTF-8 and describe the app",
  );
  expect(
    !llms.subarray(0, 3).equals(Buffer.from([0xef, 0xbb, 0xbf])),
    "out/llms.txt should not carry a BOM",
  );
}

for (const [locale, page] of [
  ["ja", "out/guide.html"],
  ["en", "out/en/guide.html"],
  ["zh-Hans", "out/zh-hans/guide.html"],
] as const) {
  const html = readText(page);
  expect(
    html.includes('"@type":"FAQPage"') &&
      html.includes('"@type":"BreadcrumbList"'),
    `${page} should carry FAQ and breadcrumb structured data`,
  );
  expect(
    html.includes(`<link rel="canonical" href="${getAppGuideUrl(locale)}"`),
    `${page} should declare its canonical guide URL`,
  );
}
expect(
  readText("out/sitemap.xml").includes(getAppGuideUrl("en")),
  "sitemap.xml should list the guide pages",
);

const headers = readText("out/_headers");
expect(
  headers.includes("X-Content-Type-Options: nosniff"),
  "_headers should include nosniff",
);
{
  const rules = parseHeaderRules(headers);
  const cspOf = (path: string) =>
    resolveHeaders(rules, path).get("content-security-policy") ?? "";
  const pages = collectPageScriptHashes();
  const missing = pages.flatMap((page) => {
    const csp = cspOf(page.route);
    return page.hashes.filter((hash) => !csp.includes(hash));
  });
  const longest = Math.max(...headers.split("\n").map((line) => line.length));
  expect(
    pages.length >= 7 && !headers.includes("__INLINE_SCRIPT_HASHES__"),
    "_headers should carry generated Content-Security-Policy rules",
  );
  expect(
    missing.length === 0,
    `every inline script must be allow-listed in its page's CSP (${missing.length} missing)`,
  );
  expect(
    pages.every((page) => !cspOf(page.route).includes(", ")),
    "each page should receive exactly one Content-Security-Policy",
  );
  expect(
    cspOf("/missing-page") === cspOf("/404"),
    "unknown paths should get the 404 page's CSP",
  );
  expect(
    longest <= HEADERS_LINE_LIMIT,
    `_headers lines must stay within Cloudflare's ${HEADERS_LINE_LIMIT} character limit (longest ${longest})`,
  );
  expect(
    headers.includes("/llms.txt\n  Content-Type: text/plain; charset=utf-8"),
    "_headers should serve llms.txt as UTF-8 text",
  );
  expect(
    headers.includes("X-Frame-Options: DENY") &&
      pages.every((page) =>
        cspOf(page.route).includes("frame-ancestors 'none'"),
      ),
    "_headers should block framing",
  );
}
expect(
  headers.includes(
    "Permissions-Policy: camera=(), microphone=(), geolocation=()",
  ),
  "_headers should keep browser capability restrictions",
);

finish();
