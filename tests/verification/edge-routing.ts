import { createStore } from "jotai/vanilla";

import {
  parseStoredGraph,
  serializeStoredGraphForWrite,
} from "../../features/graph-editor/adapters/browser/stored-graph";
import {
  edgeBendHandlePosition,
  edgeBowPxFromRenderedPointer,
} from "../../features/graph-editor/canvas/GraphCanvasHitboxOverlays";
import { defaultGraphSettings } from "../../features/graph-editor/core/graph/graph-factory";
import { updateEdgeCommand } from "../../features/graph-editor/core/graph/graph-intents";
import type {
  GraphEdge,
  GraphModel,
} from "../../features/graph-editor/core/graph/model";
import { edgeCurveMidpoint } from "../../features/graph-editor/core/layout/edge-route-geometry";
import {
  emptyEdgeRoutingContinuitySnapshot,
  readPreviousAutomaticRoutingMeta,
  updateAutomaticRoutingSnapshot,
} from "../../features/graph-editor/core/layout/edge-routing-continuity";
import {
  createEdgeRoutingCacheKey,
  computeEdgeRouting,
  type EdgeRoutingMeta,
} from "../../features/graph-editor/core/layout/edge-routing";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  executeCommandAtom,
  historyAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Edge routing");

const baseGraph = graphFixture([
  { id: "ab-1", source: "a", target: "b" },
  { id: "ab-2", source: "a", target: "b" },
]);
const initialRoutes = computeEdgeRouting(baseGraph);

expect(
  routingSignature(initialRoutes) ===
    routingSignature(computeEdgeRouting(baseGraph)),
  "routing should be deterministic",
);

const decoratedGraph: GraphModel = {
  ...baseGraph,
  nodes: baseGraph.nodes.map((node) => ({
    ...node,
    label: `renamed-${node.label}`,
    color: "blue",
  })),
  edges: baseGraph.edges.map((edge) => ({
    ...edge,
    color: "green",
  })),
};
expect(
  routingSignature(
    computeEdgeRouting(decoratedGraph, { previousMeta: initialRoutes }),
  ) === routingSignature(initialRoutes),
  "unrelated labels and colors should not move existing routes",
);
expect(
  createEdgeRoutingCacheKey(baseGraph) ===
    createEdgeRoutingCacheKey({
      ...decoratedGraph,
      edges: decoratedGraph.edges.map((edge) => ({
        ...edge,
        label: "renamed edge",
      })),
    }),
  "routing cache identity should ignore edge labels and colors",
);

const dragStartGraph: GraphModel = {
  ...graphFixture([]),
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 120, y: 0 },
    { id: "c", label: "C", order: 2, x: 240, y: 0 },
    { id: "d", label: "D", order: 3, x: 120, y: 96 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
    { id: "ad", source: "a", target: "d" },
    { id: "dc", source: "d", target: "c" },
  ],
};
const dragStartRoutes = computeEdgeRouting(dragStartGraph);
const dragEndGraph: GraphModel = {
  ...dragStartGraph,
  nodes: dragStartGraph.nodes.map((node) =>
    node.id === "b" ? { ...node, x: 120, y: -96 } : node,
  ),
};
const dragPreviewRoutes = computeEdgeRouting(dragEndGraph, {
  previousMeta: dragStartRoutes,
  rerouteEdgeIds: new Set(["ab", "bc"]),
});
const dragCommitRoutes = computeEdgeRouting(dragEndGraph, {
  previousMeta: dragStartRoutes,
});
expect(
  routingSignature(dragPreviewRoutes) === routingSignature(dragCommitRoutes),
  "node drag preview and committed routing should use the same baseline",
);

const threeParallel = graphFixture([
  ...baseGraph.edges,
  { id: "ab-3", source: "a", target: "b" },
]);
const threeRoutes = computeEdgeRouting(threeParallel, {
  previousMeta: initialRoutes,
});
expect(
  relativeOrder(baseGraph.edges, initialRoutes) ===
    relativeOrder(baseGraph.edges, threeRoutes),
  "adding a third parallel edge should preserve the existing relative side order",
);

const remainingEdges = [threeParallel.edges[0]!, threeParallel.edges[2]!];
const remainingRoutes = computeEdgeRouting(graphFixture(remainingEdges), {
  previousMeta: threeRoutes,
});
expect(
  relativeOrder(remainingEdges, threeRoutes) ===
    relativeOrder(remainingEdges, remainingRoutes),
  "deleting one parallel edge should preserve the remaining relative side order",
);

const obstructedGraph: GraphModel = {
  ...graphFixture([{ id: "ab", source: "a", target: "b" }]),
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 240, y: 0 },
    { id: "obstacle-0", label: "O0", order: 2, x: 120, y: 0 },
    { id: "obstacle-1", label: "O1", order: 3, x: 120, y: 45 },
    { id: "obstacle-2", label: "O2", order: 4, x: 120, y: 90 },
  ],
};
const previousPositiveRoute = new Map<string, EdgeRoutingMeta>([
  ["ab", routeMeta(64)],
]);
expect(
  computeEdgeRouting(obstructedGraph, {
    previousMeta: previousPositiveRoute,
  }).get("ab")!.bowPx < 0,
  "node collision avoidance should switch sides when the stable side becomes obstructed",
);

const manualGraph: GraphModel = {
  ...baseGraph,
  edges: [
    {
      id: "manual",
      source: "a",
      target: "b",
      routing: { bowPx: 48 },
    },
  ],
};
const manualRoute = computeEdgeRouting(manualGraph).get("manual");
expect(
  manualRoute?.bowPx === 48 && manualRoute.controlPointDistancesPx[0] === 48,
  "manual routing.bowPx should win over automatic routing",
);

const automaticBeforeManual = computeEdgeRouting({
  ...manualGraph,
  edges: [{ ...manualGraph.edges[0]!, routing: undefined }],
});
const automaticSnapshot = updateAutomaticRoutingSnapshot(
  { ...manualGraph, edges: [{ ...manualGraph.edges[0]!, routing: undefined }] },
  emptyEdgeRoutingContinuitySnapshot(),
  automaticBeforeManual,
);
const manualDuringEdit = computeEdgeRouting(manualGraph, {
  previousMeta: readPreviousAutomaticRoutingMeta(
    manualGraph,
    automaticSnapshot,
  ),
});
const snapshotDuringEdit = updateAutomaticRoutingSnapshot(
  manualGraph,
  automaticSnapshot,
  manualDuringEdit,
);
const automaticAfterUndo = computeEdgeRouting(
  { ...manualGraph, edges: [{ ...manualGraph.edges[0]!, routing: undefined }] },
  {
    previousMeta: readPreviousAutomaticRoutingMeta(
      {
        ...manualGraph,
        edges: [{ ...manualGraph.edges[0]!, routing: undefined }],
      },
      snapshotDuringEdit,
    ),
  },
);
expect(
  routingSignature(automaticAfterUndo) ===
    routingSignature(automaticBeforeManual),
  "undoing a manual bend should restore the automatic route from before the edit",
);

const simpleManual = computeEdgeRouting(manualGraph, { mode: "simple" });
const simpleAutomatic = computeEdgeRouting(
  { ...manualGraph, edges: [{ ...manualGraph.edges[0]!, routing: undefined }] },
  { mode: "simple" },
);
const simpleParallel = computeEdgeRouting(baseGraph, { mode: "simple" });
expect(
  simpleManual.get("manual")?.bowPx === 48 &&
    simpleAutomatic.get("manual")?.bowPx === 0 &&
    [...simpleParallel.values()].every((route) => route.bowPx === 0),
  "disabled auto routing should keep manual curves and otherwise use straight edges without parallel separation",
);

const curvedMidpoint = edgeCurveMidpoint(
  { x: 0, y: 0 },
  { x: 200, y: 0 },
  { controlPointDistancesPx: [80], controlPointWeights: [0.5] },
);
expect(
  curvedMidpoint.y === 40,
  "label anchors should use the actual curve midpoint",
);

const curvedCrossingGraph: GraphModel = {
  ...graphFixture([]),
  nodes: [
    { id: "a", label: "A", order: 0, x: -100, y: 0 },
    { id: "b", label: "B", order: 1, x: 100, y: 0 },
    { id: "c", label: "C", order: 2, x: -70, y: 30 },
    { id: "d", label: "D", order: 3, x: 70, y: 30 },
  ],
  edges: [
    {
      id: "curved",
      source: "a",
      target: "b",
      routing: { bowPx: 100 },
    },
    { id: "candidate", source: "c", target: "d" },
  ],
};
expect(
  computeEdgeRouting(curvedCrossingGraph).get("candidate")?.bowPx !== 0,
  "crossing evaluation should account for the other edge's curved route",
);

const curvedLabelGraph: GraphModel = {
  ...curvedCrossingGraph,
  nodes: [
    { id: "a", label: "A", order: 0, x: -100, y: 0 },
    { id: "b", label: "B", order: 1, x: 100, y: 0 },
    { id: "c", label: "C", order: 2, x: -50, y: 0 },
    { id: "d", label: "D", order: 3, x: 50, y: 0 },
  ],
  edges: [
    {
      id: "curved",
      source: "a",
      target: "b",
      label: "x",
      routing: { bowPx: 100 },
    },
    { id: "candidate", source: "c", target: "d", label: "y" },
  ],
};
expect(
  computeEdgeRouting(curvedLabelGraph).get("candidate")?.bowPx === 0,
  "label collision scoring should use the curved edge midpoint instead of its endpoint midpoint",
);

const pointerBow = edgeBowPxFromRenderedPointer(
  { sourceX: 0, sourceY: 0, targetX: 200, targetY: 0 },
  { x: 100, y: 60 },
  2,
);
expect(
  pointerBow === 60,
  "bend handle pointer distance should account for zoom and the quadratic midpoint",
);
const renderedMidpoint = edgeBendHandlePosition(
  {
    id: "manual",
    label: "",
    sourceX: 0,
    sourceY: 0,
    targetX: 200,
    targetY: 0,
    x: 94,
    y: 63,
    bowPx: 100,
    controlPointDistancesPx: [100],
    controlPointWeights: [0.5],
    loopDirectionDeg: -45,
    loopSweepDeg: 70,
  },
  null,
  1,
);
expect(
  renderedMidpoint.x === 94 && renderedMidpoint.y === 63,
  "an idle bend handle should use Cytoscape's exact rendered midpoint",
);

for (const route of computeEdgeRouting(obstructedGraph).values()) {
  expect(
    [
      route.bowPx,
      route.loopDirectionDeg,
      route.loopSweepDeg,
      ...route.controlPointDistancesPx,
      ...route.controlPointWeights,
    ].every(Number.isFinite),
    "all routing outputs should be finite numbers",
  );
}

verifyManualRoutingHistoryAndStorage();

finish();

function verifyManualRoutingHistoryAndStorage() {
  const store = createStore();
  store.set(syncExternalGraphAtom, manualGraph);
  store.set(
    executeCommandAtom,
    updateEdgeCommand("manual", { routing: { bowPx: -72 } }),
  );

  expect(
    store.get(historyAtom).length === 1 &&
      store.get(graphAtom).edges[0]?.routing?.bowPx === -72,
    "committing a handle drag should create one undoable command",
  );

  store.set(undoAtom);
  expect(
    store.get(graphAtom).edges[0]?.routing?.bowPx === 48,
    "undo should restore the previous manual curve",
  );

  store.set(redoAtom);
  expect(
    store.get(graphAtom).edges[0]?.routing?.bowPx === -72,
    "redo should restore the committed manual curve",
  );

  const serialized = serializeStoredGraphForWrite(store.get(graphAtom));
  const restored = serialized ? parseStoredGraph(serialized) : null;
  expect(
    restored?.edges[0]?.routing?.bowPx === -72,
    "manual routing should survive storage serialization and reload",
  );

  store.set(
    executeCommandAtom,
    updateEdgeCommand("manual", { routing: undefined }),
  );
  expect(
    store.get(graphAtom).edges[0]?.routing == null,
    "returning to automatic routing should remove the manual override",
  );
  store.set(undoAtom);
  expect(
    store.get(graphAtom).edges[0]?.routing?.bowPx === -72,
    "undo should restore a reset manual route",
  );
}

function graphFixture(edges: GraphEdge[]): GraphModel {
  return {
    version: 1,
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 240, y: 0 },
    ],
    edges,
    settings: { ...defaultGraphSettings, allowMultiEdges: true },
  };
}

function routeMeta(bowPx: number): EdgeRoutingMeta {
  return {
    bowPx,
    controlPointDistancesPx: [bowPx],
    controlPointWeights: [0.5],
    duplicate: false,
    loopDirectionDeg: -45,
    loopSweepDeg: 70,
  };
}

function routingSignature(routes: ReadonlyMap<string, EdgeRoutingMeta>) {
  return JSON.stringify(
    [...routes].map(([id, route]) => [
      id,
      route.bowPx,
      route.controlPointDistancesPx,
      route.controlPointWeights,
      route.loopDirectionDeg,
      route.loopSweepDeg,
    ]),
  );
}

function relativeOrder(
  edges: GraphEdge[],
  routes: ReadonlyMap<string, EdgeRoutingMeta>,
) {
  return edges
    .toSorted((a, b) => canonicalBow(a, routes) - canonicalBow(b, routes))
    .map((edge) => edge.id)
    .join(",");
}

function canonicalBow(
  edge: GraphEdge,
  routes: ReadonlyMap<string, EdgeRoutingMeta>,
) {
  const bowPx = routes.get(edge.id)?.bowPx ?? 0;
  return edge.source <= edge.target ? bowPx : -bowPx;
}
