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
import type { SelectionState } from "../../core/view/types";
import type { EditorMode } from "../../shell/state/editor-state";
import type { GraphCanvasChrome } from "../../core/view/types";

import {
  centerGraphOrigin,
  fitGraphToAvailableViewport,
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  readCanvasPalette,
  readZoomPercent,
  syncCytoscapeSelection,
} from "./graph-canvas-viewport";
import { withSuppressedSelectionSync } from "./selection-sync-guard";
import { syncCytoscapeElements } from "./graph-canvas-elements-sync";

type UseGraphCanvasLifecycleOptions = {
  containerRef: RefObject<HTMLDivElement | null>;
  cyRef: MutableRefObject<Core | null>;
  elements: ReturnType<typeof graphModelToCytoscapeElements>;
  chrome: GraphCanvasChrome;
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
  panRenderedHitboxes: (cy: Core) => void;
};

export function useGraphCanvasLifecycle({
  containerRef,
  cyRef,
  elements,
  chrome,
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
  panRenderedHitboxes,
}: UseGraphCanvasLifecycleOptions) {
  const arrowScaleRef = useRef(graph.settings.arrowScale);
  const flushRenderedHitboxesRef = useRef(flushRenderedHitboxes);
  const setZoomPercentRef = useRef(setZoomPercent);
  const chromeRef = useRef(chrome);
  const updateRenderedHitboxesRef = useRef(updateRenderedHitboxes);
  const panRenderedHitboxesRef = useRef(panRenderedHitboxes);
  arrowScaleRef.current = graph.settings.arrowScale;
  flushRenderedHitboxesRef.current = flushRenderedHitboxes;
  setZoomPercentRef.current = setZoomPercent;
  chromeRef.current = chrome;
  updateRenderedHitboxesRef.current = updateRenderedHitboxes;
  panRenderedHitboxesRef.current = panRenderedHitboxes;

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

      if (cy.elements().length > 0) {
        fitGraphToAvailableViewport(cy, chromeRef.current);
      } else {
        centerGraphOrigin(cy, chromeRef.current);
      }
      updateRenderedHitboxesRef.current(cy);
      setZoomPercentRef.current(readZoomPercent(cy));
    });

    return () => {
      cancelAnimationFrame(initialViewportFrame);
      cy.removeAllListeners();
      cy.destroy();
      cyRef.current = null;
    };
    // Cytoscape is created once; mode/elements/arrowScale are synced by later effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        fitGraphToAvailableViewport(cy, chromeRef.current);
      } else {
        centerGraphOrigin(cy, chromeRef.current);
      }

      updateRenderedHitboxesRef.current(cy);
      setZoomPercentRef.current(readZoomPercent(cy));
    };

    withSuppressedSelectionSync(suppressSelectionSyncRef, () => {
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
    });

    cy.userZoomingEnabled(elements.length > 0);

    if (elements.length === 0) {
      pendingFitAfterUpdateRef.current = false;
      centerGraphOrigin(cy, chromeRef.current);
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
    // pendingFitAfterUpdateRef is a stable ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    flushRenderedHitboxesRef.current(cy);
    setZoomPercentRef.current(readZoomPercent(cy));
  }, [cyRef, chrome]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy || suppressSelectionSyncRef.current) {
      return;
    }

    withSuppressedSelectionSync(suppressSelectionSyncRef, () => {
      withCytoscapeBatch(cy, () => {
        syncCytoscapeSelection(cy, selection);
      });
    });
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

      panRenderedHitboxesRef.current(cy);
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
