export type EditorMode = "select" | "node" | "edge";

export type {
  EdgeDraft,
  EdgeDraftMessageCode,
  SelectionState,
} from "../../core/view/types";
import type { EdgeDraft, SelectionState } from "../../core/view/types";

export function createEmptySelection(): SelectionState {
  return { nodeIds: [], edgeIds: [] };
}

export function createEmptyEdgeDraft(): EdgeDraft {
  return { sourceNodeId: null };
}
