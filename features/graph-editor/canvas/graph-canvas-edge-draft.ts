import { canUseEdgeEndpoints } from "../core/graph/edge-constraints";
import type { GraphModel, NodeId } from "../core/graph/model";

import type { RenderedPoint } from "./graph-canvas-types";

export type EdgeCandidateError = "self-loop" | "duplicate-edge";

export function getEdgeCandidateError(
  graph: GraphModel,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
): EdgeCandidateError | null {
  if (sourceNodeId === targetNodeId && !graph.settings.allowSelfLoops) {
    return "self-loop";
  }

  if (
    !graph.settings.allowMultiEdges &&
    !canUseEdgeEndpoints(graph, sourceNodeId, targetNodeId)
  ) {
    return "duplicate-edge";
  }

  return null;
}

export function trimRenderedSegment(
  source: RenderedPoint,
  target: RenderedPoint,
  sourceInset: number,
  targetInset: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);

  if (length <= sourceInset + targetInset || length === 0) {
    return { source, target };
  }

  const ux = dx / length;
  const uy = dy / length;

  return {
    source: {
      x: source.x + ux * sourceInset,
      y: source.y + uy * sourceInset,
    },
    target: {
      x: target.x - ux * targetInset,
      y: target.y - uy * targetInset,
    },
  };
}
