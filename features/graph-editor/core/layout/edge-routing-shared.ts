import type { EdgeCurvePoint } from "./edge-route-geometry";
import type { EdgeRoutingMeta } from "./edge-routing";
/** Types and small helpers shared by the routing modules. */
import type { GraphEdge, EdgeId } from "../graph/model";

/** Per-call scratch state: a work counter and cached curve samples. */
export type RoutingWork = {
  units: number;
  samples: Map<string, EdgeCurvePoint[]>;
};
export type ResolvedEdgeRoutingOptions = {
  avoidNodes: boolean;
  work: RoutingWork;
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
export function canonicalPreviousBow(
  edge: GraphEdge,
  previousMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
) {
  const bowPx = previousMeta.get(edge.id)?.bowPx ?? 0;

  return edge.source <= edge.target ? bowPx : -bowPx;
}
export function edgeHasVisibleLabel(edge: GraphEdge) {
  return Boolean(edge.label || edge.weight);
}
export function edgeLabelClearance(edge: GraphEdge, otherEdge: GraphEdge) {
  const labelLength = Math.max(
    edgeLabelText(edge).length,
    edgeLabelText(otherEdge).length,
  );

  return 34 + labelLength * 4;
}
export function edgeLabelText(edge: GraphEdge) {
  return edge.label ?? edge.weight ?? "";
}
export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
