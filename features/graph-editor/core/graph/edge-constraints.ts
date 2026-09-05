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
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  const key = (edge: GraphEdge) =>
    JSON.stringify(
      model.settings.directed
        ? [edge.source, edge.target]
        : [edge.source, edge.target].sort(),
    );
  const pairs = new Set(model.edges.map(key));
  const acceptedEdges: GraphEdge[] = [];
  for (const edge of edges) {
    if (
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target) ||
      (!model.settings.allowSelfLoops && edge.source === edge.target)
    )
      continue;
    const pair = key(edge);
    if (!model.settings.allowMultiEdges && pairs.has(pair)) continue;
    acceptedEdges.push(edge);
    pairs.add(pair);
  }
  return acceptedEdges;
}
