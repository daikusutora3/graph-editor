import type { GraphModel, GraphNode } from "./model";

export function getNodeByOrder(model: GraphModel): GraphNode[] {
  return [...model.nodes].sort((a, b) => a.order - b.order);
}
