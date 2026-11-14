"use client";

import type { Core } from "cytoscape";
import { nodeDisplayLabel } from "../adapters/cytoscape/cytoscape-adapter";
import { getCytoscapeElement } from "../adapters/cytoscape/cytoscape-ids";
import type { MutableRefObject } from "react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { GraphIntent } from "../core/graph/model";
import type { EdgeId, GraphModel, NodeId } from "../core/graph/model";
import type { EditorMode, SelectionState } from "../shell/state/editor-state";

import type {
  GraphContextMenuTarget,
  InlineEditTarget,
  RenderedPoint,
  SyncContextSelectionTarget,
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
  isInlineEditStartShortcut,
} from "./graph-canvas-inline-edit";
import { isEditorShortcutBlockedTarget } from "../adapters/browser/shortcut-targets";
import { resolveInlineEditCommit } from "../core/graph/inline-edit-commit";
import {
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
} from "../adapters/cytoscape/graph-canvas-viewport";

type UseGraphInlineEditOptions = {
  contextMenuTarget: GraphContextMenuTarget | null;
  cyRef: MutableRefObject<Core | null>;
  edgeLabelHitboxes: EdgeLabelHitbox[];
  executeCommand: (
    command: GraphIntent,
  ) => import("../shell/state/history-atoms").CommandResult;
  graph: GraphModel;
  mode: EditorMode;
  nodeHitboxes: NodeHitbox[];
  selection: SelectionState;
  setContextMenuTarget: (target: GraphContextMenuTarget | null) => void;
  syncContextSelection: (target: SyncContextSelectionTarget) => void;
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

  useLayoutEffect(() => {
    if (!focusKey) {
      focusKeyRef.current = null;
      return;
    }

    const shouldSelect = focusKeyRef.current !== focusKey;
    focusKeyRef.current = focusKey;

    const input = inputRef.current;
    input?.focus();
    if (shouldSelect) input?.select();
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
        if (executeCommand(result.command).status === "rejected") {
          closingRef.current = null;
          setInlineEdit({ ...inlineEdit, error: "invalid-graph" });
          window.requestAnimationFrame(() => inputRef.current?.focus());
          return;
        }
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
        isEditorShortcutBlockedTarget(event.target)
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
      const element = getCytoscapeElement(cy, editingElementId);

      if (!element.empty()) {
        element.addClass("label-editing");
      }
    }

    return () => {
      cy.elements(".label-editing").removeClass("label-editing");
    };
  }, [cyRef, editingElementId]);

  // Rename the node in place: the canvas node itself shows the draft and
  // resizes to it, and the edit field on top only provides the caret. When the
  // edit ends, the node goes back to the model's label (new on commit, old on
  // cancel), so there is never a second, stale shape.
  const renamingNodeId =
    inlineEdit?.kind === "node-label" ? inlineEdit.nodeId : null;
  const draftLabel = inlineEdit?.kind === "node-label" ? inlineEdit.value : "";
  const showNodeLabels = graph.settings.showNodeLabels;
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !renamingNodeId) return;

    const node = getCytoscapeElement(cy, renamingNodeId);
    if (node.empty()) return;

    node.data("displayLabel", draftLabel);
    return () => {
      if (!node.removed()) {
        node.data(
          "displayLabel",
          nodeDisplayLabel(String(node.data("label") ?? ""), showNodeLabels),
        );
      }
    };
  }, [cyRef, draftLabel, renamingNodeId, showNodeLabels]);

  const position = inlineEdit
    ? readInlineEditPosition(inlineEdit, nodeHitboxes, edgeLabelHitboxes)
    : null;
  const style = inlineEdit
    ? inlineEditCssProperties({
        edit: inlineEdit,
        minZoom: MIN_CANVAS_ZOOM,
        maxZoom: MAX_CANVAS_ZOOM,
        zoomPercent,
      })
    : undefined;

  const actions = useMemo(
    () => ({
      onCancel: () => finishInlineEdit("cancel"),
      onCommit: () => finishInlineEdit("commit"),
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
