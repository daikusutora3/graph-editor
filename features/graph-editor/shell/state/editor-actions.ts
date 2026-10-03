import { withMeasuredNodeGeometry } from "../../adapters/browser/node-geometry";
import { createOverlapTask } from "../../layouts/resolve-node-overlaps";
import { createMoveNodesCommand } from "../../core/graph/graph-intents";
import { atom } from "jotai";

import { createEmptyGraphModel } from "../../core/graph/graph-factory";
import {
  replaceModelCommand,
  reverseEdgesCommand,
  updateSettingsCommand,
} from "../../core/graph/graph-intents";
import type { GraphModel, GraphSettings } from "../../core/graph/model";
import {
  createManualLayoutCommand,
  createManualLayoutTask,
  type LayoutKind,
} from "../../layouts/manual-layouts";
import { edgeDraftAtom, editorModeAtom, selectionAtom } from "./editor-atoms";
import {
  createEmptyEdgeDraft,
  createEmptySelection,
  type EditorMode,
} from "./editor-state";
import { graphAtom, graphRevisionAtom } from "./graph-atoms";
import {
  acceptStorageBaseline,
  parseStoredGraph,
  scheduleStoredGraphWrite,
  flushStoredGraphWrite,
} from "../../adapters/browser/stored-graph";
import {
  commandErrorAtom,
  clearHistoryAtom,
  executeCommandAtom,
} from "./history-atoms";

type ReplaceGraphOptions = {
  clearEdgeDraft?: boolean;
  clearSelection?: boolean;
  selectMode?: boolean;
};

export const resetEditorSessionAtom = atom(null, (_get, set) => {
  set(layoutRequestAtom, null);
  set(layoutPendingRequestAtom, null);
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
    const result = set(executeCommandAtom, replaceModelCommand(model));
    if (result.status === "rejected") return result;

    if (options.selectMode) {
      set(editorModeAtom, "select");
    }

    if (options.clearSelection) {
      set(selectionAtom, createEmptySelection());
    }

    if (options.clearEdgeDraft) {
      set(edgeDraftAtom, createEmptyEdgeDraft());
    }
    return result;
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

const layoutRequestAtom = atom<symbol | null>(null);
const layoutPendingRequestAtom = atom<symbol | null>(null);
export const layoutPendingAtom = atom(
  (get) => get(layoutPendingRequestAtom) !== null,
);

export const applyManualLayoutAtom = atom(
  null,
  (get, set, kind: LayoutKind) => {
    const graph = get(graphAtom);
    const revision = get(graphRevisionAtom);
    const selection = get(selectionAtom);
    const rootNodeId =
      selection.nodeIds.length === 1 ? selection.nodeIds[0] : undefined;

    set(editorModeAtom, "select");
    const request = Symbol();
    set(layoutRequestAtom, request);
    set(
      layoutPendingRequestAtom,
      kind === "spread" || kind === "force" ? request : null,
    );
    const measured = withMeasuredNodeGeometry(graph);
    if (kind === "spread" || kind === "force") {
      return (async () => {
        const task =
          kind === "spread"
            ? createOverlapTask(measured)
            : createManualLayoutTask(measured, kind, rootNodeId);
        try {
          while (true) {
            if (
              get(graphAtom) !== graph ||
              get(graphRevisionAtom) !== revision ||
              get(layoutRequestAtom) !== request
            ) {
              return {
                status: "rejected" as const,
                message: "Layout superseded",
              };
            }
            const deadline = performance.now() + 4;
            let step = task.next();
            while (!step.done && performance.now() < deadline)
              step = task.next();
            if (step.done) {
              if (!("positions" in step.value)) {
                return set(executeCommandAtom, step.value);
              }
              const command = set(
                executeCommandAtom,
                createMoveNodesCommand(
                  "Resolve overlaps",
                  step.value.positions,
                ),
              );
              return { ...command, overlap: step.value };
            }
            // Every slice resumes the same calculation after processing input.
            // eslint-disable-next-line no-await-in-loop
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
        } finally {
          if (get(layoutPendingRequestAtom) === request) {
            set(layoutPendingRequestAtom, null);
          }
        }
      })();
    }
    return set(
      executeCommandAtom,
      createManualLayoutCommand(measured, kind, rootNodeId),
    );
  },
);

export const updateGraphSettingsAtom = atom(
  null,
  (_get, set, patch: Partial<GraphSettings>) => {
    set(executeCommandAtom, updateSettingsCommand(patch));
  },
);

export const reverseAllDirectedEdgesAtom = atom(null, (get, set) => {
  const graph = get(graphAtom);

  if (!graph.settings.directed) {
    return false;
  }

  const edgeIds = graph.edges
    .filter((edge) => edge.source !== edge.target)
    .map((edge) => edge.id);

  if (edgeIds.length === 0) {
    return false;
  }

  set(executeCommandAtom, reverseEdgesCommand(edgeIds));
  return true;
});

/** Resolve the exact storage snapshot displayed by the notice. */
export const resolveStorageConflictAtom = atom(
  null,
  (get, set, raw: string | null, fresh = false) => {
    const model = fresh
      ? createEmptyGraphModel(get(graphAtom).settings)
      : parseStoredGraph(raw);
    if (!model) {
      const message = "Invalid stored graph";
      set(commandErrorAtom, message);
      return { status: "rejected" as const, message };
    }
    const result = set(executeCommandAtom, replaceModelCommand(model));
    if (result.status === "rejected") return result;
    acceptStorageBaseline(raw);
    if (fresh) scheduleStoredGraphWrite(result.graph);
    return result;
  },
);

export const retryGraphSaveAtom = atom(null, () => flushStoredGraphWrite());
