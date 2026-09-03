"use client";

import type { Core, Position } from "cytoscape";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { graphModelToCytoscapeElements } from "../adapters/cytoscape/cytoscape-adapter";
import {
  addEdgeCommand,
  addNodeCommand,
  updateEdgeCommand,
} from "../core/graph/graph-intents";
import { resolveEdgeCreation } from "./graph-canvas-edge-creation";
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

export function GraphCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const draggingNodeIdsRef = useRef<ReadonlySet<NodeId>>(new Set());
  const pendingFitAfterUpdateRef = useRef(false);
  const suppressSelectionSyncRef = useRef(false);
  const [edgeCursor, setEdgeCursor] = useState<RenderedPoint | null>(null);
  const [edgeHoverNodeId, setEdgeHoverNodeId] = useState<NodeId | null>(null);
  const [rangeSelectionKeyActive, setRangeSelectionKeyActive] = useState(false);
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
  const { registerGraphCanvasApi } = useGraphCanvasApi();

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
    isGraphOutOfView,
    nodeHitboxes,
    updateRenderedHitboxes,
  } = useRenderedHitboxes({ chrome, graph, mode });
  const isGraphOutOfViewRef = useRef(isGraphOutOfView);
  isGraphOutOfViewRef.current = isGraphOutOfView;

  const { edgeRoutingMeta, edgeRoutingOptions } = useEdgeRoutingMeta(graph);

  const elements = useMemo(() => {
    return graphModelToCytoscapeElements(graph, {
      edgeRoutingMeta,
      edgeRoutingOptions,
    });
  }, [edgeRoutingMeta, edgeRoutingOptions, graph]);
  const graphHasElements = elements.length > 0;

  useEffect(() => {
    if (mode !== "edge") {
      setEdgeCursor(null);
      setEdgeHoverNodeId(null);
    }
  }, [mode]);

  useEffect(() => {
    const syncRangeSelectionKey = (event: KeyboardEvent) => {
      setRangeSelectionKeyActive(
        event.shiftKey || event.metaKey || event.ctrlKey,
      );
    };
    const resetRangeSelectionKey = () => setRangeSelectionKeyActive(false);

    window.addEventListener("keydown", syncRangeSelectionKey);
    window.addEventListener("keyup", syncRangeSelectionKey);
    window.addEventListener("blur", resetRangeSelectionKey);

    return () => {
      window.removeEventListener("keydown", syncRangeSelectionKey);
      window.removeEventListener("keyup", syncRangeSelectionKey);
      window.removeEventListener("blur", resetRangeSelectionKey);
    };
  }, []);

  const addNodeAtGraphPosition = useCallback(
    (position: Position) => {
      const nodeId = nanoid();

      executeCommand(
        addNodeCommand({
          id: nodeId,
          x: position.x,
          y: position.y,
        }),
      );
      showEditFeedback([nodeId]);
    },
    [executeCommand, showEditFeedback],
  );

  const drawEdgeFromNode = useCallback(
    (targetNodeId: NodeId, continueFromTarget = false) => {
      const result = resolveEdgeCreation({
        model: graph,
        draft: edgeDraft,
        targetNodeId,
        continueFromTarget,
      });

      if (result.kind === "create-edge") {
        const edgeId = nanoid();

        executeCommand(
          addEdgeCommand({
            id: edgeId,
            source: result.source,
            target: result.target,
            weight: graph.settings.weighted ? "1" : undefined,
          }),
        );
        showEditFeedback([result.source, result.target]);
      }

      setEdgeDraft(result.nextDraft);
    },
    [edgeDraft, executeCommand, graph, setEdgeDraft, showEditFeedback],
  );

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

  const updateZoomPercent = useCallback((nextZoomPercent: number) => {
    setZoomPercent((current) =>
      current === nextZoomPercent ? current : nextZoomPercent,
    );
  }, []);

  const htmlNodeDrag = useHtmlNodeDrag({
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
      fitAfterNextGraphRender: () => {
        pendingFitAfterUpdateRef.current = true;
      },
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

  useGraphCanvasLifecycle({
    containerRef,
    cyRef,
    elements,
    chrome,
    edgeRoutingOptions,
    graph,
    mode,
    pendingFitAfterUpdateRef,
    draggingNodeIdsRef,
    selection,
    selectionRef,
    flushRenderedHitboxes,
    setZoomPercent: updateZoomPercent,
    suppressSelectionSyncRef,
    updateRenderedHitboxes,
  });

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
    <div
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
            rangeSelectionActive={rangeSelectionActive}
            weighted={graph.settings.weighted}
            onSelect={selectEdge}
            onEdit={openEdgeInlineEdit}
            zoom={zoomPercent / 100}
            onBendPreview={previewEdgeBow}
            onBendCommit={(edgeId, bend) =>
              executeCommand(
                updateEdgeCommand(edgeId, {
                  routing: { bowPx: bend.bowPx, bowT: bend.bowT },
                }),
              )
            }
            onBendCancel={restoreEdgeRouting}
            onRangeSelectionPointerDown={handleRangeSelectionPointerDown}
            onContextMenu={openEdgeContextMenu}
          />
          <SelectNodeHitboxes
            nodes={nodeHitboxes}
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
        />
      ) : null}
    </div>
  );
}
