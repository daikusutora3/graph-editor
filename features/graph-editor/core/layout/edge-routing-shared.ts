import type { EdgeCurveGeometry, EdgeCurvePoint } from "./edge-route-geometry";
import { estimateLabelWidth } from "../graph/node-size";
import type { EdgeRoutingMeta } from "./edge-routing";

import type { GraphEdge, EdgeId } from "../graph/model";

export type RoutingWork = {
  units: number;
  pending?: Set<EdgeId>;
  samples: Map<string, EdgeCurvePoint[]>;
  labelAnchors?: Map<
    EdgeId,
    { curve: EdgeCurveGeometry; point: EdgeCurvePoint }
  >;
  labelSizes?: Map<EdgeId, { width: number; height: number }>;

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

  retainedMeta?: ReadonlyMap<EdgeId, EdgeRoutingMeta>;

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
