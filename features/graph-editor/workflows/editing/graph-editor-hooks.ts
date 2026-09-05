"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";

import { useGraphCanvasApi } from "../../canvas/GraphCanvasProvider";
import { editorPanelAtom } from "../../shell/state/editor-atoms";
import { toggleEditorPanel } from "../../shell/state/editor-layout";

import { isEditorShortcutBlockedTarget } from "../../adapters/browser/shortcut-targets";
import {
  clearInteractionStateAtom,
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
  observeExternalStorage,
} from "../../adapters/browser/stored-graph";
import {
  deleteSelectionAtom,
  redoAtom,
  undoAtom,
} from "../../shell/state/history-atoms";

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
  const panel = useAtomValue(editorPanelAtom);
  const setPanel = useSetAtom(editorPanelAtom);
  const canvas = useGraphCanvasApi();

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
          if (shortcut.mode !== "select" && panel !== null) {
            setPanel(null);
          }
          return false;
        case "cycle-selection-color":
          return cycleSelectionColor();
        case "clear-interaction":
          if (panel !== null) {
            setPanel(null);
            return false;
          }
          clearInteractionState();
          return false;
        case "delete-selection":
          deleteSelection();
          return false;
        case "edit-selection":
          if (panel !== null) {
            return false;
          }
          return canvas.editSelection();
        case "toggle-panel":
          setPanel(toggleEditorPanel(panel, shortcut.panel));
          return true;
        case "fit-view":
          canvas.fitView();
          return true;
        case "reset-zoom":
          canvas.resetZoom();
          return true;
        case "nudge-selection":
          return nudgeSelectedNodes({ dx: shortcut.dx, dy: shortcut.dy });
      }
    };

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    canvas,
    clearInteractionState,
    copyGraphSelection,
    cutGraphSelection,
    cycleSelectionColor,
    deleteSelection,
    nudgeSelectedNodes,
    panel,
    pasteGraphClipboard,
    redo,
    selectAllGraph,
    setMode,
    setPanel,
    undo,
  ]);
}

export function useGraphExternalStorageSync() {
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key === GRAPH_STORAGE_KEY || event.key === null) {
        observeExternalStorage(event.newValue);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
}
