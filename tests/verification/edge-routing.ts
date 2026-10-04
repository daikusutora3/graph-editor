import {
  edgeBendFromRenderedPointer,
  edgeBendHandlePosition,
} from "../../features/graph-editor/canvas/GraphCanvasHitboxOverlays";
import { createStore } from "jotai/vanilla";

import {
  parseStoredGraph,
  serializeStoredGraphForWrite,
} from "../../features/graph-editor/adapters/browser/stored-graph";
import { defaultGraphSettings } from "../../features/graph-editor/core/graph/graph-factory";
import { updateEdgeCommand } from "../../features/graph-editor/core/graph/graph-intents";
import type {
  GraphEdge,
  GraphModel,
} from "../../features/graph-editor/core/graph/model";
import { estimateNodeWidth } from "../../features/graph-editor/core/graph/node-size";
import { edgeCurveMidpoint } from "../../features/graph-editor/core/layout/edge-route-geometry";
import {
  chooseLoopDirection,
  createLoopDirectionTask,
  loopDirectionCandidates,
  loopSamplePoints,
  normalizeDegrees,
  scoreLoopDirection,
} from "../../features/graph-editor/core/layout/edge-routing-loops";
import type { ResolvedEdgeRoutingOptions } from "../../features/graph-editor/core/layout/edge-routing-shared";
import {
  layoutLine,
  layoutTree,
} from "../../features/graph-editor/layouts/layout-algorithms";
import { createSizedSampleGraph } from "../../features/graph-editor/samples/sample-graphs";
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
  createEdgeRoutingCacheKey(baseGraph) !==
    createEdgeRoutingCacheKey({
      ...decoratedGraph,
      edges: decoratedGraph.edges.map((edge) => ({
        ...edge,
        label: "renamed edge",
      })),
    }),
  "routing cache identity should invalidate visible edge labels",
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

const sevenNodeTree = createSizedSampleGraph("tree", 7, {
  autoEdgeRouting: true,
});
const linePositions = layoutLine(sevenNodeTree);
const lineTree = {
  ...sevenNodeTree,
  nodes: sevenNodeTree.nodes.map((node) => ({
    ...node,
    ...linePositions[node.id],
  })),
};
const treePositions = layoutTree(sevenNodeTree);
const restoredTree = {
  ...sevenNodeTree,
  nodes: sevenNodeTree.nodes.map((node) => ({
    ...node,
    ...treePositions[node.id],
  })),
};
const lineRoutes = computeEdgeRouting(lineTree, {
  previousMeta: computeEdgeRouting(sevenNodeTree),
});
const restoredRoutes = computeEdgeRouting(restoredTree, {
  previousMeta: lineRoutes,
});
expect(
  [...restoredRoutes.values()].every((route) => route.bowPx === 0),
  "returning from line to tree layout should clear unnecessary automatic bends",
);
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

const hexagonWithChords: GraphModel = {
  ...graphFixture([]),
  nodes: [
    [0, -150],
    [130, -75],
    [130, 75],
    [0, 150],
    [-130, 75],
    [-130, -75],
  ].map(([x, y], order) => ({
    id: `n${order}`,
    label: String(order),
    order,
    x,
    y,
  })),
  edges: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 5],
    [5, 0],
    [0, 1],
    [1, 5],
    [0, 2],
    [1, 4],
    [2, 5],
    [3, 5],
  ].map(([source, target], index) => ({
    id: `e${index}`,
    source: `n${source}`,
    target: `n${target}`,
  })),
};
const hexagonRoutes = computeEdgeRouting(hexagonWithChords);
expect(
  hexagonRoutes.get("e7")?.bowPx === 0,
  "hexagon chord 1–5 should stay straight when bending does not remove a crossing or avoid a node",
);
expect(
  hexagonRoutes.get("e0")?.bowPx !== hexagonRoutes.get("e6")?.bowPx,
  "keeping an unobstructed hexagon chord straight must still separate its parallel boundary edges",
);
const previouslyBentHexagon = new Map(hexagonRoutes);
previouslyBentHexagon.set("e7", routeMeta(-128));
const straightenedHexagonRoutes = computeEdgeRouting(hexagonWithChords, {
  previousMeta: previouslyBentHexagon,
});
expect(
  straightenedHexagonRoutes.get("e7")?.bowPx === 0,
  "hexagon chord 1–5 should return to straight instead of retaining an unnecessary previous bend",
);
expect(
  straightenedHexagonRoutes.get("e0")?.bowPx !==
    straightenedHexagonRoutes.get("e6")?.bowPx,
  "straightening a hexagon chord must preserve distinct parallel routes",
);

const crossingAtSampleBoundary: GraphModel = {
  ...graphFixture([
    { id: "ab", source: "a", target: "b" },
    { id: "cd", source: "c", target: "d" },
  ]),
  nodes: [
    { id: "a", label: "A", order: 0, x: -130, y: 0 },
    { id: "b", label: "B", order: 1, x: 130, y: 0 },
    { id: "c", label: "C", order: 2, x: -100, y: -104 },
    { id: "d", label: "D", order: 3, x: 100, y: 136 },
  ],
};
expect(
  computeEdgeRouting(crossingAtSampleBoundary).get("ab")?.bowPx === 0,
  "a crossing on a curve-sampling boundary must not introduce a bend when the crossing count is unchanged",
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
const obstructedLoopGraph: GraphModel = {
  ...graphFixture([{ id: "loop", source: "a", target: "a" }]),
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 50, y: -50 },
  ],
  settings: {
    ...defaultGraphSettings,
    allowSelfLoops: true,
    autoEdgeRouting: true,
  },
};
const loopDirection =
  computeEdgeRouting(obstructedLoopGraph).get("loop")?.loopDirectionDeg;
const renderedLoopAngle = (((loopDirection ?? 0) - 90) * Math.PI) / 180;
expect(
  loopDirection != null &&
    Math.cos(renderedLoopAngle) * 50 + Math.sin(renderedLoopAngle) * -50 <=
      0.000001,
  "automatic routing should point the rendered self-loop away from the nearby node",
);
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
    simpleAutomatic.get("manual")?.bowPx === 0,
  "disabled auto routing should keep manual curves and otherwise use straight edges",
);
{
  const bows = [...simpleParallel.values()].map((route) => route.bowPx);
  expect(
    new Set(bows).size === bows.length &&
      Math.abs(bows.reduce((sum, bow) => sum + bow, 0)) < 1e-9,
    "disabled auto routing should still fan parallel edges symmetrically around the straight line",
  );
}

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

const pointerBow = edgeBendFromRenderedPointer(
  { sourceX: 0, sourceY: 0, targetX: 200, targetY: 0 },
  { x: 100, y: 60 },
  2,
);
expect(
  pointerBow.bowPx === 60,
  "bend handle pointer distance should account for zoom and the quadratic midpoint",
);
const pointerBend = edgeBendFromRenderedPointer(
  { sourceX: 0, sourceY: 0, targetX: 200, targetY: 0 },
  { x: 120, y: 60 },
  2,
);
expect(
  pointerBend.bowPx === 60.6 && pointerBend.bowT === 0.6,
  "bend control point should sit above the pointer and pass through it",
);
expect(
  edgeBendFromRenderedPointer(
    { sourceX: 0, sourceY: 0, targetX: 200, targetY: 0 },
    { x: 10, y: 20 },
    1,
  ).bowT === 0.05,
  "bend position should be clamped near the endpoints",
);
const renderedMidpoint = edgeBendHandlePosition(
  {
    id: "manual",
    label: "",
    sourceX: 0,
    sourceY: 0,
    targetX: 200,
    targetY: 0,
    sourceWidth: 48,
    targetWidth: 48,
    nodeHeight: 48,
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
verifyRoutingGeometryWork();
verifyParallelRoutingHistoryWork();
verifyLoopRoutingWork();

finish();

function verifyLoopRoutingWork() {
  const options: ResolvedEdgeRoutingOptions = {
    avoidNodes: true,
    work: { units: 0, samples: new Map() },
    candidateBowPx: [],
    duplicateBowPx: 36,
    loopDirectionDeg: -45,
    loopDirectionStepDeg: 42,
    loopSweepDeg: 70,
    loopSweepStepDeg: 16,
    maxLoopSweepDeg: 120,
    nodeClearancePx: 42,
    previousMeta: new Map(),
    rerouteEdgeIds: null,
    separateParallelEdges: true,
    variant: 0,
  };
  for (const translation of [0, 1e9, 1e20]) {
    for (const label of ["A", "長いラベル".repeat(20)]) {
      const source = {
        id: "source",
        label,
        order: 0,
        x: translation,
        y: -translation,
        measuredWidth: estimateNodeWidth(label),
      };
      const nodes = [
        source,
        ...Array.from({ length: 180 }, (_, index) => {
          // Include both sides of the inner/outer clearance boundary, dense
          // nearby obstacles, and remote nodes that should be pruned.
          const radii = [
            0,
            29.4 - 1e-8,
            29.4 + 1e-8,
            71.4,
            113.4 - 1e-8,
            113.4 + 1e-8,
            5000,
          ];
          const radius = radii[index % radii.length]!;
          const angle = index * 0.37;
          return {
            id: `n${index}`,
            label,
            order: index + 1,
            x: source.x + Math.cos(angle) * radius,
            y: source.y + Math.sin(angle) * radius,
            measuredWidth: estimateNodeWidth(label),
          };
        }),
      ];
      const exhaustive = loopDirectionCandidates(options).reduce(
        (best, candidate) => {
          const points = loopSamplePoints(source, candidate, options);
          let score =
            Math.abs(normalizeDegrees(candidate - options.loopDirectionDeg)) *
            0.01;
          for (const node of nodes) {
            if (node.id === source.id) continue;
            const distance = Math.min(
              ...points.map((point) =>
                Math.hypot(node.x - point.x, node.y - point.y),
              ),
            );
            const overlap = Math.max(0, options.nodeClearancePx - distance);
            score += overlap * overlap;
          }
          expect(
            scoreLoopDirection(candidate, source, nodes, options) === score,
            "candidate bounds should preserve exhaustive loop collision scores",
          );
          return score < best.score ||
            (score === best.score &&
              Math.abs(candidate - options.loopDirectionDeg) <
                Math.abs(best.direction - options.loopDirectionDeg))
            ? { direction: candidate, score }
            : best;
        },
        { direction: options.loopDirectionDeg, score: Infinity },
      );
      expect(
        chooseLoopDirection(source, nodes, options) === exhaustive.direction,
        "pruned loop routing should match exhaustive scoring for dense, boundary, translated, and pill-label obstacles",
      );
      const task = createLoopDirectionTask(source, nodes, options);
      let step = task.next();
      expect(
        !step.done,
        "loop direction scoring should yield between candidates",
      );
      while (!step.done) step = task.next();
      expect(
        step.value === exhaustive.direction,
        "resuming loop scoring should retain the exhaustive direction",
      );
    }
  }

  let coordinateReads = 0;
  const source = { id: "source", label: "S", order: 0, x: 0, y: 0 };
  const distantNodes = Array.from({ length: 600 }, (_, index) => ({
    id: `far${index}`,
    order: index + 1,
    label: "Far",
    get x() {
      coordinateReads++;
      return 10000 + index;
    },
    y: 10000,
  }));
  expect(
    chooseLoopDirection(source, distantNodes, options) ===
      options.loopDirectionDeg,
    "remote obstacles should preserve the default loop direction",
  );
  expect(
    coordinateReads === distantNodes.length,
    "each remote loop obstacle should be inspected once rather than once per sample and direction",
  );
  expect(
    chooseLoopDirection(source, distantNodes, {
      ...options,
      loopDirectionDeg: -44.5,
    }) === -44,
    "unobstructed quality loops should retain rounded fractional direction candidates",
  );
}

function verifyRoutingGeometryWork() {
  const label = "長いラベル".repeat(20);
  let labelReads = 0;
  const graph: GraphModel = {
    ...graphFixture([]),
    nodes: Array.from({ length: 30 }, (_, index) => ({
      id: `n${index}`,
      order: index,
      get label() {
        labelReads++;
        return label;
      },
      x: (index % 10) * 90,
      y: Math.floor(index / 10) * 90,
    })),
    edges: Array.from({ length: 60 }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % 30}`,
      target: `n${(index + 1) % 30}`,
    })),
  };
  const routes = computeEdgeRouting(graph);
  expect(
    labelReads <= graph.nodes.length * 4,
    "routing should read long node labels a bounded number of times per node",
  );
  const measured = {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      measuredWidth: estimateNodeWidth(label),
    })),
  };
  expect(
    routingSignature(routes) === routingSignature(computeEdgeRouting(measured)),
    "resolving geometry once should preserve routes with estimated node widths",
  );
  expect(
    graph.nodes.every((node) => !("measuredWidth" in node)),
    "routing should not add transient widths to the editable model",
  );
}

function verifyParallelRoutingHistoryWork() {
  const graph: GraphModel = {
    ...graphFixture([]),
    nodes: Array.from({ length: 40 }, (_, index) => ({
      id: `n${index}`,
      label: String(index),
      order: index,
      x: (index % 10) * 90,
      y: Math.floor(index / 10) * 90,
    })),
    edges: Array.from({ length: 200 }, (_, index) => ({
      id: `e${index}`,
      // Include both directions so canonical orientation and lane centering
      // are exercised together.
      source: `n${index % 2 ? (index + 1) % 40 : index % 40}`,
      target: `n${index % 2 ? index % 40 : (index + 1) % 40}`,
    })),
  };
  const previousMeta = computeEdgeRouting(graph);
  const before = routingSignature(previousMeta);
  let fullMapReads = 0;
  const iterator = previousMeta[Symbol.iterator].bind(previousMeta);
  previousMeta[Symbol.iterator] = () => {
    fullMapReads++;
    return iterator();
  };
  computeEdgeRouting(graph, { previousMeta });
  expect(
    fullMapReads <= 1,
    "parallel routing should not copy the entire route history for each group",
  );
  expect(
    routingSignature(previousMeta) === before,
    "canonical orientation and lane centering should not mutate previous routes",
  );
}

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
