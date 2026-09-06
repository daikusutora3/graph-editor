import {
  graphClipboardAtom,
  graphPasteCountAtom,
  editorModeAtom,
  edgeDraftAtom,
} from "../../features/graph-editor/shell/state/editor-atoms";
import { pasteGraphClipboardAtom } from "../../features/graph-editor/shell/state/editor-shortcut-actions";
import { isDeepStrictEqual } from "node:util";
import { createStore } from "jotai/vanilla";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  parseGraphModelJson,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import {
  replaceModelCommand,
  updateNodeCommand,
  updateSettingsCommand,
} from "../../features/graph-editor/core/graph/graph-intents";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { graphAtom } from "../../features/graph-editor/shell/state/graph-atoms";
import {
  executeCommandAtom,
  historyAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { selectionAtom } from "../../features/graph-editor/shell/state/editor-atoms";
import { resolveNodeOverlaps } from "../../features/graph-editor/layouts/resolve-node-overlaps";
import { importGraphInput } from "../../features/graph-editor/io/import-graph";
import { exportGraph } from "../../features/graph-editor/io/export-graph";
import {
  minimumCurveDistanceToNode,
  singleBowCurve,
} from "../../features/graph-editor/core/layout/edge-route-geometry";
import {
  computeEdgeRouting,
  edgeRoutingProgress,
} from "../../features/graph-editor/core/layout/edge-routing";
import { createVerification } from "./harness";
const { expect, finish } = createVerification("Integrity");
const graph: GraphModel = {
  ...createEmptyGraphModel(),
  nodes: [
    { id: "a", label: "🧭".repeat(256), order: 0, x: 20, y: 30, color: "blue" },
    { id: "b", label: "11", order: 1, x: 20, y: 30 },
  ],
  edges: [
    {
      id: "e",
      source: "a",
      target: "b",
      label: "label",
      weight: "0",
      routing: { bowPx: 170, bowT: 0.3 },
    },
  ],
};
expect(
  isDeepStrictEqual(parseGraphModelJson(serializeGraphModel(graph)), graph),
  "JSON preserves all accepted content including 256 astral code points",
);
expect(
  parseGraphModelJson(
    JSON.stringify({
      ...graph,
      nodes: graph.nodes.map((node) => ({ ...node, label: "x".repeat(257) })),
    }),
  ) === null,
  "overlong labels reject without truncation",
);
expect(
  parseGraphModelJson(
    JSON.stringify({ ...graph, edges: [{ ...graph.edges[0], id: "a" }] }),
  ) === null,
  "node and edge IDs share one namespace",
);
for (const patch of [{ x: Infinity }, { id: "" }, { order: -1 }])
  expect(
    parseGraphModelJson(
      JSON.stringify({ ...graph, nodes: [{ ...graph.nodes[0], ...patch }] }),
    ) === null,
    "invalid coordinates, IDs and order reject",
  );
const store = createStore();
store.set(executeCommandAtom, replaceModelCommand(graph));
store.set(selectionAtom, { nodeIds: ["a"], edgeIds: [] });
const before = store.get(graphAtom),
  history = store.get(historyAtom),
  selection = store.get(selectionAtom);
expect(
  store.set(
    executeCommandAtom,
    updateNodeCommand("a", { label: "x".repeat(257) }),
  ).status === "rejected",
  "command exposes rejection",
);
expect(
  store.get(graphAtom) === before &&
    store.get(historyAtom) === history &&
    store.get(selectionAtom) === selection,
  "rejection leaves graph, history and selection untouched",
);
const crowded = {
  ...graph,
  nodes: [
    ...graph.nodes,
    { id: "isolated", label: "alone", order: 2, x: 9000, y: 9000 },
  ],
};
for (const snapToGrid of [false, true]) {
  const model = { ...crowded, settings: { ...crowded.settings, snapToGrid } };
  const result = resolveNodeOverlaps(model);
  expect(
    result.status === "resolved" && result.remainingPairs === 0,
    "long coincident pills separate, including snapped positions",
  );
  expect(
    result.positions.isolated?.x === 9000 &&
      result.positions.isolated?.y === 9000,
    "isolated node does not move",
  );
  const after = {
    ...model,
    nodes: model.nodes.map((node) => ({
      ...node,
      ...result.positions[node.id],
    })),
  };
  expect(
    resolveNodeOverlaps(after).status === "unchanged",
    "overlap resolution is idempotent",
  );
}
const singleton = { ...createEmptyGraphModel(), nodes: [graph.nodes[0]!] };
expect(
  resolveNodeOverlaps(singleton).positions.a?.x === 20,
  "singleton retains its position",
);
const dense = {
  ...createEmptyGraphModel(),
  nodes: Array.from({ length: 40 }, (_, order) => ({
    id: String(order),
    label: "long label",
    order,
    x: 500,
    y: 500,
  })),
};
expect(
  resolveNodeOverlaps(dense).status === "resolved",
  "40 coincident long nodes resolve within budget",
);
const numbered = {
  ...graph,
  nodes: graph.nodes.map((node, index) => ({
    ...node,
    label: String(10 + index),
  })),
};
expect(
  exportGraph(numbered, "edge-list").includes("0 1"),
  "10 and 11 are renumbered to configured index base",
);
expect(
  importGraphInput("0", { format: "adjacency-matrix" }).model.nodes.length ===
    1,
  "1x1 matrix accepted",
);
expect(
  importGraphInput("0 2\n2 0", { format: "adjacency-matrix" }).model.edges
    .length === 1,
  "weighted 2x2 accepted",
);
expect(
  importGraphInput(serializeGraphModel(graph), { format: "adjacency-matrix" })
    .warnings.length > 0,
  "explicit text format never switches to JSON",
);
let blocked = false;
try {
  exportGraph(
    { ...graph, settings: { ...graph.settings, weighted: true } },
    "adjacency-matrix",
  );
} catch {
  blocked = true;
}
expect(blocked, "zero-weight matrix export rejects loss");
const longEdge = {
  ...createEmptyGraphModel(),
  nodes: [
    { id: "s", label: "", order: 0, x: 0, y: 0 },
    { id: "t", label: "", order: 1, x: 10000, y: 0 },
    { id: "o", label: "", order: 2, x: 312.5, y: 0 },
  ],
  edges: [{ id: "e", source: "s", target: "t" }],
};
expect(
  minimumCurveDistanceToNode(
    longEdge.nodes[0]!,
    longEdge.nodes[1]!,
    singleBowCurve(0),
    longEdge.nodes[2]!,
  ) === 0,
  "long straight segment collision cannot hide between samples",
);
const many = {
  ...dense,
  nodes: dense.nodes.map((node, index) => ({
    ...node,
    x: index * 80,
    y: (index % 2) * 70,
  })),
  edges: Array.from({ length: 39 }, (_, i) => ({
    id: `edge${i}`,
    source: String(i),
    target: String(i + 1),
  })),
};
let routes = computeEdgeRouting(many);
for (
  let pass = 0;
  pass < 50 && edgeRoutingProgress(routes).pendingEdgeIds.length;
  pass++
)
  routes = computeEdgeRouting(many, {
    previousMeta: routes,
    rerouteEdgeIds: new Set(edgeRoutingProgress(routes).pendingEdgeIds),
  });
expect(
  edgeRoutingProgress(routes).pendingEdgeIds.length === 0,
  "routing continuation eventually reaches the last edge",
);
store.set(undoAtom);
expect(
  store.get(graphAtom).nodes.length === 0,
  "rejected command added no undo entry",
);
const bulkStore = createStore();
const base990 = {
  ...createEmptyGraphModel(),
  nodes: Array.from({ length: 990 }, (_, order) => ({
    id: `n${order}`,
    label: String(order),
    order,
    x: 0,
    y: 0,
  })),
};
bulkStore.set(executeCommandAtom, replaceModelCommand(base990));
bulkStore.set(graphClipboardAtom, {
  nodes: base990.nodes.slice(0, 20),
  edges: [],
  indexBase: 0,
});
bulkStore.set(selectionAtom, { nodeIds: ["n0"], edgeIds: [] });
bulkStore.set(editorModeAtom, "node");
const bulkBefore = {
  graph: bulkStore.get(graphAtom),
  history: bulkStore.get(historyAtom),
  selection: bulkStore.get(selectionAtom),
  draft: bulkStore.get(edgeDraftAtom),
};
bulkStore.set(pasteGraphClipboardAtom);
expect(
  bulkStore.get(graphAtom) === bulkBefore.graph &&
    bulkStore.get(historyAtom) === bulkBefore.history &&
    bulkStore.get(selectionAtom) === bulkBefore.selection &&
    bulkStore.get(edgeDraftAtom) === bulkBefore.draft &&
    bulkStore.get(graphPasteCountAtom) === 0 &&
    bulkStore.get(editorModeAtom) === "node",
  "990 plus 20 paste rejects atomically including all interaction state",
);
const limitGraph = {
  ...createEmptyGraphModel(),
  nodes: [{ id: "x", label: "", order: 0, x: 0, y: 0 }],
};
limitGraph.nodes[0]!.id += "x".repeat(
  2_000_000 - serializeGraphModel(limitGraph).length,
);
const limitJson = serializeGraphModel(limitGraph);
expect(
  limitJson.length === 2_000_000 && parseGraphModelJson(limitJson) !== null,
  "exact JSON character limit roundtrips",
);
expect(
  parseGraphModelJson(limitJson + " ") === null,
  "JSON limit plus one rejects",
);
expect(
  importGraphInput(serializeGraphModel(createEmptyGraphModel()), {
    format: "json",
  }).status === "empty",
  "valid empty JSON is a successful empty import",
);

const numericStore = createStore();
const labels = ["9007199254740993", "-9007199254740993", "0007", "free"];
const numericGraph = {
  ...createEmptyGraphModel(),
  nodes: labels.map((label, order) => ({
    id: `n${order}`,
    label,
    order,
    x: order * 100,
    y: 0,
  })),
};
numericGraph.settings.indexBase = 0;
numericStore.set(executeCommandAtom, replaceModelCommand(numericGraph));
const numericBefore = numericStore.get(graphAtom);
const numericResult = numericStore.set(
  executeCommandAtom,
  updateSettingsCommand({ indexBase: 1 }),
);
expect(
  numericResult.status === "applied" &&
    numericResult.graph === numericStore.get(graphAtom),
  "applied result identifies the committed graph",
);
expect(
  isDeepStrictEqual(
    numericStore.get(graphAtom).nodes.map((n) => n.label),
    ["9007199254740994", "-9007199254740992", "8", "free"],
  ),
  "integer shifts retain exact precision and existing zero normalization",
);
numericStore.set(undoAtom);
expect(
  isDeepStrictEqual(numericStore.get(graphAtom), numericBefore),
  "undo restores original label strings",
);
const canonical = numericStore.get(graphAtom);
const numericHistory = numericStore.get(historyAtom);
const same = numericStore.set(
  executeCommandAtom,
  replaceModelCommand(structuredClone(canonical)),
);
expect(
  same.status === "noop" &&
    same.graph === canonical &&
    numericStore.get(historyAtom) === numericHistory,
  "noop returns stored identity without adding history",
);
numericStore.set(
  executeCommandAtom,
  updateNodeCommand("n0", { label: "9".repeat(256) }),
);
const boundary = numericStore.get(graphAtom),
  boundaryHistory = numericStore.get(historyAtom);
expect(
  numericStore.set(executeCommandAtom, updateSettingsCommand({ indexBase: 1 }))
    .status === "rejected",
  "label growth beyond contract rejects the whole setting change",
);
expect(
  numericStore.get(graphAtom) === boundary &&
    numericStore.get(historyAtom) === boundaryHistory,
  "label overflow preserves settings, graph and history",
);
finish();
