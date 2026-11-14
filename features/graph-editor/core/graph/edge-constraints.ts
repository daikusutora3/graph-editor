import type { EdgeId, GraphEdge, GraphModel, NodeId } from "./model";

export function edgePairKey(source: string, target: string, directed: boolean) {
  return JSON.stringify(
    directed || source <= target ? [source, target] : [target, source],
  );
}

export function canUseEdgeEndpoints(
  model: GraphModel,
  source: NodeId,
  target: NodeId,
  ignoreEdgeId?: EdgeId,
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
      if (edge.id === ignoreEdgeId) {
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
    edgePairKey(edge.source, edge.target, model.settings.directed);
  const pairs = model.settings.allowMultiEdges
    ? null
    : new Set(model.edges.map(key));
  const acceptedEdges: GraphEdge[] = [];
  for (const edge of edges) {
    if (
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target) ||
      (!model.settings.allowSelfLoops && edge.source === edge.target)
    )
      continue;
    if (pairs) {
      const pair = key(edge);
      if (pairs.has(pair)) continue;
      pairs.add(pair);
    }
    acceptedEdges.push(edge);
  }
  return acceptedEdges;
}
