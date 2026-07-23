import { defaultGraphSettings } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  exportGraph,
  hasLossyAdjacencyExport,
  type GraphExportFormat,
} from "../../features/graph-editor/io/export-graph";
import { formatImportWarning } from "../../features/graph-editor/i18n/import-warning-messages";
import {
  importGraphInput,
  WEIGHTED_PARENT_LIST_AMBIGUITY_WARNING,
} from "../../features/graph-editor/io/import-graph";
import {
  MAX_IMPORT_EDGES,
  MAX_IMPORT_INPUT_CHARS,
  MAX_IMPORT_NODES,
} from "../../features/graph-editor/io/import-utils";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("IO contract");

const weightedDirectedModel: GraphModel = {
  version: 1,
  nodes: [
    { id: "n0", label: "0", order: 0, x: 0, y: 0 },
    { id: "n1", label: "1", order: 1, x: 120, y: 0 },
    { id: "n2", label: "2", order: 2, x: 240, y: 0 },
  ],
  edges: [
    { id: "e0", source: "n0", target: "n1", weight: "5" },
    { id: "e1", source: "n1", target: "n2", weight: "-3" },
  ],
  settings: {
    ...defaultGraphSettings,
    directed: true,
    weighted: true,
    indexBase: 0,
    weightKind: "number",
  },
};

const plainUndirectedModel: GraphModel = {
  version: 1,
  nodes: [
    { id: "n0", label: "0", order: 0, x: 0, y: 0 },
    { id: "n1", label: "1", order: 1, x: 120, y: 0 },
    { id: "n2", label: "2", order: 2, x: 240, y: 0 },
  ],
  edges: [
    { id: "e0", source: "n0", target: "n1" },
    { id: "e1", source: "n1", target: "n2" },
  ],
  settings: {
    ...defaultGraphSettings,
    directed: false,
    weighted: false,
    indexBase: 0,
  },
};

const relabeledUndirectedModel: GraphModel = {
  ...plainUndirectedModel,
  nodes: [
    { id: "n0", label: "0", order: 0, x: 0, y: 0 },
    { id: "n1", label: "2", order: 1, x: 120, y: 0 },
    { id: "n2", label: "1", order: 2, x: 240, y: 0 },
  ],
  edges: [{ id: "e0", source: "n0", target: "n1" }],
};

const parallelEdgeModel: GraphModel = {
  ...plainUndirectedModel,
  edges: [
    { id: "e0", source: "n0", target: "n1" },
    { id: "e1", source: "n0", target: "n1" },
  ],
};

for (const format of [
  "edge-list",
  "adjacency-list",
  "adjacency-matrix",
] satisfies GraphExportFormat[]) {
  assertRoundTrip(weightedDirectedModel, format);
  assertRoundTrip(plainUndirectedModel, format);
}

expect(
  !hasLossyAdjacencyExport(parallelEdgeModel, "edge-list") &&
    hasLossyAdjacencyExport(parallelEdgeModel, "adjacency-list") &&
    hasLossyAdjacencyExport(parallelEdgeModel, "adjacency-matrix"),
  "adjacency exports should warn when parallel edges may not be lossless",
);

expect(
  exportGraph(relabeledUndirectedModel, "edge-list") === "3 1\n0 2",
  "edge-list export should follow unique contiguous numeric node labels",
);

expect(
  exportGraph(relabeledUndirectedModel, "adjacency-list") === "0: 2\n1: \n2: 0",
  "adjacency-list export should order rows and targets by numeric node labels",
);

expect(
  exportGraph(relabeledUndirectedModel, "adjacency-matrix") ===
    "0 0 1\n0 0 0\n1 0 0",
  "adjacency-matrix export should order rows and columns by numeric node labels",
);

const weightedAdjacencyList = importGraphInput("0: 1(5)\n1: 2(-3)\n2:", {
  directed: true,
  weighted: true,
  indexBase: 0,
});

expect(
  weightedAdjacencyList.model.edges.map((edge) => edge.weight).join(",") ===
    "5,-3",
  "weighted adjacency-list import should preserve target(weight) values",
);

const arrowAdjacencyList = importGraphInput("0 -> 1\n1 -> 2", {
  indexBase: 0,
});

expect(
  arrowAdjacencyList.format === "Adjacency list" &&
    arrowAdjacencyList.formatKind === "adjacency-list" &&
    arrowAdjacencyList.model.settings.directed &&
    arrowAdjacencyList.model.edges.length === 2,
  "arrow adjacency-list syntax should imply directed import",
);

const ambiguousStructuredEdgeList = importGraphInput("2 1\n0 1", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  ambiguousStructuredEdgeList.format === "辺リスト" &&
    ambiguousStructuredEdgeList.formatKind === "contest-edge-list" &&
    ambiguousStructuredEdgeList.model.nodes.length === 2,
  "N M shaped input should keep structured edge-list precedence",
);

const twoByTwoMatrix = importGraphInput("0 1\n1 0", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  twoByTwoMatrix.format === "Adjacency matrix" &&
    twoByTwoMatrix.formatKind === "adjacency-matrix" &&
    twoByTwoMatrix.model.nodes.length === 2 &&
    twoByTwoMatrix.model.edges.length === 1,
  "2x2 symmetric binary matrix should import as adjacency matrix",
);

const forcedTwoByTwoMatrix = importGraphInput("0 1\n1 0", {
  format: "adjacency-matrix",
  indexBase: 0,
});

expect(
  forcedTwoByTwoMatrix.format === "Adjacency matrix" &&
    forcedTwoByTwoMatrix.formatKind === "adjacency-matrix" &&
    forcedTwoByTwoMatrix.model.nodes.length === 2 &&
    forcedTwoByTwoMatrix.model.edges.length === 1,
  "forced adjacency-matrix import should accept a 2x2 matrix",
);

const adjacencyMatrixWithLoop = importGraphInput("1 1 1\n1 0 1\n1 1 0", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  adjacencyMatrixWithLoop.format === "Adjacency matrix" &&
    adjacencyMatrixWithLoop.formatKind === "adjacency-matrix" &&
    adjacencyMatrixWithLoop.model.nodes.length === 3 &&
    adjacencyMatrixWithLoop.model.edges.length === 4 &&
    adjacencyMatrixWithLoop.model.edges.some(
      (edge) => edge.source === "n0" && edge.target === "n0",
    ),
  "binary symmetric adjacency matrices with self-loops should not be misread as edge pairs",
);

const directedMatrix = importGraphInput("0 1 0\n0 0 1\n0 0 0", {
  format: "adjacency-matrix",
  indexBase: 0,
});

expect(
  directedMatrix.format === "Adjacency matrix" &&
    directedMatrix.formatKind === "adjacency-matrix" &&
    directedMatrix.model.settings.directed &&
    directedMatrix.model.edges.map((edge) => edge.source).join(",") === "n0,n1",
  "non-symmetric adjacency matrices should infer directed import",
);

const oneIndexedLooseEdgeList = importGraphInput("1 2\n2 3\n3 1", {
  directed: false,
  weighted: false,
  indexBase: 1,
});

expect(
  oneIndexedLooseEdgeList.format === "Edge list" &&
    oneIndexedLooseEdgeList.formatKind === "edge-pairs" &&
    oneIndexedLooseEdgeList.model.nodes.length === 3 &&
    oneIndexedLooseEdgeList.model.edges.length === 3,
  "1-indexed headerless edge-list should import as loose edge-list",
);

const weightedLooseEdgeList = importGraphInput("0 1 5\n1 2 6\n2 3 7", {
  directed: false,
  weighted: true,
  indexBase: 0,
});

expect(
  weightedLooseEdgeList.format === "Edge list" &&
    weightedLooseEdgeList.formatKind === "edge-pairs" &&
    weightedLooseEdgeList.model.nodes.length === 4 &&
    weightedLooseEdgeList.model.edges.map((edge) => edge.weight).join(",") ===
      "5,6,7",
  "weighted 3-column edge-pair lists should not be misread as adjacency matrices",
);

expect(
  formatImportWarning("line 2: weight must be numeric.", "ja") ===
    "2 行目: 重みは数値で入力してください。" &&
    formatImportWarning(
      "Import is too large: 1,001 nodes, maximum is 1,000.",
      "zh-Hans",
    ) === "输入过大: 1,001 顶点，上限是 1,000。" &&
    formatImportWarning("line 2: weight must be numeric.", "en") ===
      "line 2: weight must be numeric.",
  "import warning display should localize known warnings and preserve English",
);

const forcedSingleEdgePair = importGraphInput("1 2", {
  format: "edge-pairs",
  indexBase: 1,
});

expect(
  forcedSingleEdgePair.format === "Edge list" &&
    forcedSingleEdgePair.formatKind === "edge-pairs" &&
    forcedSingleEdgePair.model.nodes.length === 2 &&
    forcedSingleEdgePair.model.edges.length === 1,
  "forced edge-pairs import should accept a single edge",
);

const oneIndexedStructuredEdgeList = importGraphInput("5 3\n1 5\n2 5\n3 5", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  oneIndexedStructuredEdgeList.warnings.length === 0 &&
    oneIndexedStructuredEdgeList.model.settings.indexBase === 1 &&
    oneIndexedStructuredEdgeList.model.nodes
      .map((node) => node.label)
      .join() === "1,2,3,4,5" &&
    oneIndexedStructuredEdgeList.model.edges.length === 3,
  "0-indexed settings should still accept 1-indexed structured edge-list input",
);

const forcedContestEdgeList = importGraphInput("2 1\n1 2", {
  format: "contest-edge-list",
  indexBase: 1,
});

expect(
  forcedContestEdgeList.format === "辺リスト" &&
    forcedContestEdgeList.model.nodes.length === 2 &&
    forcedContestEdgeList.model.edges.length === 1,
  "forced contest edge-list import should keep N M interpretation",
);

const treeEdgeList = importGraphInput("7\n0 1\n0 2\n1 3\n1 4\n2 5\n2 6", {
  indexBase: 0,
});

expect(
  treeEdgeList.formatKind === "tree-edge-list" &&
    !treeEdgeList.model.settings.directed &&
    treeEdgeList.model.nodes.length === 7 &&
    treeEdgeList.model.edges.length === 6,
  "N followed by N-1 edge rows should import as a tree edge list",
);

const parentList = importGraphInput("7\n1 1 3 2 4 4", {
  indexBase: 1,
});

expect(
  parentList.formatKind === "parent-list" &&
    parentList.model.settings.directed &&
    parentList.model.nodes.length === 7 &&
    parentList.model.edges
      .map((edge) => `${edge.source}->${edge.target}`)
      .join(",") === "n0->n1,n0->n2,n2->n3,n1->n4,n3->n5,n3->n6",
  "N followed by N-1 parents should import as a directed rooted tree",
);

const inferredOneIndexedParentList = importGraphInput("7\n1 1 3 2 4 4", {
  indexBase: 0,
});

expect(
  inferredOneIndexedParentList.formatKind === "parent-list" &&
    inferredOneIndexedParentList.model.settings.indexBase === 1 &&
    inferredOneIndexedParentList.model.edges.every(
      (edge) => edge.source !== edge.target,
    ) &&
    inferredOneIndexedParentList.model.edges
      .map((edge) => `${edge.source}->${edge.target}`)
      .join(",") === "n0->n1,n0->n2,n2->n3,n1->n4,n3->n5,n3->n6",
  "parent-list import should infer 1-indexed parents even when current settings are 0-indexed",
);

const weightedParentList = importGraphInput("5\n1 3\n1 5\n2 2\n2 4", {
  format: "weighted-parent-list",
  indexBase: 1,
});

expect(
  weightedParentList.formatKind === "weighted-parent-list" &&
    weightedParentList.model.settings.directed &&
    weightedParentList.model.settings.weighted &&
    weightedParentList.model.settings.weightKind === "number" &&
    weightedParentList.model.edges
      .map((edge) => `${edge.source}->${edge.target}:${edge.weight}`)
      .join(",") === "n0->n1:3,n0->n2:5,n1->n3:2,n1->n4:4",
  "forced weighted parent-list import should create a directed weighted rooted tree",
);

const singleNodeWeightedParentList = importGraphInput("1", {
  format: "weighted-parent-list",
});

expect(
  singleNodeWeightedParentList.formatKind === "weighted-parent-list" &&
    singleNodeWeightedParentList.model.settings.directed &&
    singleNodeWeightedParentList.model.settings.weighted &&
    singleNodeWeightedParentList.model.settings.indexBase === 1 &&
    singleNodeWeightedParentList.model.nodes.length === 1 &&
    singleNodeWeightedParentList.model.nodes[0]?.label === "1" &&
    singleNodeWeightedParentList.model.edges.length === 0,
  "weighted parent-list import should support a one-node rooted tree",
);

const ambiguousWeightedParentList = importGraphInput("5\n1 3\n1 5\n2 2\n2 4", {
  indexBase: 1,
});

expect(
  ambiguousWeightedParentList.formatKind !== "weighted-parent-list" &&
    ambiguousWeightedParentList.warnings.includes(
      WEIGHTED_PARENT_LIST_AMBIGUITY_WARNING,
    ),
  "auto import should preserve existing tree parsing and warn about a possible weighted parent list",
);

expect(
  formatImportWarning(WEIGHTED_PARENT_LIST_AMBIGUITY_WARNING, "ja") ===
    "重み付き親配列の可能性があります。各行の2つ目の値が辺の重みなら、形式で「重み付き親配列」を選択してください。" &&
    formatImportWarning(WEIGHTED_PARENT_LIST_AMBIGUITY_WARNING, "zh-Hans") ===
      "输入可能是带权父节点列表。如果每行的第二个值是边权，请手动选择“带权父节点列表”格式。",
  "weighted parent-list ambiguity warning should be localized",
);

const zeroIndexedWeightedParentList = importGraphInput("4\n0 5\n0 6\n2 7", {
  format: "weighted-parent-list",
  indexBase: 0,
});

expect(
  zeroIndexedWeightedParentList.formatKind === "weighted-parent-list" &&
    zeroIndexedWeightedParentList.model.settings.indexBase === 0 &&
    zeroIndexedWeightedParentList.model.edges
      .map((edge) => `${edge.source}->${edge.target}:${edge.weight}`)
      .join(",") === "n0->n1:5,n0->n2:6,n2->n3:7",
  "weighted parent-list import should support 0-indexed parent labels",
);

const invalidWeightedParentSelfLoop = importGraphInput("3\n2 1\n1 2", {
  format: "weighted-parent-list",
  indexBase: 1,
});

expect(
  invalidWeightedParentSelfLoop.formatKind === undefined &&
    invalidWeightedParentSelfLoop.model.edges.length === 0 &&
    invalidWeightedParentSelfLoop.warnings.length > 0,
  "weighted parent-list import should reject self-loops",
);

const invalidWeightedParentCycle = importGraphInput("4\n1 1\n3 2\n2 3", {
  format: "weighted-parent-list",
  indexBase: 1,
});

expect(
  invalidWeightedParentCycle.formatKind === undefined &&
    invalidWeightedParentCycle.model.edges.length === 0 &&
    invalidWeightedParentCycle.warnings.length > 0,
  "weighted parent-list import should reject cycles disconnected from the root",
);

const invalidParentListSelfLoop = importGraphInput("3\n2 1", {
  format: "parent-list",
  indexBase: 1,
});

expect(
  invalidParentListSelfLoop.formatKind === undefined &&
    invalidParentListSelfLoop.model.edges.length === 0 &&
    invalidParentListSelfLoop.warnings.length > 0,
  "parent-list import should reject self-loops",
);

const partialStructuredEdgeList = importGraphInput("3 2\n1 2", {
  directed: false,
  weighted: false,
  indexBase: 1,
});

expect(
  partialStructuredEdgeList.format === "辺リスト" &&
    partialStructuredEdgeList.model.edges.length === 1 &&
    partialStructuredEdgeList.warnings.length > 0,
  "plausible incomplete N M edge-list should keep structured interpretation with warnings",
);

const partialWeightedStructuredEdgeList = importGraphInput("3 2\n1 2 5\n2 3", {
  directed: false,
  weighted: false,
  indexBase: 1,
});

expect(
  partialWeightedStructuredEdgeList.format === "辺リスト" &&
    partialWeightedStructuredEdgeList.model.settings.weighted &&
    partialWeightedStructuredEdgeList.model.edges.length === 1 &&
    partialWeightedStructuredEdgeList.warnings.length > 0,
  "partially malformed weighted structured edge-list should keep weighted interpretation",
);

const importedWithRoutingOff = importGraphInput("1 2\n2 3", {
  directed: false,
  weighted: false,
  indexBase: 1,
  autoEdgeRouting: false,
});

expect(
  importedWithRoutingOff.model.settings.autoEdgeRouting === false,
  "paste import should preserve autoEdgeRouting setting",
);

const nonNumericLooseWeight = importGraphInput("0 1 x", {
  format: "edge-pairs",
  weighted: true,
  indexBase: 0,
});

expect(
  nonNumericLooseWeight.model.edges.length === 0 &&
    nonNumericLooseWeight.warnings[0]?.includes("weight must be numeric"),
  "weighted edge-pairs import should reject non-numeric weights",
);

const nonNumericAdjacencyWeight = importGraphInput("0: 1(x)", {
  format: "adjacency-list",
  weighted: true,
  indexBase: 0,
});

expect(
  nonNumericAdjacencyWeight.model.edges.length === 0 &&
    nonNumericAdjacencyWeight.warnings[0]?.includes("weight must be numeric"),
  "weighted adjacency-list import should reject non-numeric weights",
);

const looseFallback = importGraphInput("0 1\n1 2", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  looseFallback.format === "Edge list",
  "invalid structured edge-list candidates should still fall back to loose edge-list",
);

const completeBipartiteInput = [
  "65 1000",
  ...Array.from({ length: 25 }, (_, leftIndex) =>
    Array.from(
      { length: 40 },
      (_, rightIndex) => `${leftIndex + 1} ${25 + rightIndex + 1}`,
    ),
  ).flat(),
].join("\n");
const completeBipartiteImport = importGraphInput(completeBipartiteInput, {
  indexBase: 1,
});

expect(
  completeBipartiteImport.formatKind === "contest-edge-list" &&
    completeBipartiteImport.model.nodes.length === 65 &&
    completeBipartiteImport.model.edges.length === 1000,
  "large structured edge-list should not be misclassified as an oversized adjacency matrix",
);

const oversizedStructuredEdgeList = importGraphInput(
  `${MAX_IMPORT_NODES + 1} 0`,
);

expect(
  oversizedStructuredEdgeList.model.nodes.length === 0 &&
    oversizedStructuredEdgeList.warnings[0]?.includes("Import is too large"),
  "structured edge-list import should reject oversized node counts before allocation",
);

const oversizedLooseEdgeList = importGraphInput(
  Array.from(
    { length: MAX_IMPORT_EDGES + 1 },
    (_, index) => `${index} ${index + 1}`,
  ).join("\n"),
);

expect(
  oversizedLooseEdgeList.model.edges.length === 0 &&
    oversizedLooseEdgeList.warnings[0]?.includes("Import is too large"),
  "loose edge-list import should reject oversized edge counts before building the graph",
);

const oversizedRawInput = importGraphInput(
  "0 1\n".repeat(Math.ceil(MAX_IMPORT_INPUT_CHARS / 4) + 1),
);

expect(
  oversizedRawInput.model.nodes.length === 0 &&
    oversizedRawInput.warnings[0]?.includes("Import is too large"),
  "import should reject oversized raw input before parsing lines",
);

finish();

function assertRoundTrip(model: GraphModel, format: GraphExportFormat) {
  const text = exportGraph(model, format);
  const imported = importGraphInput(text, model.settings);
  const context = `${format} ${model.settings.weighted ? "weighted" : "plain"} ${
    model.settings.directed ? "directed" : "undirected"
  }`;

  expect(imported.warnings.length === 0, `${context} should import cleanly`);
  expect(
    graphSignature(imported.model) === graphSignature(model),
    `${context} should round-trip graph structure`,
  );
}

function graphSignature(model: GraphModel) {
  const orderedNodes = [...model.nodes].sort((a, b) => a.order - b.order);
  const labelById = new Map(orderedNodes.map((node) => [node.id, node.label]));
  const edges = model.edges
    .map((edge) => {
      const source = labelById.get(edge.source);
      const target = labelById.get(edge.target);
      const endpoints = model.settings.directed
        ? [source, target]
        : [source, target].sort();

      return [
        endpoints[0],
        endpoints[1],
        model.settings.weighted ? (edge.weight ?? "1") : "",
      ].join("->");
    })
    .toSorted();

  return JSON.stringify({
    directed: model.settings.directed,
    weighted: model.settings.weighted,
    nodes: orderedNodes.map((node) => node.label),
    edges,
  });
}
