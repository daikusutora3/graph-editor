"use client";

import type { MutableRefObject } from "react";
import { useCallback } from "react";

import type { EdgeId, NodeId } from "../core/graph/model";
import {
  resolveEdgeSelection,
  resolveNodeSelection,
} from "../shell/state/editor-selection";
import type { SelectionState } from "../shell/state/editor-state";

import type { SyncContextSelectionTarget } from "./graph-canvas-types";
import { selectionForTarget } from "./selection-actions";

type AtomSetter<T> = (value: T | ((current: T) => T)) => void;
type CanvasPointer = {
  clientX: number;
  clientY: number;
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
    (nodeId: NodeId, additive = false) => {
      setSelection((currentSelection) =>
        resolveNodeSelection(currentSelection, nodeId, additive),
      );
    },
    [setSelection],
  );

  const selectEdge = useCallback(
    (edgeId: EdgeId, additive = false) => {
      setSelection((currentSelection) =>
        resolveEdgeSelection(currentSelection, edgeId, additive),
      );
    },
    [setSelection],
  );

  const syncContextSelection = useCallback(
    (target: SyncContextSelectionTarget) => {
      const currentSelection = selectionRef.current;

      const nextSelection = selectionForTarget(target, currentSelection);
      if (nextSelection !== currentSelection) setSelection(nextSelection);
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
