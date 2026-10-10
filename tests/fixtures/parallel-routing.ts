import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

/** Labels and reversed siblings exercise final lane-distinctness checks. */
export function parallelRoutingFixture(edgeCount: number): GraphModel {
  return {
    ...createEmptyGraphModel({ autoEdgeRouting: true, allowMultiEdges: true }),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 300, y: 0 },
      { id: "c", label: "C", order: 2, x: 150, y: 0 },
      { id: "d", label: "D", order: 3, x: 80, y: 80 },
      { id: "e", label: "E", order: 4, x: 220, y: -50 },
    ],
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: index % 2 ? "b" : "a",
      target: index % 2 ? "a" : "b",
      label: "long edge label",
    })),
  };
}
