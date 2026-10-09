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
import {
  edgeCurveMidpoint,
  minimumCurveDistanceToNode,
  reverseEdgeCurve,
} from "../../features/graph-editor/core/layout/edge-route-geometry";
import {
  chooseLoopDirection,
  createLoopDirectionTask,
  loopDirectionCandidates,
  loopSamplePoints,
  loopLabelPoint,
  normalizeLoopStepSize,
  normalizeDegrees,
  scoreLoopDirection,
} from "../../features/graph-editor/core/layout/edge-routing-loops";
import {
  edgeLabelSize,
  type ResolvedEdgeRoutingOptions,
} from "../../features/graph-editor/core/layout/edge-routing-shared";
import {
  layoutLine,
  layoutTree,
} from "../../features/graph-editor/layouts/layout-algorithms";
import {
  createSampleGraph,
  createSizedSampleGraph,
} from "../../features/graph-editor/samples/sample-graphs";
import {
  emptyEdgeRoutingContinuitySnapshot,
  readPreviousAutomaticRoutingMeta,
  updateAutomaticRoutingSnapshot,
} from "../../features/graph-editor/core/layout/edge-routing-continuity";
import {
  createEdgeRoutingCacheKey,
  createEdgeRoutingTask,
  edgeRoutingProgress,
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

for (const directed of [false, true]) {
  for (const labelKind of ["none", "weight", "label"] as const) {
    for (const reverseOrder of [false, true]) {
      const sample = createSizedSampleGraph("tree", 7, {
        autoEdgeRouting: true,
        directed,
        weighted: labelKind === "weight",
      });
      const sevenNodeTree = {
        ...sample,
        edges: (reverseOrder ? sample.edges.toReversed() : sample.edges).map(
          (edge) => (labelKind === "label" ? { ...edge, label: "1" } : edge),
        ),
      };
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
      const freshTreeRoutes = computeEdgeRouting(restoredTree);
      let routes = computeEdgeRouting(sevenNodeTree);
      for (let cycle = 0; cycle < 3; cycle++) {
        const lineRoutes = computeEdgeRouting(lineTree, {
          previousMeta: routes,
        });
        expect(
          [...lineRoutes.values()].some((route) => route.bowPx !== 0),
          "line layout should still bend tree edges to avoid intervening nodes",
        );
        routes = computeEdgeRouting(restoredTree, { previousMeta: lineRoutes });
        const context = `${directed ? "directed" : "undirected"}, ${labelKind}, ${reverseOrder ? "reverse" : "original"} edge order, cycle ${cycle + 1}`;
        expect(
          [...routes.values()].every((route) =>
            route.controlPointDistancesPx.every((distance) => distance === 0),
          ),
          `returning from line to tree should clear unnecessary bends (${context})`,
        );
        expect(
          routingSignature(routes) === routingSignature(freshTreeRoutes),
          `restored tree routes should match a fresh tree (${context})`,
        );
      }
    }
  }
}
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
for (const count of [2, 3, 4, 10]) {
  const graph: GraphModel = {
    ...obstructedLoopGraph,
    nodes: [obstructedLoopGraph.nodes[0]],
    edges: Array.from({ length: count }, (_, index) => ({
      id: `loop-${index}`,
      source: "a",
      target: "a",
    })),
  };
  const routes = computeEdgeRouting(graph);
  const first = routes.get("loop-0")!;
  const second = routes.get("loop-1")!;
  expect(
    Math.abs(
      normalizeDegrees(second.loopDirectionDeg - first.loopDirectionDeg),
    ) >=
      360 / count - 1 &&
      [...routes.values()].every((route) => route.loopSweepDeg < 360 / count),
    `${count} automatic self-loops should occupy separate angular sectors`,
  );
  expect(
    routingSignature(routes) === routingSignature(computeEdgeRouting(graph)),
    "self-loop placement should remain deterministic",
  );
  if (count === 2) {
    const obstructed = {
      ...graph,
      nodes: [
        graph.nodes[0],
        { ...obstructedLoopGraph.nodes[1], x: -50, y: -50 },
      ],
    };
    const moved = computeEdgeRouting(obstructed);
    expect(
      moved.get("loop-0")!.loopDirectionDeg !== first.loopDirectionDeg,
      "a pair of loops should rotate away from a nearby node",
    );
    expect(
      Math.abs(
        normalizeDegrees(
          moved.get("loop-1")!.loopDirectionDeg -
            moved.get("loop-0")!.loopDirectionDeg,
        ),
      ) === 180,
      "node avoidance should preserve opposite directions for two loops",
    );
    graph.edges[0].routing = { loopDirectionDeg: 90, loopSweepDeg: 60 };
    const manual = computeEdgeRouting(graph).get("loop-0")!;
    expect(
      manual.loopDirectionDeg === 90 && manual.loopSweepDeg === 60,
      "explicit manual loop routing should remain unchanged",
    );
    graph.settings.autoEdgeRouting = false;
    graph.edges[0].routing = undefined;
    expect(
      computeEdgeRouting(graph).get("loop-0")!.loopSweepDeg === 70,
      "disabled automatic routing should preserve the existing simple layout",
    );
  }
}
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
  computeEdgeRouting(curvedCrossingGraph).get("candidate")?.bowPx === 0,
  "an ordinary crossing with a manual curve should keep a clear automatic edge straight",
);

const automaticCrossingGraph: GraphModel = {
  ...curvedCrossingGraph,
  edges: [
    curvedCrossingGraph.edges[1]!,
    { ...curvedCrossingGraph.edges[0]!, routing: undefined },
  ],
};
const previousCrossingRoutes = new Map([["curved", routeMeta(100)]]);
expect(
  computeEdgeRouting(automaticCrossingGraph, {
    previousMeta: previousCrossingRoutes,
  }).get("candidate")?.bowPx === 0,
  "a recomputed edge should not bend to avoid another edge's stale curve",
);
const partiallyRoutedCrossing = computeEdgeRouting(automaticCrossingGraph, {
  previousMeta: previousCrossingRoutes,
  rerouteEdgeIds: new Set(["candidate"]),
});
expect(
  partiallyRoutedCrossing.get("candidate")?.bowPx === 0 &&
    partiallyRoutedCrossing.get("curved") ===
      previousCrossingRoutes.get("curved"),
  "partial rerouting should preserve a later curve while tolerating its ordinary crossing",
);
expect(
  [...partiallyRoutedCrossing.keys()].join(",") === "candidate,curved",
  "preserving obstacles should not change output edge order",
);
const pendingPartial = computeEdgeRouting(automaticCrossingGraph, {
  previousMeta: new Map([
    ...previousCrossingRoutes,
    ["candidate", { ...routeMeta(0), status: "pending" as const }],
  ]),
  rerouteEdgeIds: new Set(["candidate"]),
});
expect(
  pendingPartial.get("curved") === previousCrossingRoutes.get("curved"),
  "a pending active edge must not authorize simplifying an untouched group",
);
expect(
  computeEdgeRouting({
    ...curvedCrossingGraph,
    edges: curvedCrossingGraph.edges.toReversed(),
  }).get("candidate")?.bowPx === 0,
  "a later manual curve should stay exact without forcing an ordinary crossing detour",
);

const parallelCrossingGraph: GraphModel = {
  ...automaticCrossingGraph,
  edges: [
    automaticCrossingGraph.edges[0]!,
    { id: "curved-1", source: "a", target: "b" },
    { id: "curved-2", source: "a", target: "b" },
  ],
};
const previousParallelCrossings = new Map([
  ["curved-1", routeMeta(64)],
  ["curved-2", routeMeta(100)],
]);
expect(
  computeEdgeRouting(parallelCrossingGraph, {
    previousMeta: previousParallelCrossings,
    rerouteEdgeIds: new Set(["candidate", "curved-1"]),
  }).get("candidate")?.bowPx === 0,
  "rerouting one parallel edge should discard stale obstacles for its whole group",
);
expect(
  computeEdgeRouting(parallelCrossingGraph, {
    previousMeta: new Map([["curved-1", routeMeta(100)]]),
    rerouteEdgeIds: new Set(["candidate"]),
  }).get("candidate")?.bowPx === 0,
  "a group missing previous routes should be recomputed rather than preserved as obstacles",
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

// Rectangle dimensions come from the renderer: short-label backgrounds are
//26graph px tall. A30px vertical gap already leaves visible space, even for
//long text; width must not inflate the required vertical clearance.
{
  const base: GraphModel = {
    ...graphFixture([]),
    nodes: [
      { id: "a", label: "", order: 0, x: 0, y: 0 },
      { id: "b", label: "", order: 1, x: 400, y: 0 },
      { id: "c", label: "", order: 2, x: 400, y: 60 },
    ],
    edges: [
      { id: "ab", source: "a", target: "b" },
      { id: "ac", source: "a", target: "c" },
    ],
  };
  for (const label of ["1", "abcdefghij"]) {
    const graph = {
      ...base,
      edges: base.edges.map((edge) => ({ ...edge, label })),
    };
    expect(
      [...computeEdgeRouting(graph).values()].every(
        (route) => route.bowPx === 0,
      ),
      `vertically separated ${label} labels should keep straight edges`,
    );
  }
  const separatedNode = {
    ...base,
    nodes: [
      base.nodes[0]!,
      base.nodes[1]!,
      { id: "o", label: "", order: 2, x: 200, y: 40 },
    ],
    edges: [base.edges[0]!],
  };
  expect(
    computeEdgeRouting(separatedNode).get("ab")?.bowPx === 0,
    "a40px centre gap should not bend a line16px outside the vertex",
  );
  const penetratingNode = {
    ...separatedNode,
    nodes: separatedNode.nodes.map((node) =>
      node.id === "o" ? { ...node, y: 0 } : node,
    ),
  };
  const route = computeEdgeRouting(penetratingNode).get("ab")!;
  expect(
    route.bowPx !== 0 &&
      minimumCurveDistanceToNode(
        penetratingNode.nodes[0]!,
        penetratingNode.nodes[1]!,
        route,
        penetratingNode.nodes[2]!,
      ) >= 30,
    "true vertex penetration should bend with visible clearance",
  );
  const reversedRoute = computeEdgeRouting({
    ...penetratingNode,
    edges: penetratingNode.edges.map((edge) => ({
      ...edge,
      source: edge.target,
      target: edge.source,
    })),
  }).get("ab")!;
  expect(
    JSON.stringify(reverseEdgeCurve(reversedRoute)) ===
      JSON.stringify({
        controlPointDistancesPx: route.controlPointDistancesPx,
        controlPointWeights: route.controlPointWeights,
      }),
    "reversing automatic endpoints should preserve the physical detour",
  );
}

{
  const labels: GraphModel = {
    ...graphFixture([]),
    nodes: [
      { id: "a", label: "", order: 0, x: -200, y: 0 },
      { id: "b", label: "", order: 1, x: 200, y: 0 },
      { id: "c", label: "", order: 2, x: 0, y: -200 },
      { id: "d", label: "", order: 3, x: 0, y: 200 },
    ],
    edges: [
      { id: "ab", source: "a", target: "b", label: "1" },
      { id: "cd", source: "c", target: "d", label: "1" },
    ],
  };
  const routes = computeEdgeRouting(labels);
  const first = edgeCurveMidpoint(
    labels.nodes[0]!,
    labels.nodes[1]!,
    routes.get("ab")!,
  );
  const second = edgeCurveMidpoint(
    labels.nodes[2]!,
    labels.nodes[3]!,
    routes.get("cd")!,
  );
  expect(
    [...routes.values()].some((route) => route.bowPx !== 0) &&
      (Math.abs(first.x - second.x) >= 20 ||
        Math.abs(first.y - second.y) >= 26),
    "coincident visible labels should separate their actual backgrounds",
  );
  const unlabeled = {
    ...labels,
    edges: labels.edges.map((edge) => ({ ...edge, label: undefined })),
  };
  expect(
    [...computeEdgeRouting(unlabeled).values()].every(
      (route) => route.bowPx === 0,
    ),
    "the same crossing without labels should stay straight",
  );
  const retainedLabel: GraphModel = {
    ...labels,
    nodes: [
      { id: "a", label: "", order: 0, x: -250, y: 0 },
      { id: "b", label: "", order: 1, x: 250, y: 0 },
      { id: "c", label: "", order: 2, x: -200, y: 50 },
      { id: "d", label: "", order: 3, x: 200, y: 50 },
    ],
    edges: [
      { id: "candidate", source: "c", target: "d", label: "1" },
      { id: "retained", source: "a", target: "b", label: "2" },
    ],
  };
  const old = new Map([["retained", routeMeta(100)]]);
  const partial = computeEdgeRouting(retainedLabel, {
    previousMeta: old,
    rerouteEdgeIds: new Set(["candidate"]),
  });
  expect(
    partial.get("retained") === old.get("retained") &&
      partial.get("candidate")?.bowPx !== 0,
    "a later retained label must remain an actual obstacle during partial routing",
  );
}

{
  const minimal: GraphModel = {
    ...graphFixture([]),
    nodes: [
      { id: "n0", label: "", order: 0, x: 180, y: 360 },
      { id: "n1", label: "", order: 1, x: 180, y: 450 },
      { id: "n2", label: "", order: 2, x: 0, y: 540 },
      { id: "n3", label: "", order: 3, x: 360, y: 270 },
    ],
    edges: [
      { id: "e0", source: "n0", target: "n1", label: "1" },
      { id: "e1", source: "n2", target: "n3", label: "1" },
    ],
  };
  const random = createSampleGraph("randomConnected", {
    autoEdgeRouting: true,
    weighted: true,
    directed: true,
  });
  for (const graph of [
    minimal,
    random,
    createSampleGraph("bipartite", {
      autoEdgeRouting: true,
      weighted: true,
      directed: true,
    }),
    createSampleGraph("petersen", {
      autoEdgeRouting: true,
      weighted: true,
      directed: true,
    }),
  ]) {
    const initial = finishTask(createEdgeRoutingTask(graph));
    const signature = canonicalSignature(initial);
    expect(
      canonicalSignature(
        finishTask(
          createEdgeRoutingTask({ ...graph, edges: graph.edges.toReversed() }),
        ),
      ) === signature,
      "automatic singleton routes should not depend on edge array order",
    );
    expect(
      canonicalSignature(
        finishTask(createEdgeRoutingTask(graph, { previousMeta: initial })),
      ) === signature,
      "finished routes should remain stable on repeated calculation",
    );
    const line = {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        ...layoutLine(graph)[node.id],
      })),
    };
    const lineRoutes = finishTask(
      createEdgeRoutingTask(line, { previousMeta: initial }),
    );
    expect(
      canonicalSignature(
        finishTask(createEdgeRoutingTask(graph, { previousMeta: lineRoutes })),
      ) === signature,
      "restoring coordinates should restore canonical automatic routes",
    );
  }
  const minimalRoutes = computeEdgeRouting(minimal);
  expect(
    minimalRoutes.get("e0")?.bowPx === 0 &&
      minimalRoutes.get("e1")?.bowPx !== 0,
    "label separation should bend the longer edge while preserving the short connection",
  );
  expect(
    computeEdgeRouting(random).get("e5")?.bowPx === 0,
    "final geometry should remove the random sample's obsolete e5detour",
  );
}

{
  const weightedParallel: GraphModel = {
    ...graphFixture([]),
    nodes: [
      { id: "a", label: "", order: 0, x: 0, y: 0 },
      { id: "b", label: "", order: 1, x: 400, y: 0 },
    ],
    edges: [
      { id: "ab1", source: "a", target: "b", label: "1" },
      { id: "ab2", source: "a", target: "b", label: "2" },
    ],
  };
  const routes = computeEdgeRouting(weightedParallel);
  const anchors = weightedParallel.edges.map((edge) =>
    edgeCurveMidpoint(
      weightedParallel.nodes[0]!,
      weightedParallel.nodes[1]!,
      routes.get(edge.id)!,
    ),
  );
  expect(
    Math.abs(anchors[0]!.y - anchors[1]!.y) >= 26,
    "parallel labels should retain separate visible backgrounds",
  );
}

{
  for (const reversed of [false, true]) {
    for (const manualFirst of [false, true]) {
      for (const bowT of [0.2, 0.5, 0.8]) {
        for (const mode of ["quality", "parallel"] as const) {
          const manual: GraphEdge = {
            id: "manual",
            source: reversed ? "b" : "a",
            target: reversed ? "a" : "b",
            label: "1",
            routing: { bowPx: 64, bowT },
          };
          const automatic: GraphEdge = {
            id: "automatic",
            source: "a",
            target: "b",
            label: "2",
          };
          const graph: GraphModel = {
            ...graphFixture([]),
            nodes: [
              { id: "a", label: "", order: 0, x: 0, y: 0 },
              { id: "b", label: "", order: 1, x: 400, y: 0 },
            ],
            edges: manualFirst ? [manual, automatic] : [automatic, manual],
          };
          const routes = computeEdgeRouting(graph, { mode });
          const fixed = routes.get("manual")!;
          expect(
            fixed.bowPx === 64 &&
              fixed.controlPointDistancesPx[0] === 64 &&
              fixed.controlPointWeights[0] === bowT,
            "mixed parallel routing must preserve the exact manual bow and weight",
          );
          const manualAnchor = edgeCurveMidpoint(
            graph.nodes[reversed ? 1 : 0]!,
            graph.nodes[reversed ? 0 : 1]!,
            fixed,
          );
          const automaticAnchor = edgeCurveMidpoint(
            graph.nodes[0]!,
            graph.nodes[1]!,
            routes.get("automatic")!,
          );
          expect(
            Math.abs(manualAnchor.x - automaticAnchor.x) >= 28 ||
              Math.abs(manualAnchor.y - automaticAnchor.y) >= 28,
            "mixed manual and automatic parallel labels must have separate actual backgrounds, in both edge orders and directions",
          );
          expect(
            routes.get("automatic")?.bowPx === 0,
            "a clear automatic sibling should stay straight beside a fixed manual bow regardless of order or direction",
          );
        }
      }
    }
  }
}

{
  const horizontal: GraphModel = {
    ...graphFixture([]),
    nodes: [
      { id: "a", order: 0, label: "", x: 0, y: 0 },
      { id: "b", order: 1, label: "", x: 400, y: 0 },
    ],
    edges: ["1", "2"].map((id) => ({
      id,
      source: "a",
      target: "b",
      label: "long label abcdefghijklmnop",
    })),
  };
  const vertical = {
    ...horizontal,
    nodes: [horizontal.nodes[0]!, { ...horizontal.nodes[1]!, x: 0, y: 400 }],
  };
  for (const mode of ["simple", "parallel"] as const) {
    expect(
      createEdgeRoutingCacheKey(horizontal, { mode }) !==
        createEdgeRoutingCacheKey(vertical, { mode }),
      "non-quality parallel label spacing must invalidate its cache when endpoints move",
    );
    expect(
      computeEdgeRouting(horizontal, { mode }).get("1")?.bowPx !==
        computeEdgeRouting(vertical, { mode }).get("1")?.bowPx,
      "labelled parallel lanes must follow the current chord direction",
    );
  }
}

{
  const mixedBudget: GraphModel = {
    ...graphFixture([]),
    nodes: Array.from({ length: 50 }, (_, i) => [
      { id: `a${i}`, order: i * 2, label: "", x: 0, y: i * 200 },
      { id: `b${i}`, order: i * 2 + 1, label: "", x: 400, y: i * 200 },
    ]).flat(),
    edges: Array.from({ length: 50 }, (_, i) => [
      {
        id: `manual${i}`,
        source: `a${i}`,
        target: `b${i}`,
        label: "1",
        routing: { bowPx: 64, bowT: 0.5 },
      },
      { id: `automatic${i}`, source: `a${i}`, target: `b${i}`, label: "2" },
    ]).flat(),
  };
  let draft = computeEdgeRouting(mixedBudget, { mode: "parallel" });
  expect(
    edgeRoutingProgress(draft).pendingEdgeIds.length > 0,
    "mixed manual label work must keep the synchronous scoring budget without recursive fallback",
  );
  for (
    let pass = 0;
    pass < 50 && edgeRoutingProgress(draft).pendingEdgeIds.length;
    pass++
  ) {
    draft = computeEdgeRouting(mixedBudget, {
      mode: "parallel",
      previousMeta: draft,
      rerouteEdgeIds: new Set(edgeRoutingProgress(draft).pendingEdgeIds),
    });
  }
  const finished = finishTask(
    createEdgeRoutingTask(mixedBudget, { mode: "parallel" }),
  );
  expect(
    edgeRoutingProgress(draft).pendingEdgeIds.length === 0 &&
      canonicalSignature(draft) === canonicalSignature(finished),
    "mixed parallel draft continuation must finish exactly like the full generator",
  );
  expect(
    [...draft].every(
      ([id, route]) => route.bowPx === (id.startsWith("manual") ? 64 : 0),
    ),
    "budget completion must preserve all manual routes and separate the automatic labels",
  );
}

{
  const heavy: GraphModel = {
    ...graphFixture([]),
    settings: {
      ...defaultGraphSettings,
      weighted: true,
      allowMultiEdges: true,
      autoEdgeRouting: true,
    },
    nodes: Array.from({ length: 200 }, (_, order) => ({
      id: `n${order}`,
      label: String(order),
      order,
      x: (order % 15) * 90,
      y: Math.floor(order / 15) * 90,
    })),
    edges: Array.from({ length: 400 }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % 200}`,
      target: `n${((index % 200) + 1 + ((index * 17) % 199)) % 200}`,
      weight: String(index % 10),
    })),
  };
  const saved = JSON.stringify(heavy);
  let draft = computeEdgeRouting(heavy);
  expect(
    edgeRoutingProgress(draft).pendingEdgeIds.length > 0,
    "synchronous quality routing should retain its work budget",
  );
  const complete = finishTask(
    createEdgeRoutingTask(heavy, {
      previousMeta: draft,
      rerouteEdgeIds: new Set(edgeRoutingProgress(draft).pendingEdgeIds),
    }),
  );
  expect(
    edgeRoutingProgress(complete).pendingEdgeIds.length === 0,
    "the resumed generator must finish all routing and final cleanup",
  );
  let synchronous = computeEdgeRouting(heavy);
  for (
    let pass = 0;
    pass < 100 && edgeRoutingProgress(synchronous).pendingEdgeIds.length;
    pass++
  )
    synchronous = computeEdgeRouting(heavy, {
      previousMeta: synchronous,
      rerouteEdgeIds: new Set(edgeRoutingProgress(synchronous).pendingEdgeIds),
    });
  expect(
    edgeRoutingProgress(synchronous).pendingEdgeIds.length === 0 &&
      canonicalSignature(synchronous) === canonicalSignature(complete),
    "synchronous budget chunks must resume the same canonical task",
  );
  expect(
    JSON.stringify(heavy) === saved,
    "routing scratch state must not enter the model",
  );
}

function finishTask(task: ReturnType<typeof createEdgeRoutingTask>) {
  let step = task.next();
  let steps = 0;
  while (!step.done && steps++ < 100_000) step = task.next();
  if (!step.done) throw new Error("Routing task did not finish");
  return step.value;
}
function canonicalSignature(routes: ReadonlyMap<string, EdgeRoutingMeta>) {
  return JSON.stringify(
    [...routes].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

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
verifyLoopGroupGeometry();

finish();

function verifyLoopGroupGeometry() {
  const loopGraph = (
    count: number,
    label = "loop A",
    nodeLabel = "0",
  ): GraphModel => ({
    ...graphFixture([]),
    settings: {
      ...defaultGraphSettings,
      directed: true,
      allowSelfLoops: true,
      allowMultiEdges: true,
      weighted: false,
      autoEdgeRouting: true,
    },
    nodes: [{ id: "source", label: nodeLabel, order: 0, x: 0, y: 0 }],
    edges: Array.from({ length: count }, (_, index) => ({
      id: `loop${index}`,
      source: "source",
      target: "source",
      label,
    })),
  });
  const assertLabelsSeparate = (
    graph: GraphModel,
    routes: ReadonlyMap<string, EdgeRoutingMeta>,
  ) => {
    for (let i = 0; i < graph.edges.length; i++)
      for (let j = 0; j < i; j++) {
        const a = graph.edges[i]!,
          b = graph.edges[j]!;
        const pa = loopLabelPoint(graph.nodes[0]!, routes.get(a.id)!),
          pb = loopLabelPoint(graph.nodes[0]!, routes.get(b.id)!);
        const sa = edgeLabelSize(a),
          sb = edgeLabelSize(b);
        expect(
          Math.abs(pa.x - pb.x) >= (sa.width + sb.width) / 2 + 2 ||
            Math.abs(pa.y - pb.y) >= 28,
          "estimated native-model loop-label backgrounds must be separate",
        );
      }
  };
  for (const count of [2, 3, 4, 8]) {
    const graph = loopGraph(count);
    for (const mode of ["simple", "quality"] as const) {
      const routes = computeEdgeRouting(graph, { mode });
      expect(
        edgeRoutingProgress(routes).pendingEdgeIds.length === 0,
        "small loop groups should finish before returning",
      );
      assertLabelsSeparate(graph, routes);
      expect(
        [...routes.values()].every(
          (route) =>
            normalizeLoopStepSize(route.loopStepSizePx) >= 40 &&
            normalizeLoopStepSize(route.loopStepSizePx) <= 180,
        ),
        "loop sizes must remain bounded transient geometry",
      );
      expect(
        [...routes.values()].every(
          (route) => route.loopSweepDeg <= 360 / count - 10,
        ),
        "automatic loop source sectors must stay separate in both avoidance modes",
      );
      const restored = computeEdgeRouting(graph, {
        mode: "quality",
        previousMeta: routes,
      });
      expect(
        canonicalSignature(restored) ===
          canonicalSignature(computeEdgeRouting(graph)),
        "toggling avoidance must restore canonical loop placement",
      );
    }
  }
  const manual = loopGraph(4);
  manual.edges[0] = {
    ...manual.edges[0]!,
    routing: { loopDirectionDeg: 45, loopSweepDeg: 65 },
  };
  for (const mode of ["simple", "quality"] as const) {
    const routes = computeEdgeRouting(manual, { mode });
    const fixed = routes.get("loop0")!;
    expect(
      fixed.loopDirectionDeg === 45 &&
        fixed.loopSweepDeg === 65 &&
        normalizeLoopStepSize(fixed.loopStepSizePx) === 40,
      "manual loop direction, sweep and default size must remain exact",
    );
    for (const edge of manual.edges.slice(1)) {
      const route = routes.get(edge.id)!;
      expect(
        Math.abs(normalizeDegrees(route.loopDirectionDeg - 45)) >=
          (route.loopSweepDeg + 65) / 2 + 4,
        "automatic loops must reserve the fixed manual sector",
      );
    }
    assertLabelsSeparate(manual, routes);
  }
  const pill = loopGraph(2, "loop A", "long-label-node-000000");
  for (const mode of ["simple", "quality"] as const) {
    const routes = computeEdgeRouting(pill, { mode });
    expect(
      [...routes.values()].every((route) => route.status !== "unresolved"),
      "automatic loop backgrounds must clear the source pill",
    );
    for (const route of routes.values()) {
      const p = loopLabelPoint(pill.nodes[0]!, route);
      expect(
        Math.abs(p.y) > 37,
        "pill-loop labels should lie beyond the source height",
      );
    }
    assertLabelsSeparate(pill, routes);
  }
  const shortSource = loopGraph(2);
  expect(
    createEdgeRoutingCacheKey(shortSource, { mode: "simple" }) !==
      createEdgeRoutingCacheKey(pill, { mode: "simple" }),
    "loop-size caches must invalidate when a source label widens with avoidance disabled",
  );
  const hidden = loopGraph(8, "");
  hidden.edges = hidden.edges.map((edge) => ({
    ...edge,
    label: undefined,
    weight: "1",
  }));
  expect(
    [...computeEdgeRouting(hidden).values()].every(
      (route) => normalizeLoopStepSize(route.loopStepSizePx) === 40,
    ),
    "stored hidden weights must not enlarge unlabelled loops",
  );
  const singleton = loopGraph(1, "1");
  expect(
    normalizeLoopStepSize(
      computeEdgeRouting(singleton).get("loop0")?.loopStepSizePx,
    ) === 40,
    "ordinary single loops must preserve their default size",
  );
  const longSingle = loopGraph(1, "WWWWWWWWWWWW");
  const longRoute = computeEdgeRouting(longSingle).get("loop0")!;
  const longPoint = loopLabelPoint(longSingle.nodes[0]!, longRoute);
  const longSize = edgeLabelSize(longSingle.edges[0]!);
  const longDx = Math.max(0, Math.abs(longPoint.x) - longSize.width / 2 - 4),
    longDy = Math.max(0, Math.abs(longPoint.y) - longSize.height / 2 - 4);
  expect(
    Math.hypot(longDx, longDy) >= 24,
    "a long automatic single-loop label must clear its circular source",
  );
  const retained = computeEdgeRouting(manual);
  const preserved = computeEdgeRouting(
    {
      ...manual,
      edges: [
        ...manual.edges,
        { id: "other", source: "source", target: "outside" },
      ],
      nodes: [
        ...manual.nodes,
        { id: "outside", label: "", order: 1, x: 400, y: 400 },
      ],
    },
    { previousMeta: retained, rerouteEdgeIds: new Set(["other"]) },
  );
  expect(
    manual.edges.every(
      (edge) => preserved.get(edge.id) === retained.get(edge.id),
    ),
    "untouched whole-loop groups must retain their exact metadata objects",
  );
  const dense = loopGraph(8, "loop A");
  dense.nodes.push(
    ...Array.from({ length: 400 }, (_, index) => ({
      id: `near${index}`,
      label: "",
      order: index + 1,
      x: Math.cos(index * 0.31) * 80,
      y: Math.sin(index * 0.31) * 80,
    })),
  );
  const saved = JSON.stringify(dense);
  let draft = computeEdgeRouting(dense);
  expect(
    edgeRoutingProgress(draft).pendingEdgeIds.length > 0,
    "loop node and label scoring must respect the synchronous work budget",
  );
  for (
    let pass = 0;
    pass < 100 && edgeRoutingProgress(draft).pendingEdgeIds.length;
    pass++
  )
    draft = computeEdgeRouting(dense, {
      previousMeta: draft,
      rerouteEdgeIds: new Set(edgeRoutingProgress(draft).pendingEdgeIds),
    });
  const full = finishTask(createEdgeRoutingTask(dense));
  expect(
    edgeRoutingProgress(draft).pendingEdgeIds.length === 0 &&
      canonicalSignature(draft) === canonicalSignature(full),
    "pending loop tasks must finish exactly like an uninterrupted generator",
  );
  expect(
    JSON.stringify(dense) === saved && !saved.includes("loopStepSizePx"),
    "transient loop sizes must never change the graph or its history data",
  );
}

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
          // Rust's hypot and the browser's Math.hypot can differ by a few ulps.
          // The chosen direction below must still match the exhaustive result.
          const candidateScore = scoreLoopDirection(
            candidate,
            source,
            nodes,
            options,
          );
          expect(
            Math.abs(candidateScore - score) <=
              Math.max(1e-10, Math.abs(score) * 1e-12),
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
