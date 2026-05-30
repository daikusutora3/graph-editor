import type { GraphModel, NodeId } from "../core/graph/model";

import type { RenderedPoint } from "./graph-canvas-types";

export function getEdgeCandidateError(
  graph: GraphModel,
  sourceNodeId: NodeId,
  targetNodeId: NodeId,
) {
  if (sourceNodeId === targetNodeId && !graph.settings.allowSelfLoops) {
    return "自己ループは無効です";
  }

  if (
    !graph.settings.allowMultiEdges &&
    graph.edges.some(
      (edge) =>
        (edge.source === sourceNodeId && edge.target === targetNodeId) ||
        (!graph.settings.directed &&
          edge.source === targetNodeId &&
          edge.target === sourceNodeId),
    )
  ) {
    return "同じ辺はすでに存在します";
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
