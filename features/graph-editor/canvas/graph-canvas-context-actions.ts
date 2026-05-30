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

import type { GraphContextMenuTarget } from "./graph-canvas-types";
import type { EdgeLabelHitbox } from "../adapters/cytoscape/graph-canvas-hitboxes";

type CanvasPointer = {
  clientX: number;
  clientY: number;
};
type RenderedPointFromPointer = (event: CanvasPointer) => {
  x: number;
  y: number;
};
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
  renderedPointFromPointer: RenderedPointFromPointer;
  setContextMenuTarget: Dispatch<SetStateAction<GraphContextMenuTarget | null>>;
  syncContextSelection: SyncContextSelection;
};

export function useGraphCanvasContextActions({
  cancelInlineEdit,
  deleteSelection,
  executeCommand,
  renderedPointFromPointer,
  setContextMenuTarget,
  syncContextSelection,
}: UseGraphCanvasContextActionsOptions) {
  const openNodeContextMenu = useCallback(
    (nodeId: NodeId, event: CanvasPointer) => {
      cancelInlineEdit();
      syncContextSelection({ kind: "node", nodeId });
      setContextMenuTarget({
        kind: "node",
        nodeId,
        ...renderedPointFromPointer(event),
      });
    },
    [
      cancelInlineEdit,
      renderedPointFromPointer,
      setContextMenuTarget,
      syncContextSelection,
    ],
  );

  const openEdgeContextMenu = useCallback(
    (edge: EdgeLabelHitbox, event: CanvasPointer) => {
      cancelInlineEdit();
      syncContextSelection({ kind: "edge", edgeId: edge.id });
      setContextMenuTarget({
        kind: "edge",
        edgeId: edge.id,
        sourceX: edge.sourceX,
        sourceY: edge.sourceY,
        targetX: edge.targetX,
        targetY: edge.targetY,
        ...renderedPointFromPointer(event),
      });
    },
    [
      cancelInlineEdit,
      renderedPointFromPointer,
      setContextMenuTarget,
      syncContextSelection,
    ],
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
