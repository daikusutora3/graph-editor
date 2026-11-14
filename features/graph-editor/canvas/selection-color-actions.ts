import type { GraphColor } from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";
import {
  setEdgesColorCommand,
  setNodesColorCommand,
  setSelectionColorsCommand,
} from "../core/graph/graph-intents";

export function selectionColorCommand(
  selection: SelectionState,
  kind: "node" | "edge" | "mixed",
  color: GraphColor,
) {
  if (kind === "node") return setNodesColorCommand(selection.nodeIds, color);
  if (kind === "edge") return setEdgesColorCommand(selection.edgeIds, color);
  return setSelectionColorsCommand({
    nodeIds: selection.nodeIds,
    edgeIds: selection.edgeIds,
    nodeColor: color,
    edgeColor: color,
  });
}
