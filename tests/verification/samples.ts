import {
  createSampleGraph,
  createSizedSampleGraph,
  getSizedSampleGraphMaxNodes,
  sampleGraphDefinitions,
  sampleGraphKinds,
  sizedSampleGraphKinds,
  type SampleGraphKind,
} from "../../features/graph-editor/samples";
import { sampleExpectations } from "./sample-expectations";
import type {
  GraphModel,
  NodeId,
} from "../../features/graph-editor/core/graph/model";
import {
  connectedComponents,
  isBipartite,
  isDirectedAcyclic,
} from "../../features/graph-editor/core/graph/graph-analysis";
import { createPreviewEdgePath } from "../../features/graph-editor/ui/SampleGraphPreview";
import { createVerification } from "./harness";

type IndexedGraph = {
  nodeCount: number;
  edgeCount: number;
  adjacency: boolean[][];
};

const { fail, finish } = createVerification("Sample");
const definitionKinds = sampleGraphDefinitions.map(
  (definition) => definition.kind,
);
const definitionKindSet = new Set(definitionKinds);

if (definitionKindSet.size !== definitionKinds.length) {
  fail("sample definitions contain duplicate kinds");
}

for (const kind of sampleGraphKinds) {
  if (kind === "empty") continue;
  if (!definitionKindSet.has(kind)) {
    fail(`definition registry is missing sample kind: ${kind}`);
  }
}

for (const kind of definitionKinds) {
  if (!sampleGraphKinds.includes(kind)) {
    fail(`definition registry contains unknown sample kind: ${kind}`);
  }
}

for (const definition of sampleGraphDefinitions) {
  if (!sampleGraphKinds.includes(definition.kind)) {
    fail(`definition contains unknown sample kind: ${definition.kind}`);
  }
}

const models = new Map<SampleGraphKind, GraphModel>();

for (const kind of sampleGraphKinds) {
  const model = createSampleGraph(kind, {
    directed: false,
    weighted: false,
    indexBase: 0,
  });
  models.set(kind, model);
  verifyModelIntegrity(kind, model);

  const expectation = sampleExpectations[kind];
  if (!expectation) continue;

  if (
    expectation.nodeCount != null &&
    model.nodes.length !== expectation.nodeCount
  ) {
    fail(
      `${kind}: expected ${expectation.nodeCount} nodes, got ${model.nodes.length}`,
    );
  }

  if (
    expectation.edgeCount != null &&
    model.edges.length !== expectation.edgeCount
  ) {
    fail(
      `${kind}: expected ${expectation.edgeCount} edges, got ${model.edges.length}`,
    );
  }

  if (
    expectation.connected != null &&
    connectedComponents(model).length <= 1 !== expectation.connected
  ) {
    fail(`${kind}: connected expectation failed`);
  }

  if (
    expectation.bipartite != null &&
    isBipartite(model) !== expectation.bipartite
  ) {
    fail(`${kind}: bipartite expectation failed`);
  }

  if (
    expectation.directed != null &&
    model.settings.directed !== expectation.directed
  ) {
    fail(`${kind}: directed expectation failed`);
  }

  if (
    expectation.weighted != null &&
    model.settings.weighted !== expectation.weighted
  ) {
    fail(`${kind}: weighted expectation failed`);
  }

  if (
    expectation.numericWeights &&
    !model.edges.every(
      (edge) =>
        edge.weight != null &&
        edge.weight.trim() !== "" &&
        Number.isFinite(Number(edge.weight)),
    )
  ) {
    fail(`${kind}: numeric weight expectation failed`);
  }

  if (
    expectation.acyclic != null &&
    isDirectedAcyclic(model) !== expectation.acyclic
  ) {
    fail(`${kind}: acyclic expectation failed`);
  }

  if (
    expectation.regularDegree != null &&
    !isRegular(model, expectation.regularDegree)
  ) {
    fail(`${kind}: regular degree expectation failed`);
  }

  if (
    expectation.bridgeCount != null &&
    countBridges(model) !== expectation.bridgeCount
  ) {
    fail(
      `${kind}: expected ${expectation.bridgeCount} bridges, got ${countBridges(model)}`,
    );
  }

  if (expectation.noCrossings) {
    const crossings = countStrictEdgeCrossings(model);
    if (crossings !== 0) {
      fail(
        `${kind}: expected a crossing-free straight-line layout, got ${crossings} crossings`,
      );
    }
  }

  if (
    expectation.noEdgeNodeOverlaps &&
    countEdgeNodeOverlaps(model, 1.5) !== 0
  ) {
    fail(`${kind}: expected no edge to pass through another node`);
  }

  if (expectation.unitEdgeLength && !hasNearlyEqualEdgeLengths(model, 2)) {
    fail(`${kind}: expected nearly equal edge lengths`);
  }

  if (
    expectation.triangleFree != null &&
    isTriangleFree(model) !== expectation.triangleFree
  ) {
    fail(`${kind}: triangle-free expectation failed`);
  }

  if (
    expectation.chromaticNumber != null &&
    chromaticNumber(model) !== expectation.chromaticNumber
  ) {
    fail(
      `${kind}: chromatic number expectation failed; expected ${expectation.chromaticNumber}`,
    );
  }

  if (expectation.fixedLabels) {
    const labels = orderedLabels(model);
    if (labels.join("\u0000") !== expectation.fixedLabels.join("\u0000")) {
      fail(
        `${kind}: fixed labels expectation failed; got ${labels.join(", ")}`,
      );
    }
  }

  if (
    expectation.labelPattern &&
    !orderedLabels(model).every((label) =>
      expectation.labelPattern?.test(label),
    )
  ) {
    fail(`${kind}: label pattern expectation failed`);
  }

  if (expectation.sameLabelsForIndexBase) {
    const zeroBaseLabels = orderedLabels(model);
    const oneBaseLabels = orderedLabels(
      createSampleGraph(kind, {
        directed: false,
        weighted: false,
        indexBase: 1,
      }),
    );

    if (zeroBaseLabels.join("\u0000") !== oneBaseLabels.join("\u0000")) {
      fail(`${kind}: labels should not depend on indexBase`);
    }
  }
}

verifyNamedSampleGeometry(models);
verifyPreviewEdgePaths();
verifySizedSampleGraphs();

finish(`Sample verification passed (${sampleGraphKinds.length} kinds)`);

function verifyNamedSampleGeometry(models: Map<SampleGraphKind, GraphModel>) {
  const houseX = models.get("houseX");
  if (houseX) {
    const nodes = nodePositionByOrder(houseX);

    if (
      !(
        nodes[4].y < nodes[2].y &&
        nodes[4].y < nodes[3].y &&
        nodes[2].y < nodes[0].y &&
        nodes[3].y < nodes[1].y &&
        nodes[0].x < nodes[1].x &&
        nodes[3].x < nodes[2].x
      )
    ) {
      fail("houseX sample should keep a recognizable house layout");
    }
  }

  const octahedral = models.get("octahedral");
  if (octahedral) {
    const nodes = nodePositionByOrder(octahedral);

    if (!hasRotationalSymmetry(nodes, 120, 2)) {
      fail("octahedral sample should keep its rotationally balanced layout");
    }
  }
}

function nodePositionByOrder(model: GraphModel) {
  return [...model.nodes].sort((a, b) => a.order - b.order);
}

function hasRotationalSymmetry(
  nodes: { x: number; y: number }[],
  degrees: number,
  tolerance: number,
) {
  const center = nodes.reduce(
    (sum, node) => ({ x: sum.x + node.x / nodes.length, y: sum.y + node.y / nodes.length }),
    { x: 0, y: 0 },
  );
  const angle = (degrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);

  return nodes.every((node) => {
    const dx = node.x - center.x;
    const dy = node.y - center.y;
    const rotated = {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };

    return nodes.some(
      (candidate) =>
        Math.hypot(candidate.x - rotated.x, candidate.y - rotated.y) <= tolerance,
    );
  });
}

function verifyPreviewEdgePaths() {
  const loopPath = createPreviewEdgePath({
    directed: true,
    radius: 8,
    routing: { bowPx: 0, loopDirectionDeg: -45, loopSweepDeg: 70 },
    scale: 1,
    source: { x: 20, y: 20 },
    target: { x: 20, y: 20 },
  });

  if (!loopPath.includes("C")) {
    fail("preview self-loop edges should render as curved paths");
  }

  const parallelPath = createPreviewEdgePath({
    directed: false,
    radius: 8,
    routing: { bowPx: 36, loopDirectionDeg: -45, loopSweepDeg: 70 },
    scale: 0.5,
    source: { x: 0, y: 0 },
    target: { x: 100, y: 0 },
  });

  if (!parallelPath.includes("Q")) {
    fail("preview bowed edges should render as quadratic paths");
  }
}

function verifySizedSampleGraphs() {
  for (const kind of sizedSampleGraphKinds) {
    const model = createSizedSampleGraph(kind, 11, {
      directed: false,
      weighted: false,
      indexBase: 0,
    });

    verifyModelIntegrity(`${kind} sized`, model);

    if (model.nodes.length !== 11) {
      fail(`${kind}: sized sample should create exactly 11 nodes`);
    }
  }

  const complete = createSizedSampleGraph("complete", 7, { indexBase: 0 });
  if (complete.edges.length !== 21) {
    fail("complete: sized sample should create K7");
  }

  const star = createSizedSampleGraph("star", 7, { indexBase: 0 });
  if (star.edges.length !== 6) {
    fail("star: sized sample node count should include the center");
  }

  const customGrid = createSizedSampleGraph(
    "grid",
    15,
    { indexBase: 0 },
    { columns: 5, rows: 3 },
  );
  if (customGrid.nodes.length !== 15 || customGrid.edges.length !== 22) {
    fail("grid: sized sample should support explicit rows and columns");
  }

  const customKnight = createSizedSampleGraph(
    "knight",
    20,
    { indexBase: 0 },
    { columns: 5, knightMove: "long", rows: 4 },
  );
  if (customKnight.nodes.length !== 20 || customKnight.edges.length !== 20) {
    fail("knight: sized sample should support custom move presets");
  }

  const tooSmall = createSizedSampleGraph("path", 0, { indexBase: 0 });
  if (tooSmall.nodes.length !== 1) {
    fail("sized sample node count should clamp values below the minimum");
  }

  const maxPathNodes = getSizedSampleGraphMaxNodes("path");
  const tooLarge = createSizedSampleGraph("path", maxPathNodes + 1, {
    indexBase: 0,
  });
  if (tooLarge.nodes.length !== maxPathNodes) {
    fail("sized sample node count should clamp values above the maximum");
  }

  const completeMaxNodes = getSizedSampleGraphMaxNodes("complete");
  const completeTooLarge = createSizedSampleGraph(
    "complete",
    completeMaxNodes + 1,
    { indexBase: 0 },
  );
  if (completeTooLarge.nodes.length !== completeMaxNodes) {
    fail("dense sized samples should keep edge counts under the maximum");
  }

  const invalid = createSizedSampleGraph("path", Number.NaN, { indexBase: 0 });
  if (invalid.nodes.length !== 6) {
    fail("sized sample node count should fall back when input is not finite");
  }
}

function orderedLabels(model: GraphModel): string[] {
  return [...model.nodes]
    .sort((a, b) => a.order - b.order)
    .map((node) => node.label);
}

function verifyModelIntegrity(kind: string, model: GraphModel): void {
  const nodeIds = new Set<NodeId>();
  const edgeIds = new Set<string>();
  const nodeOrders = new Set<number>();
  const seenEdges = new Set<string>();

  for (const node of model.nodes) {
    if (nodeIds.has(node.id)) {
      fail(`${kind}: duplicate node id ${node.id}`);
    }
    nodeIds.add(node.id);

    if (nodeOrders.has(node.order)) {
      fail(`${kind}: duplicate node order ${node.order}`);
    }
    nodeOrders.add(node.order);
  }

  for (const edge of model.edges) {
    if (edgeIds.has(edge.id)) {
      fail(`${kind}: duplicate edge id ${edge.id}`);
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      fail(`${kind}: edge ${edge.id} references a missing endpoint`);
      continue;
    }

    if (edge.source === edge.target) {
      fail(`${kind}: unexpected self loop on ${edge.source}`);
      continue;
    }

    const edgeKey = model.settings.directed
      ? `${edge.source}\u0000${edge.target}`
      : [edge.source, edge.target].sort().join("\u0000");
    if (seenEdges.has(edgeKey)) {
      fail(`${kind}: duplicate edge ${edge.source}-${edge.target}`);
    }
    seenEdges.add(edgeKey);
  }
}

function toIndexedGraph(model: GraphModel): IndexedGraph {
  const nodeIndexById = new Map<NodeId, number>(
    model.nodes.map((node, index) => [node.id, index]),
  );
  const nodeCount = model.nodes.length;
  const adjacency = Array.from({ length: nodeCount }, () =>
    Array<boolean>(nodeCount).fill(false),
  );

  for (const edge of model.edges) {
    const source = nodeIndexById.get(edge.source);
    const target = nodeIndexById.get(edge.target);
    if (source == null || target == null || source === target) continue;
    adjacency[source][target] = true;
    adjacency[target][source] = true;
  }

  return {
    nodeCount,
    edgeCount: model.edges.length,
    adjacency,
  };
}

function neighborMap(model: GraphModel): Map<NodeId, Set<NodeId>> {
  const neighbors = new Map<NodeId, Set<NodeId>>(
    model.nodes.map((node) => [node.id, new Set<NodeId>()]),
  );
  for (const edge of model.edges) {
    neighbors.get(edge.source)?.add(edge.target);
    neighbors.get(edge.target)?.add(edge.source);
  }
  return neighbors;
}

function countBridges(model: GraphModel): number {
  const neighbors = neighborMap(model);
  const discovery = new Map<NodeId, number>();
  const low = new Map<NodeId, number>();
  let time = 0;
  let bridges = 0;

  function visit(nodeId: NodeId, parentId: NodeId | null): void {
    time += 1;
    discovery.set(nodeId, time);
    low.set(nodeId, time);

    for (const next of neighbors.get(nodeId) ?? []) {
      if (next === parentId) continue;

      if (!discovery.has(next)) {
        visit(next, nodeId);
        low.set(
          nodeId,
          Math.min(low.get(nodeId) ?? time, low.get(next) ?? time),
        );
        if ((low.get(next) ?? 0) > (discovery.get(nodeId) ?? 0)) {
          bridges += 1;
        }
      } else {
        low.set(
          nodeId,
          Math.min(low.get(nodeId) ?? time, discovery.get(next) ?? time),
        );
      }
    }
  }

  for (const node of model.nodes) {
    if (!discovery.has(node.id)) {
      visit(node.id, null);
    }
  }

  return bridges;
}

function isRegular(model: GraphModel, degree: number): boolean {
  const neighbors = neighborMap(model);
  return model.nodes.every((node) => neighbors.get(node.id)?.size === degree);
}

function isTriangleFree(model: GraphModel): boolean {
  const graph = toIndexedGraph(model);

  for (let a = 0; a < graph.nodeCount; a += 1) {
    for (let b = a + 1; b < graph.nodeCount; b += 1) {
      if (!graph.adjacency[a][b]) continue;
      for (let c = b + 1; c < graph.nodeCount; c += 1) {
        if (graph.adjacency[a][c] && graph.adjacency[b][c]) {
          return false;
        }
      }
    }
  }

  return true;
}

function chromaticNumber(model: GraphModel): number {
  const graph = toIndexedGraph(model);
  if (graph.nodeCount === 0) return 0;

  for (let colorCount = 1; colorCount <= graph.nodeCount; colorCount += 1) {
    if (canColorWith(graph, colorCount)) {
      return colorCount;
    }
  }

  return graph.nodeCount;
}

function canColorWith(graph: IndexedGraph, colorCount: number): boolean {
  const degrees = graph.adjacency.map((row) => row.filter(Boolean).length);
  const order = Array.from(
    { length: graph.nodeCount },
    (_, index) => index,
  ).sort((a, b) => degrees[b] - degrees[a]);
  const colors = Array<number>(graph.nodeCount).fill(-1);

  function visit(depth: number): boolean {
    if (depth === order.length) return true;

    const node = order[depth];
    for (let color = 0; color < colorCount; color += 1) {
      let valid = true;
      for (let other = 0; other < graph.nodeCount; other += 1) {
        if (graph.adjacency[node][other] && colors[other] === color) {
          valid = false;
          break;
        }
      }

      if (!valid) continue;
      colors[node] = color;
      if (visit(depth + 1)) return true;
      colors[node] = -1;
    }

    return false;
  }

  return visit(0);
}

function hasNearlyEqualEdgeLengths(
  model: GraphModel,
  tolerance: number,
): boolean {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const lengths = model.edges.map((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    return source && target
      ? Math.hypot(source.x - target.x, source.y - target.y)
      : Number.NaN;
  });

  const first = lengths[0];
  return lengths.every(
    (length) =>
      Number.isFinite(length) && Math.abs(length - first) <= tolerance,
  );
}

function countEdgeNodeOverlaps(model: GraphModel, tolerance: number): number {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  let count = 0;

  for (const edge of model.edges) {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) continue;

    for (const node of model.nodes) {
      if (node.id === edge.source || node.id === edge.target) continue;
      if (
        distanceToSegment(
          { x: node.x, y: node.y },
          { x: source.x, y: source.y },
          { x: target.x, y: target.y },
        ) <= tolerance
      ) {
        count += 1;
      }
    }
  }

  return count;
}

function countStrictEdgeCrossings(model: GraphModel): number {
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  let count = 0;

  for (let first = 0; first < model.edges.length; first += 1) {
    for (let second = first + 1; second < model.edges.length; second += 1) {
      const aEdge = model.edges[first];
      const bEdge = model.edges[second];
      if (
        aEdge.source === bEdge.source ||
        aEdge.source === bEdge.target ||
        aEdge.target === bEdge.source ||
        aEdge.target === bEdge.target
      ) {
        continue;
      }

      const a = nodeById.get(aEdge.source);
      const b = nodeById.get(aEdge.target);
      const c = nodeById.get(bEdge.source);
      const d = nodeById.get(bEdge.target);
      if (!a || !b || !c || !d) continue;

      if (
        segmentsStrictlyIntersect(
          { x: a.x, y: a.y },
          { x: b.x, y: b.y },
          { x: c.x, y: c.y },
          { x: d.x, y: d.y },
        )
      ) {
        count += 1;
      }
    }
  }

  return count;
}

function segmentsStrictlyIntersect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
): boolean {
  const first = orientation(a, b, c);
  const second = orientation(a, b, d);
  const third = orientation(c, d, a);
  const fourth = orientation(c, d, b);

  return first * second < 0 && third * fourth < 0;
}

function orientation(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
): number {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const projection =
    ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  if (projection <= 0 || projection >= 1) {
    return Number.POSITIVE_INFINITY;
  }

  const projected = {
    x: start.x + projection * dx,
    y: start.y + projection * dy,
  };

  return Math.hypot(point.x - projected.x, point.y - projected.y);
}
