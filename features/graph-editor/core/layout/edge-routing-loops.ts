import type { ResolvedEdgeRoutingOptions } from "./edge-routing-shared";
/** Self-loop placement: picks the direction with the most free space. */
import type { GraphNode } from "../graph/model";

export function chooseLoopDirection(
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
export function loopSamplePoints(
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
export function normalizeDegrees(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
}
