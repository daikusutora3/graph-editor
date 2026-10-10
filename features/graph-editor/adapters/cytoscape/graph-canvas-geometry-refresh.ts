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
  // Cytoscape expands every input edge against its incident edges. One
  // representative per unordered endpoint pair avoids repeating that scan
  // for all siblings, including reversed edges and self-loops.
  const pairs = new Map<string, Set<string>>();
  const representatives = affected.edges().filter((edge) => {
    const source = edge.source().id();
    const target = edge.target().id();
    const first = source <= target ? source : target;
    const second = source <= target ? target : source;
    let targets = pairs.get(first);
    if (targets?.has(second)) return false;
    if (!targets) {
      targets = new Set();
      pairs.set(first, targets);
    }
    targets.add(second);
    return true;
  });
  affected.merge(representatives.parallelEdges());
  if (affected.length === 0) return 0;

  // updateStyle marks these bounds dirty before boundingBox captures that flag.
  // useCache:false then projects the new routes before rebuilding their boxes.
  // A bare forceRender or boundingBox({useCache:false}) can retain old boxes.
  const fresh = affected as unknown as GeometryRefreshCollection;
  fresh.updateStyle();
  fresh.boundingBox({ useCache: false });
  return affected.length;
}
