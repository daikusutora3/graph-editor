"use client";

import type { Core } from "cytoscape";
import type { MutableRefObject } from "react";
import { useCallback } from "react";

import {
  clamp,
  fitGraphToAvailableViewport,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  readZoomPercent,
  ZOOM_STEP,
} from "../adapters/cytoscape/graph-canvas-viewport";

import type { GraphCanvasChrome } from "./graph-canvas-types";

type GraphCanvasViewportActionsOptions = {
  canZoom: boolean;
  chrome: GraphCanvasChrome;
  cyRef: MutableRefObject<Core | null>;
  flushRenderedHitboxes: (cy: Core) => void;
  setZoomPercent: (zoomPercent: number) => void;
};

const ZOOM_BUTTON_STEP_PERCENT = ZOOM_STEP * 100;

export function useGraphCanvasViewportActions({
  canZoom,
  chrome,
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

    cy.resize();
    fitGraphToAvailableViewport(cy, chrome);
    syncViewportAfterZoom(cy);
  }, [chrome, cyRef, syncViewportAfterZoom]);

  const zoomCanvas = useCallback(
    (delta: number) => {
      const cy = cyRef.current;
      const container = cy?.container();

      if (!canZoom || !cy || !container) {
        return;
      }

      const direction = Math.sign(delta);

      if (direction === 0) {
        return;
      }

      zoomCanvasToLevel(cy, getNextButtonZoomLevel(cy.zoom(), direction));
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

    const rect = container.getBoundingClientRect();

    cy.zoom({ level: 1, renderedPosition: centerOfRect(rect) });

    syncViewportAfterZoom(cy);
  }, [canZoom, cyRef, syncViewportAfterZoom]);

  return {
    fitView,
    maxZoom: MAX_CANVAS_ZOOM,
    minZoom: MIN_CANVAS_ZOOM,
    resetCanvasZoom,
    zoomCanvas,
    zoomStep: ZOOM_STEP,
  };
}

function zoomCanvasToLevel(cy: Core, level: number) {
  const container = cy.container();

  if (!container) {
    return;
  }

  cy.zoom({
    level,
    renderedPosition: centerOfRect(container.getBoundingClientRect()),
  });
}

function getNextButtonZoomLevel(currentZoom: number, direction: number) {
  const currentPercent = currentZoom * 100;
  const nextPercent =
    direction > 0
      ? Math.floor(currentPercent / ZOOM_BUTTON_STEP_PERCENT) *
          ZOOM_BUTTON_STEP_PERCENT +
        ZOOM_BUTTON_STEP_PERCENT
      : Math.ceil(currentPercent / ZOOM_BUTTON_STEP_PERCENT) *
          ZOOM_BUTTON_STEP_PERCENT -
        ZOOM_BUTTON_STEP_PERCENT;

  return clamp(nextPercent / 100, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM);
}

function centerOfRect(rect: DOMRect) {
  return {
    x: rect.width / 2,
    y: rect.height / 2,
  };
}
