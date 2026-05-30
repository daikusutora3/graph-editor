"use client";

import type { Core, Position } from "cytoscape";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { nanoid } from "nanoid";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { graphModelToCytoscapeElements } from "../adapters/cytoscape/cytoscape-adapter";
import { addEdgeCommand, addNodeCommand } from "../core/graph/graph-intents";
import { resolveEdgeCreation } from "./graph-canvas-edge-creation";
import type { NodeId } from "../core/graph/model";
import { createEmptyEdgeDraft } from "../shell/state/editor-state";
import {
  edgeDraftAtom,
  editorModeAtom,
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
import { useGraphCanvasViewportActions } from "./graph-canvas-viewport-actions";
import { useEdgeRoutingMeta } from "./use-edge-routing-meta";
import { useAnimatedNullableState } from "../ui/use-panel-presence";
import {
  EdgeNodeHitboxes,
  SelectEdgeHitboxes,
  SelectNodeHitboxes,
} from "./GraphCanvasHitboxOverlays";
import {
  EdgeDraftLine,
  EditFeedbackNodes,
  FitGraphButton,
  InlineEditForm,
  InteractionLayers,
  ZoomControls,
} from "./GraphCanvasOverlays";
import { useGraphCanvasApi } from "./GraphCanvasProvider";
import { recordTimedEvent } from "../diagnostics/graph-performance-events";

type CanvasPointer = {
  clientX: number;
  clientY: number;
};
type GraphCanvasProps = {
  chrome: GraphCanvasChrome;
};

export function GraphCanvas({ chrome }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);
  const pendingFitAfterUpdateRef = useRef(false);
  const suppressSelectionSyncRef = useRef(false);
  const [edgeCursor, setEdgeCursor] = useState<RenderedPoint | null>(null);
  const [edgeHoverNodeId, setEdgeHoverNodeId] = useState<NodeId | null>(null);
  const [zoomPercent, setZoomPercent] = useState(100);
  const {
    openValue: contextMenuTarget,
    panelPresence: contextMenuPresence,
    setValue: setContextMenuTarget,
  } = useAnimatedNullableState<GraphContextMenuTarget>();

  const graph = useAtomValue(graphAtom);
  const mode = useAtomValue(editorModeAtom);
  const [edgeDraft, setEdgeDraft] = useAtom(edgeDraftAtom);
  const selection = useAtomValue(selectionAtom);
  const setSelection = useSetAtom(selectionAtom);
  const executeCommand = useSetAtom(executeCommandAtom);
  const deleteSelection = useSetAtom(deleteSelectionAtom);
  const { registerGraphCanvasApi } = useGraphCanvasApi();

  const exportPng = useGraphImageExport({ cyRef, suppressSelectionSyncRef });
  const { editFeedback, showEditFeedback } = useEditFeedback();
  const {
    edgeLabelHitboxes,
    flushRenderedHitboxes,
    isGraphOutOfView,
    nodeHitboxes,
    updateRenderedHitboxes,
  } = useRenderedHitboxes({ chrome, graph, mode });

  const { edgeRoutingMeta, edgeRoutingOptions } = useEdgeRoutingMeta(graph);

  const elements = useMemo(() => {
    return recordTimedEvent(
      "element-build-total",
      () =>
        graphModelToCytoscapeElements(graph, {
          edgeRoutingMeta,
          edgeRoutingOptions: {
            avoidNodes: edgeRoutingOptions.avoidNodes,
            variant: 0,
          },
        }),
      {
        avoidNodes: edgeRoutingOptions.avoidNodes,
        edges: graph.edges.length,
        nodes: graph.nodes.length,
      },
    );
  }, [edgeRoutingMeta, edgeRoutingOptions.avoidNodes, graph]);
  const graphHasElements = elements.length > 0;

  const selectionRef = useRef(selection);

  useEffect(() => {
    selectionRef.current = selection;
  }, [selection]);

  useEffect(() => {
    if (mode !== "edge") {
      setEdgeCursor(null);
      setEdgeHoverNodeId(null);
    }
  }, [mode]);

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

  const addNodeAtPointer = (event: CanvasPointer) => {
    const cy = cyRef.current;

    if (!cy || !containerRef.current) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const pan = cy.pan();
    const zoom = cy.zoom();

    addNodeAtGraphPosition({
      x: (event.clientX - rect.left - pan.x) / zoom,
      y: (event.clientY - rect.top - pan.y) / zoom,
    });
  };

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
    executeCommand,
    flushRenderedHitboxes,
    selectionRef,
    setSelection,
    updateRenderedHitboxes,
  });

  const { fitView, maxZoom, minZoom, resetCanvasZoom, zoomCanvas, zoomStep } =
    useGraphCanvasViewportActions({
      canZoom: graphHasElements,
      chrome,
      cyRef,
      flushRenderedHitboxes,
      setZoomPercent: updateZoomPercent,
    });

  useEffect(() => {
    registerGraphCanvasApi({
      fitView,
      fitAfterNextGraphRender: () => {
        pendingFitAfterUpdateRef.current = true;
      },
      exportPng,
    });

    return () => registerGraphCanvasApi(null);
  }, [exportPng, fitView, registerGraphCanvasApi]);

  useGraphCanvasLifecycle({
    containerRef,
    cyRef,
    elements,
    chrome,
    mode,
    pendingFitAfterUpdateRef,
    selection,
    selectionRef,
    flushRenderedHitboxes,
    setZoomPercent: updateZoomPercent,
    suppressSelectionSyncRef,
    updateRenderedHitboxes,
  });

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
    renderedPointFromPointer,
    setContextMenuTarget,
    syncContextSelection,
  });

  useCytoscapeInteractionEvents({
    cyRef,
    mode,
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
  return (
    <div
      className="relative h-full min-h-[420px] w-full overflow-hidden bg-[var(--bg-deep)]"
      onClick={() => setContextMenuTarget(null)}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div className="pointer-events-none absolute inset-0 [background-image:radial-gradient(circle,var(--canvas-grid)_1px,transparent_1.4px)] [background-size:24px_24px] opacity-[0.75]" />
      <div ref={containerRef} className="relative z-10 h-full w-full" />
      <FitGraphButton
        visible={isGraphOutOfView}
        chrome={chrome}
        onFitView={fitView}
      />
      <ZoomControls
        disabled={!graphHasElements}
        minZoom={minZoom}
        maxZoom={maxZoom}
        zoomPercent={zoomPercent}
        zoomStep={zoomStep}
        onZoom={zoomCanvas}
        onResetZoom={resetCanvasZoom}
      />
      <InteractionLayers
        mode={mode}
        onAddNode={addNodeAtPointer}
        onEdgePointerMove={(event) =>
          setEdgeCursor(renderedPointFromPointer(event))
        }
        onEdgePointerLeave={() => setEdgeCursor(null)}
        onClearEdgeDraft={() => {
          setContextMenuTarget(null);
          setEdgeDraft(createEmptyEdgeDraft());
        }}
      />
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
        onCompositionTextChange={inlineEditActions.onCompositionTextChange}
        onValueChange={inlineEditActions.onValueChange}
      />
      {mode === "select" && viewState.showSelectionActionBar ? (
        <SelectionActionBar
          graph={graph}
          selection={selection}
          chrome={chrome}
          onSetNodeColor={setSelectionNodeColor}
          onSetEdgeColor={setSelectionEdgeColor}
          onReverseEdges={reverseSelectionEdges}
        />
      ) : null}
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
          onContextMenu={openNodeContextMenu}
        />
      ) : null}
      {mode === "select" ? (
        <>
          <SelectEdgeHitboxes
            edges={edgeLabelHitboxes}
            weighted={graph.settings.weighted}
            onSelect={selectEdge}
            onEdit={openEdgeInlineEdit}
            onContextMenu={openEdgeContextMenu}
          />
          <SelectNodeHitboxes
            nodes={nodeHitboxes}
            onPointerDown={(nodeId, event) => {
              if (event.shiftKey) {
                return;
              }

              htmlNodeDrag.start(event, nodeId);
            }}
            onPointerMove={htmlNodeDrag.update}
            onPointerUp={htmlNodeDrag.finish}
            onPointerCancel={htmlNodeDrag.finish}
            onClick={(node, event) => {
              if (htmlNodeDrag.consumeSuppressedClick()) {
                return;
              }

              if (event.detail >= 2 && htmlNodeDrag.canOpenInlineEdit()) {
                openNodeLabelEdit(node.id, { x: node.x, y: node.y });
                return;
              }

              selectNode(node.id, event.shiftKey);
            }}
            onDoubleClick={(node) => {
              if (!htmlNodeDrag.canOpenInlineEdit()) {
                return;
              }

              openNodeLabelEdit(node.id, { x: node.x, y: node.y });
            }}
            onContextMenu={openNodeContextMenu}
          />
        </>
      ) : null}
      {contextMenuPresence.value ? (
        <GraphContextMenu
          target={contextMenuPresence.value}
          graph={graph}
          panelState={contextMenuPresence.state}
          sidebarCollapsed={chrome.sidebarCollapsed}
          selection={selection}
          onClose={() => setContextMenuTarget(null)}
          onEditNodeLabel={openNodeLabelEdit}
          onEditEdgeValue={openEdgeInlineEdit}
          onDeleteSelection={deleteContextSelection}
        />
      ) : null}
    </div>
  );
}
