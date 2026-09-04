import { canUseEdgeEndpoints } from "../core/graph/edge-constraints";
import { getNode } from "../core/graph/selectors";
import type { GraphModel, NodeId } from "../core/graph/model";
import type {
  EdgeDraft,
  EdgeDraftMessageCode,
} from "../shell/state/editor-state";

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
    }
  | {
      kind: "reject";
      nextDraft: EdgeDraft;
      reason: EdgeDraftMessageCode;
    };

function draftMessage(
  kind: NonNullable<EdgeDraft["message"]>["kind"],
  code: EdgeDraftMessageCode,
): NonNullable<EdgeDraft["message"]> {
  return { kind, code };
}

export function resolveEdgeCreation({
  model,
  draft,
  targetNodeId,
  continueFromTarget = false,
}: EdgeCreationInput): EdgeCreationResult {
  const sourceNodeId = draft.sourceNodeId;
  const targetExists = getNode(model, targetNodeId) !== null;
  const sourceExists = sourceNodeId
    ? getNode(model, sourceNodeId) !== null
    : true;
  const nextSourceOnEndpointError = sourceExists ? sourceNodeId : null;

  if (!targetExists || !sourceExists) {
    const reason: EdgeDraftMessageCode = !targetExists
      ? "target-missing"
      : "source-missing";

    return {
      kind: "reject",
      reason,
      nextDraft: {
        sourceNodeId: nextSourceOnEndpointError,
        message: draftMessage("error", reason),
      },
    };
  }

  if (!sourceNodeId) {
    return {
      kind: "update-draft",
      nextDraft: {
        sourceNodeId: targetNodeId,
        message: draftMessage("info", "source-selected"),
      },
    };
  }

  if (sourceNodeId === targetNodeId && !model.settings.allowSelfLoops) {
    const reason = "self-loop";

    return {
      kind: "reject",
      reason,
      nextDraft: {
        sourceNodeId,
        message: draftMessage("error", reason),
      },
    };
  }

  if (
    !model.settings.allowMultiEdges &&
    !canUseEdgeEndpoints(model, sourceNodeId, targetNodeId)
  ) {
    const reason = "duplicate-edge";

    return {
      kind: "reject",
      reason,
      nextDraft: {
        sourceNodeId,
        message: draftMessage("error", reason),
      },
    };
  }

  return {
    kind: "create-edge",
    source: sourceNodeId,
    target: targetNodeId,
    nextDraft: {
      sourceNodeId: continueFromTarget ? targetNodeId : null,
      message: draftMessage("success", "edge-created"),
    },
  };
}
