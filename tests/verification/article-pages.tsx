import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import JapaneseArticle, {
  generateMetadata as japaneseArticleMetadata,
  generateStaticParams as japaneseArticleParams,
} from "../../app/(ja)/articles/[slug]/page";
import JapaneseArticles, {
  metadata as japaneseIndexMetadata,
} from "../../app/(ja)/articles/page";
import LocalizedArticle, {
  generateMetadata as localizedArticleMetadata,
  generateStaticParams as localizedArticleParams,
} from "../../app/[locale]/articles/[slug]/page";
import LocalizedArticles, {
  generateMetadata as localizedIndexMetadata,
  generateStaticParams as localizedIndexParams,
} from "../../app/[locale]/articles/page";
import { ArticleIndexPage } from "../../app/articles/ArticleIndexPage";
import { ArticlePage } from "../../app/articles/ArticlePage";
import { GuidePage } from "../../app/guide/GuidePage";
import sitemap from "../../app/sitemap";
import {
  articleCopy,
  articleIndexPath,
  articlePath,
  articleSlugs,
  getArticles,
} from "../../lib/article-content";
import {
  appGuidePaths,
  appLocalePaths,
  appRouteLocaleParams,
  createArticleIndexMetadata,
  createArticlePageMetadata,
  getAppArticleUrl,
  getAppLocaleFromParam,
  getAppPathUrl,
  type AppLocale,
} from "../../lib/site-metadata";

const locales: readonly AppLocale[] = ["ja", "en", "zh-Hans"];
for (const slug of articleSlugs) {
  const screenshot = readFileSync(
    new URL(
      `../../public/articles/screenshots/${slug}-mobile.jpg`,
      import.meta.url,
    ),
  );
  assert.equal(screenshot.readUInt16BE(0), 0xffd8, `${slug}: valid JPEG start`);
  assert.equal(
    screenshot.readUInt16BE(screenshot.length - 2),
    0xffd9,
    `${slug}: complete JPEG image`,
  );
}
const sitemapEntries = sitemap();
assert.equal(sitemapEntries.length, 24);
assert.equal(new Set(sitemapEntries.map((entry) => entry.url)).size, 24);
const escaped = (text: string) =>
  renderToStaticMarkup(<Fragment>{text}</Fragment>);
const attribute = (tag: string, name: string) =>
  tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

function markupContract(html: string, context: string) {
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  const tags = [...markup.matchAll(/<[a-z][^>]*>/gi)].map((match) => match[0]);
  const ids = tags.flatMap((tag) => {
    const id = attribute(tag, "id");
    return id ? [id] : [];
  });
  const idSet = new Set(ids);
  assert.equal(idSet.size, ids.length, `${context}: markup IDs are unique`);
  assert.equal(tags.filter((tag) => /^<h1\b/.test(tag)).length, 1);
  for (const tag of tags) {
    const href = attribute(tag, "href");
    if (href?.startsWith("#")) {
      assert(idSet.has(href.slice(1)), `${context}: ${href} reaches a heading`);
    }
    for (const id of (attribute(tag, "aria-labelledby") ?? "")
      .split(/\s+/)
      .filter(Boolean)) {
      assert(idSet.has(id), `${context}: accessible heading ${id} exists`);
    }
    if (/^<a\b/.test(tag)) {
      assert(
        !/text-(?:blue|indigo|cyan|sky)-|text-\[var\(--accent[^)]*\)\]/.test(
          attribute(tag, "class") ?? "",
        ),
        `${context}: links use neutral reading colors`,
      );
    }
  }
  assert(
    tags.some(
      (tag) =>
        /^<main\b/.test(tag) && attribute(tag, "data-reading") !== undefined,
    ),
    `${context}: the reading style scope is present`,
  );
  const json = html.match(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
  )?.[1];
  assert(json, `${context}: server-rendered structured data is present`);
  return {
    markup,
    tags,
    ids: idSet,
    data: JSON.parse(json) as
      Record<string, unknown> | Record<string, unknown>[],
  };
}

assert.deepEqual(
  japaneseArticleParams(),
  articleSlugs.map((slug) => ({ slug })),
  "Japanese article static routes cover every published slug",
);
assert.deepEqual(
  localizedArticleParams(),
  appRouteLocaleParams.flatMap((locale) =>
    articleSlugs.map((slug) => ({ locale, slug })),
  ),
  "Localized article static routes cover both route locales and every slug",
);
assert.deepEqual(
  localizedIndexParams(),
  appRouteLocaleParams.map((locale) => ({ locale })),
);
assert.deepEqual(
  japaneseIndexMetadata,
  createArticleIndexMetadata("ja", articleCopy.ja),
);

for (const locale of locales) {
  const copy = articleCopy[locale];
  const articles = getArticles(locale);
  const indexMetadata = createArticleIndexMetadata(locale, copy);
  assert.equal(indexMetadata.alternates?.canonical, articleIndexPath(locale));
  assert.equal(indexMetadata.description, copy.description);
  for (const language of locales) {
    assert.equal(
      indexMetadata.alternates?.languages?.[language],
      articleIndexPath(language),
    );
  }
  const sitemapIndex = sitemapEntries.find(
    (entry) => entry.url === getAppArticleUrl(locale),
  );
  assert(sitemapIndex);
  for (const language of locales) {
    assert.equal(
      sitemapIndex.alternates?.languages?.[language],
      getAppPathUrl(articleIndexPath(language)),
    );
  }
  const index = markupContract(
    renderToStaticMarkup(<ArticleIndexPage locale={locale} />),
    `${locale} index`,
  );
  const guide = markupContractForGuide(
    renderToStaticMarkup(<GuidePage locale={locale} />),
  );
  assert(index.markup.includes(escaped(copy.heading)));
  assert(index.markup.includes(escaped(copy.indexIntro)));
  assert(
    index.tags.some(
      (tag) =>
        attribute(tag, "href") === articleIndexPath(locale) &&
        attribute(tag, "aria-current") === "page",
    ),
    `${locale}: the current reading section is identified`,
  );
  assert(!Array.isArray(index.data));
  assert.equal(index.data["@type"], "ItemList");
  assert.equal(
    (index.data.itemListElement as unknown[]).length,
    articleSlugs.length,
  );
  for (const article of articles) {
    const context = `${locale} ${article.slug}`;
    const sitemapArticle = sitemapEntries.find(
      (entry) => entry.url === getAppArticleUrl(locale, article.slug),
    );
    assert(sitemapArticle);
    for (const language of locales) {
      assert.equal(
        sitemapArticle.alternates?.languages?.[language],
        getAppArticleUrl(language, article.slug),
      );
    }
    assert(index.markup.includes(escaped(article.title)));
    assert(
      index.markup.includes(`href="${articlePath(locale, article.slug)}"`),
    );
    const view = markupContract(
      renderToStaticMarkup(<ArticlePage locale={locale} article={article} />),
      context,
    );
    assert(view.markup.includes(escaped(article.title)));
    assert(view.markup.includes(escaped(article.introduction)));
    for (const section of article.sections) {
      assert(
        view.ids.has(section.id),
        `${context}: ${section.id} is reachable`,
      );
      assert(view.markup.includes(escaped(section.title)));
      for (const paragraph of section.paragraphs) {
        assert(view.markup.includes(escaped(paragraph)));
      }
      for (const point of section.points ?? []) {
        assert(view.markup.includes(escaped(point)));
      }
    }
    assert(
      view.markup.includes(`<code>${escaped(article.example.input)}</code>`),
      `${context}: the full usable example is readable without JavaScript`,
    );
    const copyButton = view.tags.find(
      (tag) =>
        /^<button\b/.test(tag) &&
        attribute(tag, "aria-label") ===
          escaped(`${copy.copy}: ${article.title}`),
    );
    assert(copyButton, `${context}: the copy action names the correct example`);
    assert(/min-h-11/.test(attribute(copyButton, "class") ?? ""));
    for (const target of [
      article.guide.sectionId,
      article.canonicalGuideExampleId,
    ].filter(Boolean)) {
      assert(
        guide.ids.has(target!),
        `${context}: guide destination ${target} exists`,
      );
      assert(
        view.markup.includes(`href="${appGuidePaths[locale]}#${target}"`),
        `${context}: the guide link reaches the matching operation or example`,
      );
    }
    const exampleLink = view.tags.find(
      (tag) => attribute(tag, "href") === appLocalePaths[locale],
    );
    assert(exampleLink, `${context}: the example can be opened in the editor`);
    assert(
      !view.markup.includes("?example="),
      `${context}: articles use the ordinary editor`,
    );
    assert(
      view.tags.some(
        (tag) =>
          /^<img\b/.test(tag) &&
          (attribute(tag, "src") ?? "").includes(`${article.slug}.png`),
      ),
      `${context}: an actual application screenshot accompanies the article`,
    );
    assert(
      view.tags.some(
        (tag) =>
          /^<img\b/.test(tag) &&
          attribute(tag, "src") ===
            `/articles/screenshots/${article.slug}-mobile.jpg` &&
          attribute(tag, "loading") === "lazy" &&
          Boolean(attribute(tag, "alt")),
      ),
      `${context}: the mobile application screenshot is described and lazy loaded`,
    );
    for (const language of locales) {
      assert(
        view.markup.includes(`href="${articlePath(language, article.slug)}"`),
        `${context}: language switching keeps the same article`,
      );
    }
    for (const related of article.relatedSlugs) {
      assert(view.markup.includes(`href="${articlePath(locale, related)}"`));
    }
    assert(
      view.tags.some(
        (tag) =>
          /^<(?:img|svg)\b/.test(tag) &&
          (attribute(tag, "alt") === escaped(article.example.result) ||
            attribute(tag, "aria-label") === escaped(article.example.result)),
      ),
      `${context}: the example diagram has a localized description`,
    );
    assert(Array.isArray(view.data));
    const structuredArticle = view.data.find(
      (entry) => entry["@type"] === "TechArticle",
    );
    assert.equal(
      structuredArticle?.url,
      getAppArticleUrl(locale, article.slug),
    );
    assert.equal(structuredArticle?.headline, article.title);
    assert.equal(structuredArticle?.inLanguage, locale);
    const metadata = createArticlePageMetadata(locale, article);
    assert.equal(metadata.description, article.description);
    assert.equal(metadata.openGraph?.url, articlePath(locale, article.slug));
    assert.equal(
      metadata.alternates?.canonical,
      articlePath(locale, article.slug),
    );
    for (const language of locales) {
      assert.equal(
        metadata.alternates?.languages?.[language],
        articlePath(language, article.slug),
      );
    }
    assert.equal(
      metadata.alternates?.languages?.["x-default"],
      articlePath("ja", article.slug),
    );
  }
}

// Exercise the route components too: locale route parameters must map to the
// same localized content and metadata that direct server rendering produces.
assert(
  renderToStaticMarkup(<JapaneseArticles />).includes(
    escaped(articleCopy.ja.heading),
  ),
);
await Promise.all(
  articleSlugs.map(async (slug) => {
    const props = { params: Promise.resolve({ slug }) };
    const [metadata, page] = await Promise.all([
      japaneseArticleMetadata(props),
      JapaneseArticle(props),
    ]);
    assert.equal(metadata.alternates?.canonical, articlePath("ja", slug));
    assert(renderToStaticMarkup(page).includes(`href="${appLocalePaths.ja}"`));
  }),
);
await Promise.all(
  appRouteLocaleParams.map(async (routeLocale) => {
    const locale = getAppLocaleFromParam(routeLocale);
    const props = { params: Promise.resolve({ locale: routeLocale }) };
    const [metadata, page] = await Promise.all([
      localizedIndexMetadata(props),
      LocalizedArticles(props),
    ]);
    assert.equal(metadata.alternates?.canonical, articleIndexPath(locale));
    assert(
      renderToStaticMarkup(page).includes(escaped(articleCopy[locale].heading)),
    );
    await Promise.all(
      articleSlugs.map(async (slug) => {
        const articleProps = {
          params: Promise.resolve({ locale: routeLocale, slug }),
        };
        const [articleMetadata, articlePage] = await Promise.all([
          localizedArticleMetadata(articleProps),
          LocalizedArticle(articleProps),
        ]);
        assert.equal(
          articleMetadata.alternates?.canonical,
          articlePath(locale, slug),
        );
        assert(
          renderToStaticMarkup(articlePage).includes(
            `href="${appLocalePaths[locale]}"`,
          ),
        );
      }),
    );
  }),
);

function markupContractForGuide(html: string) {
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  const ids = new Set(
    [...markup.matchAll(/<[a-z][^>]*>/gi)].flatMap(([tag]) => {
      const id = attribute(tag, "id");
      return id ? [id] : [];
    }),
  );
  return { ids };
}

console.log(
  "Articles: 18 localized static pages, SSR content, reachable guide links, accessible examples and metadata passed",
);
