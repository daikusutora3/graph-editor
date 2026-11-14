import {
  createEmptyGraphModel,
  createEdge,
  createNode,
} from "@/features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "@/features/graph-editor/core/graph/model";
import type { ImportFormat } from "@/features/graph-editor/io/import-utils";
import { guideExamples } from "./guide-examples";

export const articleSlugs = ["edge-list", "tikz-export"] as const;

export type ArticleSlug = (typeof articleSlugs)[number];
export type GuideExampleId = (typeof guideExamples)[number]["id"];

export type ArticleExample = {
  id: ArticleSlug;
  input: string;
  format: ImportFormat;
  weighted: boolean;
  /** The guide example this article reuses, so both show the same input. */
  guideExampleId: GuideExampleId;
  nodes: readonly (readonly [string | number, number, number])[];
  edges: readonly (readonly [string | number, string | number, number?])[];
};

const edgeList = guideExamples[0];
const tree = guideExamples[2];

const articleExamples: Record<ArticleSlug, ArticleExample> = {
  "edge-list": {
    ...edgeList,
    id: "edge-list",
    format: "contest-edge-list",
    weighted: false,
    guideExampleId: edgeList.id,
  },
  "tikz-export": {
    ...tree,
    id: "tikz-export",
    format: "contest-edge-list",
    weighted: true,
    guideExampleId: tree.id,
  },
};

export function isArticleSlug(value: string): value is ArticleSlug {
  return articleSlugs.some((slug) => slug === value);
}

export function getArticleExample(value: string | null | undefined) {
  return value && isArticleSlug(value) ? articleExamples[value] : null;
}

export function createArticleExampleGraph(slug: ArticleSlug): GraphModel {
  const example = articleExamples[slug];
  return {
    ...createEmptyGraphModel({
      indexBase: 1,
      weighted: example.weighted,
    }),
    nodes: example.nodes.map(([label, x, y], order) =>
      createNode({ id: String(label), label: String(label), x, y, order }),
    ),
    edges: example.edges.map(([source, target, weight], index) =>
      createEdge({
        id: `example-edge-${index}`,
        source: String(source),
        target: String(target),
        weight: weight === undefined ? undefined : String(weight),
      }),
    ),
  };
}
