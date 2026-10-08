import type { ResolvedEdgeRoutingOptions } from "./edge-routing-shared";
/** Self-loop placement: picks the direction with the most free space. */
import type { GraphNode } from "../graph/model";

export function chooseLoopDirection(
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
) {
  const task = createLoopDirectionTask(source, nodes, options);
  let step = task.next();
  while (!step.done) step = task.next();
  return step.value;
}

/** Rotate evenly spaced loops together so their sectors stay separate. */
export function* createLoopGroupDirectionTask(
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
  count: number,
): Generator<void, number> {
  if (count === 1) {
    return yield* createLoopDirectionTask(source, nodes, options);
  }
  const nearbyNodes = loopObstacleNodes(source, nodes, options);
  if (nearbyNodes.length === 0) return Math.round(options.loopDirectionDeg);
  let best = Math.round(options.loopDirectionDeg);
  let bestScore = Infinity;
  for (const candidate of loopDirectionCandidates(options)) {
    let score = 0;
    for (let index = 0; index < count; index++) {
      yield;
      const direction = candidate + (index * 360) / count;
      score += scoreLoopDirection(direction, source, nearbyNodes, {
        ...options,
        loopDirectionDeg: options.loopDirectionDeg + (index * 360) / count,
      });
    }
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }
  return best;
}

/** Keep each direction resumable without rescoring distant nodes 24 times. */
export function* createLoopDirectionTask(
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
): Generator<void, number> {
  if (!options.avoidNodes) {
    return options.loopDirectionDeg;
  }

  const nearbyNodes = loopObstacleNodes(source, nodes, options);
  if (nearbyNodes.length === 0) return Math.round(options.loopDirectionDeg);
  const candidates = loopDirectionCandidates(options);
  let best = candidates[0] ?? options.loopDirectionDeg;
  let bestScore = scoreLoopDirection(best, source, nearbyNodes, options);

  for (const candidate of candidates.slice(1)) {
    yield;
    const score = scoreLoopDirection(candidate, source, nearbyNodes, options);

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

function loopObstacleNodes(
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
) {
  const radius = options.nodeClearancePx * 1.7;
  // Every sample lies on this circle. Only nodes within its clearance annulus
  // can contribute a score. Keep floating-point slack for translated drawings
  // where adding the radius to a large coordinate can lose precision.
  const slack =
    Number.EPSILON *
    Math.max(1, Math.abs(source.x), Math.abs(source.y), radius) *
    8;
  const outer = radius + options.nodeClearancePx + slack;
  const inner = Math.max(0, radius - options.nodeClearancePx - slack);
  const outerSquared = outer * outer;
  const innerSquared = inner * inner;

  return nodes.filter((node) => {
    if (node.id === source.id) return false;
    const dx = node.x - source.x;
    const dy = node.y - source.y;
    const squaredDistance = dx * dx + dy * dy;
    return squaredDistance <= outerSquared && squaredDistance >= innerSquared;
  });
}
export function loopDirectionCandidates(options: ResolvedEdgeRoutingOptions) {
  return Array.from({ length: 24 }, (_, index) =>
    Math.round(options.loopDirectionDeg + index * 15),
  );
}
export function scoreLoopDirection(
  directionDeg: number,
  source: GraphNode,
  nodes: GraphNode[],
  options: ResolvedEdgeRoutingOptions,
) {
  const loopPoints = loopSamplePoints(source, directionDeg, options);
  const slack =
    Number.EPSILON * Math.max(1, Math.abs(source.x), Math.abs(source.y)) * 8;
  const reach = options.nodeClearancePx + slack;
  const minX = Math.min(...loopPoints.map((point) => point.x)) - reach;
  const maxX = Math.max(...loopPoints.map((point) => point.x)) + reach;
  const minY = Math.min(...loopPoints.map((point) => point.y)) - reach;
  const maxY = Math.max(...loopPoints.map((point) => point.y)) + reach;
  let score =
    Math.abs(normalizeDegrees(directionDeg - options.loopDirectionDeg)) * 0.01;

  for (const node of nodes) {
    if (node.id === source.id) continue;
    if (node.x < minX || node.x > maxX || node.y < minY || node.y > maxY)
      continue;

    let distance = Infinity;
    for (const point of loopPoints)
      distance = Math.min(
        distance,
        Math.hypot(node.x - point.x, node.y - point.y),
      );
    const overlap = Math.max(0, options.nodeClearancePx - distance);
    score += overlap * overlap;
  }

  return score;
}
export function loopSamplePoints(
  source: GraphNode,
  directionDeg: number,
  options: ResolvedEdgeRoutingOptions,
) {
  // Cytoscape measures loop-direction from 12 o'clock, while Math.cos/sin
  // measure from 3 o'clock. Match the renderer before scoring obstacles.
  const direction = ((directionDeg - 90) * Math.PI) / 180;
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
export function normalizeDegrees(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}
