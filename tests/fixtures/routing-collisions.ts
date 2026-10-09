import type {
  GraphEdge,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";
import type { EdgeCurveGeometry } from "../../features/graph-editor/core/layout/edge-route-geometry";

/** Dense obstacles sit inside the production collision pruning box. Sparse
 * obstacles fail that same box, making input-transfer regressions visible. */
export function collisionFixture(
  count: number,
  controls: number,
  dense: boolean,
) {
  const source: GraphNode = { id: "s", order: 0, label: "s", x: -400, y: 0 };
  const target: GraphNode = { id: "t", order: 1, label: "t", x: 400, y: 0 };
  const edge: GraphEdge = { id: "e", source: source.id, target: target.id };
  const nodes: Array<GraphNode & { measuredWidth?: number }> = [
    source,
    target,
    ...Array.from({ length: count - 2 }, (_, index) => ({
      id: `n${index}`,
      order: index + 2,
      label: index % 3 ? "1" : "wide label",
      x: dense ? ((index * 73) % 641) - 320 + 0.173 : 10000 + index * 53,
      y: dense ? ((index * 47) % 221) - 110 + 0.319 : 10000 + index * 41,
      measuredWidth: index % 3 ? 48 : 112,
    })),
  ];
  const curve: EdgeCurveGeometry =
    controls === 0
      ? { controlPointDistancesPx: [0], controlPointWeights: [0.5] }
      : controls === 1
        ? { controlPointDistancesPx: [96], controlPointWeights: [0.5] }
        : {
            controlPointDistancesPx: [96, -96, 96],
            controlPointWeights: [0.25, 0.5, 0.75],
          };
  return { source, target, edge, nodes, curve };
}
