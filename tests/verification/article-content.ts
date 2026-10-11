import {
  articleCopy,
  articleEditorPath,
  articleGuidePath,
  articleIndexPath,
  articlePath,
  articleSlugs,
  getArticle,
  getArticleForGuideExample,
  getArticles,
  getArticlesForGuideSection,
} from "../../lib/article-content";
import { getArticleExample } from "../../lib/article-examples";
import { guideCopy, guideExampleCopy } from "../../lib/guide-content";
import { guideExamples } from "../../lib/guide-examples";
import {
  appGuidePaths,
  appLocalePaths,
  type AppLocale,
} from "../../lib/site-metadata";
import { createVerification } from "./harness";

const { expect, finish } = createVerification(
  "Article content and guide links",
);
const locales: AppLocale[] = ["ja", "en", "zh-Hans"];

for (const locale of locales) {
  const articles = getArticles(locale);
  const label = `${locale}:`;
  expect(
    articles.length === articleSlugs.length,
    `${label} every article exists`,
  );
  expect(
    Object.values(articleCopy[locale]).every(
      (value) => value.trim().length > 0,
    ),
    `${label} navigation and copy labels are localized`,
  );
  expect(
    getArticle(locale, "missing-article") === undefined,
    `${label} unknown articles do not fall back to unrelated content`,
  );

  for (const slug of articleSlugs) {
    const article = getArticle(locale, slug)!;
    const seed = getArticleExample(slug)!;
    const context = `${label} ${slug}`;
    const ids = article.sections.map((section) => section.id);
    expect(
      new Set(ids).size === ids.length &&
        !ids.includes("article-example") &&
        !ids.includes("article-related"),
      `${context} section anchors are unique and do not shadow shared sections`,
    );
    expect(
      article.sections.every(
        (section) =>
          section.title.trim().length > 0 &&
          section.paragraphs.length > 0 &&
          section.paragraphs.every((paragraph) => paragraph.trim().length > 0),
      ),
      `${context} sections contain readable text`,
    );
    expect(
      article.relatedSlugs.every(
        (related) =>
          related !== slug && getArticle(locale, related) !== undefined,
      ),
      `${context} related links resolve in the same locale`,
    );
    expect(
      guideCopy[locale].sections.some(
        (section) => `guide-${section.id}` === article.guideAnchor,
      ),
      `${context} operation links target current guide sections`,
    );
    expect(
      articleGuidePath(locale, slug) ===
        `${appGuidePaths[locale]}#${article.guideAnchor}`,
      `${context} operation route keeps its locale and anchor`,
    );
    expect(
      articlePath(locale, slug) === `${articleIndexPath(locale)}/${slug}` &&
        articleEditorPath(locale, slug) ===
          `${appLocalePaths[locale]}?example=${slug}`,
      `${context} article and example routes keep their locale`,
    );
    expect(
      article.example.input === seed.input &&
        article.example.code === seed.input &&
        article.example.nodes === seed.nodes &&
        article.example.edges === seed.edges &&
        article.example.format === seed.format &&
        article.example.weighted === seed.weighted,
      `${context} editor and article use one trusted example`,
    );
    if (article.canonicalGuideExampleId) {
      const index = guideExamples.findIndex(
        (example) => example.id === article.canonicalGuideExampleId,
      );
      const shared = guideExamples[index]!;
      expect(
        article.example.input === shared.input &&
          article.example.nodes === shared.nodes &&
          article.example.edges === shared.edges &&
          article.example.result ===
            guideExampleCopy[locale].examples[index]!.result,
        `${context} shared input and diagram match the guide exactly`,
      );
      expect(
        articleGuidePath(locale, slug, "example") ===
          `${appGuidePaths[locale]}#${shared.id}`,
        `${context} shared-example link uses the stable guide example anchor`,
      );
    }
  }

  expect(
    getArticleForGuideExample(locale, "edge-list")?.slug === "edge-list" &&
      getArticleForGuideExample(locale, "adjacency-matrix")?.slug ===
        "adjacency-matrix" &&
      getArticleForGuideExample(locale, "weighted-tree")?.slug ===
        "tree-layout",
    `${label} guide examples link to their reading articles`,
  );
  expect(
    getArticlesForGuideSection(locale, "layouts")
      .map((article) => article.slug)
      .join(",") === "tree-layout,bipartite-graph",
    `${label} layout guide links reach the relevant articles`,
  );
  expect(
    getArticlesForGuideSection(locale, "guide-export")
      .map((article) => article.slug)
      .join(",") === "tikz-export",
    `${label} export guide links reach the TikZ article`,
  );
}

expect(
  articleIndexPath("ja") === "/articles" &&
    articleIndexPath("en") === "/en/articles" &&
    articleIndexPath("zh-Hans") === "/zh-hans/articles",
  "localized index routes use the existing locale path convention",
);

finish();
