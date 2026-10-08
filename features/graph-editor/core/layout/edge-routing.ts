import { MAX_BOW_PX } from "../graph/edge-routing-overrides";
import type {
  ResolvedEdgeRoutingOptions,
  RoutingWork,
} from "./edge-routing-shared";
import { createLoopGroupDirectionTask } from "./edge-routing-loops";
import { clamp } from "./edge-routing-shared";
import { compareCurvePreference } from "./edge-routing-scoring";
import {
  scoreCurveNodeAndShape,
  scoreCurveLabelOverlap,
} from "./edge-routing-scoring";
import { edgeHasVisibleLabel, edgeLabelSize } from "./edge-routing-shared";
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
 * distance or label comparison =1). A synchronous call returns a pending
 * draft once spent; subsequent calls resume its exact generator. Browser
 * tasks finish all stages across frames instead of restarting the route.
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
  nodeClearancePx: 30,
  duplicateBowPx: 36,
  loopDirectionDeg: LOOP_DIRECTION_DEG,
  loopDirectionStepDeg: LOOP_DIRECTION_STEP_DEG,
  loopSweepDeg: LOOP_SWEEP_DEG,
  loopSweepStepDeg: LOOP_SWEEP_STEP_DEG,
  maxLoopSweepDeg: MAX_LOOP_SWEEP_DEG,
  candidateBowPx: [
    0, 16, -16, 32, -32, 64, -64, 96, -96, 128, -128, 160, -160, 180, -180,
  ],
};

type EdgeRoutingTask = Generator<void, Map<EdgeId, EdgeRoutingMeta>>;
type EdgeRoutingTaskState = {
  task: EdgeRoutingTask;
  work: RoutingWork;
  meta: Map<EdgeId, EdgeRoutingMeta>;
  retainedMeta?: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
  result?: Map<EdgeId, EdgeRoutingMeta>;
  cacheKey: string;
  options: EdgeRoutingOptions;
  /** Cheap provisional lanes used only while the complete task is pending. */
  skipManualReconciliation?: boolean;
};
const routingTaskStates = new WeakMap<EdgeRoutingTask, EdgeRoutingTaskState>();
const routingContinuations = new WeakMap<
  ReadonlyMap<EdgeId, EdgeRoutingMeta>,
  { state: EdgeRoutingTaskState; pending: ReadonlySet<EdgeId> }
>();

function resumableState(model: GraphModel, options: EdgeRoutingOptions) {
  const continuation =
    options.previousMeta && routingContinuations.get(options.previousMeta);
  if (
    !continuation ||
    !options.rerouteEdgeIds ||
    continuation.state.cacheKey !== createEdgeRoutingCacheKey(model, options) ||
    options.rerouteEdgeIds.size !== continuation.pending.size ||
    [...options.rerouteEdgeIds].some((id) => !continuation.pending.has(id))
  )
    return undefined;
  return continuation.state;
}

export function computeEdgeRouting(
  model: GraphModel,
  options: EdgeRoutingOptions = {},
): Map<EdgeId, EdgeRoutingMeta> {
  const resumed = resumableState(model, options);
  if (resumed?.result) return resumed.result;
  const task = resumed?.task ?? createEdgeRoutingTask(model, options);
  const state = routingTaskStates.get(task)!;
  const startedUnits = state.work.units;
  let step = task.next();
  while (!step.done && state.work.units - startedUnits < ROUTING_WORK_BUDGET)
    step = task.next();
  if (step.done) return step.value;

  // Keep the exact task alive. Rebuilding a partial route would change which
  // labels later edges see and could starve final simplification.
  const fallback = createParallelRoutingDraft(
    model,
    state.options.previousMeta,
  );
  const draft = new Map<EdgeId, EdgeRoutingMeta>();
  const pending = new Set<EdgeId>();
  for (const [id, fallbackRoute] of fallback) {
    const route = state.meta.get(id) ?? fallbackRoute;
    if (state.retainedMeta?.has(id)) {
      draft.set(id, state.retainedMeta.get(id)!);
    } else {
      draft.set(id, { ...route, status: "pending" });
      pending.add(id);
    }
  }
  state.cacheKey ||= createEdgeRoutingCacheKey(model, options);
  routingContinuations.set(draft, { state, pending });
  return draft;
}

/** A provisional draft must not recursively spend the quality work budget. */
function createParallelRoutingDraft(
  model: GraphModel,
  previousMeta: EdgeRoutingOptions["previousMeta"],
) {
  const task = createEdgeRoutingTask(model, { mode: "parallel", previousMeta });
  routingTaskStates.get(task)!.skipManualReconciliation = true;
  let step = task.next();
  while (!step.done) step = task.next();
  return step.value;
}

/** A complete resumable task: callers can yield between browser frames. */
export function createEdgeRoutingTask(
  model: GraphModel,
  options: EdgeRoutingOptions = {},
): EdgeRoutingTask {
  const resumed = resumableState(model, options);
  if (resumed?.result)
    return (function* () {
      yield;
      return resumed.result!;
    })();
  if (resumed) return resumed.task;
  const state = {
    work: {
      units: 0,
      samples: new Map(),
      pending: new Set(),
      labelAnchors: new Map(),
      labelSizes: new Map(),
    },
    meta: new Map(),
    cacheKey: "",
    options,
  } as EdgeRoutingTaskState;
  const task = routingTask(model, options, state);
  state.task = task;
  routingTaskStates.set(task, state);
  return task;
}

function* routingTask(
  model: GraphModel,
  options: EdgeRoutingOptions,
  state: EdgeRoutingTaskState,
): EdgeRoutingTask {
  model = routingDisplayModel(model);
  const resolvedOptions = resolveEdgeRoutingOptions(model, options);
  resolvedOptions.work = state.work;
  if (resolvedOptions.avoidNodes) {
    // Resolve label geometry once for this pass. Candidate scoring repeatedly
    // reads it; the transient widths must never enter history or saved models.
    model = {
      ...model,
      nodes: model.nodes.map((node) => ({
        ...node,
        measuredWidth: nodeGeometryWidth(node),
      })),
    };
  }
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
  const meta = state.meta;
  const originalEdgeOrder = new Map(
    model.edges.map((edge, index) => [edge.id, index]),
  );

  if (resolvedOptions.rerouteEdgeIds) {
    // Compare against old curves only when their entire group stays unchanged.
    // Collect them first so earlier groups can see later retained routes.
    const retainedMeta = new Map<EdgeId, EdgeRoutingMeta>();
    for (const edges of routeGroups.values()) {
      yield;
      if (
        !edges.every(
          (edge) =>
            !resolvedOptions.rerouteEdgeIds?.has(edge.id) &&
            resolvedOptions.previousMeta.has(edge.id),
        )
      ) {
        continue;
      }
      for (const edge of edges) {
        const previous = resolvedOptions.previousMeta.get(edge.id);
        if (previous) retainedMeta.set(edge.id, previous);
      }
    }
    resolvedOptions.retainedMeta = retainedMeta;
    state.retainedMeta = retainedMeta;
  }

  const chordLength = (edges: GraphEdge[]) => {
    const edge = edges[0];
    const source = edge && nodesById.get(edge.source),
      target = edge && nodesById.get(edge.target);
    return source && target
      ? Math.hypot(target.x - source.x, target.y - source.y)
      : 0;
  };
  const orderedGroups = resolvedOptions.avoidNodes
    ? [...routeGroups]
        .toSorted(
          ([a, aEdges], [b, bEdges]) =>
            chordLength(bEdges) - chordLength(aEdges) ||
            (a < b ? -1 : a > b ? 1 : 0),
        )
        .map(([, edges]) => edges)
    : [...routeGroups.values()];
  for (const edges of orderedGroups) {
    yield;
    if (
      resolvedOptions.retainedMeta &&
      edges.every((edge) => resolvedOptions.retainedMeta?.has(edge.id))
    ) {
      for (const edge of edges) {
        const previous = resolvedOptions.retainedMeta.get(edge.id);

        if (previous) {
          meta.set(edge.id, previous);
        }
      }
      continue;
    }

    if (edges.every((edge) => edge.source === edge.target)) {
      // Multiple loops on one node are spread even in simple mode; a
      // single loop has center 0 and keeps the default direction.
      const center = (edges.length - 1) / 2;
      const source = nodesById.get(edges[0]?.source ?? "");
      const separateLoops = resolvedOptions.avoidNodes && edges.length > 1;
      const loopOptions = separateLoops
        ? {
            ...resolvedOptions,
            loopSweepDeg: Math.max(
              10,
              Math.min(resolvedOptions.loopSweepDeg, 360 / edges.length - 10),
            ),
          }
        : resolvedOptions;
      const loopDirectionDeg = source
        ? yield* createLoopGroupDirectionTask(
            source,
            model.nodes,
            { ...loopOptions, nodeClearancePx: 42 },
            separateLoops ? edges.length : 1,
          )
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
                (separateLoops
                  ? (index * 360) / edges.length
                  : (index - center) * resolvedOptions.loopDirectionStepDeg),
            ),
            loopSweepDeg: separateLoops
              ? Math.max(10, loopOptions.loopSweepDeg)
              : Math.min(
                  resolvedOptions.maxLoopSweepDeg,
                  resolvedOptions.loopSweepDeg +
                    index * resolvedOptions.loopSweepStepDeg,
                ),
          }),
        );
      }

      continue;
    }

    if (!resolvedOptions.separateParallelEdges) {
      // Simple mode skips route scoring, but parallel edges still fan out
      // around the straight line; otherwise they render as one edge.
      const orderedEdges = orderParallelEdges(
        edges,
        resolvedOptions.previousMeta,
        originalEdgeOrder,
      );
      const center = (orderedEdges.length - 1) / 2;
      const spacingPx = duplicateBowSpacing(
        orderedEdges.length,
        parallelLabelSpacing(
          orderedEdges,
          nodesById,
          resolvedOptions.duplicateBowPx,
        ),
      );

      for (const [index, edge] of orderedEdges.entries()) {
        const curve = orientCanonicalCurve(
          edge,
          offsetEdgeCurve(singleBowCurve(0), (index - center) * spacingPx),
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
      }
      continue;
    }

    const [firstGroupEdge] = edges;

    if (!firstGroupEdge) {
      continue;
    }

    if (edges.length === 1) {
      const edge = firstGroupEdge;
      const curve = orientCanonicalCurve(
        edge,
        yield* chooseEdgeCurve(
          canonicalRoutingEdge(edge),
          model.edges,
          model.nodes,
          nodesById,
          resolvedOptions,
          meta,
        ),
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
      parallelLabelSpacing(
        orderedEdges,
        nodesById,
        resolvedOptions.duplicateBowPx,
      ),
    );
    const maxDuplicateBow = center * duplicateBowPx;
    // A manual sibling remains fixed; its bow must not become the automatic
    // group's centre before the override removes that sibling's lane offset.
    const firstEdge =
      orderedEdges.find((edge) => edge.routing?.bowPx === undefined) ??
      firstGroupEdge;
    const canonicalEdge = canonicalRoutingEdge(firstEdge);
    const canonicalOptions = {
      ...resolvedOptions,
      // The outside lane's midpoint lies half its control offset from centre.
      nodeClearancePx: resolvedOptions.nodeClearancePx + maxDuplicateBow / 2,
    };
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
        // A large parallel group must not perform every collision check in
        // one generator step; callers yield back to the UI between steps.
        yield;
        const route = meta.get(edge.id);
        const source = nodesById.get(edge.source),
          target = nodesById.get(edge.target);
        if (!route || !source || !target || edge.source === edge.target)
          continue;
        if (pending) {
          meta.set(edge.id, { ...route, status: "pending" });
          continue;
        }
        if (resolvedOptions.retainedMeta?.has(edge.id)) continue;
        let finalRoute = route;
        if (
          !edge.routing &&
          edges.length > 1 &&
          nodeCollisions(
            route,
            edge,
            source,
            target,
            model.nodes,
            resolvedOptions.work,
          ) > 0
        ) {
          // Evaluate offsets after applying the parallel lane, including the clamp.
          let bestCollisions = nodeCollisions(
            route,
            edge,
            source,
            target,
            model.nodes,
            resolvedOptions.work,
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
              resolvedOptions.work,
            );
            const distinct = edges.every(
              (other) =>
                other.id === edge.id ||
                Math.abs(
                  canonicalPreviousBow(other, meta) -
                    (edge.source <= edge.target
                      ? representativeBow(candidate)
                      : -representativeBow(candidate)),
                ) >=
                  duplicateBowSpacing(
                    edges.length,
                    parallelLabelSpacing(
                      edges,
                      nodesById,
                      resolvedOptions.duplicateBowPx,
                    ),
                  ),
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
          status: nodeCollisions(
            finalRoute,
            edge,
            source,
            target,
            model.nodes,
            resolvedOptions.work,
          )
            ? "unresolved"
            : "ready",
        });
      }
    }
  }
  if (
    !state.skipManualReconciliation &&
    model.edges.some((edge) => edge.routing?.bowPx !== undefined)
  ) {
    yield* separateAutomaticSiblingsFromManualRoutes(
      routeGroups.values(),
      model,
      nodesById,
      resolvedOptions,
      meta,
    );
  }
  if (
    (options.mode ?? "quality") === "quality" &&
    !resolvedOptions.avoidNodes
  ) {
    for (const [id, route] of meta)
      meta.set(id, { ...route, status: "unresolved" });
  }
  if (resolvedOptions.avoidNodes && !resolvedOptions.work.pending?.size) {
    yield* simplifyFinishedRoutes(
      orderedGroups,
      model,
      nodesById,
      resolvedOptions,
      meta,
    );
  }
  if (!resolvedOptions.avoidNodes) {
    state.result = meta;
    return meta;
  }
  // Decision order is canonical; callers keep the established group/lane order.
  const result = new Map<EdgeId, EdgeRoutingMeta>();
  for (const edges of routeGroups.values()) {
    const ordered =
      edges.length > 1 && edges[0]?.source !== edges[0]?.target
        ? orderParallelEdges(
            edges,
            resolvedOptions.previousMeta,
            originalEdgeOrder,
          )
        : edges;
    for (const edge of ordered) {
      yield;
      const route = meta.get(edge.id);
      if (route) result.set(edge.id, route);
    }
  }
  state.result = result;
  return result;
}

function parallelLabelSpacing(
  edges: GraphEdge[],
  nodesById: ReadonlyMap<NodeId, GraphNode>,
  requested: number,
) {
  const first = edges[0];
  if (!first || !edges.some(edgeHasVisibleLabel)) return requested;
  const source = nodesById.get(first.source),
    target = nodesById.get(first.target);
  if (!source || !target) return requested;
  const length = Math.hypot(target.x - source.x, target.y - source.y) || 1;
  const normalX = Math.abs((target.y - source.y) / length);
  const normalY = Math.abs((target.x - source.x) / length);
  let width = 0,
    height = 0;
  for (const edge of edges) {
    if (!edgeHasVisibleLabel(edge)) continue;
    const size = edgeLabelSize(edge);
    width = Math.max(width, size.width);
    height = Math.max(height, size.height);
  }
  return Math.max(
    requested,
    2 *
      Math.min(
        normalX ? (width + 2) / normalX : Infinity,
        normalY ? (height + 2) / normalY : Infinity,
      ),
  );
}

function* simplifyFinishedRoutes(
  groups: GraphEdge[][],
  model: GraphModel,
  nodesById: Map<NodeId, GraphNode>,
  options: ResolvedEdgeRoutingOptions,
  meta: Map<EdgeId, EdgeRoutingMeta>,
): Generator<void> {
  let changed = true;
  while (changed) {
    changed = false;
    for (const edges of groups) {
      yield;
      if (edges.length !== 1) continue;
      const edge = edges[0]!;
      const route = meta.get(edge.id);
      const source = nodesById.get(edge.source),
        target = nodesById.get(edge.target);
      if (
        !route ||
        !source ||
        !target ||
        edge.source === edge.target ||
        edge.routing?.bowPx !== undefined ||
        options.retainedMeta?.has(edge.id) ||
        route.controlPointDistancesPx.every((d) => d === 0)
      )
        continue;
      const straight = singleBowCurve(0);
      if (
        nodeCollisions(
          straight,
          edge,
          source,
          target,
          model.nodes,
          options.work,
        ) > 0
      )
        continue;
      const straightLabels = scoreCurveLabelOverlap(
        edge,
        model.edges,
        nodesById,
        straight,
        options,
        meta,
      );
      if (straightLabels !== 0) continue;
      meta.set(edge.id, { ...route, ...straight, bowPx: 0, status: "ready" });
      options.work.samples.clear();
      options.work.labelAnchors?.delete(edge.id);
      changed = true;
    }
  }
}

/** Reconcile lanes against fixed manual geometry, which has no lane offset. */
function* separateAutomaticSiblingsFromManualRoutes(
  groups: Iterable<GraphEdge[]>,
  model: GraphModel,
  nodesById: Map<NodeId, GraphNode>,
  options: ResolvedEdgeRoutingOptions,
  meta: Map<EdgeId, EdgeRoutingMeta>,
): Generator<void> {
  for (const edges of groups) {
    yield;
    if (
      edges.length < 2 ||
      edges[0]?.source === edges[0]?.target ||
      !edges.some((edge) => edge.routing?.bowPx !== undefined)
    )
      continue;
    const minimumSpacing = duplicateBowSpacing(
      edges.length,
      MIN_DUPLICATE_BOW_SPACING_PX,
    );
    for (const edge of edges) {
      yield;
      if (
        edge.routing?.bowPx !== undefined ||
        options.retainedMeta?.has(edge.id)
      )
        continue;
      const route = meta.get(edge.id);
      const canonicalEdge = canonicalRoutingEdge(edge);
      const source = nodesById.get(canonicalEdge.source),
        target = nodesById.get(canonicalEdge.target);
      if (!route || !source || !target) continue;
      const current = orientCanonicalCurve(edge, route);
      const candidates = [
        current,
        ...options.candidateBowPx.map((bow) => singleBowCurve(bow)),
        ...options.candidateBowPx.map((offset) =>
          clampCurveDistances(
            offsetEdgeCurve(current, offset),
            -MAX_BOW_PX,
            MAX_BOW_PX,
          ),
        ),
      ];
      let best = current,
        bestScore = Infinity,
        bestCollisions = Infinity,
        bestLabels = Infinity;
      for (const candidate of candidates) {
        yield;
        const distinct = edges.every((other) => {
          if (other.id === edge.id) return true;
          options.work.units += 1;
          return (
            Math.abs(
              canonicalPreviousBow(other, meta) - representativeBow(candidate),
            ) >= minimumSpacing
          );
        });
        if (!distinct) continue;
        const evaluation = options.avoidNodes
          ? scoreCurveNodeAndShape(
              candidate,
              source,
              target,
              canonicalEdge,
              model.nodes,
              options,
            )
          : {
              collisions: 0,
              score: Math.abs(representativeBow(candidate)) * 0.03,
            };
        const labels = scoreCurveLabelOverlap(
          canonicalEdge,
          model.edges,
          nodesById,
          candidate,
          options,
          meta,
          true,
        );
        const score = evaluation.score + labels;
        if (
          evaluation.collisions < bestCollisions ||
          (evaluation.collisions === bestCollisions &&
            (score < bestScore ||
              (score === bestScore &&
                compareCurvePreference(candidate, best, options.variant) < 0)))
        ) {
          best = candidate;
          bestScore = score;
          bestCollisions = evaluation.collisions;
          bestLabels = labels;
        }
      }
      const oriented = orientCanonicalCurve(edge, best);
      meta.set(edge.id, {
        ...route,
        ...oriented,
        bowPx: representativeBow(oriented),
        status: bestCollisions > 0 || bestLabels > 0 ? "unresolved" : "ready",
      });
      options.work.samples.clear();
      options.work.labelAnchors?.delete(edge.id);
    }
  }
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
  // Even simple parallel lanes depend on chord direction for label spacing.
  const nodeSignature = JSON.stringify(
    model.nodes.map((node) => [
      node.id,
      node.x,
      node.y,
      ...(resolvedOptions.avoidNodes ? [nodeGeometryWidth(node)] : []),
    ]),
  );
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
  for (let index = 0; index < candidates.length; index++)
    candidates[index] = clampCurveDistances(
      candidates[index]!,
      -MAX_BOW_PX,
      MAX_BOW_PX,
    );
  const evaluated: {
    curve: EdgeCurveGeometry;
    collisions: number;
    score: number;
  }[] = [];
  let minimumCollisions = Infinity;
  let best = simpleCurve;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    yield;
    const evaluation = scoreCurveNodeAndShape(
      candidate,
      source,
      target,
      edge,
      nodes,
      options,
    );
    evaluated.push({ curve: candidate, ...evaluation });
    if (
      evaluation.collisions < minimumCollisions ||
      (evaluation.collisions === minimumCollisions &&
        evaluation.score < bestScore)
    ) {
      minimumCollisions = evaluation.collisions;
      best = candidate;
      bestScore = evaluation.score;
    }
    if (
      candidate.controlPointDistancesPx.every((d) => d === 0) &&
      evaluation.collisions === 0 &&
      scoreCurveLabelOverlap(
        edge,
        edges,
        nodesById,
        candidate,
        options,
        resolvedMeta,
      ) === 0
    )
      return candidate;
  }
  // Node safety has strict priority. Label checks are only useful on curves
  // that can still win; do not repeat the expensive node-distance scan.
  bestScore = Infinity;
  for (const evaluation of evaluated) {
    if (evaluation.collisions !== minimumCollisions) continue;
    yield;
    const score =
      evaluation.score +
      scoreCurveLabelOverlap(
        edge,
        edges,
        nodesById,
        evaluation.curve,
        options,
        resolvedMeta,
      );
    if (
      score < bestScore ||
      (score === bestScore &&
        compareCurvePreference(evaluation.curve, best, options.variant) < 0)
    ) {
      best = evaluation.curve;
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
  work?: RoutingWork,
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
    if (work) work.units += 1;
    if (distanceToNode(node) < NODE_SIZE_PX / 2 + 6) count++;
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
