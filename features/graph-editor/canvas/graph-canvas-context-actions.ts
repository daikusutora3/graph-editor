"use client";

import { useCallback } from "react";

import { reverseEdgesCommand } from "../core/graph/graph-intents";
import { selectionColorCommand } from "./selection-color-actions";
import type {
  EdgeId,
  GraphColor,
  GraphIntent,
  NodeId,
} from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";

import type {
  GraphContextMenuTarget,
  RenderedPoint,
  SyncContextSelectionTarget,
} from "./graph-canvas-types";
import {
  EDGE_LABEL_HITBOX_HEIGHT,
  edgeLabelHitboxWidth,
  NODE_HITBOX_SIZE,
  type EdgeLabelHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";

type UseGraphCanvasContextActionsOptions = {
  cancelInlineEdit: () => void;
  executeCommand: (command: GraphIntent) => void;
  setContextMenuTarget: (target: GraphContextMenuTarget | null) => void;
  syncContextSelection: (target: SyncContextSelectionTarget) => void;
};

export function useGraphCanvasContextActions({
  cancelInlineEdit,
  executeCommand,
  setContextMenuTarget,
  syncContextSelection,
}: UseGraphCanvasContextActionsOptions) {
  const openNodeContextMenu = useCallback(
    (nodeId: NodeId, position: RenderedPoint) => {
      cancelInlineEdit();
      syncContextSelection({ kind: "node", nodeId });
      setContextMenuTarget({
        anchorRect: rectFromCenter(
          position,
          NODE_HITBOX_SIZE,
          NODE_HITBOX_SIZE,
        ),
        kind: "node",
        nodeId,
        ...position,
      });
    },
    [cancelInlineEdit, setContextMenuTarget, syncContextSelection],
  );

  const openEdgeContextMenu = useCallback(
    (edge: EdgeLabelHitbox) => {
      cancelInlineEdit();
      syncContextSelection({ kind: "edge", edgeId: edge.id });
      const position = { x: edge.x, y: edge.y };

      setContextMenuTarget({
        anchorRect: rectFromCenter(
          position,
          edgeLabelHitboxWidth(edge.label),
          EDGE_LABEL_HITBOX_HEIGHT,
        ),
        kind: "edge",
        edgeId: edge.id,
        ...position,
      });
    },
    [cancelInlineEdit, setContextMenuTarget, syncContextSelection],
  );

  const reverseSelectionEdges = useCallback(
    (edgeIds: EdgeId[]) => {
      executeCommand(reverseEdgesCommand(edgeIds));
    },
    [executeCommand],
  );

  const setSelectionColor = useCallback(
    (
      selection: SelectionState,
      kind: "node" | "edge" | "mixed",
      color: GraphColor,
    ) => {
      executeCommand(selectionColorCommand(selection, kind, color));
    },
    [executeCommand],
  );

  return {
    openEdgeContextMenu,
    openNodeContextMenu,
    reverseSelectionEdges,
    setSelectionColor,
  };
}

function rectFromCenter(
  position: RenderedPoint,
  width: number,
  height: number,
) {
  return {
    height,
    left: position.x - width / 2,
    top: position.y - height / 2,
    width,
  };
}
