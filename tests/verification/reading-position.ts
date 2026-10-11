import {
  isArticleReadingPath,
  parseReadingPosition,
  readingRestoreKey,
  readingReturnKey,
} from "../../lib/reading-position";
import type { AppLocale } from "../../lib/site-metadata";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Article reading positions");
const validRoutes: Record<AppLocale, string> = {
  ja: "/articles",
  en: "/en/articles",
  "zh-Hans": "/zh-hans/articles",
};
const slugs = [
  "edge-list",
  "adjacency-matrix",
  "tree-layout",
  "tikz-export",
  "bipartite-graph",
];

for (const [locale, indexPath] of Object.entries(validRoutes) as [
  AppLocale,
  string,
][]) {
  expect(isArticleReadingPath(indexPath, locale), `${locale} index is valid`);
  for (const slug of slugs) {
    const path = `${indexPath}/${slug}`;
    const position = parseReadingPosition(
      JSON.stringify({ path, section: "article-example", scrollY: 542.5 }),
      locale,
    );
    expect(
      position?.path === path &&
        position.section === "article-example" &&
        position.scrollY === 542.5,
      `${locale}/${slug} retains the specific article, section and scroll offset`,
    );
  }
  const zeroPosition = parseReadingPosition(
    JSON.stringify({ path: indexPath, scrollY: 0 }),
    locale,
  );
  expect(
    zeroPosition?.scrollY === 0 && zeroPosition.section === undefined,
    `${locale} accepts a top-of-page return without a section`,
  );
  for (const otherLocale of Object.keys(validRoutes) as AppLocale[]) {
    if (otherLocale === locale) continue;
    expect(
      parseReadingPosition(
        JSON.stringify({ path: validRoutes[otherLocale], scrollY: 1 }),
        locale,
      ) === null,
      `${locale} rejects a reading return belonging to ${otherLocale}`,
    );
    expect(
      readingReturnKey(locale) !== readingReturnKey(otherLocale) &&
        readingRestoreKey(locale) !== readingRestoreKey(otherLocale),
      `${locale} reading state is stored separately from ${otherLocale}`,
    );
  }
  expect(
    readingReturnKey(locale) !== readingRestoreKey(locale),
    `${locale} guide context does not itself trigger article scroll restoration`,
  );
}

for (const path of [
  "/",
  "/guide",
  "https://example.com/articles/edge-list",
  "//example.com/articles/edge-list",
  "/articles/unknown",
  "/articles/edge-list/extra",
  "/articles/../guide",
  "/articles/%65dge-list",
  "/articles?example=edge-list",
  "/articles/edge-list#article-example",
  "/articles/",
  "/zh-Hans/articles",
]) {
  expect(
    parseReadingPosition(JSON.stringify({ path, scrollY: 10 }), "ja") === null,
    `invalid or external reading destination is rejected: ${path}`,
  );
}

for (const value of [null, "", "broken", "null", "[]", "1", '"text"']) {
  expect(
    parseReadingPosition(value, "ja") === null,
    `malformed reading storage is rejected: ${String(value)}`,
  );
}

for (const scrollY of [-1, null, "100", {}, true]) {
  expect(
    parseReadingPosition(
      JSON.stringify({ path: "/articles", scrollY }),
      "ja",
    ) === null,
    `invalid scroll position is rejected: ${JSON.stringify(scrollY)}`,
  );
}
expect(
  parseReadingPosition('{"path":"/articles","scrollY":1e309}', "ja") === null,
  "nonfinite scrolling values are rejected",
);

for (const section of [null, 1, "", "#article-example", "a/b", "a?b", "a b"])
  expect(
    parseReadingPosition(
      JSON.stringify({ path: "/articles", section, scrollY: 20 }),
      "ja",
    ) === null,
    `invalid section anchors are rejected: ${JSON.stringify(section)}`,
  );

finish();
