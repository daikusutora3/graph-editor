import type {
  EdgeId,
  GraphEdge,
  GraphModel,
  GraphNode,
  NodeId,
} from "../graph/model";
import { normalizeEdgeRoutingOverride } from "../graph/edge-routing-overrides";
import {
  approximateCurveLength,
  edgeCurveMidpoint,
  minimumCurveDistanceToNode,
  offsetEdgeCurve,
  reverseEdgeCurve,
  sampleEdgeCurve,
  singleBowCurve,
  type EdgeCurveGeometry,
} from "./edge-route-geometry";

export type EdgeRoutingMeta = EdgeCurveGeometry & {
  bowPx: number;
  duplicate: boolean;
  loopDirectionDeg: number;
  loopSweepDeg: number;
};

export type EdgeRoutingOptions = {
  variant?: number;
  avoidNodes?: boolean;
  previousMeta?: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
  rerouteEdgeIds?: ReadonlySet<EdgeId> | null;
  quality?: "interactive" | "settled";
  nodeClearancePx?: number;
  duplicateBowPx?: number;
  loopDirectionDeg?: number;
  loopDirectionStepDeg?: number;
  loopSweepDeg?: number;
  loopSweepStepDeg?: number;
  maxLoopSweepDeg?: number;
  candidateBowPx?: readonly number[];
};

const MAX_BOW_PX = 180;
const LOOP_DIRECTION_DEG = -45;
const LOOP_DIRECTION_STEP_DEG = 42;
const LOOP_SWEEP_DEG = 70;
const LOOP_SWEEP_STEP_DEG = 16;
const MAX_LOOP_SWEEP_DEG = 120;
const NODE_AVOIDANCE_WORK_LIMIT = 30_000;
const EDGE_PAIR_SCORING_WORK_LIMIT = 40_000;
const MIN_DUPLICATE_BOW_SPACING_PX = 12;

const defaultEdgeRoutingMeta: EdgeRoutingMeta = {
  bowPx: 0,
  controlPointDistancesPx: [0],
  controlPointWeights: [0.5],
  duplicate: false,
  loopDirectionDeg: LOOP_DIRECTION_DEG,
  loopSweepDeg: LOOP_SWEEP_DEG,
};

const defaultEdgeRoutingOptions: Required<EdgeRoutingOptions> = {
  variant: 0,
  avoidNodes: true,
  previousMeta: new Map(),
  rerouteEdgeIds: null,
  quality: "settled",
  nodeClearancePx: 42,
  duplicateBowPx: 36,
  loopDirectionDeg: LOOP_DIRECTION_DEG,
  loopDirectionStepDeg: LOOP_DIRECTION_STEP_DEG,
  loopSweepDeg: LOOP_SWEEP_DEG,
  loopSweepStepDeg: LOOP_SWEEP_STEP_DEG,
  maxLoopSweepDeg: MAX_LOOP_SWEEP_DEG,
  candidateBowPx: [0, 32, -32, 64, -64, 96, -96],
};

export function computeEdgeRouting(
  model: GraphModel,
  options: EdgeRoutingOptions = {},
): Map<EdgeId, EdgeRoutingMeta> {
  const resolvedOptions = { ...defaultEdgeRoutingOptions, ...options };
  const routeGroups = new Map<string, GraphEdge[]>();
  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));

  for (const edge of model.edges) {
    const key = routeEdgeKey(edge);
    const group = routeGroups.get(key);

    if (group) {
      group.push(edge);
    } else {
      routeGroups.set(key, [edge]);
    }
  }

  const duplicateKeys = getDuplicateKeys(model);
  const meta = new Map<EdgeId, EdgeRoutingMeta>();

  for (const edges of routeGroups.values()) {
    if (
      resolvedOptions.rerouteEdgeIds &&
      edges.every(
        (edge) =>
          !resolvedOptions.rerouteEdgeIds?.has(edge.id) &&
          resolvedOptions.previousMeta.has(edge.id),
      )
    ) {
      for (const edge of edges) {
        const previous = resolvedOptions.previousMeta.get(edge.id);

        if (previous) {
          meta.set(edge.id, previous);
        }
      }
      continue;
    }

    if (edges.every((edge) => edge.source === edge.target)) {
      const center = (edges.length - 1) / 2;
      const source = nodesById.get(edges[0]?.source ?? "");
      const loopDirectionDeg = source
        ? chooseLoopDirection(source, model.nodes, resolvedOptions)
        : resolvedOptions.loopDirectionDeg;

      for (const [index, edge] of edges.entries()) {
        meta.set(
          edge.id,
          applyRoutingOverride(edge, {
            bowPx: 0,
            controlPointDistancesPx: [0],
            controlPointWeights: [0.5],
            duplicate: duplicateKeys.has(duplicateEdgeKey(model, edge)),
            loopDirectionDeg: Math.round(
              loopDirectionDeg +
                (index - center) * resolvedOptions.loopDirectionStepDeg,
            ),
            loopSweepDeg: Math.min(
              resolvedOptions.maxLoopSweepDeg,
              resolvedOptions.loopSweepDeg +
                index * resolvedOptions.loopSweepStepDeg,
            ),
          }),
        );
      }

      continue;
    }

    if (edges.length === 1) {
      const edge = edges[0];
      const curve = chooseEdgeCurve(
        edge,
        model.edges,
        model.nodes,
        nodesById,
        resolvedOptions,
      );
      meta.set(
        edge.id,
        applyRoutingOverride(edge, {
          ...curve,
          bowPx: representativeBow(curve),
          duplicate: duplicateKeys.has(duplicateEdgeKey(model, edge)),
          loopDirectionDeg: resolvedOptions.loopDirectionDeg,
          loopSweepDeg: resolvedOptions.loopSweepDeg,
        }),
      );
      continue;
    }

    const center = (edges.length - 1) / 2;
    const duplicateBowPx = duplicateBowSpacing(
      edges.length,
      resolvedOptions.duplicateBowPx,
    );
    const maxDuplicateBow = center * duplicateBowPx;
    const firstEdge = edges[0];
    const canonicalEdge = canonicalRoutingEdge(firstEdge);
    const canonicalOptions = orientPreviousRouteForCanonicalEdge(
      firstEdge,
      resolvedOptions,
    );
    const groupCurve = clampCurveDistances(
      chooseEdgeCurve(
        canonicalEdge,
        model.edges,
        model.nodes,
        nodesById,
        canonicalOptions,
      ),
      -MAX_BOW_PX + maxDuplicateBow,
      MAX_BOW_PX - maxDuplicateBow,
    );

    for (const [index, edge] of edges.entries()) {
      const canonicalCurve = offsetEdgeCurve(
        groupCurve,
        (index - center) * duplicateBowPx,
      );
      const curve = orientCanonicalCurve(edge, canonicalCurve);

      meta.set(
        edge.id,
        applyRoutingOverride(edge, {
          ...curve,
          bowPx: representativeBow(curve),
          duplicate: duplicateKeys.has(duplicateEdgeKey(model, edge)),
          loopDirectionDeg: resolvedOptions.loopDirectionDeg,
          loopSweepDeg: resolvedOptions.loopSweepDeg,
        }),
      );
    }
  }

  return meta;
}

function duplicateBowSpacing(edgeCount: number, requestedSpacing: number) {
  if (edgeCount <= 1) {
    return requestedSpacing;
  }

  const maximumUniqueSpacing = (MAX_BOW_PX * 2) / Math.max(1, edgeCount - 1);

  if (maximumUniqueSpacing < MIN_DUPLICATE_BOW_SPACING_PX) {
    return maximumUniqueSpacing;
  }

  return Math.max(
    MIN_DUPLICATE_BOW_SPACING_PX,
    Math.min(requestedSpacing, maximumUniqueSpacing),
  );
}

export function shouldAvoidNodesForEdgeRouting(model: GraphModel) {
  if (model.nodes.length === 0 || model.edges.length === 0) {
    return false;
  }

  return model.nodes.length * model.edges.length <= NODE_AVOIDANCE_WORK_LIMIT;
}

export function createEdgeRoutingCacheKey(
  model: GraphModel,
  options: EdgeRoutingOptions = {},
) {
  const resolvedOptions = { ...defaultEdgeRoutingOptions, ...options };
  const optionSignature = [
    model.settings.directed,
    resolvedOptions.variant,
    resolvedOptions.avoidNodes,
    resolvedOptions.quality,
    resolvedOptions.nodeClearancePx,
    resolvedOptions.duplicateBowPx,
    resolvedOptions.loopDirectionDeg,
    resolvedOptions.loopDirectionStepDeg,
    resolvedOptions.loopSweepDeg,
    resolvedOptions.loopSweepStepDeg,
    resolvedOptions.maxLoopSweepDeg,
    resolvedOptions.candidateBowPx.join(","),
  ].join(":");
  const nodeSignature = resolvedOptions.avoidNodes
    ? model.nodes.map((node) => `${node.id}:${node.x}:${node.y}`).join("|")
    : "";
  const edgeSignature = model.edges
    .map(
      (edge) =>
        `${edge.id}:${edge.source}:${edge.target}:${edge.routing?.bowPx ?? ""}:${
          edge.routing?.loopDirectionDeg ?? ""
        }:${edge.routing?.loopSweepDeg ?? ""}`,
    )
    .join("|");

  return `${optionSignature}:${nodeSignature}:${edgeSignature}`;
}

function applyRoutingOverride(
  edge: GraphEdge,
  meta: EdgeRoutingMeta,
): EdgeRoutingMeta {
  const routing = normalizeEdgeRoutingOverride(edge.routing);

  if (!routing) {
    return meta;
  }

  if (edge.source === edge.target) {
    return {
      ...meta,
      loopDirectionDeg: routing.loopDirectionDeg ?? meta.loopDirectionDeg,
      loopSweepDeg: routing.loopSweepDeg ?? meta.loopSweepDeg,
    };
  }

  if (routing.bowPx != null) {
    return {
      ...meta,
      ...singleBowCurve(routing.bowPx),
      bowPx: routing.bowPx,
    };
  }

  return {
    ...meta,
  };
}

function chooseEdgeCurve(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodes: GraphNode[],
  nodesById: Map<NodeId, GraphNode>,
  options: Required<EdgeRoutingOptions>,
): EdgeCurveGeometry {
  const legacyBow = chooseEdgeBow(edge, edges, nodes, nodesById, 0, options);
  const legacyCurve = singleBowCurve(legacyBow);

  if (!options.avoidNodes || edge.source === edge.target) {
    return legacyCurve;
  }

  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);

  if (!source || !target) {
    return legacyCurve;
  }

  const obstacles = projectedEdgeObstacles(
    edge,
    source,
    target,
    nodes,
    options.nodeClearancePx,
  );

  const candidates = edgeBowCandidates(0, options.candidateBowPx).map(
    singleBowCurve,
  );

  if (obstacles.length > 0) {
    candidates.push(
      createObstacleAvoidingCurve(obstacles, 1),
      createObstacleAvoidingCurve(obstacles, -1),
    );
  }
  const previous = options.previousMeta.get(edge.id);

  if (previous && options.quality === "interactive") {
    candidates.unshift({
      controlPointDistancesPx: previous.controlPointDistancesPx,
      controlPointWeights: previous.controlPointWeights,
    });
  }
  let best = candidates[0] ?? legacyCurve;
  let bestScore = scoreCandidateCurve(
    best,
    source,
    target,
    edge,
    edges,
    nodes,
    nodesById,
    options,
  );

  for (const candidate of candidates.slice(1)) {
    const score = scoreCandidateCurve(
      candidate,
      source,
      target,
      edge,
      edges,
      nodes,
      nodesById,
      options,
    );

    if (
      score < bestScore ||
      (score === bestScore &&
        compareCurvePreference(candidate, best, options.variant) < 0)
    ) {
      best = candidate;
      bestScore = score;
    }
  }

  return clampCurveDistances(best, -MAX_BOW_PX, MAX_BOW_PX);
}

type ProjectedObstacleCluster = {
  endWeight: number;
  negativeDistancePx: number;
  positiveDistancePx: number;
  startWeight: number;
};

function projectedEdgeObstacles(
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode,
  nodes: GraphNode[],
  clearancePx: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);

  if (length === 0) {
    return [];
  }

  const unitX = dx / length;
  const unitY = dy / length;
  const normalX = -unitY;
  const normalY = unitX;
  const extentWeight = Math.min(0.22, clearancePx / length);
  const obstacles = nodes
    .filter((node) => node.id !== edge.source && node.id !== edge.target)
    .map((node) => {
      const relativeX = node.x - source.x;
      const relativeY = node.y - source.y;

      return {
        endWeight: clamp(
          (relativeX * unitX + relativeY * unitY) / length + extentWeight,
          0.08,
          0.92,
        ),
        negativeDistancePx:
          relativeX * normalX + relativeY * normalY - clearancePx,
        positiveDistancePx:
          relativeX * normalX + relativeY * normalY + clearancePx,
        startWeight: clamp(
          (relativeX * unitX + relativeY * unitY) / length - extentWeight,
          0.08,
          0.92,
        ),
        perpendicularDistance: Math.abs(
          relativeX * normalX + relativeY * normalY,
        ),
      };
    })
    .filter(
      (obstacle) =>
        obstacle.startWeight < obstacle.endWeight &&
        obstacle.perpendicularDistance < clearancePx * 1.8,
    )
    .toSorted((a, b) => a.startWeight - b.startWeight);
  const clusters: ProjectedObstacleCluster[] = [];

  for (const obstacle of obstacles) {
    const previous = clusters.at(-1);

    if (previous && obstacle.startWeight <= previous.endWeight + 0.06) {
      previous.endWeight = Math.max(previous.endWeight, obstacle.endWeight);
      previous.positiveDistancePx = Math.max(
        previous.positiveDistancePx,
        obstacle.positiveDistancePx,
      );
      previous.negativeDistancePx = Math.min(
        previous.negativeDistancePx,
        obstacle.negativeDistancePx,
      );
      continue;
    }

    clusters.push({
      endWeight: obstacle.endWeight,
      negativeDistancePx: obstacle.negativeDistancePx,
      positiveDistancePx: obstacle.positiveDistancePx,
      startWeight: obstacle.startWeight,
    });
  }

  if (clusters.length <= 2) {
    return clusters;
  }

  return [
    {
      startWeight: clusters[0]?.startWeight ?? 0.2,
      endWeight: clusters.at(-1)?.endWeight ?? 0.8,
      positiveDistancePx: Math.max(
        ...clusters.map((cluster) => cluster.positiveDistancePx),
      ),
      negativeDistancePx: Math.min(
        ...clusters.map((cluster) => cluster.negativeDistancePx),
      ),
    },
  ];
}

function createObstacleAvoidingCurve(
  obstacles: ProjectedObstacleCluster[],
  side: 1 | -1,
): EdgeCurveGeometry {
  return {
    controlPointDistancesPx: obstacles.flatMap((obstacle) => {
      const distance =
        side > 0 ? obstacle.positiveDistancePx : obstacle.negativeDistancePx;

      return [distance, distance];
    }),
    controlPointWeights: obstacles.flatMap((obstacle) => [
      obstacle.startWeight,
      obstacle.endWeight,
    ]),
  };
}

function scoreCandidateCurve(
  curve: EdgeCurveGeometry,
  source: GraphNode,
  target: GraphNode,
  edge: GraphEdge,
  edges: GraphEdge[],
  nodes: GraphNode[],
  nodesById: Map<NodeId, GraphNode>,
  options: Required<EdgeRoutingOptions>,
) {
  let collisionCount = 0;
  let penetrationScore = 0;

  for (const node of nodes) {
    if (node.id === edge.source || node.id === edge.target) {
      continue;
    }

    const distance = minimumCurveDistanceToNode(source, target, curve, node);
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
    collisionCount * 1_000_000 +
    penetrationScore * 1_000 +
    scoreCurveCrossings(edge, edges, nodesById, source, target, curve) +
    scoreCurveLabelOverlap(edge, edges, nodesById, curve) +
    extraLength * 0.2 +
    maximumOffset * 0.03 +
    curve.controlPointWeights.length * 0.4 +
    scoreCurveZigzag(curve) +
    scoreCurveInstability(curve, edge, options)
  );
}

function scoreCurveCrossings(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodesById: Map<NodeId, GraphNode>,
  source: GraphNode,
  target: GraphNode,
  curve: EdgeCurveGeometry,
) {
  if (edges.length * edges.length > EDGE_PAIR_SCORING_WORK_LIMIT) {
    return 0;
  }

  const samples = sampleEdgeCurve(source, target, curve, 8);
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

    for (let index = 1; index < samples.length; index += 1) {
      const segmentStart = samples[index - 1];
      const segmentEnd = samples[index];

      if (
        !segmentStart ||
        !segmentEnd ||
        !segmentsProperlyIntersect(
          segmentStart,
          segmentEnd,
          otherSource,
          otherTarget,
        )
      ) {
        continue;
      }

      const crossingAngle = acuteCrossingAngle(
        segmentStart,
        segmentEnd,
        otherSource,
        otherTarget,
      );
      score += 500 + Math.max(0, 90 - crossingAngle) * 4;
      break;
    }
  }

  return score;
}

function segmentsProperlyIntersect(
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

function orientation(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function acuteCrossingAngle(
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

function scoreCurveInstability(
  curve: EdgeCurveGeometry,
  edge: GraphEdge,
  options: Required<EdgeRoutingOptions>,
) {
  if (options.quality !== "interactive") {
    return 0;
  }

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
      ? 120
      : 0;

  return difference * 0.8 + sideChangePenalty;
}

function scoreCurveLabelOverlap(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodesById: Map<NodeId, GraphNode>,
  curve: EdgeCurveGeometry,
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

    const otherAnchor = {
      x: (otherSource.x + otherTarget.x) / 2,
      y: (otherSource.y + otherTarget.y) / 2,
    };
    const distance = Math.hypot(
      anchor.x - otherAnchor.x,
      anchor.y - otherAnchor.y,
    );
    const overlap = Math.max(0, edgeLabelClearance(edge, otherEdge) - distance);
    score += overlap * overlap * 1.4;
  }

  return score;
}

function scoreCurveZigzag(curve: EdgeCurveGeometry) {
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

function compareCurvePreference(
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

function representativeBow(curve: EdgeCurveGeometry) {
  if (curve.controlPointDistancesPx.length === 0) {
    return 0;
  }

  return Math.round(
    curve.controlPointDistancesPx.reduce(
      (total, distance) => total + distance,
      0,
    ) / curve.controlPointDistancesPx.length,
  );
}

function clampCurveDistances(
  curve: EdgeCurveGeometry,
  minimum: number,
  maximum: number,
): EdgeCurveGeometry {
  return {
    ...curve,
    controlPointDistancesPx: curve.controlPointDistancesPx.map((distance) =>
      Math.round(clamp(distance, minimum, maximum)),
    ),
  };
}

function orientCanonicalCurve(
  edge: GraphEdge,
  canonicalCurve: EdgeCurveGeometry,
) {
  return edge.source <= edge.target
    ? canonicalCurve
    : reverseEdgeCurve(canonicalCurve);
}

function chooseEdgeBow(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodes: GraphNode[],
  nodesById: Map<NodeId, GraphNode>,
  baseBowPx: number,
  options: Required<EdgeRoutingOptions>,
) {
  if (edge.source === edge.target) return 0;
  if (!options.avoidNodes) {
    return Math.round(clamp(baseBowPx, -MAX_BOW_PX, MAX_BOW_PX));
  }

  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);

  if (!source || !target) return 0;

  const candidates = edgeBowCandidates(baseBowPx, options.candidateBowPx).map(
    (bowPx) => ({
      bowPx,
      score: scoreCandidateBow(
        bowPx,
        source,
        target,
        edge,
        edges,
        nodes,
        nodesById,
        baseBowPx,
        options,
      ),
    }),
  );
  const variant = Math.trunc(options.variant);
  let best = candidates[0] ?? {
    bowPx: baseBowPx,
    score: scoreCandidateBow(
      baseBowPx,
      source,
      target,
      edge,
      edges,
      nodes,
      nodesById,
      baseBowPx,
      options,
    ),
  };

  for (const candidate of candidates.slice(1)) {
    if (compareCandidate(candidate, best, baseBowPx, variant) < 0) {
      best = candidate;
    }
  }

  return Math.round(clamp(best.bowPx, -MAX_BOW_PX, MAX_BOW_PX));
}

function chooseLoopDirection(
  source: GraphNode,
  nodes: GraphNode[],
  options: Required<EdgeRoutingOptions>,
) {
  if (!options.avoidNodes) {
    return options.loopDirectionDeg;
  }

  const candidates = loopDirectionCandidates(options);
  let best = candidates[0] ?? options.loopDirectionDeg;
  let bestScore = scoreLoopDirection(best, source, nodes, options);

  for (const candidate of candidates.slice(1)) {
    const score = scoreLoopDirection(candidate, source, nodes, options);

    if (
      score < bestScore ||
      (score === bestScore &&
        Math.abs(candidate - options.loopDirectionDeg) <
          Math.abs(best - options.loopDirectionDeg))
    ) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function loopDirectionCandidates(options: Required<EdgeRoutingOptions>) {
  return Array.from({ length: 24 }, (_, index) =>
    Math.round(options.loopDirectionDeg + index * 15),
  );
}

function scoreLoopDirection(
  directionDeg: number,
  source: GraphNode,
  nodes: GraphNode[],
  options: Required<EdgeRoutingOptions>,
) {
  const loopPoints = loopSamplePoints(source, directionDeg, options);
  let score =
    Math.abs(normalizeDegrees(directionDeg - options.loopDirectionDeg)) * 0.01;

  for (const node of nodes) {
    if (node.id === source.id) continue;

    const distance = Math.min(
      ...loopPoints.map((point) =>
        Math.hypot(node.x - point.x, node.y - point.y),
      ),
    );
    const overlap = Math.max(0, options.nodeClearancePx - distance);
    score += overlap * overlap;
  }

  return score;
}

function loopSamplePoints(
  source: GraphNode,
  directionDeg: number,
  options: Required<EdgeRoutingOptions>,
) {
  const direction = (directionDeg * Math.PI) / 180;
  const sweep = (options.loopSweepDeg * Math.PI) / 180;
  const radius = options.nodeClearancePx * 1.7;

  return Array.from({ length: 7 }, (_, index) => {
    const t = index / 6;
    const angle = direction - sweep / 2 + sweep * t;

    return {
      x: source.x + Math.cos(angle) * radius,
      y: source.y + Math.sin(angle) * radius,
    };
  });
}

function normalizeDegrees(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}

function edgeBowCandidates(baseBowPx: number, offsets: readonly number[]) {
  const candidates = new Set<number>([baseBowPx]);

  for (const offset of offsets) {
    candidates.add(baseBowPx + offset);
  }

  return [...candidates];
}

function compareCandidate(
  a: { bowPx: number; score: number },
  b: { bowPx: number; score: number },
  baseBowPx: number,
  variant: number,
) {
  if (a.score !== b.score) {
    return a.score - b.score;
  }

  return (
    candidatePreference(a.bowPx, baseBowPx, variant) -
    candidatePreference(b.bowPx, baseBowPx, variant)
  );
}

function scoreCandidateBow(
  bowPx: number,
  source: GraphNode,
  target: GraphNode,
  edge: GraphEdge,
  edges: GraphEdge[],
  nodes: GraphNode[],
  nodesById: Map<NodeId, GraphNode>,
  baseBowPx: number,
  options: Required<EdgeRoutingOptions>,
) {
  const length = Math.hypot(target.x - source.x, target.y - source.y);
  let score = Math.abs(bowPx) * 0.04 + Math.abs(bowPx - baseBowPx) * 0.025;

  if (length === 0) return score;

  for (const node of nodes) {
    if (node.id === edge.source || node.id === edge.target) continue;

    const nearest = nearestQuadraticPoint(source, target, bowPx, node);
    const endpointWeight = endpointProximityWeight(nearest.t);
    if (endpointWeight === 0) continue;

    const overlap = Math.max(0, options.nodeClearancePx - nearest.distance);
    score += overlap * overlap * endpointWeight;
  }

  score += scoreEdgeLabelOverlap(edge, edges, nodesById, bowPx);

  return score;
}

function scoreEdgeLabelOverlap(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodesById: Map<NodeId, GraphNode>,
  bowPx: number,
) {
  if (!edgeHasVisibleLabel(edge) || edge.source === edge.target) {
    return 0;
  }

  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);

  if (!source || !target) {
    return 0;
  }

  const anchor = quadraticPoint(source, target, bowPx, 0.5);
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

    const otherAnchor = quadraticPoint(otherSource, otherTarget, 0, 0.5);
    const distance = Math.hypot(
      anchor.x - otherAnchor.x,
      anchor.y - otherAnchor.y,
    );
    const clearance = edgeLabelClearance(edge, otherEdge);
    const overlap = Math.max(0, clearance - distance);

    score += overlap * overlap * 1.4;
  }

  return score;
}

function edgeHasVisibleLabel(edge: GraphEdge) {
  return Boolean(edge.label || edge.weight);
}

function edgeLabelClearance(edge: GraphEdge, otherEdge: GraphEdge) {
  const labelLength = Math.max(
    edgeLabelText(edge).length,
    edgeLabelText(otherEdge).length,
  );

  return 34 + labelLength * 4;
}

function edgeLabelText(edge: GraphEdge) {
  return edge.label ?? edge.weight ?? "";
}

function nearestQuadraticPoint(
  source: GraphNode,
  target: GraphNode,
  bowPx: number,
  node: GraphNode,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const normalX = length === 0 ? 0 : -dy / length;
  const normalY = length === 0 ? 0 : dx / length;
  const controlX = (source.x + target.x) / 2 + normalX * bowPx;
  const controlY = (source.y + target.y) / 2 + normalY * bowPx;
  let best = { distance: Number.POSITIVE_INFINITY, t: 0 };

  for (let step = 0; step <= 20; step += 1) {
    const t = step / 20;
    const inv = 1 - t;
    const x = inv * inv * source.x + 2 * inv * t * controlX + t * t * target.x;
    const y = inv * inv * source.y + 2 * inv * t * controlY + t * t * target.y;
    const distance = Math.hypot(node.x - x, node.y - y);

    if (distance < best.distance) {
      best = { distance, t };
    }
  }

  return best;
}

function quadraticPoint(
  source: GraphNode,
  target: GraphNode,
  bowPx: number,
  t: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const normalX = length === 0 ? 0 : -dy / length;
  const normalY = length === 0 ? 0 : dx / length;
  const controlX = (source.x + target.x) / 2 + normalX * bowPx;
  const controlY = (source.y + target.y) / 2 + normalY * bowPx;
  const inv = 1 - t;

  return {
    x: inv * inv * source.x + 2 * inv * t * controlX + t * t * target.x,
    y: inv * inv * source.y + 2 * inv * t * controlY + t * t * target.y,
  };
}

function endpointProximityWeight(t: number) {
  const endpointDistance = Math.min(t, 1 - t);

  if (endpointDistance <= 0.08) return 0;
  if (endpointDistance >= 0.24) return 1;

  return (endpointDistance - 0.08) / 0.16;
}

function candidatePreference(
  bowPx: number,
  baseBowPx: number,
  variant: number,
) {
  const signPreference =
    Math.abs(variant % 2) === 1 ? -Math.sign(bowPx) : Math.sign(bowPx);
  const curvePreference =
    Math.floor(Math.abs(variant) / 2) % 2 === 1
      ? -Math.abs(bowPx - baseBowPx)
      : Math.abs(bowPx - baseBowPx);

  return curvePreference + signPreference * 0.001;
}

function canonicalRoutingEdge(edge: GraphEdge): GraphEdge {
  if (edge.source <= edge.target) {
    return edge;
  }

  return {
    ...edge,
    source: edge.target,
    target: edge.source,
  };
}

function orientPreviousRouteForCanonicalEdge(
  edge: GraphEdge,
  options: Required<EdgeRoutingOptions>,
): Required<EdgeRoutingOptions> {
  if (edge.source <= edge.target) {
    return options;
  }

  const previous = options.previousMeta.get(edge.id);

  if (!previous) {
    return options;
  }

  const previousMeta = new Map(options.previousMeta);
  previousMeta.set(edge.id, {
    ...previous,
    ...reverseEdgeCurve(previous),
    bowPx: -previous.bowPx,
  });

  return { ...options, previousMeta };
}

function routeEdgeKey(edge: GraphEdge) {
  return edge.source <= edge.target
    ? `${edge.source}\0${edge.target}`
    : `${edge.target}\0${edge.source}`;
}

function getDuplicateKeys(model: GraphModel) {
  const edgeCounts = new Map<string, number>();
  const duplicateKeys = new Set<string>();

  for (const edge of model.edges) {
    const key = duplicateEdgeKey(model, edge);
    const count = (edgeCounts.get(key) ?? 0) + 1;
    edgeCounts.set(key, count);

    if (count === 2) {
      duplicateKeys.add(key);
    }
  }

  return duplicateKeys;
}

function duplicateEdgeKey(model: GraphModel, edge: GraphEdge) {
  if (model.settings.directed) {
    return `${edge.source}\0${edge.target}`;
  }

  return routeEdgeKey(edge);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export { defaultEdgeRoutingMeta };
