import { MAX_BOW_PX } from "../graph/edge-routing-overrides";
import type { ResolvedEdgeRoutingOptions } from "./edge-routing-shared";
import { chooseLoopDirection } from "./edge-routing-loops";
import { clamp } from "./edge-routing-shared";
import { compareCurvePreference } from "./edge-routing-scoring";
import { scoreCandidateCurve } from "./edge-routing-scoring";
import { canonicalPreviousBow } from "./edge-routing-shared";
import type {
  EdgeId,
  GraphEdge,
  GraphModel,
  GraphNode,
  NodeId,
} from "../graph/model";
import { normalizeEdgeRoutingOverride } from "../graph/edge-routing-overrides";
import {
  createCurveNodeDistance,
  curveThroughChordOffset,
  offsetEdgeCurve,
  reverseEdgeCurve,
  singleBowCurve,
  type EdgeCurveGeometry,
} from "./edge-route-geometry";
import {
  nodeGeometryWidth,
  NODE_SIZE_PX,
  pillExtentTowards,
} from "../graph/node-size";

export type EdgeRoutingMeta = EdgeCurveGeometry & {
  status?: "ready" | "pending" | "unresolved";
  bowPx: number;
  duplicate: boolean;
  loopDirectionDeg: number;
  loopSweepDeg: number;
};

export type EdgeRoutingMode = "simple" | "parallel" | "quality";

export type EdgeRoutingOptions = {
  mode?: EdgeRoutingMode;
  previousMeta?: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
  rerouteEdgeIds?: ReadonlySet<EdgeId> | null;
};

const LOOP_DIRECTION_DEG = -45;
const LOOP_DIRECTION_STEP_DEG = 42;
const LOOP_SWEEP_DEG = 70;
const LOOP_SWEEP_STEP_DEG = 16;
const MAX_LOOP_SWEEP_DEG = 120;
// Coarse gates; the per-call work budget below is what bounds actual time.
const NODE_AVOIDANCE_WORK_LIMIT = 400_000;
export const EDGE_PAIR_SCORING_WORK_LIMIT = 4_000_000;
/**
 * Scoring work allowed per computeEdgeRouting call, in "units" (one node
 * distance check = 1, one edge-pair crossing check = 4). Once spent, the
 * remaining edges keep their previous route or go straight instead of
 * freezing the UI. ~250k units is roughly 10 ms on a laptop.
 */
const ROUTING_WORK_BUDGET = 25_000;
const MIN_DUPLICATE_BOW_SPACING_PX = 12;

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
  work: { units: 0, samples: new Map(), pending: new Set() },
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
  candidateBowPx: [
    0, 32, -32, 64, -64, 96, -96, 128, -128, 160, -160, 180, -180,
  ],
};

export function computeEdgeRouting(
  model: GraphModel,
  options: EdgeRoutingOptions = {},
): Map<EdgeId, EdgeRoutingMeta> {
  const task = createEdgeRoutingTask(model, options);
  let step = task.next();
  while (!step.done) step = task.next();
  return step.value;
}

/** Retains group, candidate and final-check progress between browser frames. */
export function* createEdgeRoutingTask(
  model: GraphModel,
  options: EdgeRoutingOptions = {},
): Generator<void, Map<EdgeId, EdgeRoutingMeta>> {
  model = routingDisplayModel(model);
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
    yield;
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

    const [firstGroupEdge] = edges;

    if (!firstGroupEdge) {
      continue;
    }

    if (edges.length === 1) {
      const edge = firstGroupEdge;
      const curve = yield* chooseEdgeCurve(
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
    const firstEdge = orderedEdges[0] ?? firstGroupEdge;
    const canonicalEdge = canonicalRoutingEdge(firstEdge);
    const canonicalOptions = centerPreviousRouteForParallelGroup(
      firstEdge,
      orientPreviousRouteForCanonicalEdge(firstEdge, resolvedOptions),
      -center * duplicateBowPx,
    );
    const groupCurve = clampCurveDistances(
      yield* chooseEdgeCurve(
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

  if (resolvedOptions.avoidNodes) {
    for (const edges of routeGroups.values()) {
      yield;
      const pending = edges.some((edge) =>
        resolvedOptions.work.pending?.has(edge.id),
      );
      for (const edge of edges) {
        const route = meta.get(edge.id);
        const source = nodesById.get(edge.source),
          target = nodesById.get(edge.target);
        if (!route || !source || !target || edge.source === edge.target)
          continue;
        if (pending) {
          meta.set(edge.id, { ...route, status: "pending" });
          continue;
        }
        if (
          resolvedOptions.rerouteEdgeIds &&
          !resolvedOptions.rerouteEdgeIds.has(edge.id)
        )
          continue;
        let finalRoute = route;
        if (
          !edge.routing &&
          edges.length > 1 &&
          nodeCollisions(route, edge, source, target, model.nodes) > 0
        ) {
          // Evaluate offsets after applying the parallel lane, including the clamp.
          let bestCollisions = nodeCollisions(
            route,
            edge,
            source,
            target,
            model.nodes,
          );
          for (const offset of [24, -24, 48, -48, 96, -96, 180, -180]) {
            yield;
            const candidate = clampCurveDistances(
              offsetEdgeCurve(route, offset),
              -MAX_BOW_PX,
              MAX_BOW_PX,
            );
            const collisions = nodeCollisions(
              candidate,
              edge,
              source,
              target,
              model.nodes,
            );
            const distinct = edges.every(
              (other) =>
                other.id === edge.id ||
                Math.abs(
                  canonicalPreviousBow(other, meta) -
                    (edge.source <= edge.target
                      ? representativeBow(candidate)
                      : -representativeBow(candidate)),
                ) >= MIN_DUPLICATE_BOW_SPACING_PX,
            );
            if (distinct && collisions < bestCollisions) {
              bestCollisions = collisions;
              finalRoute = {
                ...route,
                ...candidate,
                bowPx: representativeBow(candidate),
              };
            }
          }
        }
        meta.set(edge.id, {
          ...finalRoute,
          status: nodeCollisions(finalRoute, edge, source, target, model.nodes)
            ? "unresolved"
            : "ready",
        });
      }
    }
  }
  if (
    (options.mode ?? "quality") === "quality" &&
    !resolvedOptions.avoidNodes
  ) {
    for (const [id, route] of meta)
      meta.set(id, { ...route, status: "unresolved" });
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
  const requestedMode = options.mode ?? "quality";
  const mode =
    requestedMode === "parallel"
      ? "parallel"
      : resolveRoutingMode(model, requestedMode);

  return {
    ...defaultEdgeRoutingOptions,
    avoidNodes: mode === "quality",
    work: { units: 0, samples: new Map(), pending: new Set() },
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
  model = routingDisplayModel(model);
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
    ? JSON.stringify(
        model.nodes.map((node) => [
          node.id,
          node.x,
          node.y,
          nodeGeometryWidth(node),
        ]),
      )
    : "";
  const edgeSignature = model.edges
    .map(
      (edge) =>
        `${JSON.stringify([edge.id, edge.source, edge.target, edge.label, edge.weight])}:${edge.routing?.bowPx ?? ""}:${edge.routing?.bowT ?? ""}:${
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
      ...singleBowCurve(routing.bowPx, routing.bowT ?? 0.5),
      bowPx: routing.bowPx,
    };
  }

  return {
    ...meta,
  };
}

function* chooseEdgeCurve(
  edge: GraphEdge,
  edges: GraphEdge[],
  nodes: GraphNode[],
  nodesById: Map<NodeId, GraphNode>,
  options: ResolvedEdgeRoutingOptions,
  resolvedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
): Generator<void, EdgeCurveGeometry> {
  if (edge.routing?.bowPx !== undefined)
    return singleBowCurve(edge.routing.bowPx, edge.routing.bowT);
  const simpleCurve = singleBowCurve(0);

  if (!options.avoidNodes || edge.source === edge.target) {
    return simpleCurve;
  }

  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);

  if (!source || !target) {
    return simpleCurve;
  }

  if (options.work.units > ROUTING_WORK_BUDGET) {
    options.work.pending?.add(edge.id);
    // Budget spent: keep whatever this edge had rather than stalling.
    const previous = options.previousMeta.get(edge.id);

    return previous
      ? {
          controlPointDistancesPx: previous.controlPointDistancesPx,
          controlPointWeights: previous.controlPointWeights,
        }
      : simpleCurve;
  }

  const obstacles = projectedEdgeObstacles(
    edge,
    source,
    target,
    nodes,
    options.nodeClearancePx,
  );

  const candidates = edgeBowCandidates(0, options.candidateBowPx).map((bowPx) =>
    singleBowCurve(bowPx),
  );

  if (obstacles.length > 0) {
    candidates.push(
      ...createObstacleAvoidingCurves(source, target, obstacles, 1),
      ...createObstacleAvoidingCurves(source, target, obstacles, -1),
    );
  }
  const previous = options.previousMeta.get(edge.id);

  if (previous) {
    candidates.unshift({
      controlPointDistancesPx: previous.controlPointDistancesPx,
      controlPointWeights: previous.controlPointWeights,
    });
  }
  for (let index = 0; index < candidates.length; index++)
    candidates[index] = clampCurveDistances(
      candidates[index]!,
      -MAX_BOW_PX,
      MAX_BOW_PX,
    );
  let best = candidates[0] ?? simpleCurve;
  let bestCollisions = nodeCollisions(best, edge, source, target, nodes);
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
    yield;
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

    const collisions = nodeCollisions(candidate, edge, source, target, nodes);
    if (
      collisions < bestCollisions ||
      (collisions === bestCollisions &&
        (score < bestScore ||
          (score === bestScore &&
            compareCurvePreference(candidate, best, options.variant) < 0)))
    ) {
      bestCollisions = collisions;
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
  baseClearancePx: number,
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
  const obstacles = nodes
    .filter((node) => node.id !== edge.source && node.id !== edge.target)
    .map((node) => {
      const relativeX = node.x - source.x;
      const relativeY = node.y - source.y;
      // Wide pills extend further than a circle; measure their reach along
      // and across the edge so the clearance hugs the actual shape.
      const halfWidth = nodeGeometryWidth(node) / 2;
      const halfHeight = NODE_SIZE_PX / 2;
      const acrossExtra =
        pillExtentTowards(halfWidth, halfHeight, normalX, normalY) - halfHeight;
      const alongExtra =
        pillExtentTowards(halfWidth, halfHeight, unitX, unitY) - halfHeight;
      const clearancePx = baseClearancePx + acrossExtra;
      const extentWeight = Math.min(
        0.22,
        (baseClearancePx + alongExtra) / length,
      );

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
        clearancePx,
      };
    })
    .filter(
      (obstacle) =>
        obstacle.startWeight < obstacle.endWeight &&
        obstacle.perpendicularDistance < obstacle.clearancePx * 1.8,
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

/**
 * Single-control curves that clear the obstacles on one side. Each cluster
 * yields a curve passing over its centre with the required offset, and the
 * strictest cluster yields one more so a single bend can clear several nodes.
 * Every candidate is a plain quadratic bend, so it is exactly what a manual
 * drag can produce and stays within the manual bend limits.
 */
function createObstacleAvoidingCurves(
  source: GraphNode,
  target: GraphNode,
  obstacles: ProjectedObstacleCluster[],
  side: 1 | -1,
): EdgeCurveGeometry[] {
  const p0 = { x: source.x, y: source.y };
  const p2 = { x: target.x, y: target.y };
  const offsetOf = (obstacle: ProjectedObstacleCluster) =>
    side > 0 ? obstacle.positiveDistancePx : obstacle.negativeDistancePx;
  const centerOf = (obstacle: ProjectedObstacleCluster) =>
    (obstacle.startWeight + obstacle.endWeight) / 2;
  const curves = obstacles.map((obstacle) =>
    curveThroughChordOffset(p0, p2, centerOf(obstacle), offsetOf(obstacle)),
  );

  if (obstacles.length > 1) {
    const strictest = obstacles.reduce((best, obstacle) =>
      Math.abs(offsetOf(obstacle)) > Math.abs(offsetOf(best)) ? obstacle : best,
    );
    curves.push(
      curveThroughChordOffset(p0, p2, 0.5, offsetOf(strictest)),
      curveThroughChordOffset(
        p0,
        p2,
        centerOf(strictest),
        offsetOf(strictest) * 1.25,
      ),
    );
  }

  return curves;
}

export function representativeBow(curve: EdgeCurveGeometry) {
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

function edgeBowCandidates(baseBowPx: number, offsets: readonly number[]) {
  const candidates = new Set<number>([baseBowPx]);

  for (const offset of offsets) {
    candidates.add(baseBowPx + offset);
  }

  return [...candidates];
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

export function routeEdgeKey(edge: GraphEdge) {
  return edge.source <= edge.target
    ? JSON.stringify([edge.source, edge.target])
    : JSON.stringify([edge.target, edge.source]);
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
    return JSON.stringify([edge.source, edge.target]);
  }

  return routeEdgeKey(edge);
}

export { defaultEdgeRoutingMeta };

function routingDisplayModel(model: GraphModel): GraphModel {
  return {
    ...model,
    nodes: model.settings.showNodeLabels
      ? model.nodes
      : model.nodes.map((node) => ({
          ...node,
          label: "",
          measuredWidth: NODE_SIZE_PX,
        })),
    edges: model.edges.map((edge) => ({
      ...edge,
      label:
        edge.label ?? (model.settings.weighted ? (edge.weight ?? "1") : ""),
      weight: undefined,
    })),
  };
}

function nodeCollisions(
  curve: EdgeCurveGeometry,
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode,
  nodes: GraphNode[],
) {
  const reach =
    Math.max(0, ...curve.controlPointDistancesPx.map(Math.abs)) + NODE_SIZE_PX;
  let count = 0;
  const distanceToNode = createCurveNodeDistance(source, target, curve);
  for (const node of nodes) {
    if (node.id === edge.source || node.id === edge.target) continue;
    const halfWidth = nodeGeometryWidth(node) / 2;
    if (
      node.x + halfWidth < Math.min(source.x, target.x) - reach ||
      node.x - halfWidth > Math.max(source.x, target.x) + reach ||
      node.y < Math.min(source.y, target.y) - reach ||
      node.y > Math.max(source.y, target.y) + reach
    )
      continue;
    if (distanceToNode(node) < NODE_SIZE_PX / 2 + 12) count++;
  }
  return count;
}

export function edgeRoutingProgress(
  routes: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
) {
  return {
    pendingEdgeIds: [...routes]
      .filter(([, route]) => route.status === "pending")
      .map(([id]) => id),
    unresolvedEdgeIds: [...routes]
      .filter(([, route]) => route.status === "unresolved")
      .map(([id]) => id),
  };
}
