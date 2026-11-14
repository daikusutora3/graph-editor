import type { GraphModel, NodeId } from "../core/graph/model";
import { isEdgeCandidateBlocked } from "./graph-canvas-edge-draft";
import type { EdgeDraft } from "../shell/state/editor-state";

export type EdgeCreationInput = {
  model: GraphModel;
  draft: EdgeDraft;
  targetNodeId: NodeId;
  continueFromTarget?: boolean;
};

export type EdgeCreationResult =
  | {
      kind: "create-edge";
      source: NodeId;
      target: NodeId;
      nextDraft: EdgeDraft;
    }
  | {
      kind: "update-draft";
      nextDraft: EdgeDraft;
    };

export function resolveEdgeCreation({
  model,
  draft,
  targetNodeId,
  continueFromTarget = false,
}: EdgeCreationInput): EdgeCreationResult {
  const sourceNodeId = draft;
  const targetExists = model.nodes.some((node) => node.id === targetNodeId);
  const sourceExists = sourceNodeId
    ? model.nodes.some((node) => node.id === sourceNodeId)
    : true;
  const nextSourceOnEndpointError = sourceExists ? sourceNodeId : null;

  if (!targetExists || !sourceExists) {
    return {
      kind: "update-draft",
      nextDraft: nextSourceOnEndpointError,
    };
  }

  if (!sourceNodeId) {
    return {
      kind: "update-draft",
      nextDraft: targetNodeId,
    };
  }

  if (isEdgeCandidateBlocked(model, sourceNodeId, targetNodeId)) {
    return {
      kind: "update-draft",
      nextDraft: sourceNodeId,
    };
  }

  return {
    kind: "create-edge",
    source: sourceNodeId,
    target: targetNodeId,
    nextDraft: continueFromTarget ? targetNodeId : null,
  };
}
