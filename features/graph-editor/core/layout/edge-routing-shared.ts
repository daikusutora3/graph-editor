import type { EdgeCurveGeometry, EdgeCurvePoint } from "./edge-route-geometry";
import { estimateLabelWidth } from "../graph/node-size";
import type { EdgeRoutingMeta } from "./edge-routing";
/** Types and small helpers shared by the routing modules. */
import type { GraphEdge, EdgeId } from "../graph/model";

/** Per-call scratch state: a work counter and cached curve samples. */
export type RoutingWork = {
  units: number;
  pending?: Set<EdgeId>;
  samples: Map<string, EdgeCurvePoint[]>;
  labelAnchors?: Map<
    EdgeId,
    { curve: EdgeCurveGeometry; point: EdgeCurvePoint }
  >;
  labelSizes?: Map<EdgeId, { width: number; height: number }>;
  /** Product tasks retain immutable edge labels; public helpers may not. */
  stableLabels?: true;
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
  /** Previous routes belonging to whole groups retained in this pass. */
  retainedMeta?: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
  /** The current group's previous route, oriented and centred for scoring. */
  previousRoute?: EdgeRoutingMeta;
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

/** Axis-aligned background bounds at the renderer's12px edge font. */
export function edgeLabelSize(edge: GraphEdge, work?: RoutingWork) {
  const cached = work?.labelSizes?.get(edge.id);
  if (cached) return cached;
  const size = {
    width: estimateLabelWidth(edgeLabelText(edge), 12) + 10,
    height: 26,
  };
  work?.labelSizes?.set(edge.id, size);
  return size;
}
