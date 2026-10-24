import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

export function disconnectedForceFixture(
  nodeCount: number,
  edgeCount: number,
): GraphModel {
  const ids = Array.from(
    { length: nodeCount },
    (_, index) =>
      ["__proto__", "constructor", "toString", "__ge_id__:constructor"][
        index
      ] ?? `n${index}`,
  );
  const componentCount = Math.floor(nodeCount / 2);
  return {
    ...createEmptyGraphModel({
      directed: true,
      allowMultiEdges: true,
      allowSelfLoops: true,
    }),
    nodes: ids
      .map((id, order) => ({ id, order, label: id, x: order * 10, y: 0 }))
      .reverse(),
    edges: Array.from({ length: edgeCount }, (_, index) => {
      const component = index % componentCount;
      const first = ids[component * 2]!;
      const second = ids[component * 2 + 1]!;
      return {
        id: `edge${index}`,
        source: index % 2 ? second : first,
        target: index % 2 ? first : second,
      };
    }),
  };
}
