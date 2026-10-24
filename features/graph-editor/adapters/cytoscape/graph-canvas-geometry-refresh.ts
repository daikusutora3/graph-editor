import type { CollectionReturnValue } from "cytoscape";

type GeometryRefreshCollection = {
  updateStyle: () => unknown;
  boundingBox: (options: { useCache: false }) => unknown;
};

export function refreshCytoscapeGeometry(changed: CollectionReturnValue) {
  if (changed.length === 0 || changed.cy().destroyed()) return 0;

  const affected = changed
    .cy()
    .collection(changed)
    .filter((element) => !element.removed());
  affected.merge(affected.nodes().connectedEdges());

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

  const fresh = affected as unknown as GeometryRefreshCollection;
  fresh.updateStyle();
  fresh.boundingBox({ useCache: false });
  return affected.length;
}
