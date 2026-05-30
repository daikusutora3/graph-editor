import type {
  EdgeId,
  GraphEdge,
  GraphModel,
  GraphNode,
  NodeId,
} from "../graph/model";
import { normalizeEdgeRoutingOverride } from "../graph/edge-routing-overrides";

export type EdgeRoutingMeta = {
  bowPx: number;
  duplicate: boolean;
  loopDirectionDeg: number;
  loopSweepDeg: number;
};

export type EdgeRoutingOptions = {
  variant?: number;
  avoidNodes?: boolean;
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

const defaultEdgeRoutingMeta: EdgeRoutingMeta = {
  bowPx: 0,
  duplicate: false,
  loopDirectionDeg: LOOP_DIRECTION_DEG,
  loopSweepDeg: LOOP_SWEEP_DEG,
};

const defaultEdgeRoutingOptions: Required<EdgeRoutingOptions> = {
  variant: 0,
  avoidNodes: true,
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
    if (edges.every((edge) => edge.source === edge.target)) {
      const center = (edges.length - 1) / 2;

      for (const [index, edge] of edges.entries()) {
        meta.set(
          edge.id,
          applyRoutingOverride(edge, {
            bowPx: 0,
            duplicate: duplicateKeys.has(duplicateEdgeKey(model, edge)),
            loopDirectionDeg: Math.round(
              resolvedOptions.loopDirectionDeg +
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
      meta.set(
        edge.id,
        applyRoutingOverride(edge, {
          bowPx: chooseEdgeBow(
            edge,
            model.nodes,
            nodesById,
            0,
            resolvedOptions,
          ),
          duplicate: duplicateKeys.has(duplicateEdgeKey(model, edge)),
          loopDirectionDeg: resolvedOptions.loopDirectionDeg,
          loopSweepDeg: resolvedOptions.loopSweepDeg,
        }),
      );
      continue;
    }

    const center = (edges.length - 1) / 2;
    const maxDuplicateBow = Math.min(
      MAX_BOW_PX,
      center * resolvedOptions.duplicateBowPx,
    );
    const groupBowPx = clamp(
      chooseEdgeBow(
        canonicalRoutingEdge(edges[0]),
        model.nodes,
        nodesById,
        0,
        resolvedOptions,
      ),
      -MAX_BOW_PX + maxDuplicateBow,
      MAX_BOW_PX - maxDuplicateBow,
    );

    for (const [index, edge] of edges.entries()) {
      const canonicalBow =
        groupBowPx + (index - center) * resolvedOptions.duplicateBowPx;

      meta.set(
        edge.id,
        applyRoutingOverride(edge, {
          bowPx: Math.round(
            clamp(edgeBow(edge, canonicalBow), -MAX_BOW_PX, MAX_BOW_PX),
          ),
          duplicate: duplicateKeys.has(duplicateEdgeKey(model, edge)),
          loopDirectionDeg: resolvedOptions.loopDirectionDeg,
          loopSweepDeg: resolvedOptions.loopSweepDeg,
        }),
      );
    }
  }

  return meta;
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

  return {
    ...meta,
    bowPx: routing.bowPx ?? meta.bowPx,
  };
}

function chooseEdgeBow(
  edge: GraphEdge,
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
        nodes,
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
      nodes,
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
  nodes: GraphNode[],
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

  return score;
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

function edgeBow(edge: GraphEdge, canonicalBowPx: number) {
  if (edge.source === edge.target || edge.source <= edge.target) {
    return canonicalBowPx;
  }

  return -canonicalBowPx;
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
