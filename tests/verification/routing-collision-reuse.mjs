import { mock } from "bun:test";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory.ts";
import * as collisions from "../../features/graph-editor/core/layout/edge-routing-collisions.ts";
import { createVerification } from "./harness.ts";

const { expect, finish } = createVerification("Routing collision reuse");
const original = collisions.countCurveNodeCollisions;
let calls = 0;
const modulePath =
  "../../features/graph-editor/core/layout/edge-routing-collisions.ts";
mock.module(modulePath, () => ({
  ...collisions,
  countCurveNodeCollisions: (...args) => {
    calls++;
    return original(...args);
  },
}));
const { createEdgeRoutingTask } =
  await import("../../features/graph-editor/core/layout/edge-routing.ts");
try {
  for (const reverse of [false, true]) {
    const graph = {
      ...createEmptyGraphModel({
        autoEdgeRouting: true,
        allowMultiEdges: true,
      }),
      nodes: [
        { id: "a", label: "A", order: 0, x: 0, y: 0 },
        { id: "b", label: "B", order: 1, x: 300, y: 0 },
        { id: "c", label: "C", order: 2, x: 150, y: 0 },
        { id: "d", label: "D", order: 3, x: 80, y: 80 },
        { id: "e", label: "E", order: 4, x: 220, y: -50 },
      ],
      edges: Array.from({ length: 4 }, (_, index) => ({
        id: `e${index}`,
        source: reverse && index % 2 ? "b" : "a",
        target: reverse && index % 2 ? "a" : "b",
        label: String(index),
      })),
    };
    calls = 0;
    const task = createEdgeRoutingTask(graph, { mode: "quality" });
    let step = task.next();
    while (!step.done) step = task.next();
    expect(
      calls > 0 && calls <= 36,
      "parallel avoidance reuses the initial and winning scores instead of the former 44 collision scans",
    );
    const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
    const expectedBows = [-180, -124, 112, -12];
    for (const [index, edge] of graph.edges.entries()) {
      const route = step.value.get(edge.id);
      const count = original(
        route,
        edge,
        nodes.get(edge.source),
        nodes.get(edge.target),
        graph.nodes,
      );
      expect(
        route.status === (count ? "unresolved" : "ready") &&
          route.bowPx === expectedBows[index] * (reverse && index % 2 ? -1 : 1),
        "yielded candidate selection preserves the clamped route, reverse orientation and actual final collision status",
      );
    }
  }
} finally {
  mock.module(modulePath, () => ({
    ...collisions,
    countCurveNodeCollisions: original,
  }));
}
finish();
