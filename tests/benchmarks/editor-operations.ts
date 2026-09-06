import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { prepareGraphTransaction } from "../../features/graph-editor/core/graph/graph-transaction";
import { updateNodeCommand } from "../../features/graph-editor/core/graph/graph-intents";
import {
  computeEdgeRouting,
  createEdgeRoutingTask,
} from "../../features/graph-editor/core/layout/edge-routing";
import {
  resolveNodeOverlaps,
  createOverlapTask,
} from "../../features/graph-editor/layouts/resolve-node-overlaps";

// Deterministic fixtures; report the longest synchronous call, not only averages.
for (const [name, count, edgeCount, dense, long] of [
  ["small", 20, 30, false, false],
  ["long labels / parallel", 100, 500, false, true],
  ["coincident", 200, 400, true, false],
  ["limits", 1000, 5000, false, false],
] as const) {
  const graph = {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      order: i,
      label: long ? "長いラベル".repeat(20) : `${i}`,
      x: dense ? 0 : (i % 32) * 90,
      y: dense ? 0 : Math.floor(i / 32) * 90,
    })),
    edges: Array.from({ length: edgeCount }, (_, i) => ({
      id: `e${i}`,
      source: `n${i % count}`,
      target: `n${(i + 1) % count}`,
    })),
  };
  graph.settings.allowMultiEdges = true;
  graph.settings.autoEdgeRouting = true;
  const previousMeta = measure("initial routing", () =>
    computeEdgeRouting(graph, { mode: "quality" }),
  );
  const moved = {
    ...graph,
    nodes: graph.nodes.map((n, i) => (i ? n : { ...n, x: n.x + 17 })),
  };
  measure("drag routing", () =>
    computeEdgeRouting(moved, { mode: "quality", previousMeta }),
  );
  measure("overlaps", () => resolveNodeOverlaps(graph));
  measure("transaction", () =>
    prepareGraphTransaction(graph, updateNodeCommand("n0", { x: 17 }), 0),
  );
  sliced(
    "initial routing sliced",
    createEdgeRoutingTask(graph, { mode: "quality" }),
  );
  sliced(
    "drag routing sliced",
    createEdgeRoutingTask(moved, { mode: "quality", previousMeta }),
  );
  sliced("overlaps sliced", createOverlapTask(graph));
  function sliced<T>(operation: string, task: Generator<void, T>) {
    const times: number[] = [];
    while (true) {
      const start = performance.now();
      let step = task.next();
      while (!step.done && performance.now() - start < 4) step = task.next();
      times.push(performance.now() - start);
      if (step.done) break;
    }
    console.log(
      `${name}\t${operation}\ttotal ${times.reduce((a, b) => a + b, 0).toFixed(2)} ms\tmax slice ${Math.max(...times).toFixed(2)} ms (${times.length} slices)`,
    );
  }
  function measure<T>(operation: string, run: () => T): T {
    const times: number[] = [];
    let result!: T;
    for (let i = 0; i < 3; i++) {
      const start = performance.now();
      result = run();
      times.push(performance.now() - start);
    }
    console.log(
      `${name}\t${operation}\tmean ${(times.reduce((a, b) => a + b, 0) / times.length).toFixed(2)} ms\tmax ${Math.max(...times).toFixed(2)} ms`,
    );
    return result;
  }
}
