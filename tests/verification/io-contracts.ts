import { defaultGraphSettings } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  exportGraph,
  type GraphExportFormat,
} from "../../features/graph-editor/io/export-graph";
import { importGraphInput } from "../../features/graph-editor/io/import-graph";
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

for (const format of [
  "edge-list",
  "adjacency-list",
  "adjacency-matrix",
] satisfies GraphExportFormat[]) {
  assertRoundTrip(weightedDirectedModel, format);
  assertRoundTrip(plainUndirectedModel, format);
}

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

const ambiguousStructuredEdgeList = importGraphInput("2 1\n0 1", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  ambiguousStructuredEdgeList.format === "辺リスト" &&
    ambiguousStructuredEdgeList.model.nodes.length === 2,
  "N M shaped input should keep structured edge-list precedence",
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

const looseFallback = importGraphInput("0 1\n1 2", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  looseFallback.format === "Edge list",
  "invalid structured edge-list candidates should still fall back to loose edge-list",
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
