"use client";

import type { Core } from "cytoscape";
import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { GraphIntent } from "../core/graph/model";
import type { EdgeId, GraphModel, NodeId } from "../core/graph/model";
import type { EditorMode, SelectionState } from "../shell/state/editor-state";

import type {
  GraphContextMenuTarget,
  InlineEditTarget,
  RenderedPoint,
} from "./graph-canvas-types";
import {
  readInlineEditPosition,
  readRenderedEdgeLabelPosition,
  readRenderedNodePosition,
  type EdgeLabelHitbox,
  type NodeHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";
import {
  inlineEditCssProperties,
  isCanvasShortcutBlockedTarget,
  isInlineEditStartShortcut,
} from "./graph-canvas-inline-edit";
import { resolveInlineEditCommit } from "../core/graph/inline-edit-commit";
import {
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
} from "../adapters/cytoscape/graph-canvas-viewport";

type SyncContextSelectionTarget = Pick<GraphContextMenuTarget, "kind"> & {
  edgeId?: EdgeId;
  nodeId?: NodeId;
};

type UseGraphInlineEditOptions = {
  contextMenuTarget: GraphContextMenuTarget | null;
  cyRef: MutableRefObject<Core | null>;
  edgeLabelHitboxes: EdgeLabelHitbox[];
  executeCommand: (command: GraphIntent) => void;
  graph: GraphModel;
  mode: EditorMode;
  nodeHitboxes: NodeHitbox[];
  selection: SelectionState;
  setContextMenuTarget: Dispatch<SetStateAction<GraphContextMenuTarget | null>>;
  syncContextSelection: (target: SyncContextSelectionTarget) => SelectionState;
  zoomPercent: number;
};

export function useGraphInlineEdit({
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
}: UseGraphInlineEditOptions) {
  const [inlineEdit, setInlineEdit] = useState<InlineEditTarget | null>(null);
  const [compositionText, setCompositionText] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composingRef = useRef(false);
  const closingRef = useRef<"commit" | "cancel" | null>(null);
  const focusKeyRef = useRef<string | null>(null);

  const focusKey =
    inlineEdit?.kind === "node-label"
      ? `node:${inlineEdit.nodeId}`
      : inlineEdit
        ? `edge:${inlineEdit.edgeId}:${inlineEdit.kind}`
        : null;

  useEffect(() => {
    if (!focusKey) {
      focusKeyRef.current = null;
      setCompositionText("");
      return;
    }

    const shouldSelect = focusKeyRef.current !== focusKey;
    focusKeyRef.current = focusKey;
    const animationFrameId = window.requestAnimationFrame(() => {
      const input = inputRef.current;

      input?.focus();
      if (shouldSelect) {
        input?.select();
      }
    });

    return () => window.cancelAnimationFrame(animationFrameId);
  }, [focusKey]);

  const openNodeLabelEdit = useCallback(
    (nodeId: NodeId, position: RenderedPoint) => {
      const node = graph.nodes.find((item) => item.id === nodeId);

      if (!node) {
        return;
      }

      syncContextSelection({ kind: "node", nodeId });
      closingRef.current = null;
      setContextMenuTarget(null);
      setInlineEdit({
        kind: "node-label",
        nodeId,
        value: node.label,
        fallbackPosition: position,
      });
    },
    [graph.nodes, setContextMenuTarget, syncContextSelection],
  );

  const openEdgeInlineEdit = useCallback(
    (edgeId: EdgeId, position: RenderedPoint) => {
      const edge = graph.edges.find((item) => item.id === edgeId);

      if (!edge) {
        return;
      }

      syncContextSelection({ kind: "edge", edgeId });
      closingRef.current = null;
      setContextMenuTarget(null);
      setInlineEdit({
        kind: graph.settings.weighted ? "edge-weight" : "edge-label",
        edgeId,
        value: graph.settings.weighted
          ? (edge.weight ?? "1")
          : (edge.label ?? ""),
        fallbackPosition: position,
      });
    },
    [
      graph.edges,
      graph.settings.weighted,
      setContextMenuTarget,
      syncContextSelection,
    ],
  );

  const closeInlineEdit = useCallback(() => {
    setCompositionText("");
    setInlineEdit(null);
    window.requestAnimationFrame(() => {
      closingRef.current = null;
    });
  }, []);

  const cancelInlineEdit = useCallback(() => {
    closingRef.current = "cancel";
    setInlineEdit(null);
  }, []);

  const finishInlineEdit = useCallback(
    (action: "commit" | "cancel") => {
      if (!inlineEdit || closingRef.current) {
        return;
      }

      closingRef.current = action;

      if (action === "cancel") {
        closeInlineEdit();
        return;
      }

      const result = resolveInlineEditCommit(inlineEdit, graph);

      if (result.kind === "error") {
        closingRef.current = null;
        setInlineEdit(result.edit);
        window.requestAnimationFrame(() => inputRef.current?.focus());
        return;
      }

      if (result.command) {
        executeCommand(result.command);
      }

      closeInlineEdit();
    },
    [closeInlineEdit, executeCommand, graph, inlineEdit],
  );

  useEffect(() => {
    const openSelectionEdit = (event: KeyboardEvent) => {
      if (
        !isInlineEditStartShortcut(event) ||
        mode !== "select" ||
        inlineEdit ||
        contextMenuTarget ||
        isCanvasShortcutBlockedTarget(event.target)
      ) {
        return;
      }

      if (selection.nodeIds.length === 1 && selection.edgeIds.length === 0) {
        const nodeId = selection.nodeIds[0];
        const position =
          nodeHitboxes.find((node) => node.id === nodeId) ??
          readRenderedNodePosition(cyRef.current, nodeId);

        if (!position) {
          return;
        }

        event.preventDefault();
        openNodeLabelEdit(nodeId, position);
        return;
      }

      if (selection.edgeIds.length === 1 && selection.nodeIds.length === 0) {
        const edgeId = selection.edgeIds[0];
        const position =
          edgeLabelHitboxes.find((edge) => edge.id === edgeId) ??
          readRenderedEdgeLabelPosition(cyRef.current, edgeId);

        if (!position) {
          return;
        }

        event.preventDefault();
        openEdgeInlineEdit(edgeId, position);
      }
    };

    window.addEventListener("keydown", openSelectionEdit);

    return () => {
      window.removeEventListener("keydown", openSelectionEdit);
    };
  }, [
    contextMenuTarget,
    cyRef,
    edgeLabelHitboxes,
    inlineEdit,
    mode,
    nodeHitboxes,
    openEdgeInlineEdit,
    openNodeLabelEdit,
    selection,
  ]);

  const editingElementId =
    inlineEdit?.kind === "node-label"
      ? inlineEdit.nodeId
      : (inlineEdit?.edgeId ?? null);

  useEffect(() => {
    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    cy.elements(".label-editing").removeClass("label-editing");

    if (editingElementId) {
      const element = cy.getElementById(editingElementId);

      if (!element.empty()) {
        element.addClass("label-editing");
      }
    }

    return () => {
      cy.elements(".label-editing").removeClass("label-editing");
    };
  }, [cyRef, editingElementId]);

  const position = inlineEdit
    ? readInlineEditPosition(inlineEdit, nodeHitboxes, edgeLabelHitboxes)
    : null;
  const style = inlineEdit
    ? inlineEditCssProperties({
        edit: inlineEdit,
        minZoom: MIN_CANVAS_ZOOM,
        maxZoom: MAX_CANVAS_ZOOM,
        zoomPercent,
        compositionText,
      })
    : undefined;

  const actions = useMemo(
    () => ({
      onCancel: () => finishInlineEdit("cancel"),
      onCommit: () => finishInlineEdit("commit"),
      onCompositionTextChange: setCompositionText,
      onValueChange: (value: string) =>
        setInlineEdit((current) =>
          current ? { ...current, value, error: undefined } : current,
        ),
    }),
    [finishInlineEdit],
  );

  return {
    actions,
    cancelInlineEdit,
    composingRef,
    edit: inlineEdit,
    inputRef,
    openEdgeInlineEdit,
    openNodeLabelEdit,
    position,
    setInlineEdit,
    style,
  };
}
