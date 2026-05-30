"use client";

import type { RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import type {
  EdgeLabelHitbox,
  NodeHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";
import type { EdgeId, NodeId } from "../core/graph/model";
import type { EditorMode, SelectionState } from "../shell/state/editor-state";

import type { RenderedPoint } from "./graph-canvas-types";

type AtomSetter<T> = (value: T | ((current: T) => T)) => void;

export type SelectionBoxRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

type ShiftRangeSelectionState = {
  current: RenderedPoint;
  origin: RenderedPoint;
  pointerId: number;
};

type PointerPosition = {
  clientX: number;
  clientY: number;
};

type ConsumableEvent = {
  preventDefault: () => void;
  stopPropagation: () => void;
};

type NativeRangeStartEvent = ConsumableEvent &
  PointerPosition & {
    button: number;
    shiftKey: boolean;
    target: EventTarget | null;
  };

type UseShiftRangeSelectionOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  edgeLabelHitboxes: EdgeLabelHitbox[];
  mode: EditorMode;
  nodeHitboxes: NodeHitbox[];
  rootRef: RefObject<HTMLDivElement | null>;
  setSelection: AtomSetter<SelectionState>;
};

const MIN_SELECTION_BOX_PX = 4;

export function useShiftRangeSelection({
  containerRef,
  edgeLabelHitboxes,
  mode,
  nodeHitboxes,
  rootRef,
  setSelection,
}: UseShiftRangeSelectionOptions) {
  const [selectionBox, setSelectionBox] =
    useState<ShiftRangeSelectionState | null>(null);
  const dragRef = useRef<ShiftRangeSelectionState | null>(null);

  const beginRangeSelection = (
    event: PointerPosition,
    container: HTMLDivElement,
    pointerId: number,
  ) => {
    const nextSelectionBox = createSelectionBox(event, container, pointerId);

    dragRef.current = nextSelectionBox;
    setSelectionBox(nextSelectionBox);
  };

  const updateRangeSelectionPoint = (
    event: PointerPosition,
    container: HTMLDivElement,
    drag: ShiftRangeSelectionState,
  ) => {
    const nextSelectionBox = {
      ...drag,
      current: renderedPointFromPointer(event, container),
    };

    dragRef.current = nextSelectionBox;
    setSelectionBox(nextSelectionBox);
  };

  const clearRangeSelection = () => {
    dragRef.current = null;
    setSelectionBox(null);
  };

  const commitRangeSelection = (rect: SelectionBoxRect) => {
    if (
      rect.width < MIN_SELECTION_BOX_PX &&
      rect.height < MIN_SELECTION_BOX_PX
    ) {
      return;
    }

    const nodeIds = nodeHitboxes
      .filter((node) => pointInRect(node, rect))
      .map((node) => node.id);
    const edgeIds = edgeLabelHitboxes
      .filter((edge) => edgeIntersectsRect(edge, rect))
      .map((edge) => edge.id);

    if (nodeIds.length === 0 && edgeIds.length === 0) {
      return;
    }

    setSelection((currentSelection) => ({
      nodeIds: mergeIds(currentSelection.nodeIds, nodeIds),
      edgeIds: mergeIds(currentSelection.edgeIds, edgeIds),
    }));
  };

  useEffect(() => {
    const container = containerRef.current;
    const root = rootRef.current;

    if (!container || !root || mode !== "select") {
      return;
    }

    const onPointerDown = (event: PointerEvent) => {
      if (!canStartNativeRangeSelection(event, root, dragRef.current)) {
        return;
      }

      consumeRangeSelectionEvent(event);
      beginRangeSelection(event, container, event.pointerId);
      window.addEventListener("pointermove", onPointerMove, true);
      window.addEventListener("pointerup", onPointerUp, true);
      window.addEventListener("pointercancel", onPointerCancel, true);
    };

    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current;

      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      consumeRangeSelectionEvent(event);
      updateRangeSelectionPoint(event, container, drag);
    };

    const onPointerUp = (event: PointerEvent) => {
      const drag = dragRef.current;

      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      consumeRangeSelectionEvent(event);
      commitRangeSelection(selectionRect(drag));
      clearRangeSelection();
      removeWindowListeners();
    };

    const onPointerCancel = (event: PointerEvent) => {
      const drag = dragRef.current;

      if (drag?.pointerId === event.pointerId) {
        clearRangeSelection();
        removeWindowListeners();
      }
    };

    const removeWindowListeners = () => {
      window.removeEventListener("pointermove", onPointerMove, true);
      window.removeEventListener("pointerup", onPointerUp, true);
      window.removeEventListener("pointercancel", onPointerCancel, true);
    };

    document.addEventListener("pointerdown", onPointerDown, true);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      removeWindowListeners();
      clearRangeSelection();
    };
  }, [
    containerRef,
    edgeLabelHitboxes,
    mode,
    nodeHitboxes,
    rootRef,
    setSelection,
  ]);

  return {
    active: mode === "select",
    rect: selectionBox ? selectionRect(selectionBox) : null,
  };
}

function canStartNativeRangeSelection(
  event: NativeRangeStartEvent,
  root: HTMLDivElement,
  currentDrag: ShiftRangeSelectionState | null,
) {
  return (
    !currentDrag &&
    event.button === 0 &&
    event.shiftKey &&
    event.target instanceof Node &&
    root.contains(event.target)
  );
}

function consumeRangeSelectionEvent(event: ConsumableEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function createSelectionBox(
  event: PointerPosition,
  container: HTMLDivElement,
  pointerId: number,
): ShiftRangeSelectionState {
  const origin = renderedPointFromPointer(event, container);

  return {
    current: origin,
    origin,
    pointerId,
  };
}

function renderedPointFromPointer(
  event: PointerPosition,
  container: HTMLDivElement,
): RenderedPoint {
  const rect = container.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function selectionRect(selectionBox: ShiftRangeSelectionState) {
  const left = Math.min(selectionBox.origin.x, selectionBox.current.x);
  const top = Math.min(selectionBox.origin.y, selectionBox.current.y);
  const right = Math.max(selectionBox.origin.x, selectionBox.current.x);
  const bottom = Math.max(selectionBox.origin.y, selectionBox.current.y);

  return {
    height: bottom - top,
    left,
    top,
    width: right - left,
  };
}

function pointInRect(point: RenderedPoint, rect: SelectionBoxRect) {
  return (
    point.x >= rect.left &&
    point.x <= rect.left + rect.width &&
    point.y >= rect.top &&
    point.y <= rect.top + rect.height
  );
}

function edgeIntersectsRect(edge: EdgeLabelHitbox, rect: SelectionBoxRect) {
  if (
    pointInRect({ x: edge.x, y: edge.y }, rect) ||
    pointInRect({ x: edge.sourceX, y: edge.sourceY }, rect) ||
    pointInRect({ x: edge.targetX, y: edge.targetY }, rect)
  ) {
    return true;
  }

  const rectRight = rect.left + rect.width;
  const rectBottom = rect.top + rect.height;
  const segment = {
    ax: edge.sourceX,
    ay: edge.sourceY,
    bx: edge.targetX,
    by: edge.targetY,
  };

  return (
    segmentsIntersect(segment, {
      ax: rect.left,
      ay: rect.top,
      bx: rectRight,
      by: rect.top,
    }) ||
    segmentsIntersect(segment, {
      ax: rectRight,
      ay: rect.top,
      bx: rectRight,
      by: rectBottom,
    }) ||
    segmentsIntersect(segment, {
      ax: rectRight,
      ay: rectBottom,
      bx: rect.left,
      by: rectBottom,
    }) ||
    segmentsIntersect(segment, {
      ax: rect.left,
      ay: rectBottom,
      bx: rect.left,
      by: rect.top,
    })
  );
}

function segmentsIntersect(
  a: { ax: number; ay: number; bx: number; by: number },
  b: { ax: number; ay: number; bx: number; by: number },
) {
  const d1 = direction(a.ax, a.ay, a.bx, a.by, b.ax, b.ay);
  const d2 = direction(a.ax, a.ay, a.bx, a.by, b.bx, b.by);
  const d3 = direction(b.ax, b.ay, b.bx, b.by, a.ax, a.ay);
  const d4 = direction(b.ax, b.ay, b.bx, b.by, a.bx, a.by);

  return d1 * d2 <= 0 && d3 * d4 <= 0;
}

function direction(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  px: number,
  py: number,
) {
  return (px - ax) * (by - ay) - (py - ay) * (bx - ax);
}

function mergeIds<T extends NodeId | EdgeId>(currentIds: T[], nextIds: T[]) {
  return [...new Set([...currentIds, ...nextIds])];
}
