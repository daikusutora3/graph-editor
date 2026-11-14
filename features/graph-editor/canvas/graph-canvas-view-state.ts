import type { GraphModel, NodeId } from "../core/graph/model";
import type { EdgeDraft, SelectionState } from "../shell/state/editor-state";
import type { EditFeedback } from "./graph-canvas-edit-feedback";

import type { NodeHitbox } from "../adapters/cytoscape/graph-canvas-hitboxes";
import type { RenderedPoint } from "./graph-canvas-types";
import {
  isEdgeCandidateBlocked,
  trimRenderedSegment,
} from "./graph-canvas-edge-draft";

type GraphCanvasViewStateOptions = {
  edgeCursor: RenderedPoint | null;
  edgeDraft: EdgeDraft;
  edgeHoverNodeId: NodeId | null;
  editFeedback: EditFeedback | null;
  graph: GraphModel;
  inlineEditActive: boolean;
  nodeHitboxes: NodeHitbox[];
  selection: SelectionState;
};

export function getGraphCanvasViewState({
  edgeCursor,
  edgeDraft,
  edgeHoverNodeId,
  editFeedback,
  graph,
  inlineEditActive,
  nodeHitboxes,
  selection,
}: GraphCanvasViewStateOptions) {
  const sourceHitbox = edgeDraft
    ? nodeHitboxes.find((node) => node.id === edgeDraft)
    : null;
  const edgeCandidateBlocked = Boolean(
    edgeDraft &&
    edgeHoverNodeId &&
    isEdgeCandidateBlocked(graph, edgeDraft, edgeHoverNodeId),
  );
  const feedbackNodeHitboxes = editFeedback
    ? nodeHitboxes.filter((node) => editFeedback.nodeIds.includes(node.id))
    : [];
  const edgeDraftSegment =
    sourceHitbox && edgeCursor
      ? trimRenderedSegment(sourceHitbox, edgeCursor, 28)
      : null;
  const hasSelection =
    selection.nodeIds.length > 0 || selection.edgeIds.length > 0;

  return {
    edgeCandidateBlocked,
    edgeDraftSegment,
    feedbackNodeHitboxes,
    showSelectionActionBar: !inlineEditActive && hasSelection,
  };
}
