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

export type EdgeRoutingMode = "simple" | "quality";

export type EdgeRoutingOptions = {
  mode?: EdgeRoutingMode;
  previousMeta?: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
  rerouteEdgeIds?: ReadonlySet<EdgeId> | null;
};

type ResolvedEdgeRoutingOptions = {
  avoidNodes: boolean;
  candidateBowPx: readonly number[];
  duplicateBowPx: number;
  loopDirectionDeg: number;
  loopDirectionStepDeg: number;
  loopSweepDeg: number;
  loopSweepStepDeg: number;
  maxLoopSweepDeg: number;
  nodeClearancePx: number;
  previousMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
  rerouteEdgeIds: ReadonlySet<EdgeId> | null;
  separateParallelEdges: boolean;
  variant: number;
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
const NODE_COLLISION_SCORE = 1_000_000;
const NODE_PENETRATION_SCORE = 1_000;
const EDGE_CROSSING_SCORE = 500;
const SIDE_CHANGE_SCORE = 120;
const ROUTE_DIFFERENCE_SCORE = 0.8;
const EXTRA_LENGTH_SCORE = 0.2;

const defaultEdgeRoutingMeta: EdgeRoutingMeta = {
  bowPx: 0,
  controlPointDistancesPx: [0],
  controlPointWeights: [0.5],
  duplicate: false,
  loopDirectionDeg: LOOP_DIRECTION_DEG,
  loopSweepDeg: LOOP_SWEEP_DEG,
};

const defaultEdgeRoutingOptions: ResolvedEdgeRoutingOptions = {
  variant: 0,
  avoidNodes: true,
  previousMeta: new Map(),
  rerouteEdgeIds: null,
  separateParallelEdges: true,
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
  const resolvedOptions = resolveEdgeRoutingOptions(model, options);
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
  const originalEdgeOrder = new Map(
    model.edges.map((edge, index) => [edge.id, index]),
  );

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
      const center = resolvedOptions.separateParallelEdges
        ? (edges.length - 1) / 2
        : 0;
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
                (resolvedOptions.separateParallelEdges ? index - center : 0) *
                  resolvedOptions.loopDirectionStepDeg,
            ),
            loopSweepDeg: Math.min(
              resolvedOptions.maxLoopSweepDeg,
              resolvedOptions.loopSweepDeg +
                (resolvedOptions.separateParallelEdges ? index : 0) *
                  resolvedOptions.loopSweepStepDeg,
            ),
          }),
        );
      }

      continue;
    }

    if (!resolvedOptions.separateParallelEdges) {
      for (const edge of edges) {
        meta.set(
          edge.id,
          applyRoutingOverride(edge, {
            ...singleBowCurve(0),
            bowPx: 0,
            duplicate: duplicateKeys.has(duplicateEdgeKey(model, edge)),
            loopDirectionDeg: resolvedOptions.loopDirectionDeg,
            loopSweepDeg: resolvedOptions.loopSweepDeg,
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
        meta,
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

    const orderedEdges = orderParallelEdges(
      edges,
      resolvedOptions.previousMeta,
      originalEdgeOrder,
    );
    const center = (orderedEdges.length - 1) / 2;
    const duplicateBowPx = duplicateBowSpacing(
      orderedEdges.length,
      resolvedOptions.duplicateBowPx,
    );
    const maxDuplicateBow = center * duplicateBowPx;
    const firstEdge = orderedEdges[0];
    const canonicalEdge = canonicalRoutingEdge(firstEdge);
    const canonicalOptions = centerPreviousRouteForParallelGroup(
      firstEdge,
      orientPreviousRouteForCanonicalEdge(firstEdge, resolvedOptions),
      -center * duplicateBowPx,
    );
    const groupCurve = clampCurveDistances(
      chooseEdgeCurve(
        canonicalEdge,
        model.edges,
        model.nodes,
        nodesById,
        canonicalOptions,
        meta,
      ),
      -MAX_BOW_PX + maxDuplicateBow,
      MAX_BOW_PX - maxDuplicateBow,
    );

    for (const [index, edge] of orderedEdges.entries()) {
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

function orderParallelEdges(
  edges: GraphEdge[],
  previousMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
  originalEdgeOrder: ReadonlyMap<EdgeId, number>,
) {
  return edges.toSorted((a, b) => {
    const previousBowDifference =
      canonicalPreviousBow(a, previousMeta) -
      canonicalPreviousBow(b, previousMeta);

    return (
      previousBowDifference ||
      (originalEdgeOrder.get(a.id) ?? 0) - (originalEdgeOrder.get(b.id) ?? 0)
    );
  });
}

function canonicalPreviousBow(
  edge: GraphEdge,
  previousMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
) {
  const bowPx = previousMeta.get(edge.id)?.bowPx ?? 0;

  return edge.source <= edge.target ? bowPx : -bowPx;
}

export function shouldAvoidNodesForEdgeRouting(model: GraphModel) {
  return resolveRoutingMode(model, "quality") === "quality";
}

export function resolveRoutingMode(
  model: GraphModel,
  requestedMode: EdgeRoutingMode,
): EdgeRoutingMode {
  if (requestedMode === "simple") {
    return "simple";
  }

  const nodeAvoidanceAffordable =
    model.nodes.length > 0 &&
    model.edges.length > 0 &&
    model.nodes.length * model.edges.length <= NODE_AVOIDANCE_WORK_LIMIT;
  const edgeScoringAffordable =
    model.edges.length * model.edges.length <= EDGE_PAIR_SCORING_WORK_LIMIT;

  return nodeAvoidanceAffordable && edgeScoringAffordable
    ? "quality"
    : "simple";
}

function resolveEdgeRoutingOptions(
  model: GraphModel,
  options: EdgeRoutingOptions,
): ResolvedEdgeRoutingOptions {
  const mode = resolveRoutingMode(model, options.mode ?? "quality");

  return {
    ...defaultEdgeRoutingOptions,
    avoidNodes: mode === "quality",
    previousMeta:
      options.previousMeta ?? defaultEdgeRoutingOptions.previousMeta,
    rerouteEdgeIds:
      options.rerouteEdgeIds ?? defaultEdgeRoutingOptions.rerouteEdgeIds,
    separateParallelEdges: options.mode !== "simple",
  };
}

export function createEdgeRoutingCacheKey(
  model: GraphModel,
  options: EdgeRoutingOptions = {},
) {
  const resolvedOptions = resolveEdgeRoutingOptions(model, options);
  const optionSignature = [
    model.settings.directed,
    resolvedOptions.variant,
    resolvedOptions.avoidNodes,
    resolvedOptions.separateParallelEdges,
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
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
): EdgeCurveGeometry {
  const simpleCurve = singleBowCurve(0);

  if (!options.avoidNodes || edge.source === edge.target) {
    return simpleCurve;
  }

  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);

  if (!source || !target) {
    return simpleCurve;
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

  if (previous) {
    candidates.unshift({
      controlPointDistancesPx: previous.controlPointDistancesPx,
      controlPointWeights: previous.controlPointWeights,
    });
  }
  let best = candidates[0] ?? simpleCurve;
  let bestScore = scoreCandidateCurve(
    best,
    source,
    target,
    edge,
    edges,
    nodes,
    nodesById,
    options,
    resolvedMeta,
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
      resolvedMeta,
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
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
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

function scoreCurveCrossings(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodesById: Map<NodeId, GraphNode>,
  source: GraphNode,
  target: GraphNode,
  curve: EdgeCurveGeometry,
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
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

    const otherCurve = routeForEdge(otherEdge, options, resolvedMeta);
    const otherSamples = sampleEdgeCurve(
      otherSource,
      otherTarget,
      otherCurve,
      8,
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

function routeForEdge(
  edge: GraphEdge,
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
): EdgeCurveGeometry {
  return (
    resolvedMeta.get(edge.id) ??
    options.previousMeta.get(edge.id) ??
    singleBowCurve(0)
  );
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

function scoreCurveLabelOverlap(
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

function chooseLoopDirection(
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
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

function loopDirectionCandidates(options: ResolvedEdgeRoutingOptions) {
  return Array.from({ length: 24 }, (_, index) =>
    Math.round(options.loopDirectionDeg + index * 15),
  );
}

function scoreLoopDirection(
  directionDeg: number,
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
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
  options: ResolvedEdgeRoutingOptions,
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
  options: ResolvedEdgeRoutingOptions,
): ResolvedEdgeRoutingOptions {
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

function centerPreviousRouteForParallelGroup(
  edge: GraphEdge,
  options: ResolvedEdgeRoutingOptions,
  edgeOffsetPx: number,
): ResolvedEdgeRoutingOptions {
  const previous = options.previousMeta.get(edge.id);

  if (!previous || edgeOffsetPx === 0) {
    return options;
  }

  const centered = offsetEdgeCurve(previous, -edgeOffsetPx);
  const previousMeta = new Map(options.previousMeta);
  previousMeta.set(edge.id, {
    ...previous,
    ...centered,
    bowPx: representativeBow(centered),
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
