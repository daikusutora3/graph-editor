import type { EdgeId, GraphEdge, GraphModel, NodeId } from "./model";

export function canUseEdgeEndpoints(
  model: GraphModel,
  source: NodeId,
  target: NodeId,
  options: { ignoreEdgeIds?: ReadonlySet<EdgeId> } = {},
) {
  const nodeIds = new Set(model.nodes.map((node) => node.id));

  if (!nodeIds.has(source) || !nodeIds.has(target)) {
    return false;
  }

  if (!model.settings.allowSelfLoops && source === target) {
    return false;
  }

  if (!model.settings.allowMultiEdges) {
    return !model.edges.some((edge) => {
      if (options.ignoreEdgeIds?.has(edge.id)) {
        return false;
      }

      if (model.settings.directed) {
        return edge.source === source && edge.target === target;
      }

      return (
        (edge.source === source && edge.target === target) ||
        (edge.source === target && edge.target === source)
      );
    });
  }

  return true;
}

export function filterAddableEdges(model: GraphModel, edges: GraphEdge[]) {
  const workingModel: GraphModel = { ...model, edges: [...model.edges] };
  const acceptedEdges: GraphEdge[] = [];

  for (const edge of edges) {
    if (!canUseEdgeEndpoints(workingModel, edge.source, edge.target)) {
      continue;
    }

    acceptedEdges.push(edge);
    workingModel.edges.push(edge);
  }

  return acceptedEdges;
}
