"use client";
import { edgeRoutingProgress } from "../core/layout/edge-routing";
import { integrityCopy } from "../i18n/integrity-copy";

import type { Core } from "cytoscape";
import { useAtom, useAtomValue, useSetAtom } from "jotai";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { graphModelToCytoscapeElements } from "../adapters/cytoscape/cytoscape-adapter";
import { updateEdgeCommand } from "../core/graph/graph-intents";

import type { NodeId } from "../core/graph/model";
import {
  edgeDraftAtom,
  editorLayoutAtom,
  editorModeAtom,
  editorPanelAtom,
  selectionAtom,
} from "../shell/state/editor-atoms";
import { graphAtom } from "../shell/state/graph-atoms";
import {
  deleteSelectionAtom,
  executeCommandAtom,
} from "../shell/state/history-atoms";

import { SelectionActionBar } from "./SelectionActionBar";
import { GraphContextMenu } from "./GraphContextMenu";
import { useGraphCanvasContextActions } from "./graph-canvas-context-actions";
import type {
  GraphCanvasChrome,
  GraphContextMenuTarget,
} from "./graph-canvas-types";
import { getGraphCanvasViewState } from "./graph-canvas-view-state";
import type { RenderedPoint } from "./graph-canvas-types";
import { useEditFeedback } from "./graph-canvas-edit-feedback";
import { useHtmlNodeDrag } from "./graph-canvas-html-node-drag";
import { useGraphImageExport } from "../adapters/cytoscape/graph-canvas-image-export";
import { useCytoscapeInteractionEvents } from "./graph-canvas-interaction-events";
import { useGraphInlineEdit } from "./graph-canvas-inline-edit-state";
import { useGraphCanvasLifecycle } from "../adapters/cytoscape/graph-canvas-lifecycle";
import { useGraphCanvasModeEffects } from "./graph-canvas-mode-effects";
import { useRenderedHitboxes } from "./graph-canvas-rendered-hitboxes";
import { useGraphCanvasSelectionActions } from "./graph-canvas-selection-actions";
import { useRangeSelectionPointerForwarding } from "./graph-canvas-range-selection-forwarding";
import { useRangeSelectionPreview } from "./graph-canvas-range-selection-preview";
import { useGraphCanvasViewportActions } from "./graph-canvas-viewport-actions";
import { useEdgeRoutingMeta } from "./use-edge-routing-meta";
import { useGraphEditingActions } from "./use-graph-editing-actions";
import { useRangeSelectionKey } from "./use-range-selection-key";
import { nudgeEdgeBend } from "../core/layout/edge-route-geometry";
import { describeSelection } from "./selection-actions";
import { useI18n } from "../i18n/I18nProvider";
import { useAnimatedNullableState } from "../ui/hooks/use-panel-presence";
import {
  type EdgeBend,
  EdgeNodeHitboxes,
  SelectEdgeHitboxes,
  SelectNodeHitboxes,
} from "./GraphCanvasHitboxOverlays";
import {
  EdgeDraftLine,
  EditFeedbackNodes,
  FitToViewButton,
  InlineEditForm,
  ZoomBadge,
  ZoomControls,
} from "./GraphCanvasOverlays";
import { useGraphCanvasApi } from "./GraphCanvasProvider";

/** Graph px added per "bend" menu action. */
const BEND_STEP_PX = 48;

export function GraphCanvas() {
  const [attempt, setAttempt] = useState(0);
  const retryDisplay = useCallback(() => setAttempt((value) => value + 1), []);
  return <GraphCanvasSession key={attempt} retryDisplay={retryDisplay} />;
}

function GraphCanvasSession({ retryDisplay }: { retryDisplay: () => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const draggingNodeIdsRef = useRef<ReadonlySet<NodeId>>(new Set());
  const suppressSelectionSyncRef = useRef(false);
  const [edgeCursor, setEdgeCursor] = useState<RenderedPoint | null>(null);
  const [edgeHoverNodeId, setEdgeHoverNodeId] = useState<NodeId | null>(null);
  const rangeSelectionKeyActive = useRangeSelectionKey();
  const [zoomPercent, setZoomPercent] = useState(100);
  const {
    openValue: contextMenuTarget,
    panelPresence: contextMenuPresence,
    setValue: setContextMenuTarget,
  } = useAnimatedNullableState<GraphContextMenuTarget>();

  const graph = useAtomValue(graphAtom);
  const layout = useAtomValue(editorLayoutAtom);
  const panelOpen = useAtomValue(editorPanelAtom) !== null;
  const mode = useAtomValue(editorModeAtom);
  const [edgeDraft, setEdgeDraft] = useAtom(edgeDraftAtom);
  const selection = useAtomValue(selectionAtom);
  const setSelection = useSetAtom(selectionAtom);
  const executeCommand = useSetAtom(executeCommandAtom);
  const deleteSelection = useSetAtom(deleteSelectionAtom);
  const { registerGraphCanvasApi, fitRequest, completeFit } =
    useGraphCanvasApi();

  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  const chrome = useMemo<GraphCanvasChrome>(() => ({ layout }), [layout]);

  const exportPng = useGraphImageExport({
    cyRef,
    selectionRef,
    suppressSelectionSyncRef,
  });
  const { editFeedback, showEditFeedback } = useEditFeedback();
  const {
    edgeLabelHitboxes,
    flushRenderedHitboxes,
    hitboxLayerRef,
    isGraphOutOfView,
    nodeHitboxes,
    panRenderedHitboxes,
    updateRenderedHitboxes,
  } = useRenderedHitboxes({ chrome, graph, mode });
  const isGraphOutOfViewRef = useRef(isGraphOutOfView);
  isGraphOutOfViewRef.current = isGraphOutOfView;

  const {
    edgeRoutingMeta,
    edgeRoutingOptions,
    acceptRoutingMeta,
    routingReady,
  } = useEdgeRoutingMeta(graph);

  const elements = useMemo(() => {
    return graphModelToCytoscapeElements(graph, {
      edgeRoutingMeta,
      edgeRoutingOptions,
    });
  }, [edgeRoutingMeta, edgeRoutingOptions, graph]);
  const graphHasElements = elements.length > 0;
  const routingProgress = edgeRoutingProgress(edgeRoutingMeta);

  useEffect(() => {
    if (mode !== "edge") {
      setEdgeCursor(null);
      setEdgeHoverNodeId(null);
    }
  }, [mode]);

  const { addNodeAtGraphPosition, drawEdgeFromNode } = useGraphEditingActions({
    edgeDraft,
    executeCommand,
    graph,
    setEdgeDraft,
    showEditFeedback,
  });

  const {
    renderedPointFromPointer,
    selectEdge,
    selectNode,
    syncContextSelection,
  } = useGraphCanvasSelectionActions({
    containerRef,
    selectionRef,
    setSelection,
  });

  const updateZoomPercent = useCallback((nextZoomPercent: number) => {
    setZoomPercent((current) =>
      current === nextZoomPercent ? current : nextZoomPercent,
    );
  }, []);

  const { displayReady, displayError } = useGraphCanvasLifecycle({
    routingReady,
    containerRef,
    cyRef,
    elements,
    chrome,
    graph,
    mode,
    fitRequest,
    completeFit,
    draggingNodeIdsRef,
    selection,
    selectionRef,
    flushRenderedHitboxes,
    setZoomPercent: updateZoomPercent,
    suppressSelectionSyncRef,
    updateRenderedHitboxes,
    panRenderedHitboxes,
  });

  const inlineEditState = useGraphInlineEdit({
    contextMenuTarget,
    cyRef,
    edgeLabelHitboxes,
    executeCommand,
    graph,
    mode,
    nodeHitboxes,
    selection,
    setContextMenuTarget,
    syncContextSelection,
    zoomPercent,
  });
  const {
    actions: inlineEditActions,
    cancelInlineEdit,
    composingRef: inlineEditComposingRef,
    edit: inlineEdit,
    inputRef: inlineLabelInputRef,
    openEdgeInlineEdit,
    openNodeLabelEdit,
    position: inlineEditPosition,
    setInlineEdit,
    style: inlineEditStyle,
  } = inlineEditState;

  useGraphCanvasModeEffects({
    cyRef,
    edgeDraft,
    graph,
    mode,
    setContextMenuTarget,
    setEdgeDraft,
    setInlineEdit,
    setSelection,
  });

  const htmlNodeDrag = useHtmlNodeDrag({
    acceptRoutingMeta,
    cyRef,
    draggingNodeIdsRef,
    edgeRoutingMeta,
    edgeRoutingOptions,
    executeCommand,
    graph,
    selectionRef,
    setSelection,
    updateRenderedHitboxes,
  });

  useEffect(() => {
    if (mode !== "select") {
      htmlNodeDrag.cancel();
    }
  }, [htmlNodeDrag, mode]);

  const { fitView, maxZoom, minZoom, resetCanvasZoom, zoomCanvas, zoomStep } =
    useGraphCanvasViewportActions({
      canZoom: graphHasElements,
      chrome,
      cyRef,
      flushRenderedHitboxes,
      setZoomPercent: updateZoomPercent,
    });

  const editSelectedNode = useCallback(() => {
    const nodeId = selectionRef.current.nodeIds[0];
    const hitbox = nodeHitboxes.find((node) => node.id === nodeId);

    if (nodeId && hitbox) {
      openNodeLabelEdit(nodeId, { x: hitbox.x, y: hitbox.y });
    }
  }, [nodeHitboxes, openNodeLabelEdit]);
  const editSelectedEdge = useCallback(() => {
    const edgeId = selectionRef.current.edgeIds[0];
    const hitbox = edgeLabelHitboxes.find((edge) => edge.id === edgeId);

    if (edgeId && hitbox) {
      openEdgeInlineEdit(edgeId, { x: hitbox.x, y: hitbox.y });
    }
  }, [edgeLabelHitboxes, openEdgeInlineEdit]);
  const editSelection = useCallback(() => {
    const current = selectionRef.current;

    if (current.nodeIds.length === 1 && current.edgeIds.length === 0) {
      editSelectedNode();
      return true;
    }

    if (current.edgeIds.length === 1 && current.nodeIds.length === 0) {
      editSelectedEdge();
      return true;
    }

    return false;
  }, [editSelectedEdge, editSelectedNode]);

  useEffect(() => {
    registerGraphCanvasApi({
      editSelection,
      fitView,
      exportPng,
      resetZoom: resetCanvasZoom,
      isGraphOutOfView: () => isGraphOutOfViewRef.current,
    });

    return () => registerGraphCanvasApi(null);
  }, [
    editSelection,
    exportPng,
    fitView,
    registerGraphCanvasApi,
    resetCanvasZoom,
  ]);

  useEffect(() => {
    const cy = cyRef.current;

    if (cy && !cy.destroyed()) {
      flushRenderedHitboxes(cy);
    }
  }, [flushRenderedHitboxes, mode]);

  const {
    deleteContextSelection,
    openEdgeContextMenu,
    openNodeContextMenu,
    reverseSelectionEdges,
    setSelectionEdgeColor,
    setSelectionNodeColor,
  } = useGraphCanvasContextActions({
    cancelInlineEdit,
    deleteSelection,
    executeCommand,
    setContextMenuTarget,
    syncContextSelection,
  });

  useCytoscapeInteractionEvents({
    cyRef,
    mode,
    onPlaceNode: addNodeAtGraphPosition,
    setContextMenuTarget,
    setEdgeDraft,
    setSelection,
  });

  const viewState = getGraphCanvasViewState({
    edgeCursor,
    edgeDraft,
    edgeHoverNodeId,
    editFeedback,
    graph,
    inlineEditActive: Boolean(inlineEdit),
    nodeHitboxes,
    selection,
  });
  const rangeSelectionActive =
    mode === "select" && rangeSelectionKeyActive && !inlineEdit;
  const previewEdgeBow = useCallback(
    (edgeId: string, bend: EdgeBend) => {
      const edge = cyRef.current?.getElementById(edgeId);

      if (!edge || edge.empty() || !edge.isEdge()) {
        return null;
      }

      edge.data({
        bow: bend.bowPx,
        controlPointDistances: [bend.bowPx],
        controlPointWeights: [bend.bowT],
      });

      const midpoint = edge.renderedMidpoint();

      return Number.isFinite(midpoint.x) && Number.isFinite(midpoint.y)
        ? { x: midpoint.x, y: midpoint.y }
        : null;
    },
    [cyRef],
  );
  const restoreEdgeRouting = useCallback(
    (edgeId: string) => {
      const meta = edgeRoutingMeta.get(edgeId);
      const edge = cyRef.current?.getElementById(edgeId);

      if (!meta || !edge || edge.empty() || !edge.isEdge()) {
        return;
      }

      edge.data({
        bow: meta.bowPx,
        controlPointDistances: meta.controlPointDistancesPx,
        controlPointWeights: meta.controlPointWeights,
      });
    },
    [cyRef, edgeRoutingMeta],
  );
  const { messages, locale } = useI18n();
  const selectedNodeIdSet = useMemo(
    () => new Set(selection.nodeIds),
    [selection.nodeIds],
  );
  const selectedEdgeIdSet = useMemo(
    () => new Set(selection.edgeIds),
    [selection.edgeIds],
  );
  const selectionSummary =
    selection.nodeIds.length > 0 || selection.edgeIds.length > 0
      ? describeSelection(graph, selection, messages)
      : "";
  // Menu/keyboard bend: nudge the curve sideways, keeping its position.
  const bendEdgeBy = useCallback(
    (edgeId: string, direction: -1 | 1) => {
      const edge = graph.edges.find((candidate) => candidate.id === edgeId);
      if (!edge) return;
      const rendered = cyRef.current?.getElementById(edgeId);
      const routing = nudgeEdgeBend(
        edge.routing,
        rendered && !rendered.empty()
          ? {
              controlPointDistancesPx: rendered.data("controlPointDistances"),
              controlPointWeights: rendered.data("controlPointWeights"),
            }
          : undefined,
        direction * BEND_STEP_PX,
      );
      if (routing) executeCommand(updateEdgeCommand(edgeId, { routing }));
    },
    [executeCommand, graph.edges],
  );
  const handleCanvasClick = useCallback(() => {
    setContextMenuTarget(null);
  }, [setContextMenuTarget]);
  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (mode !== "edge") {
        return;
      }

      if (
        event.target instanceof Element &&
        event.target.closest("[data-edge-node-hitbox='true']")
      ) {
        return;
      }

      setEdgeCursor(renderedPointFromPointer(event));
    },
    [mode, renderedPointFromPointer],
  );
  const handleCanvasPointerLeave = useCallback(() => {
    if (mode === "edge") {
      setEdgeCursor(null);
    }
  }, [mode]);
  const previewRangeSelectionPointerDown = useRangeSelectionPreview({
    containerRef,
    cyRef,
    enabled: mode === "select" && !inlineEdit,
  });
  const forwardRangeSelectionPointerDown = useRangeSelectionPointerForwarding({
    containerRef,
    enabled: mode === "select" && !inlineEdit,
  });
  const handleRangeSelectionPointerDown = useCallback(
    (event: ReactPointerEvent<Element>) => {
      previewRangeSelectionPointerDown(event);
      return forwardRangeSelectionPointerDown(event);
    },
    [forwardRangeSelectionPointerDown, previewRangeSelectionPointerDown],
  );

  return (
    <>
      {!displayReady ? (
        <div
          role="status"
          className="absolute inset-0 grid place-items-center bg-[var(--bg)] text-sm text-[var(--muted)]"
        >
          {displayError ? (
            <button onClick={retryDisplay}>
              {integrityCopy[locale === "ja" ? "ja" : "en"].renderFailed}{" "}
              {integrityCopy[locale === "ja" ? "ja" : "en"].retry}
            </button>
          ) : (
            integrityCopy[locale === "ja" ? "ja" : "en"].loading
          )}
        </div>
      ) : null}
      {graph.settings.autoEdgeRouting &&
      (routingProgress.pendingEdgeIds.length ||
        routingProgress.unresolvedEdgeIds.length) ? (
        <p
          role="status"
          className="pointer-events-none absolute bottom-20 left-4 z-20 max-w-[calc(100%-32px)] rounded bg-[var(--panel-solid)] px-2 py-1 text-xs text-[var(--muted)]"
        >
          {routingProgress.pendingEdgeIds.length
            ? integrityCopy[locale === "ja" ? "ja" : "en"].pendingRoutes(
                routingProgress.pendingEdgeIds.length,
              )
            : integrityCopy[locale === "ja" ? "ja" : "en"].unresolvedRoutes(
                routingProgress.unresolvedEdgeIds.length,
              )}
        </p>
      ) : null}
      <div
        data-canvas-ready={displayReady}
        style={{ visibility: displayReady ? "visible" : "hidden" }}
        inert={!displayReady}
        className={[
          "relative h-full min-h-0 w-full overflow-hidden bg-[var(--bg)]",
          "touch-none",
          mode === "edge" || mode === "node" ? "cursor-crosshair" : "",
        ].join(" ")}
        onClick={handleCanvasClick}
        onContextMenu={(event) => event.preventDefault()}
        onPointerLeave={handleCanvasPointerLeave}
        onPointerMove={handleCanvasPointerMove}
      >
        <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,var(--grid)_1px,transparent_1.4px)] [background-size:24px_24px]" />
        <div
          ref={containerRef}
          className="relative z-10 h-full w-full"
          onPointerDownCapture={previewRangeSelectionPointerDown}
        />
        <ZoomBadge visible={layout === "mobile"} zoomPercent={zoomPercent} />
        {/* Announces what is selected to assistive tech; visually hidden. */}
        <div role="status" aria-live="polite" className="sr-only">
          {selectionSummary}
        </div>
        {(() => {
          const selectionBar =
            mode === "select" &&
            viewState.showSelectionActionBar &&
            !panelOpen ? (
              <SelectionActionBar
                graph={graph}
                selection={selection}
                chrome={chrome}
                onSetNodeColor={setSelectionNodeColor}
                onSetEdgeColor={setSelectionEdgeColor}
                onReverseEdges={reverseSelectionEdges}
                onResetEdgeCurve={(edgeId) =>
                  executeCommand(
                    updateEdgeCommand(edgeId, { routing: undefined }),
                  )
                }
                onEditSelectedNode={editSelectedNode}
                onEditSelectedEdge={editSelectedEdge}
                onDeleteSelection={() => deleteSelection(selection)}
              />
            ) : null;

          if (layout !== "mobile") {
            // Desktop bottom row mirrors the top row: a three-column grid keeps
            // the centered selection bar and the zoom pill from overlapping.
            return (
              <div className="pointer-events-none absolute inset-x-6 bottom-6 z-40 grid grid-cols-[1fr_auto_1fr] items-end gap-3">
                <span />
                <div className="flex justify-center">{selectionBar}</div>
                <div className="flex justify-end">
                  <ZoomControls
                    disabled={!graphHasElements}
                    minZoom={minZoom}
                    maxZoom={maxZoom}
                    zoomPercent={zoomPercent}
                    zoomStep={zoomStep}
                    onFitView={fitView}
                    onZoom={zoomCanvas}
                    onResetZoom={resetCanvasZoom}
                  />
                </div>
              </div>
            );
          }

          // Mobile: pinch handles zoom, so the pill is replaced by a rescue
          // "fit" button that only appears when the graph is off-screen. The
          // stack keeps it clear of the selection bar and the bottom toolbar.
          return (
            <div className="pointer-events-none absolute inset-x-3 bottom-[92px] z-40 flex flex-col items-stretch gap-2">
              {isGraphOutOfView ? (
                <div className="flex justify-end">
                  <FitToViewButton onFitView={fitView} />
                </div>
              ) : null}
              {selectionBar}
            </div>
          );
        })()}
        <div
          ref={hitboxLayerRef}
          className="pointer-events-none absolute inset-0 z-20 will-change-transform"
        >
          {mode === "edge" ? (
            <>
              <EdgeDraftLine
                segment={viewState.edgeDraftSegment}
                hasError={Boolean(viewState.edgeCandidateError)}
                showTargetMarker={!edgeHoverNodeId}
              />
            </>
          ) : null}
          <EditFeedbackNodes
            feedbackId={editFeedback?.id ?? null}
            nodes={viewState.feedbackNodeHitboxes}
          />
          <InlineEditForm
            edit={inlineEdit}
            inputRef={inlineLabelInputRef}
            isComposingRef={inlineEditComposingRef}
            position={inlineEditPosition}
            style={inlineEditStyle}
            onCancel={inlineEditActions.onCancel}
            onCommit={inlineEditActions.onCommit}
            onValueChange={inlineEditActions.onValueChange}
          />
          {mode === "edge" ? (
            <EdgeNodeHitboxes
              nodes={nodeHitboxes}
              sourceNodeId={edgeDraft.sourceNodeId}
              onPointerEnter={(node) => {
                setEdgeCursor({ x: node.x, y: node.y });
                setEdgeHoverNodeId(node.id);
              }}
              onPointerLeave={(nodeId) => {
                setEdgeCursor(null);
                setEdgeHoverNodeId((current) =>
                  current === nodeId ? null : current,
                );
              }}
              onConnect={drawEdgeFromNode}
              onContextMenu={(node) =>
                openNodeContextMenu(node.id, { x: node.x, y: node.y })
              }
            />
          ) : null}
          {mode === "select" ? (
            <>
              <SelectEdgeHitboxes
                edges={edgeLabelHitboxes}
                selectedEdgeIds={selectedEdgeIdSet}
                rangeSelectionActive={rangeSelectionActive}
                weighted={graph.settings.weighted}
                onSelect={selectEdge}
                onEdit={openEdgeInlineEdit}
                zoom={zoomPercent / 100}
                onBendPreview={previewEdgeBow}
                onBendCommit={(edgeId, bend) => {
                  const result = executeCommand(
                    updateEdgeCommand(edgeId, {
                      routing: { bowPx: bend.bowPx, bowT: bend.bowT },
                    }),
                  );
                  if (result.status === "rejected") restoreEdgeRouting(edgeId);
                }}
                onBendCancel={restoreEdgeRouting}
                onRangeSelectionPointerDown={handleRangeSelectionPointerDown}
                onContextMenu={openEdgeContextMenu}
              />
              <SelectNodeHitboxes
                nodes={nodeHitboxes}
                selectedNodeIds={selectedNodeIdSet}
                rangeSelectionActive={rangeSelectionActive}
                onPointerDown={(nodeId, event) => {
                  if (event.shiftKey || event.metaKey || event.ctrlKey) {
                    return;
                  }

                  htmlNodeDrag.start(event, nodeId);
                }}
                onPointerMove={htmlNodeDrag.update}
                onPointerUp={htmlNodeDrag.finish}
                onPointerCancel={htmlNodeDrag.finish}
                onRangeSelectionPointerDown={handleRangeSelectionPointerDown}
                onClick={(node, event) => {
                  if (htmlNodeDrag.consumeSuppressedClick()) {
                    return;
                  }

                  if (event.detail >= 2 && htmlNodeDrag.canOpenInlineEdit()) {
                    openNodeLabelEdit(node.id, { x: node.x, y: node.y });
                    return;
                  }

                  selectNode(
                    node.id,
                    event.shiftKey || event.metaKey || event.ctrlKey,
                  );
                }}
                onDoubleClick={(node) => {
                  if (!htmlNodeDrag.canOpenInlineEdit()) {
                    return;
                  }

                  openNodeLabelEdit(node.id, { x: node.x, y: node.y });
                }}
                onContextMenu={(node) =>
                  openNodeContextMenu(node.id, { x: node.x, y: node.y })
                }
              />
            </>
          ) : null}
        </div>
        {contextMenuPresence.value ? (
          <GraphContextMenu
            target={contextMenuPresence.value}
            graph={graph}
            panelState={contextMenuPresence.state}
            selection={selection}
            onClose={() => setContextMenuTarget(null)}
            onEditNodeLabel={openNodeLabelEdit}
            onEditEdgeValue={openEdgeInlineEdit}
            onDeleteSelection={deleteContextSelection}
            onReverseEdges={reverseSelectionEdges}
            onResetEdgeCurve={(edgeId) =>
              executeCommand(updateEdgeCommand(edgeId, { routing: undefined }))
            }
            onBendEdge={bendEdgeBy}
          />
        ) : null}
      </div>
    </>
  );
}
