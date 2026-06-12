import { atom } from "jotai";

import { nextEdgeColor, nextNodeColor } from "../../core/graph/colors";
import {
  createMoveNodesCommand,
  setEdgesColorCommand,
  setNodesColorCommand,
} from "../../core/graph/graph-intents";
import {
  createGraphClipboardPayload,
  createPasteGraphCommand,
} from "../../io/clipboard";
import {
  edgeDraftAtom,
  editorModeAtom,
  graphClipboardAtom,
  graphPasteCountAtom,
  selectionAtom,
} from "./editor-atoms";
import { createEmptyEdgeDraft } from "./editor-state";
import { graphAtom } from "./graph-atoms";
import { deleteSelectionAtom, executeCommandAtom } from "./history-atoms";

export const selectAllGraphAtom = atom(null, (get, set) => {
  const graph = get(graphAtom);

  set(editorModeAtom, "select");
  set(edgeDraftAtom, createEmptyEdgeDraft());
  set(selectionAtom, {
    nodeIds: graph.nodes.map((node) => node.id),
    edgeIds: graph.edges.map((edge) => edge.id),
  });
});

export const copyGraphSelectionAtom = atom(null, (get, set) => {
  const payload = createGraphClipboardPayload(
    get(graphAtom),
    get(selectionAtom),
  );

  if (!payload) {
    return false;
  }

  set(graphClipboardAtom, payload);
  set(graphPasteCountAtom, 0);
  return true;
});

export const cutGraphSelectionAtom = atom(null, (get, set) => {
  const selection = get(selectionAtom);
  const payload = createGraphClipboardPayload(get(graphAtom), selection);

  if (!payload) {
    return false;
  }

  set(graphClipboardAtom, payload);
  set(graphPasteCountAtom, 0);
  set(deleteSelectionAtom, selection);
  return true;
});

export const pasteGraphClipboardAtom = atom(null, (get, set) => {
  const graphClipboard = get(graphClipboardAtom);

  if (!graphClipboard) {
    return false;
  }

  const pasteCount = get(graphPasteCountAtom) + 1;
  const pasteResult = createPasteGraphCommand(
    get(graphAtom),
    graphClipboard,
    pasteCount,
  );

  if (!pasteResult) {
    return true;
  }

  set(editorModeAtom, "select");
  set(edgeDraftAtom, createEmptyEdgeDraft());
  set(executeCommandAtom, pasteResult.command);
  set(selectionAtom, pasteResult.selection);
  set(graphPasteCountAtom, pasteCount);
  return true;
});

export const cycleSelectionColorAtom = atom(null, (get, set) => {
  const graph = get(graphAtom);
  const selection = get(selectionAtom);

  if (selection.nodeIds.length === 0 && selection.edgeIds.length === 0) {
    return false;
  }

  if (selection.nodeIds.length > 0) {
    const firstNode = graph.nodes.find(
      (node) => node.id === selection.nodeIds[0],
    );
    set(
      executeCommandAtom,
      setNodesColorCommand(selection.nodeIds, nextNodeColor(firstNode?.color)),
    );
  }

  if (selection.edgeIds.length > 0) {
    const firstEdge = graph.edges.find(
      (edge) => edge.id === selection.edgeIds[0],
    );
    set(
      executeCommandAtom,
      setEdgesColorCommand(selection.edgeIds, nextEdgeColor(firstEdge?.color)),
    );
  }

  return true;
});

export const nudgeSelectedNodesAtom = atom(
  null,
  (get, set, { dx, dy }: { dx: number; dy: number }) => {
    const graph = get(graphAtom);
    const selection = get(selectionAtom);

    if (selection.nodeIds.length === 0) {
      return false;
    }

    const selected = graph.nodes.filter((node) =>
      selection.nodeIds.includes(node.id),
    );

    if (selected.length === 0) {
      return true;
    }

    const after = Object.fromEntries(
      selected.map((node) => [node.id, { x: node.x + dx, y: node.y + dy }]),
    );

    set(executeCommandAtom, createMoveNodesCommand("Nudge node", after));
    return true;
  },
);
