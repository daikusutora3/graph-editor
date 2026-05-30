import type { EdgeId, NodeId } from "../../core/graph/model";

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

function toggleId<T extends string>(ids: T[], id: T) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}
