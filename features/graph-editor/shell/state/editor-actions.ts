import { withMeasuredNodeGeometry } from "../../adapters/browser/node-geometry";
import { createOverlapTask } from "../../layouts/resolve-node-overlaps";
import { atom } from "jotai";
import {
  computeLayoutInWorker,
  computeOverlapsInWorker,
} from "../../compute/worker-client";
import { withRustKernelSuppressed } from "../../compute/rust-kernel";

import { createEmptyGraphModel } from "../../core/graph/graph-factory";
import {
  createMoveNodesCommand,
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
import { createEmptySelection } from "./editor-state";
import { graphAtom, graphRevisionAtom } from "./graph-atoms";
import {
  acceptStorageBaseline,
  parseStoredGraph,
  scheduleStoredGraphWrite,
  flushStoredGraphWrite,
} from "../../adapters/browser/stored-graph";
import { commandErrorAtom, executeCommandAtom } from "./history-atoms";

const layoutControllerAtom = atom<AbortController | null>(null);

export const clearInteractionStateAtom = atom(null, (_get, set) => {
  set(selectionAtom, createEmptySelection());
  set(edgeDraftAtom, null);
});

export const replaceGraphModelAtom = atom(
  null,
  (_get, set, model: GraphModel) => {
    const result = set(executeCommandAtom, replaceModelCommand(model));
    if (result.status === "rejected") return result;

    set(editorModeAtom, "select");
    set(clearInteractionStateAtom);
    return result;
  },
);

export const clearGraphAtom = atom(null, (get, set) => {
  const graph = get(graphAtom);

  if (graph.nodes.length === 0 && graph.edges.length === 0) {
    return;
  }

  set(replaceGraphModelAtom, createEmptyGraphModel(graph.settings));
});

export const layoutPendingAtom = atom(
  (get) => get(layoutControllerAtom) !== null,
);

export const applyManualLayoutAtom = atom(
  null,
  (
    get,
    set,
    kind: LayoutKind,
    options?: {
      signal?: AbortSignal;
      rootNodeId?: string | null;
      selectMode?: boolean;
    },
  ) => {
    if (options?.signal?.aborted) {
      return { status: "rejected" as const, message: "Layout cancelled" };
    }
    get(layoutControllerAtom)?.abort();
    set(layoutControllerAtom, null);
    const graph = get(graphAtom);
    const revision = get(graphRevisionAtom);
    const selection = get(selectionAtom);
    const rootNodeId =
      options?.rootNodeId === null
        ? undefined
        : (options?.rootNodeId ??
          (selection.nodeIds.length === 1 ? selection.nodeIds[0] : undefined));

    if (options?.selectMode !== false) set(editorModeAtom, "select");
    const measured = withMeasuredNodeGeometry(graph);
    if (kind === "spread" || kind === "force") {
      return (async () => {
        const controller = new AbortController();
        const abort = () => controller.abort();
        options?.signal?.addEventListener("abort", abort, { once: true });
        if (options?.signal?.aborted) controller.abort();
        set(layoutControllerAtom, controller);
        const superseded = () =>
          controller.signal.aborted ||
          get(graphAtom) !== graph ||
          get(graphRevisionAtom) !== revision;
        const task =
          kind === "spread"
            ? createOverlapTask(measured)
            : createManualLayoutTask(measured, kind, rootNodeId);
        const nextFallbackStep = () =>
          withRustKernelSuppressed(() => task.next());
        try {
          let computed =
            kind === "spread"
              ? await computeOverlapsInWorker(measured, controller.signal)
              : await computeLayoutInWorker(
                  measured,
                  kind,
                  rootNodeId,
                  controller.signal,
                );
          if (superseded())
            return {
              status: "rejected" as const,
              message: "Layout superseded",
            };
          while (!computed) {
            if (superseded()) {
              return {
                status: "rejected" as const,
                message: "Layout superseded",
              };
            }
            const deadline = performance.now() + 4;
            let step = nextFallbackStep();
            while (!step.done && performance.now() < deadline)
              step = nextFallbackStep();
            if (step.done) {
              computed = step.value;
              break;
            }

            // eslint-disable-next-line no-await-in-loop
            await new Promise<void>((resolve) => setTimeout(resolve, 0));
          }
          if (!("positions" in computed))
            return set(executeCommandAtom, computed);
          const command = set(
            executeCommandAtom,
            createMoveNodesCommand("Resolve overlaps", computed.positions),
          );
          return { ...command, overlap: computed };
        } finally {
          options?.signal?.removeEventListener("abort", abort);
          controller.abort();
          if (get(layoutControllerAtom) === controller)
            set(layoutControllerAtom, null);
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

export const resolveStorageConflictAtom = atom(
  null,
  (get, set, raw: string | null, fresh = false) => {
    const model = fresh
      ? createEmptyGraphModel(get(graphAtom).settings)
      : parseStoredGraph(raw);
    if (!model) {
      const message = "Invalid stored graph";
      const failure = { reason: "invalid-graph" as const, message };
      set(commandErrorAtom, failure);
      return { status: "rejected" as const, ...failure };
    }
    const result = set(executeCommandAtom, replaceModelCommand(model));
    if (result.status === "rejected") return result;
    acceptStorageBaseline(raw);
    if (fresh) scheduleStoredGraphWrite(result.graph);
    return result;
  },
);

export const retryGraphSaveAtom = atom(null, () => flushStoredGraphWrite());
