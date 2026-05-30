"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

import { isEditorShortcutBlockedTarget } from "../../adapters/browser/shortcut-targets";
import { selectionAtom } from "../../shell/state/editor-atoms";
import {
  clearInteractionStateAtom,
  resetEditorSessionAtom,
  setEditorModeAtom,
} from "../../shell/state/editor-actions";
import {
  copyGraphSelectionAtom,
  cutGraphSelectionAtom,
  cycleSelectionColorAtom,
  nudgeSelectedNodesAtom,
  pasteGraphClipboardAtom,
  selectAllGraphAtom,
} from "../../shell/state/editor-shortcut-actions";
import {
  resolveGraphEditorShortcut,
  shouldPreventDefaultForGraphEditorShortcut,
  type GraphEditorShortcut,
} from "../../shell/state/editor-shortcuts";
import {
  GRAPH_STORAGE_KEY,
  graphAtom,
  initialGraph,
  syncExternalGraphAtom,
} from "../../shell/state/graph-atoms";
import {
  deleteSelectionAtom,
  redoAtom,
  undoAtom,
} from "../../shell/state/history-atoms";
import { parseStoredGraph } from "../../adapters/browser/stored-graph";

export function useGraphSelectionPruning() {
  const graph = useAtomValue(graphAtom);
  const selection = useAtomValue(selectionAtom);
  const setSelection = useSetAtom(selectionAtom);

  useEffect(() => {
    const nodeIds = new Set(graph.nodes.map((node) => node.id));
    const edgeIds = new Set(graph.edges.map((edge) => edge.id));
    const nextSelection = {
      nodeIds: selection.nodeIds.filter((nodeId) => nodeIds.has(nodeId)),
      edgeIds: selection.edgeIds.filter((edgeId) => edgeIds.has(edgeId)),
    };

    if (
      nextSelection.nodeIds.length !== selection.nodeIds.length ||
      nextSelection.edgeIds.length !== selection.edgeIds.length
    ) {
      setSelection(nextSelection);
    }
  }, [graph.edges, graph.nodes, selection, setSelection]);
}

export function useGraphEditorShortcuts() {
  const setMode = useSetAtom(setEditorModeAtom);
  const clearInteractionState = useSetAtom(clearInteractionStateAtom);
  const selectAllGraph = useSetAtom(selectAllGraphAtom);
  const copyGraphSelection = useSetAtom(copyGraphSelectionAtom);
  const cutGraphSelection = useSetAtom(cutGraphSelectionAtom);
  const pasteGraphClipboard = useSetAtom(pasteGraphClipboardAtom);
  const cycleSelectionColor = useSetAtom(cycleSelectionColorAtom);
  const nudgeSelectedNodes = useSetAtom(nudgeSelectedNodesAtom);
  const deleteSelection = useSetAtom(deleteSelectionAtom);
  const undo = useSetAtom(undoAtom);
  const redo = useSetAtom(redoAtom);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditorShortcutBlockedTarget(event.target)) {
        return;
      }

      const shortcut = resolveGraphEditorShortcut(event);
      if (!shortcut) {
        return;
      }

      const consumed = handleShortcut(shortcut);

      if (shouldPreventDefaultForGraphEditorShortcut(shortcut, consumed)) {
        event.preventDefault();
      }
    };

    const handleShortcut = (shortcut: GraphEditorShortcut) => {
      switch (shortcut.type) {
        case "undo":
          undo();
          return true;
        case "redo":
          redo();
          return true;
        case "select-all":
          selectAllGraph();
          return true;
        case "copy-selection":
          return copyGraphSelection();
        case "cut-selection":
          return cutGraphSelection();
        case "paste-clipboard":
          return pasteGraphClipboard();
        case "set-mode":
          setMode(shortcut.mode);
          return false;
        case "cycle-selection-color":
          return cycleSelectionColor();
        case "clear-interaction":
          clearInteractionState();
          return false;
        case "delete-selection":
          deleteSelection();
          return false;
        case "nudge-selection":
          return nudgeSelectedNodes({ dx: shortcut.dx, dy: shortcut.dy });
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    clearInteractionState,
    copyGraphSelection,
    cutGraphSelection,
    cycleSelectionColor,
    deleteSelection,
    nudgeSelectedNodes,
    pasteGraphClipboard,
    redo,
    selectAllGraph,
    setMode,
    undo,
  ]);
}

export function useGraphExternalStorageSync() {
  const syncExternalGraph = useSetAtom(syncExternalGraphAtom);
  const resetEditorSession = useSetAtom(resetEditorSessionAtom);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== GRAPH_STORAGE_KEY) {
        return;
      }

      syncExternalGraph(parseStoredGraph(event.newValue) ?? initialGraph);
      resetEditorSession();
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [resetEditorSession, syncExternalGraph]);
}
