import type { GraphEdge, GraphNode } from "../core/graph/model";
import { isGraphCoordinate } from "../core/graph/graph-coordinates";
import { nodeGeometryWidth } from "../core/graph/node-size";
import type {
  EdgeCurveGeometry,
  EdgeCurvePoint,
} from "../core/layout/edge-route-geometry";
import { getRustKernelReady, runRustKernel } from "./rust-kernel";

type NodeSnapshot = {
  data: Float64Array;
  collisionBounded: boolean;
  hasWidePills: boolean;
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
  let hasWidePills = false;
  const indexes = new Map<string, number>();
  const records = nodes.map((node, index) => {
    data[index * 3] = node.x;
    data[index * 3 + 1] = node.y;
    data[index * 3 + 2] = nodeGeometryWidth(node) / 2;
    hasWidePills ||= data[index * 3 + 2]! > 24;
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
  const snapshot = { data, collisionBounded, hasWidePills, indexes, records };
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

export type ProjectedObstacleCluster = {
  endWeight: number;
  negativeDistancePx: number;
  positiveDistancePx: number;
  startWeight: number;
};

/** Capsule projection and stable clustering. Host-derived chord/direction norms
 * retain the reference's Math.hypot values before the 24-step pill searches. */
export function projectRustEdgeObstacles(
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode,
  nodes: GraphNode[],
  baseClearancePx: number,
): ProjectedObstacleCluster[] | null {
  if (!getRustKernelReady() || nodes.length < 64) return null;
  if (
    ![source.x, source.y, target.x, target.y, baseClearancePx].every(
      boundedCollisionCoordinate,
    )
  )
    return null;
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];
  if (!Number.isFinite(length)) return null;
  const snapshot = nodeSnapshot(nodes);
  if (!snapshot.collisionBounded || snapshot.indexes.size !== nodes.length)
    return null;
  // Small all-circle projections have no pill search to amortize the ABI.
  if (nodes.length < 256 && !snapshot.hasWidePills) return null;
  const unitX = dx / length;
  const unitY = dy / length;
  const result = runRustKernel(
    "routing_projected_obstacles",
    [snapshot.data],
    10,
    [
      nodes.length,
      snapshot.indexes.get(edge.source) ?? -1,
      snapshot.indexes.get(edge.target) ?? -1,
      source.x,
      source.y,
      length,
      unitX,
      unitY,
      Math.hypot(unitX, unitY) || 1,
      Math.hypot(-unitY, unitX) || 1,
      baseClearancePx,
    ],
  );
  if (!result || result[0] === -1) return null;
  const count = result[0]!;
  if (result[1] === 1)
    return [
      {
        startWeight: result[2]!,
        endWeight: result[3]!,
        positiveDistancePx: result[5]!,
        negativeDistancePx: result[4]!,
      },
    ];
  return Array.from({ length: count }, (_, index) => ({
    endWeight: result[3 + index * 4]!,
    negativeDistancePx: result[4 + index * 4]!,
    positiveDistancePx: result[5 + index * 4]!,
    startWeight: result[2 + index * 4]!,
  }));
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
  if (
    !canRustCountCurveNodeCollisions(curve, source, target) ||
    !boundedCollisionCoordinate(clearance)
  )
    return null;
  const snapshot = nodeSnapshot(nodes);
  // Models validate unique IDs. Preserve the public helper's exclusion rules
  // for callers that supply a temporary invalid array with duplicate IDs.
  if (!snapshot.collisionBounded || snapshot.indexes.size !== nodes.length)
    return null;
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
const boundedCollisionCoordinate = isGraphCoordinate;

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
  if (
    !boundedCollisionCoordinate(clearance) ||
    !points.every(
      (point) =>
        boundedCollisionCoordinate(point.x) &&
        boundedCollisionCoordinate(point.y),
    )
  )
    return null;
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
  const snapshot = nodeSnapshot(nodes);
  if (!snapshot.collisionBounded) return null;
  const result = runRustKernel(
    "routing_loop_obstacles",
    [snapshot.data, data],
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
  // The first collision slot is a batch-wide sentinel for a strict threshold
  // tie. Keep JS's Math.hypot result and its original generator work trace.
  return result?.[2] === -1 ? null : result;
}
