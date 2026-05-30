import type { GraphModel, NodeId } from "../core/graph/model";
import type { EdgeDraft, SelectionState } from "../shell/state/editor-state";

import type { NodeHitbox } from "../adapters/cytoscape/graph-canvas-hitboxes";
import type { RenderedPoint } from "./graph-canvas-types";
import {
  getEdgeCandidateError,
  trimRenderedSegment,
} from "./graph-canvas-edge-draft";

type EditFeedback = {
  id: number;
  nodeIds: NodeId[];
};

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
  const sourceHitbox = edgeDraft.sourceNodeId
    ? nodeHitboxes.find((node) => node.id === edgeDraft.sourceNodeId)
    : null;
  const edgeCandidateError =
    edgeDraft.sourceNodeId && edgeHoverNodeId
      ? getEdgeCandidateError(graph, edgeDraft.sourceNodeId, edgeHoverNodeId)
      : null;
  const feedbackNodeHitboxes = editFeedback
    ? nodeHitboxes.filter((node) => editFeedback.nodeIds.includes(node.id))
    : [];
  const edgeDraftSegment =
    sourceHitbox && edgeCursor
      ? trimRenderedSegment(sourceHitbox, edgeCursor, 28, 0)
      : null;
  const hasSelection =
    selection.nodeIds.length > 0 || selection.edgeIds.length > 0;

  return {
    edgeCandidateError,
    edgeDraftSegment,
    feedbackNodeHitboxes,
    hasSelection,
    showSelectionActionBar: !inlineEditActive && hasSelection,
  };
}
