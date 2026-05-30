"use client";

import type { PointerEvent as ReactPointerEvent, RefObject } from "react";
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

type UseShiftRangeSelectionOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  edgeLabelHitboxes: EdgeLabelHitbox[];
  mode: EditorMode;
  nodeHitboxes: NodeHitbox[];
  setSelection: AtomSetter<SelectionState>;
};

const MIN_SELECTION_BOX_PX = 4;

export function useShiftRangeSelection({
  containerRef,
  edgeLabelHitboxes,
  mode,
  nodeHitboxes,
  setSelection,
}: UseShiftRangeSelectionOptions) {
  const [shiftPressed, setShiftPressed] = useState(false);
  const [selectionBox, setSelectionBox] =
    useState<ShiftRangeSelectionState | null>(null);
  const dragRef = useRef<ShiftRangeSelectionState | null>(null);

  useEffect(() => {
    if (mode !== "select") {
      setShiftPressed(false);
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftPressed(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftPressed(false);
      }
    };
    const onBlur = () => setShiftPressed(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [mode]);

  const startRangeSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;

    if (!container || event.button !== 0) {
      return;
    }

    const origin = renderedPointFromPointer(event, container);
    const nextSelectionBox = {
      current: origin,
      origin,
      pointerId: event.pointerId,
    };

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = nextSelectionBox;
    setSelectionBox(nextSelectionBox);
  };

  const updateRangeSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const drag = dragRef.current;

    if (!container || !drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const nextSelectionBox = {
      ...drag,
      current: renderedPointFromPointer(event, container),
    };
    dragRef.current = nextSelectionBox;
    setSelectionBox(nextSelectionBox);
  };

  const finishRangeSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.releasePointerCapture(event.pointerId);

    const rect = selectionRect(drag);
    clearRangeSelection();

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

  const cancelRangeSelection = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;

    if (drag?.pointerId === event.pointerId) {
      clearRangeSelection();
    }
  };

  const clearRangeSelection = () => {
    dragRef.current = null;
    setSelectionBox(null);
  };

  return {
    active: mode === "select" && (shiftPressed || selectionBox !== null),
    rect: selectionBox ? selectionRect(selectionBox) : null,
    handlers: {
      onPointerCancel: cancelRangeSelection,
      onPointerDown: startRangeSelection,
      onPointerMove: updateRangeSelection,
      onPointerUp: finishRangeSelection,
    },
  };
}

function renderedPointFromPointer(
  event: { clientX: number; clientY: number },
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
