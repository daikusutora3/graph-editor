import {
  articleCopy,
  articleIndexPath,
  articlePath,
  articleSamples,
  articleSlugs,
  getArticle,
  getArticleForGuideExample,
  getArticles,
  getArticlesForGuideSection,
} from "../../lib/article-content";
import {
  createArticleExampleGraph,
  getArticleExample,
} from "../../lib/article-examples";
import { exportGraph } from "../../features/graph-editor/io/export-graph";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { evaluateGraphInput } from "../../features/graph-editor/io/import-graph";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import { guideCopy, guideExampleCopy } from "../../lib/guide-content";
import { guideExamples } from "../../lib/guide-examples";
import { type AppLocale } from "../../lib/site-metadata";
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
        (section) => `guide-${section.id}` === article.guide.sectionId,
      ),
      `${context} operation links target current guide sections`,
    );
    expect(
      articlePath(locale, slug) === `${articleIndexPath(locale)}/${slug}`,
      `${context} article route keeps its locale`,
    );
    expect(
      article.example.input === seed.input &&
        article.example.nodes === seed.nodes &&
        article.example.edges === seed.edges &&
        article.example.format === seed.format &&
        article.example.weighted === seed.weighted,
      `${context} editor and article use one trusted example`,
    );
    if (article.example.guideExampleId) {
      const index = guideExamples.findIndex(
        (example) => example.id === article.example.guideExampleId,
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
    }
  }

  expect(
    getArticleForGuideExample(locale, "edge-list")?.slug === "edge-list" &&
      getArticleForGuideExample(locale, "adjacency-matrix")?.slug ===
        "edge-list" &&
      getArticleForGuideExample(locale, "weighted-tree")?.slug ===
        "tikz-export",
    `${label} guide examples link to the article that covers them`,
  );
  expect(
    getArticlesForGuideSection(locale, "import")
      .map((article) => article.slug)
      .join(",") === "edge-list",
    `${label} import guide links reach the input article`,
  );
  expect(
    getArticlesForGuideSection(locale, "guide-export")
      .map((article) => article.slug)
      .join(",") === "tikz-export",
    `${label} export guide links reach the TikZ article`,
  );
}

// The input article labels each sample with a format; the importer must agree.
for (const locale of locales) {
  const samples = getArticle(locale, "edge-list")!.sections.flatMap(
    (section) => section.samples ?? [],
  );
  expect(
    samples.length === Object.keys(articleSamples.formatSamples).length,
    `${locale}: every format sample is shown`,
  );
  for (const sample of samples) {
    const evaluation = evaluateGraphInput(sample.code, {
      ...createEmptyGraphModel().settings,
      format: "auto",
    });
    const kind = evaluation.analysis.recommendedFormat;
    expect(
      kind !== undefined &&
        messagesByLocale[locale].starter.formats[kind].toLowerCase() ===
          sample.title.toLowerCase() &&
        evaluation.result.model.nodes.length > 0,
      `${locale}: "${sample.title}" sample is read as that format (got ${kind})`,
    );
  }
}

// The TikZ article quotes the exporter's opening lines; keep them in sync.
{
  const tikz = exportGraph(createArticleExampleGraph("tikz-export"), "tikz");
  const { texSamples } = articleSamples;
  expect(
    tikz.includes(texSamples.styles) &&
      texSamples.preamble
        .split("\n")
        .every((line) => tikz.includes(`% ${line}`)) &&
      tikz.includes("ge label,midway"),
    "the TikZ article's preamble and style snippets match the exporter output",
  );
}

expect(
  articleIndexPath("ja") === "/articles" &&
    articleIndexPath("en") === "/en/articles" &&
    articleIndexPath("zh-Hans") === "/zh-hans/articles",
  "localized index routes use the existing locale path convention",
);

finish();
