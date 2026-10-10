import { atom } from "jotai";

import { deleteSelectionCommand } from "../../core/graph/graph-intents";
import { prepareGraphPatch } from "../../core/graph/graph-patch";
import { prepareGraphTransaction } from "../../core/graph/graph-transaction";
import type {
  GraphModel,
  GraphIntent,
  GraphTransaction,
  GraphPatch,
} from "../../core/graph/model";
import { edgeDraftAtom, selectionAtom } from "./editor-atoms";
import {
  createEmptyEdgeDraft,
  createEmptySelection,
  type SelectionState,
} from "./editor-state";
import { graphAtom, graphRevisionAtom, commitGraphAtom } from "./graph-atoms";
import { pruneSelectionForGraph } from "./editor-selection";

export type CommandResult =
  | { status: "applied" | "noop"; graph: GraphModel }
  | { status: "rejected"; message: string };
export const commandErrorAtom = atom<string | null>(null);

export const historyAtom = atom<GraphTransaction[]>([]);
export const futureAtom = atom<GraphTransaction[]>([]);
export const canUndoAtom = atom((get) => get(historyAtom).length > 0);
export const canRedoAtom = atom((get) => get(futureAtom).length > 0);

const MAX_HISTORY_ENTRIES = 150;
// A count alone lets repeated near-limit imports retain hundreds of megabytes.
// Estimate patch text, objects and reference arrays without serializing again.
const MAX_HISTORY_RETAINED_BYTES = 32 * 1024 * 1024;
const historyCostCache = new WeakMap<GraphTransaction, number>();

export const executeCommandAtom = atom(
  null,
  (get, set, intent: GraphIntent): CommandResult => {
    const graph = get(graphAtom);
    let prepared;
    try {
      prepared = prepareGraphTransaction(graph, intent, get(graphRevisionAtom));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      set(commandErrorAtom, message);
      return { status: "rejected", message };
    }
    set(commandErrorAtom, null);

    if (!prepared) {
      return { status: "noop", graph };
    }

    const { after, transaction } = prepared;
    set(commitGraphAtom, after, prepared.serialized);
    set(graphRevisionAtom, transaction.afterRevision);
    if (
      get(edgeDraftAtom).sourceNodeId !== null ||
      get(edgeDraftAtom).message
    ) {
      set(edgeDraftAtom, createEmptyEdgeDraft());
    }
    set(selectionAtom, pruneSelectionForGraph(get(selectionAtom), after));
    set(historyAtom, appendHistory(get(historyAtom), transaction));
    set(futureAtom, []);
    return { status: "applied", graph: after };
  },
);

export const undoAtom = atom(null, (get, set) => {
  const history = get(historyAtom);
  const transaction = history.at(-1);

  if (!transaction) {
    return;
  }

  const graph = get(graphAtom);

  if (get(graphRevisionAtom) !== transaction.afterRevision) {
    set(historyAtom, []);
    set(futureAtom, []);
    return;
  }

  const { after: nextGraph, serialized } = prepareGraphPatch(
    graph,
    transaction.backward,
  );
  set(commitGraphAtom, nextGraph, serialized);
  set(graphRevisionAtom, transaction.beforeRevision);
  set(edgeDraftAtom, createEmptyEdgeDraft());
  set(selectionAtom, pruneSelectionForGraph(get(selectionAtom), nextGraph));
  set(historyAtom, history.slice(0, -1));
  set(futureAtom, [transaction, ...get(futureAtom)]);
});

export const redoAtom = atom(null, (get, set) => {
  const future = get(futureAtom);
  const [transaction, ...restFuture] = future;

  if (!transaction) {
    return;
  }

  const graph = get(graphAtom);

  if (get(graphRevisionAtom) !== transaction.beforeRevision) {
    set(historyAtom, []);
    set(futureAtom, []);
    return;
  }

  const { after: nextGraph, serialized } = prepareGraphPatch(
    graph,
    transaction.forward,
  );
  set(commitGraphAtom, nextGraph, serialized);
  set(graphRevisionAtom, transaction.afterRevision);
  set(edgeDraftAtom, createEmptyEdgeDraft());
  set(selectionAtom, pruneSelectionForGraph(get(selectionAtom), nextGraph));
  set(historyAtom, appendHistory(get(historyAtom), transaction));
  set(futureAtom, restFuture);
});

export const clearHistoryAtom = atom(null, (_get, set) => {
  set(historyAtom, []);
  set(futureAtom, []);
});

export const deleteSelectionAtom = atom(
  null,
  (get, set, selection: SelectionState = get(selectionAtom)) => {
    if (selection.nodeIds.length === 0 && selection.edgeIds.length === 0) {
      return;
    }

    set(executeCommandAtom, deleteSelectionCommand(selection));
    set(selectionAtom, createEmptySelection());
  },
);

function appendHistory(
  history: GraphTransaction[],
  transaction: GraphTransaction,
) {
  const nextHistory = [...history, transaction];
  let retainedBytes = 0;
  let start = nextHistory.length;
  while (start > 0 && nextHistory.length - start < MAX_HISTORY_ENTRIES) {
    const cost = estimateTransactionBytes(nextHistory[start - 1]!);
    // Keep the newest operation undoable even if it alone exceeds the budget.
    if (
      start < nextHistory.length &&
      retainedBytes + cost > MAX_HISTORY_RETAINED_BYTES
    )
      break;
    retainedBytes += cost;
    start -= 1;
  }
  return start === 0 ? nextHistory : nextHistory.slice(start);
}

function estimateTransactionBytes(transaction: GraphTransaction) {
  const cached = historyCostCache.get(transaction);
  if (cached !== undefined) return cached;
  const cost =
    256 +
    transaction.label.length * 2 +
    estimatePatchBytes(transaction.forward) +
    estimatePatchBytes(transaction.backward);
  historyCostCache.set(transaction, cost);
  return cost;
}

function estimatePatchBytes(patch: GraphPatch) {
  let bytes = 256;
  for (const section of [patch.nodes, patch.edges]) {
    if (!section) continue;
    for (const ids of [section.remove, section.order])
      if (ids)
        bytes += 64 + ids.reduce((sum, id) => sum + 8 + id.length * 2, 0);
    for (const element of section.put ?? []) {
      bytes += 256;
      for (const value of Object.values(element)) {
        if (typeof value === "string") bytes += value.length * 2;
        else if (value && typeof value === "object") bytes += 128;
      }
    }
  }
  if (patch.settings) bytes += 256;
  return bytes;
}
