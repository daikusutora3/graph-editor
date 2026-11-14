import { canUseEdgeEndpoints } from "../core/graph/edge-constraints";
import type { GraphModel, NodeId } from "../core/graph/model";

import type { RenderedPoint } from "./graph-canvas-types";

export function isEdgeCandidateBlocked(
  graph: GraphModel,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
): boolean {
  return (
    (sourceNodeId === targetNodeId && !graph.settings.allowSelfLoops) ||
    (!graph.settings.allowMultiEdges &&
      !canUseEdgeEndpoints(graph, sourceNodeId, targetNodeId))
  );
}

export function trimRenderedSegment(
  source: RenderedPoint,
  target: RenderedPoint,
  sourceInset: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);

  if (length <= sourceInset || length === 0) {
    return { source, target };
  }

  const ux = dx / length;
  const uy = dy / length;

  return {
    source: {
      x: source.x + ux * sourceInset,
      y: source.y + uy * sourceInset,
    },
    target,
  };
}
