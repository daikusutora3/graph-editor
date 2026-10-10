import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { createCalculationCanvas } from "../fixtures/calculation-canvas";
import { refreshCytoscapeGeometry } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-geometry-refresh";
import {
  readEdgeLabelHitboxes,
  readNodeHitboxes,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelDiagnostics,
  withRustKernelSuppressed,
  type RustKernelCalls,
} from "../../features/graph-editor/compute/rust-kernel";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { createEdgeRoutingTask } from "../../features/graph-editor/core/layout/edge-routing";

// Run versions separately using the same runtime and machine:
// node scripts/toolchain.mjs run tests/benchmarks/geometry-routing-performance.ts --output /tmp/geometry-routing-before.json
// node scripts/toolchain.mjs run tests/benchmarks/geometry-routing-performance.ts --baseline /tmp/geometry-routing-before.json
// Real Cytoscape projections with deterministic font metrics; no DOM/raster/FPS.
const ITERATIONS = 15;
const WARMUPS = 5;
type Metric = {
  name: string;
  medianMs: number;
  signature: string;
  collisionKernelCalls?: number;
};
const metrics: Metric[] = [];

for (const edgeCount of [100, 500, 1000]) {
  const graph: GraphModel = {
    ...createEmptyGraphModel({ weighted: true, allowMultiEdges: true }),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 200, y: 0 },
    ],
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: index % 2 ? "a" : "b",
      target: index % 2 ? "b" : "a",
      label: String(index),
    })),
  };
  const { cy } = createCalculationCanvas(graph);
  let pass = 0;
  try {
    measure(
      `geometry: ${edgeCount} parallel edges`,
      () => {
        const node = cy.getElementById("a");
        node.position({ x: pass % 2 ? 10 : -10, y: pass++ });
        return refreshCytoscapeGeometry(node);
      },
      () => ({
        nodes: readNodeHitboxes(cy, graph),
        edges: readEdgeLabelHitboxes(cy, graph),
      }),
    );
  } finally {
    cy.destroy();
  }
}

await initializeRustKernelFromBytes(
  readFileSync(`${process.cwd()}/public${RUST_KERNEL_URL}`),
);
for (const [name, nodeCount, edgeCount, parallel] of [
  ["dense", 150, 220, false],
  ["parallel", 100, 300, true],
  ["sparse", 100, 20, false],
] as const) {
  const graph = routingFixture(
    nodeCount,
    edgeCount,
    parallel,
    name === "sparse",
  );
  for (const backend of ["JS", "Wasm"] as const) {
    let lastCalls: RustKernelCalls = {};
    const metric = measure(`${name}: ${backend} routing`, () => {
      lastCalls = {};
      const run = () =>
        withRustKernelDiagnostics(lastCalls, () => {
          const task = createEdgeRoutingTask(graph, { mode: "quality" });
          let step = task.next();
          while (!step.done) step = task.next();
          return [...step.value];
        });
      return backend === "JS" ? withRustKernelSuppressed(run) : run();
    });
    metric.collisionKernelCalls = lastCalls.routing_node_collisions ?? 0;
  }
}

const baselinePath = argument("--baseline");
const baseline = baselinePath
  ? (JSON.parse(readFileSync(baselinePath, "utf8")) as { metrics: Metric[] })
  : undefined;
const baselineByName = new Map(
  baseline?.metrics.map((metric) => [metric.name, metric]),
);
for (const metric of metrics) {
  const before = baselineByName.get(metric.name);
  console.log(
    JSON.stringify({
      ...metric,
      ...(before
        ? {
            previousMedianMs: before.medianMs,
            sameOutput: before.signature === metric.signature,
            previousCollisionKernelCalls: before.collisionKernelCalls,
          }
        : {}),
    }),
  );
}
const outputPath = argument("--output");
if (outputPath)
  writeFileSync(
    outputPath,
    JSON.stringify(
      { iterations: ITERATIONS, warmups: WARMUPS, metrics },
      null,
      2,
    ),
  );

function measure(name: string, run: () => unknown, output?: () => unknown) {
  for (let iteration = 0; iteration < WARMUPS; iteration++) run();
  const times: number[] = [];
  let result: unknown;
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const start = performance.now();
    result = run();
    times.push(performance.now() - start);
  }
  const metric: Metric = {
    name,
    medianMs: times.toSorted((a, b) => a - b)[Math.floor(times.length / 2)]!,
    signature: createHash("sha256")
      .update(JSON.stringify(output ? output() : result))
      .digest("hex"),
  };
  metrics.push(metric);
  return metric;
}

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function routingFixture(
  nodeCount: number,
  edgeCount: number,
  parallel: boolean,
  sparse: boolean,
): GraphModel {
  return {
    ...createEmptyGraphModel({ autoEdgeRouting: true, allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: index % 5 === 0 ? "long vertex label" : String(index),
      x: sparse ? (index % 10) * 250 : ((index * 73) % 400) - 200,
      y: sparse ? Math.floor(index / 10) * 250 : ((index * 137) % 280) - 140,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${parallel ? index % 20 : (index * 7) % nodeCount}`,
      target: `n${parallel ? (index % 20) + 1 : (index * 7 + 1) % nodeCount}`,
    })),
  };
}
