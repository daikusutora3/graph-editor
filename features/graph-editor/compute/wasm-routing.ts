import type { GraphEdge, GraphNode } from "../core/graph/model";
import { nodeGeometryWidth } from "../core/graph/node-size";
import type {
  EdgeCurveGeometry,
  EdgeCurvePoint,
} from "../core/layout/edge-route-geometry";
import { getRustKernelReady, runRustKernel } from "./rust-kernel";

type NodeSnapshot = {
  data: Float64Array;
  collisionBounded: boolean;
  records: {
    node: GraphNode;
    id: string;
    x: number;
    y: number;
    label: string;
    measuredWidth: number | undefined;
  }[];
  indexes: Map<string, number>;
};
const snapshots = new WeakMap<GraphNode[], NodeSnapshot>();

/** Validate coordinates and sizing inputs as well as identities. Public scoring
 * helpers may be called with an array mutated in place between candidates. */
function nodeSnapshot(nodes: GraphNode[]) {
  const cached = snapshots.get(nodes);
  if (
    cached &&
    cached.records.length === nodes.length &&
    nodes.every((node, index) => {
      const previous = cached.records[index]!;
      const measuredWidth = (node as GraphNode & { measuredWidth?: number })
        .measuredWidth;
      return (
        previous.node === node &&
        previous.id === node.id &&
        previous.x === node.x &&
        previous.y === node.y &&
        previous.label === node.label &&
        previous.measuredWidth === measuredWidth
      );
    })
  )
    return cached;
  const data = new Float64Array(nodes.length * 3);
  let collisionBounded = true;
  const indexes = new Map<string, number>();
  const records = nodes.map((node, index) => {
    data[index * 3] = node.x;
    data[index * 3 + 1] = node.y;
    data[index * 3 + 2] = nodeGeometryWidth(node) / 2;
    collisionBounded &&=
      boundedCollisionCoordinate(data[index * 3]!) &&
      boundedCollisionCoordinate(data[index * 3 + 1]!) &&
      boundedCollisionCoordinate(data[index * 3 + 2]!);
    indexes.set(node.id, index);
    return {
      node,
      id: node.id,
      x: node.x,
      y: node.y,
      label: node.label,
      measuredWidth: (node as GraphNode & { measuredWidth?: number })
        .measuredWidth,
    };
  });
  const snapshot = { data, collisionBounded, indexes, records };
  snapshots.set(nodes, snapshot);
  return snapshot;
}

function packCurve(curve: EdgeCurveGeometry) {
  const distances = curve.controlPointDistancesPx;
  const weights = curve.controlPointWeights;
  const data = new Float64Array(2 + distances.length + weights.length);
  data[0] = distances.length;
  data[1] = weights.length;
  data.set(distances, 2);
  data.set(weights, 2 + distances.length);
  return data;
}

export function scoreRustCurveNodeAndShape(
  curve: EdgeCurveGeometry,
  source: GraphNode,
  target: GraphNode,
  edge: GraphEdge,
  nodes: GraphNode[],
  clearance: number,
) {
  if (!getRustKernelReady()) return null;
  const snapshot = nodeSnapshot(nodes);
  // Models validate unique IDs. Preserve the public helper's exclusion rules
  // for callers that supply a temporary invalid array with duplicate IDs.
  if (snapshot.indexes.size !== nodes.length) return null;
  const result = runRustKernel(
    "routing_node_shape",
    [snapshot.data, packCurve(curve)],
    3,
    [
      nodes.length,
      snapshot.indexes.get(edge.source) ?? -1,
      snapshot.indexes.get(edge.target) ?? -1,
      source.x,
      source.y,
      target.x,
      target.y,
      clearance,
    ],
  );
  return result
    ? { collisions: result[0]!, score: result[1]!, units: result[2]! }
    : null;
}

/** Dedicated final-route check: retain its tighter pruning and exact work
 * accounting instead of paying for candidate penetration/length scoring. */
function boundedCollisionCoordinate(value: number) {
  return Number.isFinite(value) && Math.abs(value) <= 1e12;
}

export function canRustCountCurveNodeCollisions(
  curve: EdgeCurveGeometry,
  source: GraphNode,
  target: GraphNode,
) {
  return (
    [source.x, source.y, target.x, target.y].every(
      boundedCollisionCoordinate,
    ) &&
    curve.controlPointDistancesPx.every(boundedCollisionCoordinate) &&
    curve.controlPointWeights.every((weight) => weight >= 0 && weight <= 1)
  );
}

export function countRustCurveNodeCollisions(
  curve: EdgeCurveGeometry,
  source: GraphNode,
  target: GraphNode,
  edge: GraphEdge,
  nodes: GraphNode[],
) {
  if (!getRustKernelReady()) return null;
  if (!canRustCountCurveNodeCollisions(curve, source, target)) return null;
  const snapshot = nodeSnapshot(nodes);
  if (!snapshot.collisionBounded || snapshot.indexes.size !== nodes.length)
    return null;
  const result = runRustKernel(
    "routing_node_collisions",
    [snapshot.data, packCurve(curve)],
    3,
    [
      nodes.length,
      snapshot.indexes.get(edge.source) ?? -1,
      snapshot.indexes.get(edge.target) ?? -1,
      source.x,
      source.y,
      target.x,
      target.y,
    ],
  );
  return result && result[2] === 0
    ? { collisions: result[0]!, units: result[1]! }
    : null;
}

export function scoreRustCurveCrossings(
  curve: EdgeCurveGeometry,
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  otherSamples: readonly EdgeCurvePoint[][],
) {
  if (!getRustKernelReady()) return null;
  const data = new Float64Array(
    otherSamples.reduce((length, points) => length + 1 + points.length * 2, 0),
  );
  let cursor = 0;
  for (const points of otherSamples) {
    data[cursor++] = points.length;
    for (const point of points) {
      data[cursor++] = point.x;
      data[cursor++] = point.y;
    }
  }
  const result = runRustKernel(
    "routing_crossings",
    [packCurve(curve), data],
    1,
    [data.length, source.x, source.y, target.x, target.y],
  );
  return result?.[0] ?? null;
}

export type RoutingLabelObstacle = {
  anchor: EdgeCurvePoint;
  size: { width: number; height: number };
};

export function scoreRustCurveLabelOverlap(
  curve: EdgeCurveGeometry,
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  size: { width: number; height: number },
  labels: readonly RoutingLabelObstacle[],
) {
  if (!getRustKernelReady()) return null;
  const data = new Float64Array(labels.length * 4);
  labels.forEach(({ anchor, size: otherSize }, index) => {
    data[index * 4] = anchor.x;
    data[index * 4 + 1] = anchor.y;
    data[index * 4 + 2] = otherSize.width;
    data[index * 4 + 3] = otherSize.height;
  });
  const result = runRustKernel(
    "routing_label_overlap",
    [packCurve(curve), data],
    1,
    [
      labels.length,
      source.x,
      source.y,
      target.x,
      target.y,
      size.width,
      size.height,
    ],
  );
  return result?.[0] ?? null;
}

export function scoreRustLoopObstacles(
  nodes: GraphNode[],
  points: readonly EdgeCurvePoint[],
  clearance: number,
  bounds: { x1: number; y1: number; x2: number; y2: number },
  pillNodes: boolean,
) {
  if (!getRustKernelReady()) return null;
  // A Wasm call pays for copying every input/output even when almost all nodes
  // fail the cheap bounds check. Sample only to choose the backend: Rust/JS
  // still run the complete bounds test and use every obstacle for the result.
  if (pillNodes) {
    if (nodes.length < 16) return null;
  } else {
    if (nodes.length < 64) return null;
    let inside = 0;
    for (let index = 0; index < 16; index++) {
      const node = nodes[Math.floor((index * nodes.length) / 16)]!;
      if (
        node.x >= bounds.x1 &&
        node.x <= bounds.x2 &&
        node.y >= bounds.y1 &&
        node.y <= bounds.y2
      )
        inside++;
    }
    if (inside < 4) return null;
  }
  const data = new Float64Array(points.length * 2);
  points.forEach((point, index) => {
    data[index * 2] = point.x;
    data[index * 2 + 1] = point.y;
  });
  return runRustKernel(
    "routing_loop_obstacles",
    [nodeSnapshot(nodes).data, data],
    nodes.length * 3,
    [
      nodes.length,
      points.length,
      clearance,
      bounds.x1,
      bounds.y1,
      bounds.x2,
      bounds.y2,
      pillNodes ? 1 : 0,
    ],
  );
}
