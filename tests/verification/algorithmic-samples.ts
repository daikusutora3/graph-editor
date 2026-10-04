import { algorithmicSampleFactories } from "../../features/graph-editor/samples/algorithmic-samples";
import { createSampleGraph } from "../../features/graph-editor/samples/sample-graphs";
import type {
  GraphModel,
  NodeId,
} from "../../features/graph-editor/core/graph/model";
import { computeEdgeRouting } from "../../features/graph-editor/core/layout/edge-routing";
import { edgeCurveMidpoint } from "../../features/graph-editor/core/layout/edge-route-geometry";
import { edgeLabelClearance } from "../../features/graph-editor/core/layout/edge-routing-shared";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Algorithmic samples");

for (const [kind, factory] of Object.entries(algorithmicSampleFactories)) {
  const settings = {
    directed: false,
    weighted: false,
    weightKind: "string" as const,
    indexBase: 1 as const,
    allowMultiEdges: false,
    allowSelfLoops: false,
    showNodeLabels: false,
    arrowScale: 2,
    snapToGrid: true,
    autoEdgeRouting: false,
  };
  const model = factory(settings);
  expect(
    model.nodes.every((node, index) => node.label === String(index + 1)),
    `${kind}: labels must follow the selected index base`,
  );
  expect(
    !model.settings.showNodeLabels &&
      model.settings.arrowScale === 2 &&
      model.settings.snapToGrid &&
      !model.settings.autoEdgeRouting,
    `${kind}: unrelated display settings must survive sample creation`,
  );
  expect(
    JSON.stringify(
      createSampleGraph(
        kind as keyof typeof algorithmicSampleFactories,
        settings,
      ),
    ) === JSON.stringify(model),
    `${kind}: gallery integration must preserve the algorithm example and its layout`,
  );
  expect(
    model.nodes.every(
      (node) => Number.isFinite(node.x) && Number.isFinite(node.y),
    ),
    `${kind}: all positions must be finite`,
  );
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  expect(
    nodeIds.size === model.nodes.length,
    `${kind}: node IDs must be unique`,
  );
  expect(
    new Set(model.edges.map((edge) => edge.id)).size === model.edges.length,
    `${kind}: edge IDs must be unique`,
  );
  expect(
    model.edges.every(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target),
    ),
    `${kind}: all edges must reference existing nodes`,
  );
  expect(
    !hasEdgeThroughNode(model),
    `${kind}: straight edges must not hide unrelated vertices`,
  );
}

const zeroOne = algorithmicSampleFactories.zeroOne({
  weighted: false,
  weightKind: "none",
});
expectNumericDirected(zeroOne, "0–1 BFS");
expect(
  zeroOne.edges.every((edge) => edge.weight === "0" || edge.weight === "1") &&
    zeroOne.edges.some((edge) => edge.weight === "0") &&
    zeroOne.edges.some((edge) => edge.weight === "1"),
  "0–1 BFS must contain both 0 and 1 weights exclusively",
);
expectDistances(zeroOne, [0, 0, 0, 1, 1, 1, 2], "0–1 BFS");

const negativeEdges = algorithmicSampleFactories.negativeEdges({
  directed: false,
  weighted: false,
});
expectNumericDirected(negativeEdges, "Negative edges");
expect(
  negativeEdges.edges.some((edge) => Number(edge.weight) < 0),
  "Bellman–Ford example must actually contain a negative edge",
);
expectDistances(negativeEdges, [0, 1, 5, 3, 6, 7], "Negative edges");
expect(
  !bellmanFord(negativeEdges, true).negativeCycle,
  "Negative-edge example must have no negative cycle in any component",
);

for (const autoEdgeRouting of [false, true]) {
  const routed = algorithmicSampleFactories.negativeEdges({ autoEdgeRouting });
  const routes = computeEdgeRouting(routed, {
    mode: autoEdgeRouting ? "quality" : "simple",
  });
  const nodes = new Map(routed.nodes.map((node) => [node.id, node]));
  const opposing = routed.edges.filter(
    (edge) =>
      (edge.source === "n1" && edge.target === "n2") ||
      (edge.source === "n2" && edge.target === "n1"),
  );
  const labels = opposing.map((edge) => {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    const route = routes.get(edge.id);
    if (!source || !target || !route) return null;
    return edgeCurveMidpoint(source, target, route);
  });
  const first = labels[0];
  const second = labels[1];
  expect(
    opposing.length === 2 && Boolean(first && second),
    "Negative-edge example must route both opposite directions",
  );
  if (first && second) {
    const chordX = nodes.get("n1")?.x ?? 0;
    expect(
      (first.x - chordX) * (second.x - chordX) < 0,
      `Negative-edge weights must lie on opposite sides with automatic routing ${autoEdgeRouting}`,
    );
    for (const zoom of [1, 1.5]) {
      const separation = Math.abs(first.x - second.x) * zoom;
      const required = edgeLabelClearance(opposing[0], opposing[1]) * zoom;
      expect(
        separation >= required,
        `Opposite weight labels must retain clear horizontal space at ${zoom * 100}% with automatic routing ${autoEdgeRouting}`,
      );
    }
  }
  expectDistances(routed, [0, 1, 5, 3, 6, 7], "Routed negative edges");
  expect(
    !bellmanFord(routed, true).negativeCycle,
    "Separating negative-edge labels must preserve the absence of negative cycles",
  );
}

const negativeCycle = algorithmicSampleFactories.negativeCycle({
  directed: false,
  weighted: false,
});
expectNumericDirected(negativeCycle, "Negative cycle");
expect(
  bellmanFord(negativeCycle).negativeCycle,
  "Negative-cycle example must have a negative cycle reachable from vertex 0",
);
expect(
  componentCount(negativeCycle) === 1,
  "Negative cycle must not be hidden in a disconnected component",
);

const multigraph = algorithmicSampleFactories.multigraph({
  directed: true,
  allowMultiEdges: false,
  allowSelfLoops: false,
  autoEdgeRouting: false,
});
expect(
  !multigraph.settings.directed &&
    multigraph.settings.allowMultiEdges &&
    multigraph.settings.allowSelfLoops,
  "Multigraph must enable its defining undirected parallel-edge and self-loop settings",
);
expect(
  multigraph.edges.filter((edge) => edge.source === edge.target).length === 1,
  "Multigraph must contain a self-loop",
);
const edgePairs = multigraph.edges.map((edge) =>
  [edge.source, edge.target].sort().join("/"),
);
expect(
  new Set(edgePairs).size < edgePairs.length,
  "Multigraph must contain parallel edges",
);
expect(
  multigraph.edges[0].routing?.bowPx !== multigraph.edges[1].routing?.bowPx,
  "Parallel edges must remain distinguishable when automatic routing is disabled",
);

const bridges = algorithmicSampleFactories.bridges({ directed: true });
expect(!bridges.settings.directed, "Bridge example must be undirected");
const bridgeIds = bridges.edges
  .filter((edge) => componentCount(bridges, edge.id) > 1)
  .map((edge) => edge.id);
expect(
  bridgeIds.join(",") === "e3,e4,e5",
  "Bridge example must have exactly three bridges joining the cycles",
);
const articulationIds = bridges.nodes
  .filter((node) => componentCount(bridges, undefined, node.id) > 1)
  .map((node) => node.id);
expect(
  articulationIds.join(",") === "n2,n3,n4,n5",
  "Bridge example must expose four articulation points",
);

const matching = algorithmicSampleFactories.bipartiteMatching({
  directed: true,
});
expect(!matching.settings.directed, "Matching example must be undirected");
expect(
  matching.edges.every(
    (edge) =>
      Number(edge.source.slice(1)) < 4 && Number(edge.target.slice(1)) >= 4,
  ),
  "Matching edges must run exclusively between the two visible partitions",
);
expect(
  maximumMatchingSize(matching) === 4,
  "Matching example must admit a perfect matching of size 4",
);
expect(
  greedyMatchingSize(matching) === 3,
  "Matching example must require an augmenting path after greedy matching",
);

const euler = algorithmicSampleFactories.eulerTrail({ directed: true });
expect(
  !euler.settings.directed && componentCount(euler) === 1,
  "Euler example must be connected and undirected",
);
const degrees = new Map(euler.nodes.map((node) => [node.id, 0]));
for (const edge of euler.edges) {
  degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
  degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
}
expect(
  [...degrees]
    .filter(([, degree]) => degree % 2 === 1)
    .map(([id]) => id)
    .join(",") === "n0,n3",
  "Euler example must have exactly two odd vertices (0 and 3)",
);
const trail = ["n0", "n1", "n2", "n3", "n4", "n5", "n0", "n3"];
const unused = new Set(euler.edges.map((edge) => edge.id));
for (let index = 1; index < trail.length; index += 1) {
  const edge = euler.edges.find(
    (candidate) =>
      unused.has(candidate.id) &&
      ((candidate.source === trail[index - 1] &&
        candidate.target === trail[index]) ||
        (candidate.target === trail[index - 1] &&
          candidate.source === trail[index])),
  );
  expect(
    Boolean(edge),
    "Known Euler trail must traverse an available edge at every step",
  );
  if (edge) unused.delete(edge.id);
}
expect(unused.size === 0, "Known Euler trail must use every edge exactly once");

const functional = algorithmicSampleFactories.functional({ directed: false });
expect(functional.settings.directed, "Functional graph must be directed");
expect(
  functional.nodes.every(
    (node) =>
      functional.edges.filter((edge) => edge.source === node.id).length === 1,
  ),
  "Every functional-graph vertex must have exactly one outgoing edge",
);
const successor = new Map(
  functional.edges.map((edge) => [edge.source, edge.target]),
);
const cycles = new Set<string>();
for (const node of functional.nodes) {
  const sequence: NodeId[] = [];
  let current = node.id;
  while (
    !sequence.includes(current) &&
    sequence.length <= functional.nodes.length
  ) {
    sequence.push(current);
    current = successor.get(current) ?? "missing";
  }
  const start = sequence.indexOf(current);
  expect(
    start >= 0,
    "Every functional-graph orbit must eventually enter a cycle",
  );
  if (start >= 0) cycles.add(sequence.slice(start).sort().join(","));
}
expect(
  [...cycles].sort().join(";") === "n0,n1,n2;n6,n7",
  "Functional graph must show distinct 3-cycle and 2-cycle components with incoming trees",
);

finish();

function expectNumericDirected(model: GraphModel, name: string) {
  expect(
    model.settings.directed &&
      model.settings.weighted &&
      model.settings.weightKind === "number",
    `${name}: required numeric directed weighted settings must override incompatible settings`,
  );
}

function bellmanFord(model: GraphModel, allSources = false) {
  const distance = new Map(
    model.nodes.map((node) => [
      node.id,
      allSources || node.order === 0 ? 0 : Infinity,
    ]),
  );
  for (let pass = 1; pass < model.nodes.length; pass += 1) {
    for (const edge of model.edges) {
      distance.set(
        edge.target,
        Math.min(
          distance.get(edge.target) ?? Infinity,
          (distance.get(edge.source) ?? Infinity) + Number(edge.weight),
        ),
      );
    }
  }
  const hasNegativeCycle = model.edges.some(
    (edge) =>
      (distance.get(edge.source) ?? Infinity) + Number(edge.weight) <
      (distance.get(edge.target) ?? Infinity),
  );
  return { distance, negativeCycle: hasNegativeCycle };
}

function expectDistances(model: GraphModel, expected: number[], name: string) {
  const result = bellmanFord(model);
  expect(
    !result.negativeCycle,
    `${name}: shortest distances must be well defined`,
  );
  expect(
    model.nodes.map((node) => result.distance.get(node.id)).join(",") ===
      expected.join(","),
    `${name}: shortest distances from vertex 0 must match the known example`,
  );
}

function componentCount(
  model: GraphModel,
  removedEdge?: string,
  removedNode?: NodeId,
): number {
  const remaining = new Set(
    model.nodes
      .filter((node) => node.id !== removedNode)
      .map((node) => node.id),
  );
  let count = 0;
  while (remaining.size > 0) {
    const first = remaining.values().next().value;
    if (first === undefined) break;
    const queue = [first];
    remaining.delete(first);
    count += 1;
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const edge of model.edges) {
        if (
          edge.id === removedEdge ||
          edge.source === removedNode ||
          edge.target === removedNode
        )
          continue;
        const next =
          edge.source === queue[cursor]
            ? edge.target
            : edge.target === queue[cursor]
              ? edge.source
              : undefined;
        if (next && remaining.delete(next)) queue.push(next);
      }
    }
  }
  return count;
}

function maximumMatchingSize(model: GraphModel): number {
  const left = model.nodes.filter((node) => node.x < 0).map((node) => node.id);
  function visit(index: number, used: Set<NodeId>): number {
    if (index === left.length) return 0;
    let best = visit(index + 1, used);
    for (const edge of model.edges) {
      if (edge.source !== left[index] || used.has(edge.target)) continue;
      used.add(edge.target);
      best = Math.max(best, 1 + visit(index + 1, used));
      used.delete(edge.target);
    }
    return best;
  }
  return visit(0, new Set());
}

function greedyMatchingSize(model: GraphModel): number {
  const used = new Set<NodeId>();
  let count = 0;
  for (const edge of model.edges) {
    if (used.has(edge.source) || used.has(edge.target)) continue;
    used.add(edge.source);
    used.add(edge.target);
    count += 1;
  }
  return count;
}

function hasEdgeThroughNode(model: GraphModel) {
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  return model.edges.some((edge) => {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    if (
      !source ||
      !target ||
      edge.source === edge.target ||
      edge.routing?.bowPx
    )
      return false;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const lengthSquared = dx * dx + dy * dy;
    return model.nodes.some((node) => {
      if (node.id === source.id || node.id === target.id) return false;
      const projection =
        ((node.x - source.x) * dx + (node.y - source.y) * dy) / lengthSquared;
      return (
        projection > 0 &&
        projection < 1 &&
        Math.hypot(
          node.x - source.x - projection * dx,
          node.y - source.y - projection * dy,
        ) < 15
      );
    });
  });
}
