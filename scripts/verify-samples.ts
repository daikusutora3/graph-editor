import {
  createSampleGraph,
  sampleGraphDefinitions,
  sampleExpectations,
  sampleGraphKinds,
  type SampleGraphKind,
} from "../features/graph-editor/samples";
import type {
  GraphModel,
  NodeId,
} from "../features/graph-editor/core/graph/model";
import {
  connectedComponents,
  isBipartite,
  isDirectedAcyclic,
} from "../features/graph-editor/core/graph/graph-analysis";

type IndexedGraph = {
  nodeCount: number;
  edgeCount: number;
  adjacency: boolean[][];
};

const failures: string[] = [];
const definitionKinds = sampleGraphDefinitions.map(
  (definition) => definition.kind,
);
const definitionKindSet = new Set(definitionKinds);

if (definitionKindSet.size !== definitionKinds.length) {
  failures.push("sample definitions contain duplicate kinds");
}

for (const kind of sampleGraphKinds) {
  if (kind === "empty") continue;
  if (!definitionKindSet.has(kind)) {
    failures.push(`definition registry is missing sample kind: ${kind}`);
  }
}

for (const kind of definitionKinds) {
  if (!sampleGraphKinds.includes(kind)) {
    failures.push(`definition registry contains unknown sample kind: ${kind}`);
  }
}

for (const definition of sampleGraphDefinitions) {
  if (!sampleGraphKinds.includes(definition.kind)) {
    failures.push(
      `definition contains unknown sample kind: ${definition.kind}`,
    );
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
    failures.push(
      `${kind}: expected ${expectation.nodeCount} nodes, got ${model.nodes.length}`,
    );
  }

  if (
    expectation.edgeCount != null &&
    model.edges.length !== expectation.edgeCount
  ) {
    failures.push(
      `${kind}: expected ${expectation.edgeCount} edges, got ${model.edges.length}`,
    );
  }

  if (
    expectation.connected != null &&
    connectedComponents(model).length <= 1 !== expectation.connected
  ) {
    failures.push(`${kind}: connected expectation failed`);
  }

  if (
    expectation.bipartite != null &&
    isBipartite(model) !== expectation.bipartite
  ) {
    failures.push(`${kind}: bipartite expectation failed`);
  }

  if (
    expectation.directed != null &&
    model.settings.directed !== expectation.directed
  ) {
    failures.push(`${kind}: directed expectation failed`);
  }

  if (
    expectation.weighted != null &&
    model.settings.weighted !== expectation.weighted
  ) {
    failures.push(`${kind}: weighted expectation failed`);
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
    failures.push(`${kind}: numeric weight expectation failed`);
  }

  if (
    expectation.acyclic != null &&
    isDirectedAcyclic(model) !== expectation.acyclic
  ) {
    failures.push(`${kind}: acyclic expectation failed`);
  }

  if (
    expectation.regularDegree != null &&
    !isRegular(model, expectation.regularDegree)
  ) {
    failures.push(`${kind}: regular degree expectation failed`);
  }

  if (
    expectation.bridgeCount != null &&
    countBridges(model) !== expectation.bridgeCount
  ) {
    failures.push(
      `${kind}: expected ${expectation.bridgeCount} bridges, got ${countBridges(model)}`,
    );
  }

  if (expectation.noCrossings) {
    const crossings = countStrictEdgeCrossings(model);
    if (crossings !== 0) {
      failures.push(
        `${kind}: expected a crossing-free straight-line layout, got ${crossings} crossings`,
      );
    }
  }

  if (
    expectation.noEdgeNodeOverlaps &&
    countEdgeNodeOverlaps(model, 1.5) !== 0
  ) {
    failures.push(`${kind}: expected no edge to pass through another node`);
  }

  if (expectation.unitEdgeLength && !hasNearlyEqualEdgeLengths(model, 2)) {
    failures.push(`${kind}: expected nearly equal edge lengths`);
  }

  if (
    expectation.triangleFree != null &&
    isTriangleFree(model) !== expectation.triangleFree
  ) {
    failures.push(`${kind}: triangle-free expectation failed`);
  }

  if (
    expectation.chromaticNumber != null &&
    chromaticNumber(model) !== expectation.chromaticNumber
  ) {
    failures.push(
      `${kind}: chromatic number expectation failed; expected ${expectation.chromaticNumber}`,
    );
  }

  if (expectation.fixedLabels) {
    const labels = orderedLabels(model);
    if (labels.join("\u0000") !== expectation.fixedLabels.join("\u0000")) {
      failures.push(
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
    failures.push(`${kind}: label pattern expectation failed`);
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
      failures.push(`${kind}: labels should not depend on indexBase`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Sample verification failed (${failures.length})`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Sample verification passed (${sampleGraphKinds.length} kinds)`);

function orderedLabels(model: GraphModel): string[] {
  return [...model.nodes]
    .sort((a, b) => a.order - b.order)
    .map((node) => node.label);
}

function verifyModelIntegrity(kind: SampleGraphKind, model: GraphModel): void {
  const nodeIds = new Set<NodeId>();
  const edgeIds = new Set<string>();
  const nodeOrders = new Set<number>();
  const seenEdges = new Set<string>();

  for (const node of model.nodes) {
    if (nodeIds.has(node.id)) {
      failures.push(`${kind}: duplicate node id ${node.id}`);
    }
    nodeIds.add(node.id);

    if (nodeOrders.has(node.order)) {
      failures.push(`${kind}: duplicate node order ${node.order}`);
    }
    nodeOrders.add(node.order);
  }

  for (const edge of model.edges) {
    if (edgeIds.has(edge.id)) {
      failures.push(`${kind}: duplicate edge id ${edge.id}`);
    }
    edgeIds.add(edge.id);

    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      failures.push(`${kind}: edge ${edge.id} references a missing endpoint`);
      continue;
    }

    if (edge.source === edge.target) {
      failures.push(`${kind}: unexpected self loop on ${edge.source}`);
      continue;
    }

    const edgeKey = model.settings.directed
      ? `${edge.source}\u0000${edge.target}`
      : [edge.source, edge.target].sort().join("\u0000");
    if (seenEdges.has(edgeKey)) {
      failures.push(`${kind}: duplicate edge ${edge.source}-${edge.target}`);
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
