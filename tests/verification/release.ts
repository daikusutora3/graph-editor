import {
  HEADERS_LINE_LIMIT,
  collectPageScriptHashes,
  parseHeaderRules,
  resolveHeaders,
} from "../../scripts/build-headers";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";

import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_TITLE,
  SITE_URL,
  SOCIAL_IMAGE,
  appLanguageAlternates,
  appLocaleMetadata,
  appLocalePaths,
  appGuidePaths,
  createAppStructuredData,
  getAppGuideUrl,
  getAppLocaleUrl,
  getAppPathUrl,
  getAppArticleUrl,
  getAppArticleLanguageAlternates,
  type AppLocale,
} from "../../lib/site-metadata";
import {
  GUIDE_LAST_MODIFIED,
  HOME_LAST_MODIFIED,
  ARTICLES_LAST_MODIFIED,
  ARTICLES_PUBLISHED_DATE,
  toIsoDate,
} from "../../lib/content-dates";
import {
  articleCopy,
  articleIndexPath,
  articlePath,
  getArticles,
} from "../../lib/article-content";
import { createVerification } from "./harness";

const root = process.cwd();
const { expect, finish } = createVerification("Release");
const locales = Object.keys(appLocalePaths) as AppLocale[];
const articleRoutes = locales.flatMap((locale) => [
  articleIndexPath(locale),
  ...getArticles(locale).map((article) => articlePath(locale, article.slug)),
]);
const escaped = (text: string) =>
  renderToStaticMarkup(createElement(Fragment, null, text));

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
  ...articleRoutes.map((route) => `out${route}.html`),
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

const exportedKernelPath = `out${RUST_KERNEL_URL}`;
const publicKernelPath = `public${RUST_KERNEL_URL}`;
expectFile(exportedKernelPath);
expectFile(publicKernelPath);
if (
  existsSync(join(root, exportedKernelPath)) &&
  existsSync(join(root, publicKernelPath))
) {
  const exportedKernel = readFileSync(join(root, exportedKernelPath));
  const publicKernel = readFileSync(join(root, publicKernelPath));
  const contentHash = createHash("sha256")
    .update(exportedKernel)
    .digest("hex")
    .slice(0, 16);
  expect(
    WebAssembly.validate(exportedKernel),
    "the exported Rust kernel should be a valid Wasm module",
  );
  expect(
    exportedKernel.equals(publicKernel),
    "the exported Wasm should match the public artifact requested by the runtime",
  );
  expect(
    RUST_KERNEL_URL === `/wasm/graph-kernels.${contentHash}.wasm`,
    "the exported Wasm URL should fingerprint its contents for immutable caching",
  );
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
  // featureList is generated from the same copy the intro renders, so it can
  // never drift from the page text.
  expect(
    html.includes(
      `"featureList":${JSON.stringify(appLocaleMetadata[locale].features)}`,
    ),
    `${localeHtmlPaths[locale]} JSON-LD featureList should match the intro features`,
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
const sitemapUrls = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map(
  ([, entry]) => entry ?? "",
);
expect(
  sitemapUrls.length === 24 &&
    new Set(sitemapUrls.map((entry) => entry.match(/<loc>(.*?)<\/loc>/)?.[1]))
      .size === 24,
  "sitemap.xml should contain 24 distinct editor, guide and article URLs",
);
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

const articleLastModified = new Set<string>();
for (const locale of locales) {
  const indexPath = `out${articleIndexPath(locale)}.html`;
  const index = readText(indexPath);
  const copy = articleCopy[locale];
  expect(
    index.includes(`<title>${escaped(copy.title)}</title>`) &&
      index.includes(
        `name="description" content="${escaped(copy.description)}"`,
      ) &&
      index.includes(`rel="canonical" href="${getAppArticleUrl(locale)}"`) &&
      index.includes(
        `property="og:locale" content="${localeOpenGraphLocales[locale]}"`,
      ) &&
      index.includes(`property="og:type" content="website"`) &&
      index.includes(`<html lang="${locale}" data-locale="${locale}"`),
    `${indexPath} should have localized article index metadata and language`,
  );
  expect(
    index.includes(escaped(copy.heading)) &&
      index.includes(escaped(copy.indexIntro)) &&
      index.includes('"@type":"ItemList"'),
    `${indexPath} should prerender the index introduction and article list`,
  );
  for (const article of getArticles(locale)) {
    const page = `out${articlePath(locale, article.slug)}.html`;
    const html = readText(page);
    expect(
      index.includes(`href="${articlePath(locale, article.slug)}"`) &&
        index.includes(escaped(article.title)),
      `${indexPath} should link to the localized ${article.slug} article`,
    );
    expect(
      html.includes(
        `<title>${escaped(`${article.title} | ${APP_NAME}`)}</title>`,
      ) &&
        html.includes(
          `name="description" content="${escaped(article.description)}"`,
        ) &&
        html.includes(
          `rel="canonical" href="${getAppArticleUrl(locale, article.slug)}"`,
        ) &&
        html.includes(
          `property="og:locale" content="${localeOpenGraphLocales[locale]}"`,
        ) &&
        html.includes(`property="og:type" content="article"`) &&
        html.includes(`<html lang="${locale}" data-locale="${locale}"`),
      `${page} should include localized article metadata, canonical URL and language`,
    );
    expect(
      html.includes(escaped(article.introduction)) &&
        article.sections.every(
          (section) =>
            html.includes(`id="${section.id}"`) &&
            section.paragraphs.every((paragraph) =>
              html.includes(escaped(paragraph)),
            ),
        ) &&
        html.includes(`<code>${escaped(article.example.input)}</code>`) &&
        html.includes(
          `href="${appGuidePaths[locale]}#${article.guide.sectionId}"`,
        ),
      `${page} should prerender the content, usable example and exact guide destination`,
    );
    expect(
      html.includes(`href="${appLocalePaths[locale]}"`),
      `${page} should link to the ordinary editor`,
    );
    const structured = [
      ...html.matchAll(
        /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
      ),
    ].flatMap(([, body]) => {
      const value = JSON.parse(body ?? "null") as
        Record<string, unknown> | Record<string, unknown>[];
      return Array.isArray(value) ? value : [value];
    });
    const structuredArticle = structured.find(
      (entry) => entry?.["@type"] === "TechArticle",
    );
    expect(
      structuredArticle?.url === getAppArticleUrl(locale, article.slug) &&
        structuredArticle?.headline === article.title &&
        structuredArticle?.inLanguage === locale &&
        structuredArticle?.datePublished === ARTICLES_PUBLISHED_DATE &&
        structuredArticle?.dateModified === toIsoDate(ARTICLES_LAST_MODIFIED),
      `${page} should carry dated TechArticle data aligned with its visible content`,
    );
  }

  for (const slug of [
    undefined,
    ...getArticles(locale).map((article) => article.slug),
  ]) {
    const route = `${articleIndexPath(locale)}${slug ? `/${slug}` : ""}`;
    const page = `out${route}.html`;
    const html = readText(page);
    const url = getAppArticleUrl(locale, slug);
    const entry = sitemapUrls.find((value) =>
      value.includes(`<loc>${url}</loc>`),
    );
    expect(Boolean(entry), `sitemap.xml should list ${url}`);
    const modified = entry?.match(/<lastmod>(.*?)<\/lastmod>/)?.[1];
    if (modified) articleLastModified.add(modified);
    expect(
      Boolean(modified) &&
        !Number.isNaN(new Date(modified!).getTime()) &&
        toIsoDate(new Date(modified!)) === toIsoDate(ARTICLES_LAST_MODIFIED),
      `sitemap.xml should carry the content modification date for ${url}`,
    );
    for (const [language, alternatePath] of Object.entries(
      getAppArticleLanguageAlternates(slug),
    )) {
      const alternateUrl = getAppPathUrl(alternatePath);
      expect(
        html.includes(
          `rel="alternate" hrefLang="${language}" href="${alternateUrl}"`,
        ) &&
          entry?.includes(`hreflang="${language}" href="${alternateUrl}"`) ===
            true,
        `${page} and sitemap.xml should agree on the ${language} alternate`,
      );
    }
  }
}
expect(
  articleLastModified.size === 1,
  "All article sitemap entries should use the same content modification date",
);

for (const [locale, page] of [
  ["ja", "out/index.html"],
  ["en", "out/en.html"],
  ["zh-Hans", "out/zh-hans.html"],
] as const) {
  const html = readText(page);
  expect(
    html.includes("<h1") && html.includes(APP_NAME),
    `${page} should prerender the app heading`,
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
expect(
  sitemap.includes(`<lastmod>${HOME_LAST_MODIFIED.toISOString()}</lastmod>`) &&
    sitemap.includes(`<lastmod>${GUIDE_LAST_MODIFIED.toISOString()}</lastmod>`),
  "sitemap.xml lastmod should come from the content commit dates, not the build clock",
);
for (const page of ["out/guide.html", "out/en/guide.html"]) {
  const html = readText(page);
  expect(
    html.includes('"@type":"TechArticle"') && html.includes('"dateModified":"'),
    `${page} should carry dated TechArticle structured data`,
  );
}
{
  const redirects = readText("out/_redirects");
  for (const path of ["/en", "/guide", "/en/guide", "/zh-hans/guide"]) {
    expect(
      redirects.includes(`${path}/ ${path} 301`),
      `_redirects should permanently redirect ${path}/ to ${path}`,
    );
  }
  for (const route of articleRoutes) {
    expect(
      redirects.includes(`${route}.html ${route} 301`) &&
        redirects.includes(`${route}/ ${route} 301`),
      `_redirects should consolidate HTML and trailing-slash variants for ${route}`,
    );
  }
}

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
  expect(
    articleRoutes.every((route) => pages.some((page) => page.route === route)),
    "Generated page CSP rules should cover all 18 article routes",
  );
  const kernelHeaders = resolveHeaders(rules, RUST_KERNEL_URL);
  expect(
    kernelHeaders.get("content-type") === "application/wasm",
    "the exported Wasm should be served with the WebAssembly MIME type",
  );
  expect(
    kernelHeaders.get("cache-control") ===
      "public, max-age=31536000, immutable",
    "the content-addressed Wasm should retain one-year immutable caching",
  );
  expect(
    pages.every((page) =>
      cspOf(page.route)
        .split(";")
        .find((directive) => directive.trim().startsWith("script-src "))
        ?.split(/\s+/)
        .includes("'wasm-unsafe-eval'"),
    ),
    "every exported page's script CSP should allow WebAssembly compilation",
  );
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
    cspOf("/404").includes("script-src 'self'") &&
      resolveHeaders(rules, "/missing-page").get("x-frame-options") === "DENY",
    "the 404 page should carry a CSP and unknown paths the other headers",
  );
  expect(
    headers.split("\n").filter((line) => line.startsWith("/*")).length === 1 &&
      !headers.includes("! Content-Security-Policy"),
    "_headers must not layer two Content-Security-Policy rules on one path",
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
