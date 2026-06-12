"use client";

import type { Core, EdgeSingular } from "cytoscape";
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
  RefObject,
} from "react";
import { useCallback, useEffect, useRef } from "react";

import { withCytoscapeBatch } from "../adapters/cytoscape/cytoscape-batch";

type RenderedPoint = {
  x: number;
  y: number;
};

type RenderedBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

type RangePreviewSession = {
  pointerId: number;
  start: RenderedPoint;
  current: RenderedPoint;
  frame: number;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
  stopListeners: () => void;
};

type UseRangeSelectionPreviewOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  cyRef: MutableRefObject<Core | null>;
  enabled: boolean;
};

const RANGE_PREVIEW_CLASS = "range-preview";

export function useRangeSelectionPreview({
  containerRef,
  cyRef,
  enabled,
}: UseRangeSelectionPreviewOptions) {
  const sessionRef = useRef<RangePreviewSession | null>(null);

  const clearPreview = useCallback(() => {
    const session = sessionRef.current;
    const cy = cyRef.current;

    sessionRef.current = null;
    session?.stopListeners();

    if (session?.frame) {
      window.cancelAnimationFrame(session.frame);
    }

    if (!cy || cy.destroyed()) {
      return;
    }

    cy.elements(`.${RANGE_PREVIEW_CLASS}`).removeClass(RANGE_PREVIEW_CLASS);
  }, [cyRef]);

  const flushPreview = useCallback(() => {
    const session = sessionRef.current;
    const cy = cyRef.current;

    if (!session || !cy || cy.destroyed()) {
      return;
    }

    session.frame = 0;

    const box = renderedBoxFromPoints(session.start, session.current);
    const nextNodeIds = new Set<string>();
    const nextEdgeIds = new Set<string>();

    cy.nodes().forEach((node) => {
      const nodeBox = node.renderedBoundingBox({
        includeNodes: true,
        includeEdges: false,
        includeLabels: false,
        includeOverlays: false,
        includeUnderlays: false,
      });

      if (boxContains(box, nodeBox)) {
        nextNodeIds.add(node.id());
      }
    });

    cy.edges().forEach((edge) => {
      if (edgeControlPathInBox(box, edge)) {
        nextEdgeIds.add(edge.id());
      }
    });

    withCytoscapeBatch(cy, () => {
      applyPreviewClassDiff(cy, session.nodeIds, nextNodeIds);
      applyPreviewClassDiff(cy, session.edgeIds, nextEdgeIds);
    });

    session.nodeIds = nextNodeIds;
    session.edgeIds = nextEdgeIds;
  }, [cyRef]);

  const schedulePreview = useCallback(() => {
    const session = sessionRef.current;

    if (!session || session.frame) {
      return;
    }

    session.frame = window.requestAnimationFrame(flushPreview);
  }, [flushPreview]);

  useEffect(() => {
    if (!enabled) {
      clearPreview();
    }
  }, [clearPreview, enabled]);

  useEffect(() => clearPreview, [clearPreview]);

  return useCallback(
    (event: ReactPointerEvent<Element>) => {
      const container = containerRef.current;
      const cy = cyRef.current;

      if (
        !enabled ||
        event.button !== 0 ||
        (!event.shiftKey && !event.metaKey && !event.ctrlKey) ||
        !container ||
        !cy ||
        cy.destroyed()
      ) {
        return false;
      }

      clearPreview();

      const pointerId = event.pointerId;
      const point = renderedPointFromPointer(event.nativeEvent, container);
      const updatePreviewPointer = (moveEvent: PointerEvent) => {
        const session = sessionRef.current;
        const currentContainer = containerRef.current;

        if (
          !session ||
          moveEvent.pointerId !== session.pointerId ||
          !currentContainer
        ) {
          return;
        }

        session.current = renderedPointFromPointer(moveEvent, currentContainer);
        schedulePreview();
      };
      const finishPreviewPointer = (finishEvent: PointerEvent) => {
        const session = sessionRef.current;

        if (!session || finishEvent.pointerId !== session.pointerId) {
          return;
        }

        clearPreview();
      };
      const stopListeners = () => {
        window.removeEventListener("pointermove", updatePreviewPointer, true);
        window.removeEventListener("pointerup", finishPreviewPointer, true);
        window.removeEventListener("pointercancel", finishPreviewPointer, true);
      };

      sessionRef.current = {
        pointerId,
        start: point,
        current: point,
        frame: 0,
        nodeIds: new Set(),
        edgeIds: new Set(),
        stopListeners,
      };

      window.addEventListener("pointermove", updatePreviewPointer, true);
      window.addEventListener("pointerup", finishPreviewPointer, true);
      window.addEventListener("pointercancel", finishPreviewPointer, true);
      schedulePreview();

      return true;
    },
    [containerRef, cyRef, enabled, clearPreview, schedulePreview],
  );
}

function renderedPointFromPointer(
  event: Pick<MouseEvent, "clientX" | "clientY">,
  container: HTMLDivElement,
): RenderedPoint {
  const rect = container.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function renderedBoxFromPoints(
  start: RenderedPoint,
  current: RenderedPoint,
): RenderedBox {
  return {
    x1: Math.min(start.x, current.x),
    y1: Math.min(start.y, current.y),
    x2: Math.max(start.x, current.x),
    y2: Math.max(start.y, current.y),
  };
}

function boxContains(
  a: RenderedBox,
  b: { x1: number; y1: number; x2: number; y2: number },
) {
  return a.x1 <= b.x1 && a.y1 <= b.y1 && a.x2 >= b.x2 && a.y2 >= b.y2;
}

function edgeControlPathInBox(box: RenderedBox, edge: EdgeSingular) {
  const points = [
    edge.renderedSourceEndpoint(),
    edge.renderedTargetEndpoint(),
    ...readRenderedEdgePoints(edge, "renderedControlPoints"),
    ...readRenderedEdgePoints(edge, "renderedSegmentPoints"),
  ].filter(isRenderedPoint);

  return points.every((point) => pointInBox(box, point));
}

function readRenderedEdgePoints(
  edge: EdgeSingular,
  method: "renderedControlPoints" | "renderedSegmentPoints",
) {
  try {
    const points = edge[method]();

    return Array.isArray(points) ? points : [];
  } catch {
    return [];
  }
}

function isRenderedPoint(point: unknown): point is RenderedPoint {
  return (
    typeof point === "object" &&
    point !== null &&
    "x" in point &&
    "y" in point &&
    typeof point.x === "number" &&
    typeof point.y === "number" &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}

function pointInBox(box: RenderedBox, point: RenderedPoint) {
  return (
    point.x >= box.x1 &&
    point.x <= box.x2 &&
    point.y >= box.y1 &&
    point.y <= box.y2
  );
}

function applyPreviewClassDiff(
  cy: Core,
  currentIds: Set<string>,
  nextIds: Set<string>,
) {
  currentIds.forEach((id) => {
    if (!nextIds.has(id)) {
      cy.getElementById(id).removeClass(RANGE_PREVIEW_CLASS);
    }
  });

  nextIds.forEach((id) => {
    if (!currentIds.has(id)) {
      cy.getElementById(id).addClass(RANGE_PREVIEW_CLASS);
    }
  });
}
