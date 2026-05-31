import { resolveInlineEditCommit } from "../../features/graph-editor/core/graph/inline-edit-commit";
import {
  createEmptyGraphModel,
  defaultGraphSettings,
} from "../../features/graph-editor/core/graph/graph-factory";
import {
  addEdgeCommand,
  deleteSelectionCommand,
  reverseEdgesCommand,
  updateSettingsCommand,
} from "../../features/graph-editor/core/graph/graph-intents";
import { applyGraphPatch } from "../../features/graph-editor/core/graph/graph-patch";
import { reduceGraphIntent } from "../../features/graph-editor/core/graph/graph-reducer";
import { prepareGraphTransaction } from "../../features/graph-editor/core/graph/graph-transaction";
import {
  computeEdgeRouting,
  shouldAvoidNodesForEdgeRouting,
} from "../../features/graph-editor/core/layout/edge-routing";
import { importGraphInput } from "../../features/graph-editor/io/import-graph";
import { hasGraphContent } from "../../features/graph-editor/core/graph/selectors";
import type {
  GraphEdge,
  GraphModel,
} from "../../features/graph-editor/core/graph/model";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Graph core");

const validEdgeList = importGraphInput("0 1\n1 2", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  hasGraphContent(validEdgeList.model),
  "valid edge list should produce graph content",
);

const structuredEdgeList = importGraphInput("3 2\n0 1\n1 2", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  structuredEdgeList.format === "辺リスト",
  "N M header input should keep structured edge-list precedence",
);
expect(
  structuredEdgeList.model.nodes.length === 3 &&
    structuredEdgeList.model.edges.length === 2,
  "structured edge-list input should honor declared node and edge counts",
);

const adjacencyMatrix = importGraphInput("0 1 0\n1 0 1\n0 1 0", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  adjacencyMatrix.format === "Adjacency matrix",
  "square numeric input should prefer adjacency-matrix parsing before edge-list parsing",
);

const adjacencyList = importGraphInput("0: 1 2\n1: 2", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  adjacencyList.format === "Adjacency list",
  "colon-separated input should prefer adjacency-list parsing before edge-list parsing",
);

const looseEdgeList = importGraphInput("0 1\n1 2\n2 3", {
  directed: false,
  weighted: false,
  indexBase: 0,
});

expect(
  looseEdgeList.format === "Edge list",
  "plain pairs without an N M header should fall back to loose edge-list parsing",
);

const constrainedModel: GraphModel = {
  ...createEmptyGraphModel({ directed: true, allowMultiEdges: false }),
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 100, y: 0 },
  ],
  edges: [{ id: "ab", source: "a", target: "b" }],
};

expect(
  reduceGraphIntent(
    constrainedModel,
    addEdgeCommand({ id: "duplicate", source: "a", target: "b" }),
  ).edges.length === 1,
  "reducer should reject duplicate add-edge when multi-edges are disabled",
);

const reversedConflictModel: GraphModel = {
  ...constrainedModel,
  edges: [
    { id: "ab", source: "a", target: "b" },
    { id: "ba", source: "b", target: "a" },
  ],
};

expect(
  reduceGraphIntent(
    reversedConflictModel,
    reverseEdgesCommand(["ab"]),
  ).edges.find((edge) => edge.id === "ab")?.source === "a",
  "reducer should leave a reversed edge unchanged when it would collide",
);

const weightedModel = {
  version: 1 as const,
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 100, y: 0 },
  ],
  edges: [{ id: "ab", source: "a", target: "b", weight: "2" }],
  settings: {
    ...defaultGraphSettings,
    weighted: true,
    weightKind: "number" as const,
  },
};

const invalidInlineWeight = resolveInlineEditCommit(
  {
    kind: "edge-weight",
    edgeId: "ab",
    value: "not-a-number",
    fallbackPosition: { x: 0, y: 0 },
  },
  weightedModel,
);

expect(
  invalidInlineWeight.kind === "error",
  "invalid inline edge weight should keep the editor open with an error",
);

const unchangedInlineWeight = resolveInlineEditCommit(
  {
    kind: "edge-weight",
    edgeId: "ab",
    value: "2",
    fallbackPosition: { x: 0, y: 0 },
  },
  weightedModel,
);

expect(
  unchangedInlineWeight.kind === "close" && !unchangedInlineWeight.command,
  "unchanged inline edge weight should close without creating a command",
);

const changedInlineLabel = resolveInlineEditCommit(
  {
    kind: "node-label",
    nodeId: "a",
    value: "Alpha",
    fallbackPosition: { x: 0, y: 0 },
  },
  weightedModel,
);
const changedModel =
  changedInlineLabel.kind === "close" && changedInlineLabel.command
    ? applyInlineEditIntent(weightedModel, changedInlineLabel.command)
    : weightedModel;

expect(
  changedModel.nodes.find((node) => node.id === "a")?.label === "Alpha",
  "changed inline node label should create a command that updates the node",
);

const oneBasedModel = applyIntent(
  {
    version: 1,
    nodes: [
      { id: "a", label: "0", order: 0, x: 0, y: 0 },
      { id: "b", label: "Custom", order: 1, x: 100, y: 0 },
    ],
    edges: [{ id: "ab", source: "a", target: "b" }],
    settings: { ...defaultGraphSettings, indexBase: 0 },
  },
  updateSettingsCommand({ indexBase: 1, weighted: true }),
);

expect(
  oneBasedModel.nodes[0]?.label === "1" &&
    oneBasedModel.nodes[1]?.label === "Custom",
  "index-base updates should only rewrite generated node labels",
);
expect(
  oneBasedModel.edges[0]?.weight === "1",
  "enabling weighted mode should default blank edge weights to one",
);

const deletedSelectionModel = applyIntent(
  {
    version: 1,
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 100, y: 0 },
      { id: "c", label: "C", order: 2, x: 200, y: 0 },
    ],
    edges: [
      { id: "ab", source: "a", target: "b" },
      { id: "bc", source: "b", target: "c" },
    ],
    settings: defaultGraphSettings,
  },
  deleteSelectionCommand({ nodeIds: ["b"], edgeIds: [] }),
);

expect(
  deletedSelectionModel.nodes.map((node) => node.id).join(",") === "a,c" &&
    deletedSelectionModel.edges.length === 0,
  "delete-selection should remove selected nodes and dangling incident edges",
);

const emptyModel: GraphModel = {
  version: 1,
  nodes: [],
  edges: [],
  settings: defaultGraphSettings,
};
const largeRoutingModel: GraphModel = {
  version: 1,
  nodes: Array.from({ length: 200 }, (_, index) => ({
    id: `node-${index}`,
    label: `${index}`,
    order: index,
    x: index * 10,
    y: 0,
  })),
  edges: Array.from({ length: 200 }, (_, index) => ({
    id: `edge-${index}`,
    source: `node-${index % 200}`,
    target: `node-${(index + 1) % 200}`,
  })),
  settings: defaultGraphSettings,
};

expect(
  !shouldAvoidNodesForEdgeRouting(emptyModel),
  "edge routing should skip node avoidance when there is no routing work",
);
expect(
  shouldAvoidNodesForEdgeRouting(weightedModel),
  "edge routing should keep node avoidance for small graphs",
);
expect(
  !shouldAvoidNodesForEdgeRouting(largeRoutingModel),
  "edge routing should skip node avoidance beyond the work limit",
);

const multiEdgeModel: GraphModel = {
  version: 1,
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 180, y: 0 },
    { id: "c", label: "C", order: 2, x: 90, y: 8 },
  ],
  edges: [
    { id: "ab-1", source: "a", target: "b" },
    { id: "ab-2", source: "a", target: "b" },
    { id: "ba-1", source: "b", target: "a" },
  ],
  settings: defaultGraphSettings,
};
const multiEdgeRouting = computeEdgeRouting(multiEdgeModel);
const canonicalMultiEdgeBows = multiEdgeModel.edges.map((edge) =>
  canonicalBow(edge, multiEdgeRouting.get(edge.id)?.bowPx ?? 0),
);
const sortedMultiEdgeBows = [...canonicalMultiEdgeBows].sort((a, b) => a - b);

expect(
  sortedMultiEdgeBows.every((bowPx, index) => {
    const nextBowPx = sortedMultiEdgeBows[index + 1];

    return nextBowPx === undefined || nextBowPx - bowPx >= 30;
  }),
  "multi-edge routing should keep parallel edges visually separated",
);

finish();

function applyInlineEditIntent(
  model: GraphModel,
  intent: NonNullable<
    Extract<typeof changedInlineLabel, { kind: "close" }>["command"]
  >,
) {
  return applyIntent(model, intent);
}

function applyIntent(
  model: GraphModel,
  intent: Parameters<typeof prepareGraphTransaction>[1],
) {
  const transaction = prepareGraphTransaction(model, intent, 0);
  return transaction ? applyGraphPatch(model, transaction.forward) : model;
}

function canonicalBow(edge: GraphEdge, bowPx: number) {
  return edge.source <= edge.target ? bowPx : -bowPx;
}
