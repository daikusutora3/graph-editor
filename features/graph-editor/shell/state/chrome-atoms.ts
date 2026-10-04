import { atom } from "jotai";

import { edgeDraftAtom, selectionAtom } from "./editor-atoms";
import type { EditorPanel } from "./editor-layout";
import { graphAtom, graphIsEmptyAtom } from "./graph-atoms";

/** Keep graph edits out of the chrome while its graph-dependent panels are closed. */
export function createChromeGraphAtom(visiblePanel: EditorPanel | null) {
  const needsGraph =
    visiblePanel === "layouts" ||
    visiblePanel === "settings" ||
    visiblePanel === "menu" ||
    visiblePanel === "export" ||
    visiblePanel === "png";
  return atom((get) =>
    needsGraph || get(graphIsEmptyAtom) ? get(graphAtom) : null,
  );
}

export const inactiveGraphRevisionAtom = atom(0);

export const hasSelectionAtom = atom((get) => {
  const selection = get(selectionAtom);
  return selection.nodeIds.length > 0 || selection.edgeIds.length > 0;
});

export const edgeDraftSourceLabelAtom = atom((get) => {
  const sourceNodeId = get(edgeDraftAtom).sourceNodeId;
  if (sourceNodeId === null) return null;
  return (
    get(graphAtom).nodes.find((node) => node.id === sourceNodeId)?.label ?? null
  );
});
