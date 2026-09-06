import { nodeGeometryWidth } from "../graph/node-size";
import { singleBowCurve } from "./edge-route-geometry";
import type { EdgeRoutingMeta } from "./edge-routing";
import { edgeHasVisibleLabel } from "./edge-routing-shared";
import type { RoutingWork } from "./edge-routing-shared";
import { representativeBow } from "./edge-routing";
import { routeEdgeKey } from "./edge-routing";
import { edgeLabelClearance } from "./edge-routing-shared";
import type { ResolvedEdgeRoutingOptions } from "./edge-routing-shared";
import { EDGE_PAIR_SCORING_WORK_LIMIT } from "./edge-routing";
/** Candidate-curve scoring for automatic edge routing. Pure functions; the
 * work counter in RoutingWork bounds the total cost per routing pass. */
import type { GraphEdge, GraphNode, EdgeId, NodeId } from "../graph/model";
import {
  approximateCurveLength,
  edgeCurveMidpoint,
  createCurveNodeDistance,
  sampleEdgeCurve,
  type EdgeCurveGeometry,
  type EdgeCurvePoint,
} from "./edge-route-geometry";

export const NODE_CHECK_UNITS = 1;
export const EDGE_PAIR_UNITS = 4;
/** Bounding-box slack around a candidate curve when pruning obstacles. */
export const PRUNE_MARGIN_PX = 120;
export const STRAIGHT_CURVE: EdgeCurveGeometry = {
  controlPointDistancesPx: [0],
  controlPointWeights: [0.5],
};
export const NODE_COLLISION_SCORE = 1_000_000;
export const NODE_PENETRATION_SCORE = 1_000;
export const EDGE_CROSSING_SCORE = 500;
export const SIDE_CHANGE_SCORE = 120;
export const ROUTE_DIFFERENCE_SCORE = 0.8;
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

  return (
    collisionCount * NODE_COLLISION_SCORE +
    penetrationScore * NODE_PENETRATION_SCORE +
    scoreCurveCrossings(
      edge,
      edges,
      nodesById,
      source,
      target,
      curve,
      options,
      resolvedMeta,
    ) +
    scoreCurveLabelOverlap(
      edge,
      edges,
      nodesById,
      curve,
      options,
      resolvedMeta,
    ) +
    extraLength * EXTRA_LENGTH_SCORE +
    maximumOffset * 0.03 +
    curve.controlPointWeights.length * 0.4 +
    scoreCurveZigzag(curve) +
    scoreCurveInstability(curve, edge, options)
  );
}
export function scoreCurveCrossings(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodesById: Map<NodeId, GraphNode>,
  source: GraphNode,
  target: GraphNode,
  curve: EdgeCurveGeometry,
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
) {
  const samples = sampleEdgeCurve(source, target, curve, 8);
  const bounds = curveBounds(source, target, curve, 0);
  let score = 0;

  for (const otherEdge of edges) {
    if (
      otherEdge.id === edge.id ||
      otherEdge.source === edge.source ||
      otherEdge.source === edge.target ||
      otherEdge.target === edge.source ||
      otherEdge.target === edge.target
    ) {
      continue;
    }

    const otherSource = nodesById.get(otherEdge.source);
    const otherTarget = nodesById.get(otherEdge.target);

    if (!otherSource || !otherTarget) {
      continue;
    }

    const otherCurve = routeForEdge(otherEdge, options, resolvedMeta);
    const otherBounds = curveBounds(otherSource, otherTarget, otherCurve, 0);

    if (
      otherBounds.x2 < bounds.x1 ||
      otherBounds.x1 > bounds.x2 ||
      otherBounds.y2 < bounds.y1 ||
      otherBounds.y1 > bounds.y2
    ) {
      continue;
    }

    options.work.units += EDGE_PAIR_UNITS;
    const otherSamples = cachedCurveSamples(
      options.work,
      `${otherEdge.id}:${resolvedMeta.has(otherEdge.id) ? "r" : "p"}`,
      otherSource,
      otherTarget,
      otherCurve,
    );

    for (let index = 1; index < samples.length; index += 1) {
      const segmentStart = samples[index - 1];
      const segmentEnd = samples[index];

      if (!segmentStart || !segmentEnd) {
        continue;
      }

      let crossed = false;

      for (
        let otherIndex = 1;
        otherIndex < otherSamples.length;
        otherIndex += 1
      ) {
        const otherStart = otherSamples[otherIndex - 1];
        const otherEnd = otherSamples[otherIndex];

        if (
          !otherStart ||
          !otherEnd ||
          !segmentsProperlyIntersect(
            segmentStart,
            segmentEnd,
            otherStart,
            otherEnd,
          )
        ) {
          continue;
        }

        const crossingAngle = acuteCrossingAngle(
          segmentStart,
          segmentEnd,
          otherStart,
          otherEnd,
        );
        score += EDGE_CROSSING_SCORE + Math.max(0, 90 - crossingAngle) * 4;
        crossed = true;
        break;
      }

      if (crossed) {
        break;
      }
    }
  }

  return score;
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
    options.previousMeta.get(edge.id) ??
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
export function cachedCurveSamples(
  work: RoutingWork,
  key: string,
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  curve: EdgeCurveGeometry,
) {
  const cached = work.samples.get(key);

  if (cached) {
    return cached;
  }

  const samples = sampleEdgeCurve(source, target, curve, 8);
  work.samples.set(key, samples);

  return samples;
}
export function segmentsProperlyIntersect(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
) {
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  const epsilon = 0.001;

  return abC * abD < -epsilon && cdA * cdB < -epsilon;
}
export function orientation(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
export function acuteCrossingAngle(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number },
) {
  const firstX = b.x - a.x;
  const firstY = b.y - a.y;
  const secondX = d.x - c.x;
  const secondY = d.y - c.y;
  const denominator = Math.hypot(firstX, firstY) * Math.hypot(secondX, secondY);

  if (denominator === 0) {
    return 0;
  }

  const cosine = Math.min(
    1,
    Math.max(-1, (firstX * secondX + firstY * secondY) / denominator),
  );
  const degrees = (Math.acos(Math.abs(cosine)) * 180) / Math.PI;

  return Math.min(90, degrees);
}
export function scoreCurveInstability(
  curve: EdgeCurveGeometry,
  edge: GraphEdge,
  options: ResolvedEdgeRoutingOptions,
) {
  const previous = options.previousMeta.get(edge.id);

  if (!previous) {
    return 0;
  }

  const sampleCount = Math.max(
    curve.controlPointDistancesPx.length,
    previous.controlPointDistancesPx.length,
  );
  let difference = 0;

  for (let index = 0; index < sampleCount; index += 1) {
    const currentDistance =
      curve.controlPointDistancesPx[
        Math.min(index, curve.controlPointDistancesPx.length - 1)
      ] ?? 0;
    const previousDistance =
      previous.controlPointDistancesPx[
        Math.min(index, previous.controlPointDistancesPx.length - 1)
      ] ?? 0;
    difference += Math.abs(currentDistance - previousDistance);
  }

  const currentSide = Math.sign(representativeBow(curve));
  const previousSide = Math.sign(representativeBow(previous));
  const sideChangePenalty =
    currentSide !== 0 && previousSide !== 0 && currentSide !== previousSide
      ? SIDE_CHANGE_SCORE
      : 0;

  return difference * ROUTE_DIFFERENCE_SCORE + sideChangePenalty;
}
export function scoreCurveLabelOverlap(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodesById: Map<NodeId, GraphNode>,
  curve: EdgeCurveGeometry,
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
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

  const anchor = edgeCurveMidpoint(source, target, curve);
  let score = 0;

  for (const otherEdge of edges) {
    if (
      otherEdge.id === edge.id ||
      otherEdge.source === otherEdge.target ||
      routeEdgeKey(otherEdge) === routeEdgeKey(edge) ||
      !edgeHasVisibleLabel(otherEdge)
    ) {
      continue;
    }

    const otherSource = nodesById.get(otherEdge.source);
    const otherTarget = nodesById.get(otherEdge.target);

    if (!otherSource || !otherTarget) {
      continue;
    }

    const otherAnchor = edgeCurveMidpoint(
      otherSource,
      otherTarget,
      routeForEdge(otherEdge, options, resolvedMeta),
    );
    const distance = Math.hypot(
      anchor.x - otherAnchor.x,
      anchor.y - otherAnchor.y,
    );
    const overlap = Math.max(0, edgeLabelClearance(edge, otherEdge) - distance);
    score += overlap * overlap * 1.4;
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
