import { canUseEdgeEndpoints } from "../core/graph/edge-constraints";
import { getNode } from "../core/graph/selectors";
import type { GraphModel, NodeId } from "../core/graph/model";
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
    }
  | {
      kind: "reject";
      nextDraft: EdgeDraft;
      reason: string;
    };

function draftMessage(
  kind: NonNullable<EdgeDraft["message"]>["kind"],
  text: string,
): NonNullable<EdgeDraft["message"]> {
  return { kind, text };
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
    const reason = !targetExists
      ? "接続先のノードが見つかりません"
      : "始点のノードが見つかりません";

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
        message: draftMessage("info", "始点を選択しました"),
      },
    };
  }

  if (sourceNodeId === targetNodeId && !model.settings.allowSelfLoops) {
    const reason = "自己ループは無効です";

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
    const reason = "同じ辺はすでに存在します";

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
      message: draftMessage("success", "辺を作成しました"),
    },
  };
}
