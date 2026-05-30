import type { EdgeId, GraphEdge, GraphModel, GraphNode, NodeId } from "./model";

export function hasGraphContent(
  model: Pick<GraphModel, "nodes" | "edges">,
): boolean {
  return model.nodes.length > 0 || model.edges.length > 0;
}

export function getNode(model: GraphModel, nodeId: NodeId): GraphNode | null {
  return model.nodes.find((node) => node.id === nodeId) ?? null;
}

export function getEdge(model: GraphModel, edgeId: EdgeId): GraphEdge | null {
  return model.edges.find((edge) => edge.id === edgeId) ?? null;
}

export function getNodeIndexById(model: GraphModel): Map<NodeId, number> {
  return new Map(model.nodes.map((node, index) => [node.id, index]));
}

export function getNodeByOrder(model: GraphModel): GraphNode[] {
  return [...model.nodes].sort((a, b) => a.order - b.order);
}

export function getIncidentEdges(
  model: GraphModel,
  nodeId: NodeId,
): GraphEdge[] {
  return model.edges.filter(
    (edge) => edge.source === nodeId || edge.target === nodeId,
  );
}

export function getOutgoingEdges(
  model: GraphModel,
  nodeId: NodeId,
): GraphEdge[] {
  return model.edges.filter((edge) => edge.source === nodeId);
}

export function getIncomingEdges(
  model: GraphModel,
  nodeId: NodeId,
): GraphEdge[] {
  return model.edges.filter((edge) => edge.target === nodeId);
}

export function getNeighbors(model: GraphModel, nodeId: NodeId): GraphNode[] {
  const nodeIds = new Set<NodeId>();
  for (const edge of model.edges) {
    if (edge.source === nodeId) nodeIds.add(edge.target);
    if (edge.target === nodeId) nodeIds.add(edge.source);
  }

  return model.nodes.filter((node) => nodeIds.has(node.id));
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

export function getAdjacencyList(model: GraphModel): Map<NodeId, NodeId[]> {
  const adjacency = new Map<NodeId, NodeId[]>(
    model.nodes.map((node) => [node.id, []]),
  );

  for (const edge of model.edges) {
    adjacency.get(edge.source)?.push(edge.target);
    if (!model.settings.directed && edge.source !== edge.target) {
      adjacency.get(edge.target)?.push(edge.source);
    }
  }

  return adjacency;
}
