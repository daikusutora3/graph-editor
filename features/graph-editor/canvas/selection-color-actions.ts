import type { GraphColor } from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";

type SelectionColorActions = {
  onSetNodeColor: (nodeIds: string[], color: GraphColor) => void;
  onSetEdgeColor: (edgeIds: string[], color: GraphColor) => void;
  onSetSelectionColors: (selection: SelectionState, color: GraphColor) => void;
};

export function pickSelectionColor(
  selection: SelectionState,
  kind: "node" | "edge" | "mixed",
  color: GraphColor,
  actions: SelectionColorActions,
) {
  if (kind === "mixed") actions.onSetSelectionColors(selection, color);
  else if (kind === "node") actions.onSetNodeColor(selection.nodeIds, color);
  else actions.onSetEdgeColor(selection.edgeIds, color);
}
