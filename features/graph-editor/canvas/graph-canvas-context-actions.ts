"use client";

import type { Dispatch, SetStateAction } from "react";
import { useCallback } from "react";

import {
  reverseEdgesCommand,
  setEdgesColorCommand,
  setNodesColorCommand,
} from "../core/graph/graph-intents";
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
} from "./graph-canvas-types";
import {
  EDGE_LABEL_HITBOX_HEIGHT,
  edgeLabelHitboxWidth,
  NODE_HITBOX_SIZE,
  type EdgeLabelHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";

type SyncContextSelection = (
  target: Pick<GraphContextMenuTarget, "kind"> & {
    edgeId?: EdgeId;
    nodeId?: NodeId;
  },
) => SelectionState;

type UseGraphCanvasContextActionsOptions = {
  cancelInlineEdit: () => void;
  deleteSelection: (selection: SelectionState) => void;
  executeCommand: (command: GraphIntent) => void;
  setContextMenuTarget: Dispatch<SetStateAction<GraphContextMenuTarget | null>>;
  syncContextSelection: SyncContextSelection;
};

export function useGraphCanvasContextActions({
  cancelInlineEdit,
  deleteSelection,
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

  const setSelectionEdgeColor = useCallback(
    (edgeIds: EdgeId[], color: GraphColor) => {
      executeCommand(setEdgesColorCommand(edgeIds, color));
    },
    [executeCommand],
  );

  const setSelectionNodeColor = useCallback(
    (nodeIds: NodeId[], color: GraphColor) => {
      executeCommand(setNodesColorCommand(nodeIds, color));
    },
    [executeCommand],
  );

  const reverseSelectionEdges = useCallback(
    (edgeIds: EdgeId[]) => {
      executeCommand(reverseEdgesCommand(edgeIds));
    },
    [executeCommand],
  );

  const deleteContextSelection = useCallback(
    (nextSelection: SelectionState) => {
      deleteSelection(nextSelection);
    },
    [deleteSelection],
  );

  return {
    deleteContextSelection,
    openEdgeContextMenu,
    openNodeContextMenu,
    reverseSelectionEdges,
    setSelectionEdgeColor,
    setSelectionNodeColor,
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
