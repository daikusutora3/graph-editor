import { atom } from "jotai";

import { createEmptyGraphModel } from "../../core/graph/graph-factory";
import {
  replaceModelCommand,
  updateSettingsCommand,
} from "../../core/graph/graph-intents";
import type { GraphModel, GraphSettings } from "../../core/graph/model";
import {
  createManualLayoutCommand,
  type LayoutKind,
} from "../../layouts/manual-layouts";
import { edgeDraftAtom, editorModeAtom, selectionAtom } from "./editor-atoms";
import {
  createEmptyEdgeDraft,
  createEmptySelection,
  type EditorMode,
} from "./editor-state";
import { graphAtom } from "./graph-atoms";
import { clearHistoryAtom, executeCommandAtom } from "./history-atoms";

type ReplaceGraphOptions = {
  clearEdgeDraft?: boolean;
  clearSelection?: boolean;
  selectMode?: boolean;
};

export const resetEditorSessionAtom = atom(null, (_get, set) => {
  set(editorModeAtom, "select");
  set(selectionAtom, createEmptySelection());
  set(edgeDraftAtom, createEmptyEdgeDraft());
  set(clearHistoryAtom);
});

export const clearInteractionStateAtom = atom(null, (_get, set) => {
  set(selectionAtom, createEmptySelection());
  set(edgeDraftAtom, createEmptyEdgeDraft());
});

export const setEditorModeAtom = atom(null, (_get, set, mode: EditorMode) => {
  set(editorModeAtom, mode);
});

export const replaceGraphModelAtom = atom(
  null,
  (_get, set, model: GraphModel, options: ReplaceGraphOptions = {}) => {
    set(executeCommandAtom, replaceModelCommand(model));

    if (options.selectMode) {
      set(editorModeAtom, "select");
    }

    if (options.clearSelection) {
      set(selectionAtom, createEmptySelection());
    }

    if (options.clearEdgeDraft) {
      set(edgeDraftAtom, createEmptyEdgeDraft());
    }
  },
);

export const clearGraphAtom = atom(null, (get, set) => {
  const graph = get(graphAtom);

  if (graph.nodes.length === 0 && graph.edges.length === 0) {
    return;
  }

  set(replaceGraphModelAtom, createEmptyGraphModel(graph.settings), {
    clearEdgeDraft: true,
    clearSelection: true,
    selectMode: true,
  });
});

export const applyManualLayoutAtom = atom(
  null,
  (get, set, kind: LayoutKind) => {
    const graph = get(graphAtom);
    const selection = get(selectionAtom);
    const rootNodeId =
      selection.nodeIds.length === 1 ? selection.nodeIds[0] : undefined;

    set(editorModeAtom, "select");
    set(executeCommandAtom, createManualLayoutCommand(graph, kind, rootNodeId));
  },
);

export const updateGraphSettingsAtom = atom(
  null,
  (_get, set, patch: Partial<GraphSettings>) => {
    set(executeCommandAtom, updateSettingsCommand(patch));
  },
);
