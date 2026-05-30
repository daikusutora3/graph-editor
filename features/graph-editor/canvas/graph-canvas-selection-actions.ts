"use client";

import type { MutableRefObject } from "react";
import { useCallback } from "react";

import type { EdgeId, NodeId } from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";

import type { GraphContextMenuTarget } from "./graph-canvas-types";

type AtomSetter<T> = (value: T | ((current: T) => T)) => void;
type CanvasPointer = {
  clientX: number;
  clientY: number;
};
type SyncContextSelectionTarget = Pick<GraphContextMenuTarget, "kind"> & {
  edgeId?: EdgeId;
  nodeId?: NodeId;
};

type UseGraphCanvasSelectionActionsOptions = {
  containerRef: MutableRefObject<HTMLDivElement | null>;
  selectionRef: MutableRefObject<SelectionState>;
  setSelection: AtomSetter<SelectionState>;
};

export function useGraphCanvasSelectionActions({
  containerRef,
  selectionRef,
  setSelection,
}: UseGraphCanvasSelectionActionsOptions) {
  const selectNode = useCallback(
    (nodeId: NodeId) => {
      setSelection({ nodeIds: [nodeId], edgeIds: [] });
    },
    [setSelection],
  );

  const selectEdge = useCallback(
    (edgeId: EdgeId) => {
      setSelection({ nodeIds: [], edgeIds: [edgeId] });
    },
    [setSelection],
  );

  const syncContextSelection = useCallback(
    (target: SyncContextSelectionTarget) => {
      const currentSelection = selectionRef.current;

      if (target.kind === "node" && target.nodeId) {
        if (currentSelection.nodeIds.includes(target.nodeId)) {
          return currentSelection;
        }

        const nextSelection = { nodeIds: [target.nodeId], edgeIds: [] };
        setSelection(nextSelection);
        return nextSelection;
      }

      if (target.kind === "edge" && target.edgeId) {
        if (currentSelection.edgeIds.includes(target.edgeId)) {
          return currentSelection;
        }

        const nextSelection = { nodeIds: [], edgeIds: [target.edgeId] };
        setSelection(nextSelection);
        return nextSelection;
      }

      return currentSelection;
    },
    [selectionRef, setSelection],
  );

  const renderedPointFromPointer = useCallback(
    (event: CanvasPointer) => {
      const rect = containerRef.current?.getBoundingClientRect();

      return {
        x: rect ? event.clientX - rect.left : event.clientX,
        y: rect ? event.clientY - rect.top : event.clientY,
      };
    },
    [containerRef],
  );

  return {
    renderedPointFromPointer,
    selectEdge,
    selectNode,
    syncContextSelection,
  };
}
