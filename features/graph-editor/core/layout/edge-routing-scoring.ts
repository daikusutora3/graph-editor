import { nodeGeometryWidth } from "../graph/node-size";
import {
  scoreRustCurveLabelOverlap,
  scoreRustCurveNodeAndShape,
  type RoutingLabelObstacle,
} from "../../compute/wasm-routing";
import { singleBowCurve } from "./edge-route-geometry";
import type { EdgeRoutingMeta } from "./edge-routing";
import { edgeHasVisibleLabel } from "./edge-routing-shared";
import { representativeBow } from "./edge-routing";
import { routeEdgeKey } from "./edge-routing";
import { edgeLabelSize } from "./edge-routing-shared";
import type { ResolvedEdgeRoutingOptions } from "./edge-routing-shared";
import { EDGE_PAIR_SCORING_WORK_LIMIT } from "./edge-routing";
/** Candidate-curve scoring for automatic edge routing. Pure functions; the
 * work counter in RoutingWork bounds the total cost per routing pass. */
import type { GraphEdge, GraphNode, EdgeId, NodeId } from "../graph/model";
import {
  approximateCurveLength,
  edgeCurveMidpoint,
  createCurveNodeDistance,
  type EdgeCurveGeometry,
  type EdgeCurvePoint,
} from "./edge-route-geometry";

export const NODE_CHECK_UNITS = 1;
/** Bounding-box slack around a candidate curve when pruning obstacles. */
export const PRUNE_MARGIN_PX = 120;
export const STRAIGHT_CURVE: EdgeCurveGeometry = {
  controlPointDistancesPx: [0],
  controlPointWeights: [0.5],
};
export const NODE_COLLISION_SCORE = 1_000_000;
export const NODE_PENETRATION_SCORE = 1_000;
export const EXTRA_LENGTH_SCORE = 0.2;
export function scoreCandidateCurve(
  curve: EdgeCurveGeometry,
  source: GraphNode,
  target: GraphNode,
  edge: GraphEdge,
  edges: GraphEdge[],
  nodes: GraphNode[],
  nodesById: Map<NodeId, GraphNode>,
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
) {
  return (
    scoreCurveNodeAndShape(curve, source, target, edge, nodes, options).score +
    scoreCurveLabelOverlap(edge, edges, nodesById, curve, options, resolvedMeta)
  );
}
export function scoreCurveNodeAndShape(
  curve: EdgeCurveGeometry,
  source: GraphNode,
  target: GraphNode,
  edge: GraphEdge,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
) {
  const rustScore = scoreRustCurveNodeAndShape(
    curve,
    source,
    target,
    edge,
    nodes,
    options.nodeClearancePx,
  );
  if (rustScore) {
    options.work.units += rustScore.units;
    return { collisions: rustScore.collisions, score: rustScore.score };
  }
  const distanceToNode = createCurveNodeDistance(source, target, curve);
  let collisionCount = 0;
  let penetrationScore = 0;
  const bounds = curveBounds(source, target, curve, options.nodeClearancePx);

  for (const node of nodes) {
    if (node.id === edge.source || node.id === edge.target) {
      continue;
    }

    if (
      node.x + nodeGeometryWidth(node) / 2 < bounds.x1 ||
      node.x - nodeGeometryWidth(node) / 2 > bounds.x2 ||
      node.y < bounds.y1 ||
      node.y > bounds.y2
    ) {
      continue;
    }

    options.work.units += NODE_CHECK_UNITS;
    const distance = distanceToNode(node);
    const overlap = Math.max(0, options.nodeClearancePx - distance);

    if (overlap > 0) {
      collisionCount += 1;
      penetrationScore += overlap * overlap;
    }
  }

  const directLength = Math.hypot(target.x - source.x, target.y - source.y);
  const extraLength = Math.max(
    0,
    approximateCurveLength(source, target, curve) - directLength,
  );
  const maximumOffset = Math.max(
    0,
    ...curve.controlPointDistancesPx.map(Math.abs),
  );

  return {
    collisions: collisionCount,
    score:
      collisionCount * NODE_COLLISION_SCORE +
      penetrationScore * NODE_PENETRATION_SCORE +
      extraLength * EXTRA_LENGTH_SCORE +
      maximumOffset * 0.03 +
      curve.controlPointWeights.length * 0.4 +
      scoreCurveZigzag(curve),
  };
}
export function routeForEdge(
  edge: GraphEdge,
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
): EdgeCurveGeometry {
  if (edge.routing?.bowPx !== undefined)
    return singleBowCurve(edge.routing.bowPx, edge.routing.bowT);
  return (
    resolvedMeta.get(edge.id) ??
    options.retainedMeta?.get(edge.id) ??
    STRAIGHT_CURVE
  );
}
/** Axis-aligned box that contains the curve plus `margin`, for cheap pruning. */
export function curveBounds(
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  curve: EdgeCurveGeometry,
  margin: number,
) {
  const reach =
    Math.max(0, ...curve.controlPointDistancesPx.map(Math.abs)) +
    margin +
    PRUNE_MARGIN_PX;

  return {
    x1: Math.min(source.x, target.x) - reach,
    y1: Math.min(source.y, target.y) - reach,
    x2: Math.max(source.x, target.x) + reach,
    y2: Math.max(source.y, target.y) + reach,
  };
}
export function scoreCurveLabelOverlap(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodesById: Map<NodeId, GraphNode>,
  curve: EdgeCurveGeometry,
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
  includeParallelLabels = false,
) {
  if (
    !edgeHasVisibleLabel(edge) ||
    edges.length * edges.length > EDGE_PAIR_SCORING_WORK_LIMIT
  ) {
    return 0;
  }

  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);

  if (!source || !target) {
    return 0;
  }

  const size = edgeLabelSize(edge, options.work);
  const labels: RoutingLabelObstacle[] = [];

  for (const otherEdge of edges) {
    if (
      otherEdge.id === edge.id ||
      otherEdge.source === otherEdge.target ||
      (!includeParallelLabels &&
        routeEdgeKey(otherEdge) === routeEdgeKey(edge)) ||
      !edgeHasVisibleLabel(otherEdge)
    ) {
      continue;
    }

    const otherSource = nodesById.get(otherEdge.source);
    const otherTarget = nodesById.get(otherEdge.target);

    if (!otherSource || !otherTarget) {
      continue;
    }

    const otherCurve = routeForEdge(otherEdge, options, resolvedMeta);
    const cached = options.work.labelAnchors?.get(otherEdge.id);
    const otherAnchor =
      cached?.curve === otherCurve
        ? cached.point
        : edgeCurveMidpoint(otherSource, otherTarget, otherCurve);
    if (cached?.curve !== otherCurve)
      options.work.labelAnchors?.set(otherEdge.id, {
        curve: otherCurve,
        point: otherAnchor,
      });
    options.work.units += NODE_CHECK_UNITS;
    const otherSize = edgeLabelSize(otherEdge, options.work);
    labels.push({ anchor: otherAnchor, size: otherSize });
  }
  if (labels.length === 0) return 0;
  // Rust saves midpoint sampling work for multi-control candidates. For simple
  // curves or many cached anchors, copying labels costs more than JS arithmetic.
  const rustScore =
    curve.controlPointWeights.length >= 3 && labels.length <= 64
      ? scoreRustCurveLabelOverlap(curve, source, target, size, labels)
      : null;
  if (rustScore !== null) return rustScore;
  const anchor = edgeCurveMidpoint(source, target, curve);
  let score = 0;
  for (const { anchor: otherAnchor, size: otherSize } of labels) {
    const overlapX =
      (size.width + otherSize.width) / 2 +
      2 -
      Math.abs(anchor.x - otherAnchor.x);
    const overlapY =
      (size.height + otherSize.height) / 2 +
      2 -
      Math.abs(anchor.y - otherAnchor.y);
    if (overlapX > 0 && overlapY > 0)
      score += 10_000 + overlapX * overlapY * 1.4;
  }

  return score;
}
export function scoreCurveZigzag(curve: EdgeCurveGeometry) {
  let score = 0;

  for (
    let index = 1;
    index < curve.controlPointDistancesPx.length;
    index += 1
  ) {
    const previous = curve.controlPointDistancesPx[index - 1] ?? 0;
    const current = curve.controlPointDistancesPx[index] ?? 0;

    if (Math.sign(previous) !== Math.sign(current)) {
      score += Math.abs(previous - current) * 2;
    }
  }

  return score;
}
export function compareCurvePreference(
  a: EdgeCurveGeometry,
  b: EdgeCurveGeometry,
  variant: number,
) {
  const aOffset = representativeBow(a);
  const bOffset = representativeBow(b);
  const sign = Math.abs(Math.trunc(variant) % 2) === 1 ? -1 : 1;

  return (
    a.controlPointWeights.length - b.controlPointWeights.length ||
    Math.abs(aOffset) - Math.abs(bOffset) ||
    (aOffset - bOffset) * sign
  );
}
