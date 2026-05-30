import type { EdgeId, NodeId } from "../../core/graph/model";

export type EditorMode = "select" | "node" | "edge";

export type SelectionState = {
  nodeIds: NodeId[];
  edgeIds: EdgeId[];
};

export function createEmptySelection(): SelectionState {
  return { nodeIds: [], edgeIds: [] };
}

export type EdgeDraft = {
  sourceNodeId: NodeId | null;
  message?: {
    kind: "info" | "success" | "error";
    text: string;
  } | null;
};

export function createEmptyEdgeDraft(): EdgeDraft {
  return { sourceNodeId: null };
}
