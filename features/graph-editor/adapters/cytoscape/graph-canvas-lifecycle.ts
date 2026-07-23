"use client";

import cytoscape, { type Core } from "cytoscape";
import type { MutableRefObject, RefObject } from "react";
import { useEffect, useRef } from "react";

import {
  createGraphCanvasStylesheet,
  syncCytoscapeEdgeRoutingData,
  type graphModelToCytoscapeElements,
} from "./cytoscape-adapter";
import { withCytoscapeBatch } from "./cytoscape-batch";
import type { GraphModel } from "../../core/graph/model";
import type { EdgeRoutingOptions } from "../../core/layout/edge-routing";
import type {
  EditorMode,
  SelectionState,
} from "../../shell/state/editor-state";

import {
  APP_ANIMATION_DURATION_MS,
  APP_ANIMATION_EASING,
  centerGraphOrigin,
  fitGraphToAvailableViewport,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  prefersReducedMotion,
  readCanvasPalette,
  readGraphViewportCenterX,
  readZoomPercent,
  syncCytoscapeSelection,
} from "./graph-canvas-viewport";
import { syncCytoscapeElements } from "./graph-canvas-elements-sync";

type UseGraphCanvasLifecycleOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  cyRef: MutableRefObject<Core | null>;
  elements: ReturnType<typeof graphModelToCytoscapeElements>;
  sidebarCollapsed: boolean;
  edgeRoutingOptions: EdgeRoutingOptions;
  graph: GraphModel;
  mode: EditorMode;
  selection: SelectionState;
  selectionRef: MutableRefObject<SelectionState>;
  draggingNodeIdsRef: MutableRefObject<ReadonlySet<string>>;
  pendingFitAfterUpdateRef: MutableRefObject<boolean>;
  flushRenderedHitboxes: (cy: Core) => void;
  setZoomPercent: (value: number) => void;
  suppressSelectionSyncRef: MutableRefObject<boolean>;
  updateRenderedHitboxes: (cy: Core) => void;
};

export function useGraphCanvasLifecycle({
  containerRef,
  cyRef,
  elements,
  sidebarCollapsed,
  edgeRoutingOptions,
  graph,
  mode,
  selection,
  selectionRef,
  draggingNodeIdsRef,
  pendingFitAfterUpdateRef,
  flushRenderedHitboxes,
  setZoomPercent,
  suppressSelectionSyncRef,
  updateRenderedHitboxes,
}: UseGraphCanvasLifecycleOptions) {
  const previousSidebarCollapsedRef = useRef<boolean | null>(null);
  const arrowScaleRef = useRef(graph.settings.arrowScale);
  const flushRenderedHitboxesRef = useRef(flushRenderedHitboxes);
  const setZoomPercentRef = useRef(setZoomPercent);
  const sidebarCollapsedRef = useRef(sidebarCollapsed);
  const updateRenderedHitboxesRef = useRef(updateRenderedHitboxes);
  arrowScaleRef.current = graph.settings.arrowScale;
  flushRenderedHitboxesRef.current = flushRenderedHitboxes;
  setZoomPercentRef.current = setZoomPercent;
  sidebarCollapsedRef.current = sidebarCollapsed;
  updateRenderedHitboxesRef.current = updateRenderedHitboxes;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: createGraphCanvasStylesheet(
        readCanvasPalette(),
        graph.settings.arrowScale,
      ),
      layout: { name: "preset", fit: false },
      boxSelectionEnabled: mode === "select",
      selectionType: "single",
      autoungrabify: true,
      autounselectify: mode !== "select",
      minZoom: MIN_CANVAS_ZOOM,
      maxZoom: MAX_CANVAS_ZOOM,
    });

    cyRef.current = cy;
    const initialViewportFrame = requestAnimationFrame(() => {
      if (cy.destroyed()) {
        return;
      }

      centerGraphOrigin(cy, {
        sidebarCollapsed: sidebarCollapsedRef.current,
      });
      setZoomPercentRef.current(readZoomPercent(cy));
    });

    return () => {
      cancelAnimationFrame(initialViewportFrame);
      cy.removeAllListeners();
      cy.destroy();
      cyRef.current = null;
    };
  }, [containerRef, cyRef]);

  useEffect(() => {
    const container = containerRef.current;
    const cy = cyRef.current;

    if (!container || !cy) {
      return;
    }

    const observer = new ResizeObserver(() => {
      if (cy.destroyed()) {
        return;
      }

      cy.resize();
      updateRenderedHitboxesRef.current(cy);
      setZoomPercentRef.current(readZoomPercent(cy));
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, [containerRef, cyRef]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    const updateCanvasTheme = () => {
      if (cy.destroyed()) {
        return;
      }

      cy.style(
        createGraphCanvasStylesheet(readCanvasPalette(), arrowScaleRef.current),
      );
      cy.resize();
      updateRenderedHitboxesRef.current(cy);
    };

    const observer = new MutationObserver(updateCanvasTheme);
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [cyRef]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.style(
      createGraphCanvasStylesheet(
        readCanvasPalette(),
        graph.settings.arrowScale,
      ),
    );
    cy.resize();
    updateRenderedHitboxesRef.current(cy);
  }, [cyRef, graph.settings.arrowScale]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    const fitToGraph = () => {
      cy.resize();

      if (cy.elements().length > 0) {
        fitGraphToAvailableViewport(cy, {
          sidebarCollapsed: sidebarCollapsedRef.current,
        });
      } else {
        centerGraphOrigin(cy, {
          sidebarCollapsed: sidebarCollapsedRef.current,
        });
      }

      updateRenderedHitboxesRef.current(cy);
      setZoomPercentRef.current(readZoomPercent(cy));
    };

    try {
      suppressSelectionSyncRef.current = true;

      withCytoscapeBatch(cy, () => {
        syncCytoscapeElements(cy, elements, {
          skipNodePositionIds: draggingNodeIdsRef.current,
        });
        syncDraggedEdgeRoutingPreview(
          cy,
          graph,
          edgeRoutingOptions,
          draggingNodeIdsRef.current,
        );
        syncCytoscapeSelection(cy, selectionRef.current);
      });
    } finally {
      suppressSelectionSyncRef.current = false;
    }

    cy.userZoomingEnabled(elements.length > 0);

    if (elements.length === 0) {
      pendingFitAfterUpdateRef.current = false;
      centerGraphOrigin(cy, {
        sidebarCollapsed: sidebarCollapsedRef.current,
      });
      flushRenderedHitboxesRef.current(cy);
      setZoomPercentRef.current(readZoomPercent(cy));
      return;
    }

    if (pendingFitAfterUpdateRef.current) {
      pendingFitAfterUpdateRef.current = false;
      fitToGraph();
      return;
    }

    updateRenderedHitboxesRef.current(cy);
  }, [
    cyRef,
    elements,
    edgeRoutingOptions,
    draggingNodeIdsRef,
    graph,
    selectionRef,
    suppressSelectionSyncRef,
  ]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.resize();

    const previousSidebarCollapsed = previousSidebarCollapsedRef.current;
    previousSidebarCollapsedRef.current = sidebarCollapsed;

    if (
      previousSidebarCollapsed !== null &&
      previousSidebarCollapsed !== sidebarCollapsed
    ) {
      const previousCenter = readGraphViewportCenterX(cy, {
        sidebarCollapsed: previousSidebarCollapsed,
      });
      const nextCenter = readGraphViewportCenterX(cy, {
        sidebarCollapsed,
      });

      if (previousCenter !== null && nextCenter !== null) {
        const pan = cy.pan();
        const nextPan = { x: pan.x + nextCenter - previousCenter, y: pan.y };

        if (!prefersReducedMotion()) {
          cy.stop(true, false);
          cy.animate(
            { pan: nextPan },
            {
              duration: APP_ANIMATION_DURATION_MS,
              easing: APP_ANIMATION_EASING,
            },
          );

          const timeoutId = window.setTimeout(() => {
            flushRenderedHitboxesRef.current(cy);
            setZoomPercentRef.current(readZoomPercent(cy));
          }, APP_ANIMATION_DURATION_MS + 40);

          return () => window.clearTimeout(timeoutId);
        }

        cy.pan(nextPan);
      }
    }

    flushRenderedHitboxesRef.current(cy);
    setZoomPercentRef.current(readZoomPercent(cy));
  }, [cyRef, sidebarCollapsed]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy || suppressSelectionSyncRef.current) {
      return;
    }

    try {
      suppressSelectionSyncRef.current = true;
      withCytoscapeBatch(cy, () => {
        syncCytoscapeSelection(cy, selection);
      });
    } finally {
      suppressSelectionSyncRef.current = false;
    }
  }, [cyRef, selection, suppressSelectionSyncRef]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    const updateCanvasOverlay = () => {
      if (cy.destroyed()) {
        return;
      }

      updateRenderedHitboxesRef.current(cy);
    };
    const updateZoomOverlay = () => {
      if (cy.destroyed()) {
        return;
      }

      updateRenderedHitboxesRef.current(cy);
      setZoomPercentRef.current(readZoomPercent(cy));
    };

    cy.on("pan", updateCanvasOverlay);
    cy.on("zoom resize", updateZoomOverlay);

    return () => {
      if (!cy.destroyed()) {
        cy.off("pan", updateCanvasOverlay);
        cy.off("zoom resize", updateZoomOverlay);
      }
    };
  }, [cyRef]);
}

function syncDraggedEdgeRoutingPreview(
  cy: Core,
  graph: GraphModel,
  edgeRoutingOptions: EdgeRoutingOptions,
  draggingNodeIds: ReadonlySet<string>,
) {
  if (draggingNodeIds.size === 0 || edgeRoutingOptions.mode !== "quality") {
    return;
  }

  syncCytoscapeEdgeRoutingData(cy, graph, edgeRoutingOptions);
}
