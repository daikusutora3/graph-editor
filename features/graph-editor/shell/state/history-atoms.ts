import { atom } from "jotai";

import { deleteSelectionCommand } from "../../core/graph/graph-intents";
import { applyGraphPatch } from "../../core/graph/graph-patch";
import { prepareGraphTransaction } from "../../core/graph/graph-transaction";
import type { GraphIntent, GraphTransaction } from "../../core/graph/model";
import { edgeDraftAtom, selectionAtom } from "./editor-atoms";
import {
  createEmptyEdgeDraft,
  createEmptySelection,
  type SelectionState,
} from "./editor-state";
import { graphAtom, graphRevisionAtom } from "./graph-atoms";
import { pruneSelectionForGraph } from "./editor-selection";

export const historyAtom = atom<GraphTransaction[]>([]);
export const futureAtom = atom<GraphTransaction[]>([]);

const MAX_HISTORY_ENTRIES = 150;

export const executeCommandAtom = atom(
  null,
  (get, set, intent: GraphIntent) => {
    const graph = get(graphAtom);
    const transaction = prepareGraphTransaction(
      graph,
      intent,
      get(graphRevisionAtom),
    );

    if (!transaction) {
      return;
    }

    const nextGraph = applyGraphPatch(graph, transaction.forward);
    set(graphAtom, nextGraph);
    set(graphRevisionAtom, transaction.afterRevision);
    set(edgeDraftAtom, createEmptyEdgeDraft());
    set(selectionAtom, pruneSelectionForGraph(get(selectionAtom), nextGraph));
    set(historyAtom, appendHistory(get(historyAtom), transaction));
    set(futureAtom, []);
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

  const nextGraph = applyGraphPatch(graph, transaction.backward);
  set(graphAtom, nextGraph);
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

  const nextGraph = applyGraphPatch(graph, transaction.forward);
  set(graphAtom, nextGraph);
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

  return nextHistory.length > MAX_HISTORY_ENTRIES
    ? nextHistory.slice(-MAX_HISTORY_ENTRIES)
    : nextHistory;
}
