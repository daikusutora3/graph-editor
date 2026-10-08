"use client";

import cytoscape, { type Core } from "cytoscape";
import type { MutableRefObject, RefObject } from "react";
import { useEffect, useRef, useState } from "react";

import {
  createGraphCanvasStylesheet,
  type graphModelToCytoscapeElements,
} from "./cytoscape-adapter";
import { withCytoscapeBatch } from "./cytoscape-batch";
import type { GraphModel } from "../../core/graph/model";
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
import { refreshCytoscapeGeometry } from "./graph-canvas-geometry-refresh";
import { afterCytoscapeRender } from "./graph-canvas-render-request";
import { startVisibleTimeout } from "../browser/visible-timeout";

import type { CanvasFitRequest } from "../../canvas/GraphCanvasProvider";

type UseGraphCanvasLifecycleOptions = {
  routingReady: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  cyRef: MutableRefObject<Core | null>;
  elements: ReturnType<typeof graphModelToCytoscapeElements>;
  chrome: GraphCanvasChrome;
  graph: GraphModel;
  mode: EditorMode;
  selection: SelectionState;
  selectionRef: MutableRefObject<SelectionState>;
  draggingNodeIdsRef: MutableRefObject<ReadonlySet<string>>;
  fitRequest: CanvasFitRequest | null;
  completeFit: (id: number) => void;
  flushRenderedHitboxes: (cy: Core) => void;
  setZoomPercent: (value: number) => void;
  notifyViewportSignature: (value: string) => void;
  notifyExportScaleSignature: (value: string) => void;
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
  graph,
  mode,
  selection,
  selectionRef,
  draggingNodeIdsRef,
  fitRequest,
  completeFit,
  flushRenderedHitboxes,
  setZoomPercent,
  notifyViewportSignature,
  notifyExportScaleSignature,
  suppressSelectionSyncRef,
  updateRenderedHitboxes,
  panRenderedHitboxes,
}: UseGraphCanvasLifecycleOptions) {
  const [displayReady, setDisplayReady] = useState(false);
  const [displayError, setDisplayError] = useState(false);
  const [paintedElements, setPaintedElements] = useState<
    typeof elements | null
  >(null);
  const paintedElementsRef = useRef<typeof elements | null>(null);
  const initialGeometryRef = useRef(true);
  const initialFitRef = useRef(true);
  const requestRef = useRef(0);
  const arrowScaleRef = useRef(graph.settings.arrowScale);
  const flushRenderedHitboxesRef = useRef(flushRenderedHitboxes);
  const setZoomPercentRef = useRef(setZoomPercent);
  const notifyViewportSignatureRef = useRef(notifyViewportSignature);
  const notifyExportScaleSignatureRef = useRef(notifyExportScaleSignature);
  const chromeRef = useRef(chrome);
  const updateRenderedHitboxesRef = useRef(updateRenderedHitboxes);
  const panRenderedHitboxesRef = useRef(panRenderedHitboxes);
  arrowScaleRef.current = graph.settings.arrowScale;
  flushRenderedHitboxesRef.current = flushRenderedHitboxes;
  setZoomPercentRef.current = setZoomPercent;
  notifyViewportSignatureRef.current = notifyViewportSignature;
  notifyExportScaleSignatureRef.current = notifyExportScaleSignature;
  chromeRef.current = chrome;
  updateRenderedHitboxesRef.current = updateRenderedHitboxes;
  panRenderedHitboxesRef.current = panRenderedHitboxes;

  useEffect(() => {
    if (!fitRequest) return;
    return startVisibleTimeout(() => completeFit(fitRequest.id), 10_000);
  }, [fitRequest, completeFit]);

  useEffect(() => {
    if (displayReady) return;
    return startVisibleTimeout(() => setDisplayError(true), 10_000);
  }, [displayReady]);

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
    initialGeometryRef.current = true;
    paintedElementsRef.current = null;
    setPaintedElements(null);
    setDisplayReady(false);
    setDisplayError(false);
    cyRef.current = cy;
    return () => {
      requestRef.current++;
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
      refreshCytoscapeGeometry(cy.elements());
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
    refreshCytoscapeGeometry(cy.collection(cy.edges()));
    cy.resize();
    updateRenderedHitboxesRef.current(cy);
  }, [cyRef, graph.settings.arrowScale]);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    const shouldReveal = initialFitRef.current;
    const shouldFit = fitRequest?.graph === graph;
    if (fitRequest && !shouldFit) completeFit(fitRequest.id);
    const request = ++requestRef.current;
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

    const synced = withSuppressedSelectionSync(suppressSelectionSyncRef, () =>
      withCytoscapeBatch(cy, () => {
        const result = syncCytoscapeElements(cy, elements, {
          skipNodePositionIds: draggingNodeIdsRef.current,
        });
        syncCytoscapeSelection(cy, selectionRef.current);
        return result;
      }),
    );

    cy.userZoomingEnabled(elements.length > 0);

    const needsPaint =
      shouldReveal || shouldFit || paintedElementsRef.current !== elements;
    const cancelRender =
      routingReady && needsPaint
        ? afterCytoscapeRender(
            cy,
            () => request === requestRef.current,
            () => {
              flushRenderedHitboxesRef.current(cy);
              paintedElementsRef.current = elements;
              setPaintedElements(elements);
              initialFitRef.current = false;
              setDisplayReady(true);
              setDisplayError(false);
              if (shouldFit && fitRequest) completeFit(fitRequest.id);
            },
          )
        : null;

    // Refresh after the batch and before fit/hitbox reads. Initialization needs
    // one full projection; subsequent requests touch only changed neighbours.
    refreshCytoscapeGeometry(
      initialGeometryRef.current ? cy.elements() : synced.changedElements,
    );
    initialGeometryRef.current = false;

    if (routingReady && needsPaint) {
      if (shouldReveal || shouldFit) fitToGraph();
      cy.forceRender();
    } else {
      updateRenderedHitboxesRef.current(cy);
    }
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      if (requestRef.current === request) requestRef.current = request + 1;
      cancelRender?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    cyRef,
    elements,
    routingReady,
    fitRequest,
    completeFit,
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

    const updateExportSnapshots = () => {
      if (cy.destroyed()) return;
      notifyViewportSignatureRef.current(readViewportSignature(cy));
      notifyExportScaleSignatureRef.current(readExportScaleSignature(cy));
    };
    const updateCanvasOverlay = () => {
      if (cy.destroyed()) {
        return;
      }

      panRenderedHitboxesRef.current(cy);
      notifyViewportSignatureRef.current(readViewportSignature(cy));
    };
    const updateZoomOverlay = () => {
      if (cy.destroyed()) {
        return;
      }

      updateRenderedHitboxesRef.current(cy);
      setZoomPercentRef.current(readZoomPercent(cy));
      updateExportSnapshots();
    };

    const canvasWindow = cy.container()?.ownerDocument.defaultView ?? window;
    let resolutionQuery: MediaQueryList | null = null;
    const watchResolution = () => {
      resolutionQuery?.removeEventListener("change", updateResolution);
      resolutionQuery = canvasWindow.matchMedia(
        `(resolution: ${readCanvasPixelRatio(cy)}dppx)`,
      );
      resolutionQuery.addEventListener("change", updateResolution);
    };
    const updateResolution = () => {
      updateExportSnapshots();
      // The previous density query stays false after the first change. Rebind
      // at the new density so later monitor or browser zoom changes also notify.
      watchResolution();
    };

    updateExportSnapshots();
    watchResolution();
    canvasWindow.addEventListener("resize", updateExportSnapshots);
    cy.on("pan", updateCanvasOverlay);
    cy.on("zoom resize", updateZoomOverlay);

    return () => {
      canvasWindow.removeEventListener("resize", updateExportSnapshots);
      resolutionQuery?.removeEventListener("change", updateResolution);
      if (!cy.destroyed()) {
        cy.off("pan", updateCanvasOverlay);
        cy.off("zoom resize", updateZoomOverlay);
      }
    };
  }, [cyRef]);
  return {
    displayReady,
    displayError,
    renderReady: routingReady && paintedElements === elements,
  };
}

function readViewportSignature(cy: Core) {
  const pan = cy.pan();
  // Stable primitive values avoid notifying on unchanged resize events and
  // retain zoom precision beyond the rounded percentage used by the controls.
  return JSON.stringify([
    cy.zoom(),
    pan.x,
    pan.y,
    cy.width(),
    cy.height(),
    readCanvasPixelRatio(cy),
  ]);
}

function readExportScaleSignature(cy: Core) {
  return JSON.stringify([cy.zoom(), readCanvasPixelRatio(cy)]);
}

function readCanvasPixelRatio(cy: Core) {
  return cy.container()?.ownerDocument.defaultView?.devicePixelRatio || 1;
}
