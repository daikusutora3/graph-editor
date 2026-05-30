import type { EdgeId, GraphModel, NodeId } from "../../core/graph/model";

import type { SelectionState } from "./editor-state";

export function resolveNodeSelection(
  currentSelection: SelectionState,
  nodeId: NodeId,
  additive: boolean,
): SelectionState {
  if (!additive) {
    return { nodeIds: [nodeId], edgeIds: [] };
  }

  return {
    nodeIds: toggleId(currentSelection.nodeIds, nodeId),
    edgeIds: currentSelection.edgeIds,
  };
}

export function resolveEdgeSelection(
  currentSelection: SelectionState,
  edgeId: EdgeId,
  additive: boolean,
): SelectionState {
  if (!additive) {
    return { nodeIds: [], edgeIds: [edgeId] };
  }

  return {
    nodeIds: currentSelection.nodeIds,
    edgeIds: toggleId(currentSelection.edgeIds, edgeId),
  };
}

export function pruneSelectionForGraph(
  selection: SelectionState,
  graph: GraphModel,
): SelectionState {
  const nodeIds = new Set(graph.nodes.map((node) => node.id));
  const edgeIds = new Set(graph.edges.map((edge) => edge.id));
  const nextSelection = {
    nodeIds: selection.nodeIds.filter((nodeId) => nodeIds.has(nodeId)),
    edgeIds: selection.edgeIds.filter((edgeId) => edgeIds.has(edgeId)),
  };

  return nextSelection.nodeIds.length === selection.nodeIds.length &&
    nextSelection.edgeIds.length === selection.edgeIds.length
    ? selection
    : nextSelection;
}

function toggleId<T extends string>(ids: T[], id: T) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
