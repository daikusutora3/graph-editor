"use client";

import type { Core } from "cytoscape";
import type { MutableRefObject } from "react";
import { useCallback } from "react";

import {
  fitGraphToAvailableViewport,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  nextCanvasButtonZoomLevel,
  readZoomPercent,
} from "../adapters/cytoscape/graph-canvas-viewport";

import type { EditorLayout } from "../core/view/types";
import { readEditorChromeInsets } from "../adapters/browser/editor-chrome-insets";

type GraphCanvasViewportActionsOptions = {
  canZoom: boolean;
  layout: EditorLayout;
  cyRef: MutableRefObject<Core | null>;
  flushRenderedHitboxes: (cy: Core) => void;
  setZoomPercent: (zoomPercent: number) => void;
};

export function useGraphCanvasViewportActions({
  canZoom,
  layout,
  cyRef,
  flushRenderedHitboxes,
  setZoomPercent,
}: GraphCanvasViewportActionsOptions) {
  const syncViewportAfterZoom = useCallback(
    (cy: Core) => {
      flushRenderedHitboxes(cy);
      setZoomPercent(readZoomPercent(cy));
    },
    [flushRenderedHitboxes, setZoomPercent],
  );

  const fitView = useCallback(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    const container = cy.container();
    fitGraphToAvailableViewport(
      cy,
      layout,
      container
        ? readEditorChromeInsets(container, { includeCanvasControls: true })
        : undefined,
    );
    syncViewportAfterZoom(cy);
  }, [layout, cyRef, syncViewportAfterZoom]);

  const zoomCanvas = useCallback(
    (direction: -1 | 1) => {
      const cy = cyRef.current;
      const container = cy?.container();

      if (!canZoom || !cy || !container) {
        return;
      }

      zoomCanvasToLevel(
        cy,
        container,
        nextCanvasButtonZoomLevel(cy.zoom(), direction),
      );
      syncViewportAfterZoom(cy);
    },
    [canZoom, cyRef, syncViewportAfterZoom],
  );

  const resetCanvasZoom = useCallback(() => {
    const cy = cyRef.current;
    const container = cy?.container();

    if (!canZoom || !cy || !container) {
      return;
    }

    zoomCanvasToLevel(cy, container, 1);
    syncViewportAfterZoom(cy);
  }, [canZoom, cyRef, syncViewportAfterZoom]);

  return {
    fitView,
    maxZoom: MAX_CANVAS_ZOOM,
    minZoom: MIN_CANVAS_ZOOM,
    resetCanvasZoom,
    zoomCanvas,
  };
}

function zoomCanvasToLevel(cy: Core, container: HTMLElement, level: number) {
  cy.zoom({
    level,
    renderedPosition: centerOfRect(container.getBoundingClientRect()),
  });
}

function centerOfRect(rect: DOMRect) {
  return {
    x: rect.width / 2,
    y: rect.height / 2,
  };
}
