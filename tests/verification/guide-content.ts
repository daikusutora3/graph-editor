import assert from "node:assert/strict";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { GuidePage } from "../../app/guide/GuidePage";
import { guideCopy, guideExampleCopy } from "../../lib/guide-content";
import { guideExamples } from "../../lib/guide-examples";
import {
  appGuidePaths,
  appLocalePaths,
  getAppGuideUrl,
  type AppLocale,
} from "../../lib/site-metadata";
import { importGraphInput } from "../../features/graph-editor/io/import-graph";
import type { ImportFormat } from "../../features/graph-editor/io/import-utils";

const locales: readonly AppLocale[] = ["ja", "en", "zh-Hans"];
const supportedFormats: readonly ImportFormat[] = [
  "contest-edge-list",
  "edge-pairs",
  "tree-edge-list",
  "parent-list",
  "weighted-parent-list",
  "adjacency-list",
  "adjacency-matrix",
  "json",
];
const legacySections = ["import", "draw", "layouts", "export", "shortcuts"];
const escaped = (text: string) =>
  renderToStaticMarkup(createElement(Fragment, null, text));
const attribute = (tag: string, name: string) =>
  tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

for (const locale of locales) {
  const copy = guideCopy[locale];
  const exampleCopy = guideExampleCopy[locale];
  assert.deepEqual(
    copy.sections.map((section) => section.id),
    guideCopy.en.sections.map((section) => section.id),
    `${locale}: each language covers the same guide topics`,
  );
  assert.equal(
    exampleCopy.examples.length,
    guideExamples.length,
    `${locale}: each example has a translated description`,
  );

  const html = renderToStaticMarkup(createElement(GuidePage, { locale }));

  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, "");
  const tags = [...markup.matchAll(/<[a-z][^>]*>/gi)].map((match) => match[0]);
  const ids = tags.flatMap((tag) => {
    const id = attribute(tag, "id");
    return id ? [id] : [];
  });
  const idSet = new Set(ids);
  assert.equal(idSet.size, ids.length, `${locale}: HTML IDs are unique`);
  assert.equal(
    tags.filter((tag) => /^<h1\b/.test(tag)).length,
    1,
    `${locale}: the guide has one primary heading`,
  );
  for (const tag of tags) {
    const href = attribute(tag, "href");
    if (href?.startsWith("#")) {
      assert(
        idSet.has(href.slice(1)),
        `${locale}: internal link ${href} reaches existing content`,
      );
      const destination = tags.find(
        (target) => attribute(target, "id") === href.slice(1),
      );
      assert(
        href === "#guide-top" ||
          (destination && attribute(destination, "tabindex") === "-1"),
        `${locale}: internal link ${href} moves keyboard focus to its content`,
      );
    }
    for (const id of (attribute(tag, "aria-labelledby") ?? "")
      .split(/\s+/)
      .filter(Boolean)) {
      assert(idSet.has(id), `${locale}: accessible heading ${id} exists`);
    }
  }
  for (const id of ["guide-content", "guide-top", "guide-start", "guide-faq"]) {
    assert(idSet.has(id), `${locale}: ${id} navigation target exists`);
  }
  for (const section of copy.sections) {
    assert(
      idSet.has(`guide-${section.id}`) &&
        markup.includes(escaped(section.title)),
      `${locale}: topic ${section.id} is rendered and reachable`,
    );
  }
  for (const [index, section] of legacySections.entries()) {
    assert(
      idSet.has(`guide-section-${index}`) && idSet.has(`guide-${section}`),
      `${locale}: the old link for ${section} remains valid`,
    );
  }
  assert(
    markup.includes(`href="${appLocalePaths[locale]}"`),
    `${locale}: users can return to their localized editor`,
  );
  for (const language of locales) {
    assert(
      markup.includes(`href="${appGuidePaths[language]}"`),
      `${locale}: users can change to the ${language} guide`,
    );
  }

  const copyButtons = tags.filter(
    (tag) =>
      /^<button\b/.test(tag) &&
      attribute(tag, "aria-label")?.startsWith(
        escaped(`${exampleCopy.copy}: `),
      ),
  );
  assert.equal(
    copyButtons.length,
    guideExamples.length,
    `${locale}: every input has a copy action`,
  );
  for (const [index, example] of guideExamples.entries()) {
    const translated = exampleCopy.examples[index]!;
    assert(
      copyButtons.some(
        (tag) =>
          attribute(tag, "aria-label") ===
          escaped(`${exampleCopy.copy}: ${translated.title}`),
      ),
      `${locale}: the ${example.id} copy action identifies its own example`,
    );
    assert(
      markup.includes(`<code>${escaped(example.input)}</code>`),
      `${locale}: ${example.id} exposes complete input without JavaScript`,
    );
    assert(
      tags.some(
        (tag) =>
          /^<img\b/.test(tag) &&
          attribute(tag, "src") === `/guide/${example.id}.png` &&
          attribute(tag, "alt") === escaped(translated.result),
      ),
      `${locale}: ${example.id} has a diagram with a translated alternative`,
    );
  }

  const formatTable = copy.sections.find(
    (section) => section.id === "import",
  )?.table;
  assert(formatTable, `${locale}: supported input formats are documented`);
  assert.equal(formatTable.rows.length, supportedFormats.length);
  for (const [index, [name, input]] of formatTable.rows.entries()) {
    const format = supportedFormats[index]!;
    const result = importGraphInput(input, { format, indexBase: 1 });
    assert.notEqual(
      result.status,
      "failure",
      `${locale}: the ${name} reference example is valid when its format is selected`,
    );
    assert.equal(
      result.warnings.length,
      0,
      `${locale}: the ${name} reference example has no invalid rows`,
    );
    assert(
      markup.includes(`<code>${escaped(input)}</code>`),
      `${locale}: the ${name} reference preserves real newlines`,
    );
  }

  const json = html.match(
    /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
  )?.[1];
  assert(json, `${locale}: guide structured data is present`);
  const data: {
    "@type": string;
    headline?: string;
    url?: string;
    inLanguage?: string;
    mainEntity?: unknown;
  }[] = JSON.parse(json);
  const article = data.find((entry) => entry["@type"] === "TechArticle");
  assert.equal(article?.url, getAppGuideUrl(locale));
  assert.equal(article?.headline, copy.heading);
  assert.equal(article?.inLanguage, locale);
  const faq = data.find((entry) => entry["@type"] === "FAQPage");
  assert.deepEqual(
    faq?.mainEntity,
    copy.faq.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
    `${locale}: machine-readable FAQs match the reader-facing copy`,
  );
  for (const entry of copy.faq) {
    assert(
      markup.includes(escaped(entry.question)) &&
        markup.includes(escaped(entry.answer)),
      `${locale}: every structured FAQ is also available in the HTML`,
    );
  }
  const faqMarkup = markup.match(
    /<section\b[^>]*\bid="guide-faq"[^>]*>([\s\S]*?)<\/section>/,
  )?.[1];
  assert(faqMarkup, `${locale}: the FAQ section is present`);
  const faqDisclosures = [...faqMarkup.matchAll(/<details\b[^>]*>/g)].map(
    (match) => match[0],
  );
  assert.equal(
    faqDisclosures.length,
    copy.faq.length,
    `${locale}: the accordion contains every FAQ`,
  );
  assert(
    faqDisclosures.every((tag) => attribute(tag, "name") === "guide-faq"),
    `${locale}: every FAQ belongs to the same exclusive accordion`,
  );
  assert.equal(
    tags.filter(
      (tag) =>
        /^<details\b/.test(tag) && attribute(tag, "name") === "guide-faq",
    ).length,
    faqDisclosures.length,
    `${locale}: standalone disclosures stay independent from the FAQ`,
  );
}

console.log(
  "Guide: 3-locale SSR, navigation, accessible examples, valid format inputs and FAQ parity passed",
);
