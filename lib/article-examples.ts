import {
  createEmptyGraphModel,
  createEdge,
  createNode,
} from "@/features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "@/features/graph-editor/core/graph/model";
import type { ImportFormat } from "@/features/graph-editor/io/import-utils";
import { guideExamples } from "./guide-examples";

/** Small, trusted examples shared by articles and the editor entry point. */
export const articleSlugs = [
  "edge-list",
  "adjacency-matrix",
  "tree-layout",
  "tikz-export",
  "bipartite-graph",
] as const;

export type ArticleSlug = (typeof articleSlugs)[number];
type GuideExampleId = (typeof guideExamples)[number]["id"];

export type ArticleExample = {
  id: ArticleSlug;
  input: string;
  format: ImportFormat;
  weighted: boolean;
  guideExampleId: GuideExampleId | null;
  nodes: readonly (readonly [string | number, number, number])[];
  edges: readonly (readonly [string | number, string | number, number?])[];
};

const edgeList = guideExamples[0];
const matrix = guideExamples[1];
const tree = guideExamples[2];

const articleExamples: Record<ArticleSlug, ArticleExample> = {
  "edge-list": {
    ...edgeList,
    id: "edge-list",
    format: "contest-edge-list",
    weighted: false,
    guideExampleId: edgeList.id,
  },
  "adjacency-matrix": {
    ...matrix,
    id: "adjacency-matrix",
    format: "adjacency-matrix",
    weighted: false,
    guideExampleId: matrix.id,
  },
  "tree-layout": {
    ...tree,
    id: "tree-layout",
    format: "contest-edge-list",
    weighted: true,
    guideExampleId: tree.id,
  },
  "tikz-export": {
    ...edgeList,
    id: "tikz-export",
    format: "contest-edge-list",
    weighted: false,
    guideExampleId: edgeList.id,
  },
  "bipartite-graph": {
    id: "bipartite-graph",
    input: "A 1\nA 2\nB 2\nB 3",
    format: "edge-pairs",
    weighted: false,
    guideExampleId: null,
    nodes: [
      ["A", 65, 55],
      ["B", 65, 135],
      ["1", 235, 25],
      ["2", 235, 95],
      ["3", 235, 165],
    ],
    edges: [
      ["A", "1"],
      ["A", "2"],
      ["B", "2"],
      ["B", "3"],
    ],
  },
};

export function isArticleSlug(value: string): value is ArticleSlug {
  return articleSlugs.some((slug) => slug === value);
}

export function getArticleExample(value: string | null | undefined) {
  return value && isArticleSlug(value) ? articleExamples[value] : null;
}

/** No import parsing or article prose is needed to open these fixed examples. */
export function createArticleExampleGraph(slug: ArticleSlug): GraphModel {
  const example = articleExamples[slug];
  return {
    ...createEmptyGraphModel({
      indexBase: example.guideExampleId ? 1 : 0,
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
