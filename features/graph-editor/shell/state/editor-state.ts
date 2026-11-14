export type EditorMode = "select" | "node" | "edge";
export type RangeSelectionFilter = "all" | "nodes" | "edges";

export type { EdgeDraft, SelectionState } from "../../core/view/types";
import type { SelectionState } from "../../core/view/types";

export function createEmptySelection(): SelectionState {
  return { nodeIds: [], edgeIds: [] };
}
