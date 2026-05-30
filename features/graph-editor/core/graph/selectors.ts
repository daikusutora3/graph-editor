import type { GraphModel, GraphNode, NodeId } from "./model";

export function hasGraphContent(
  model: Pick<GraphModel, "nodes" | "edges">,
): boolean {
  return model.nodes.length > 0 || model.edges.length > 0;
}

export function getNode(model: GraphModel, nodeId: NodeId): GraphNode | null {
  return model.nodes.find((node) => node.id === nodeId) ?? null;
}

export function getNodeByOrder(model: GraphModel): GraphNode[] {
  return [...model.nodes].sort((a, b) => a.order - b.order);
}

export function hasEdgeBetween(
  model: GraphModel,
  source: NodeId,
  target: NodeId,
): boolean {
  return model.edges.some((edge) => {
    if (model.settings.directed) {
      return edge.source === source && edge.target === target;
    }
    return (
      (edge.source === source && edge.target === target) ||
      (edge.source === target && edge.target === source)
    );
  });
}
