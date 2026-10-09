import type { GraphNode } from "../core/graph/model";
import { NODE_SIZE_PX } from "../core/graph/node-size";
import type { EdgeCurveGeometry } from "../core/layout/edge-route-geometry";
import { getRustKernelReady, runRustKernel } from "./rust-kernel";

export type InteractiveRoutingCandidate = {
  source: GraphNode;
  target: GraphNode;
  curve: EdgeCurveGeometry;
};

const MAX_COORDINATE = 1e12;
const MIN_MOVED_NODES = 128;
const MIN_TOTAL_EDGES = 128;
const MIN_BATCH_EDGES = 8;

function bounded(value: number) {
  return Number.isFinite(value) && Math.abs(value) <= MAX_COORDINATE;
}

export function canRustSelectInteractiveRoute({
  source,
  target,
  curve,
}: InteractiveRoutingCandidate) {
  return (
    bounded(source.x) &&
    bounded(source.y) &&
    bounded(target.x) &&
    bounded(target.y) &&
    curve.controlPointWeights.length <= 1 &&
    curve.controlPointDistancesPx.every((distance) => distance === 0) &&
    curve.controlPointWeights.every((weight) => weight >= 0 && weight <= 1)
  );
}

export function canRustBatchInteractiveReroutes(
  movedNodes: number,
  totalEdges: number,
) {
  return (
    getRustKernelReady() &&
    movedNodes >= MIN_MOVED_NODES &&
    totalEdges >= MIN_TOTAL_EDGES
  );
}

/** A snapshot per task, without live Wasm allocations across generator yields.
 * Small drags retain JS; each bounded batch copies the moved geometry once. */
export function createRustInteractiveRerouteBatch(
  movedNodes: Array<GraphNode & { measuredWidth: number }>,
  totalEdges: number,
) {
  if (!canRustBatchInteractiveReroutes(movedNodes.length, totalEdges))
    return null;
  const nodes = new Float64Array(movedNodes.length * 3);
  for (const [index, node] of movedNodes.entries()) {
    const span = Math.max(0, (node.measuredWidth - NODE_SIZE_PX) / 2);
    if (!bounded(node.x) || !bounded(node.y) || !bounded(span)) return null;
    nodes[index * 3] = node.x;
    nodes[index * 3 + 1] = node.y;
    nodes[index * 3 + 2] = span;
  }
  return (candidates: InteractiveRoutingCandidate[]) => {
    if (candidates.length < MIN_BATCH_EDGES) return null;
    const edges = new Float64Array(candidates.length * 6);
    for (const [index, candidate] of candidates.entries()) {
      if (!canRustSelectInteractiveRoute(candidate)) return null;
      const { source, target, curve } = candidate;
      edges[index * 6] = source.x;
      edges[index * 6 + 1] = source.y;
      edges[index * 6 + 2] = target.x;
      edges[index * 6 + 3] = target.y;
      edges[index * 6 + 4] = curve.controlPointWeights[0] ?? 0.5;
      edges[index * 6 + 5] =
        Math.min(
          curve.controlPointDistancesPx.length,
          curve.controlPointWeights.length,
        ) > 0
          ? 1
          : 0;
    }
    return runRustKernel(
      "interactive_straight_reroutes",
      [nodes, edges],
      candidates.length,
      [movedNodes.length, candidates.length],
    );
  };
}
