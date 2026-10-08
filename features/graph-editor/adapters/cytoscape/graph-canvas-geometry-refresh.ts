import type { CollectionReturnValue } from "cytoscape";

// Cytoscape 3.34.3 implements these collection methods/options but omits them
// from its declarations. Keep the compatibility type inside this adapter.
type GeometryRefreshCollection = {
  updateStyle: () => unknown;
  boundingBox: (options: { useCache: false }) => unknown;
};

/** Refresh projections before a fit or label read can cache the old geometry. */
export function refreshCytoscapeGeometry(changed: CollectionReturnValue) {
  if (changed.length === 0 || changed.cy().destroyed()) return 0;

  const affected = changed
    .cy()
    .collection(changed)
    .filter((element) => !element.removed());
  affected.merge(affected.nodes().connectedEdges());
  affected.merge(affected.edges().parallelEdges());
  if (affected.length === 0) return 0;

  // updateStyle marks these bounds dirty before boundingBox captures that flag.
  // useCache:false then projects the new routes before rebuilding their boxes.
  // A bare forceRender or boundingBox({useCache:false}) can retain old boxes.
  const fresh = affected as unknown as GeometryRefreshCollection;
  fresh.updateStyle();
  fresh.boundingBox({ useCache: false });
  return affected.length;
}
