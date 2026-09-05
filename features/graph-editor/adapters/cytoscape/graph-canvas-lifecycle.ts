"use client";

import cytoscape, { type Core } from "cytoscape";
import type { MutableRefObject, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

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
  routingReady: boolean;
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
  routingReady,
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
  const [displayReady, setDisplayReady] = useState(false);
  const [displayError, setDisplayError] = useState(false);
  const [retry, setRetry] = useState(0);
  const initialFitRef = useRef(true);
  const requestRef = useRef(0);
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

    let cy: Core;
    try {
      cy = cytoscape({
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
    } catch {
      setDisplayError(true);
      return;
    }
    initialFitRef.current = true;
    cyRef.current = cy;
    return () => {
      cy.removeAllListeners();
      cy.destroy();
      cyRef.current = null;
    };
    // Cytoscape is created once; mode/elements/arrowScale are synced by later effects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, cyRef, retry]);

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
  }, [containerRef, cyRef, retry]);

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

    document.fonts?.addEventListener("loadingdone", updateCanvasTheme);
    const observer = new MutationObserver(updateCanvasTheme);
    observer.observe(document.documentElement, {
      attributeFilter: ["data-theme"],
      attributes: true,
    });

    return () => {
      observer.disconnect();
      document.fonts?.removeEventListener("loadingdone", updateCanvasTheme);
    };
  }, [cyRef, retry]);

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

    const shouldReveal =
      initialFitRef.current || pendingFitAfterUpdateRef.current;
    const request = ++requestRef.current;
    let completed = false;
    let renderFrame: number | null = null;
    let timeout: number | null = null;
    if (shouldReveal) setDisplayReady(false);
    const reveal = () => {
      if (request !== requestRef.current || cy.destroyed()) return;
      renderFrame = requestAnimationFrame(() => {
        if (request !== requestRef.current || cy.destroyed()) return;
        flushRenderedHitboxesRef.current(cy);
        completed = true;
        setDisplayReady(true);
        setDisplayError(false);
        if (timeout !== null) clearTimeout(timeout);
      });
    };
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

    if (shouldReveal && routingReady) {
      initialFitRef.current = false;
      pendingFitAfterUpdateRef.current = false;
      // Register for this exact element/viewport request, after batched updates.
      cy.one("render", reveal);
      fitToGraph();
      cy.forceRender();
      timeout = window.setTimeout(() => {
        if (request === requestRef.current) setDisplayError(true);
      }, 10_000);
    } else {
      updateRenderedHitboxesRef.current(cy);
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (requestRef.current === request) requestRef.current = request + 1;
      cy.off("render", reveal);
      if (renderFrame !== null) cancelAnimationFrame(renderFrame);
      if (timeout !== null) clearTimeout(timeout);
      // An interrupted reveal still needs to finish for the replacement request.
      if (shouldReveal && !completed) initialFitRef.current = true;
    };
    // pendingFitAfterUpdateRef is a stable ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cyRef,
    elements,
    routingReady,
    retry,
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
  }, [cyRef, retry]);
  return {
    displayReady: displayReady && !pendingFitAfterUpdateRef.current,
    displayError,
    retryDisplay: () => {
      setDisplayReady(false);
      setDisplayError(false);
      setRetry((value) => value + 1);
    },
  };
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
