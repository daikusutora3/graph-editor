import { readFileSync } from "node:fs";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  resetRustKernelForTests,
} from "../../features/graph-editor/compute/rust-kernel";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { createManualLayoutCommand } from "../../features/graph-editor/layouts/manual-layouts";
import { ensureNodeClearance } from "../../features/graph-editor/layouts/layout-geometry";
import { resolveNodeOverlaps } from "../../features/graph-editor/layouts/resolve-node-overlaps";

// Bun CPU timings include graph marshalling, the Rust call and normalization.
// They exclude download/initialization and browser Worker messaging/rendering.
const iterations = 7;
const graphs = [100, 200, 300].map((count) => fixture(count));
const wide = fixture(1000);
wide.nodes = wide.nodes.map((node, index) => ({
  ...node,
  label: "長いラベル".repeat(20),
  x: (index % 32) * 128,
  y: Math.floor(index / 32) * 104,
}));
const widePositions = Object.fromEntries(
  wide.nodes.map((node) => [node.id, { x: node.x, y: node.y }]),
);
const colliding = fixture(1000);
colliding.nodes = colliding.nodes.map((node, index) => ({
  ...node,
  x: index === 1 ? 0 : (index % 32) * 128,
  y: Math.floor(index / 32) * 104,
}));
const dense = fixture(150);
dense.nodes = dense.nodes.map((node) => ({ ...node, x: 0, y: 0, label: "" }));
const operations = [
  {
    name: "clearance 1000 long labels",
    run: () => ensureNodeClearance(widePositions, wide.nodes),
  },
  {
    name: "overlap 1000 one collision",
    run: () => resolveNodeOverlaps(colliding),
  },
  { name: "overlap 150 coincident", run: () => resolveNodeOverlaps(dense) },
];
resetRustKernelForTests();
const javascript = graphs.map(measure);
const otherJavascript = operations.map(({ run }) => measureTask(run));
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));
const wasm = graphs.map(measure);
const otherWasm = operations.map(({ run }) => measureTask(run));
graphs.forEach((graph, index) => {
  const before = javascript[index]!;
  const after = wasm[index]!;
  console.log(
    JSON.stringify({
      vertices: graph.nodes.length,
      javascriptMedianMs: before.medianMs,
      wasmMedianMs: after.medianMs,
      speedup: before.medianMs / after.medianMs,
      sameOutput: before.output === after.output,
    }),
  );
  if (before.output !== after.output) process.exitCode = 1;
});
operations.forEach(({ name }, index) => {
  const before = otherJavascript[index]!;
  const after = otherWasm[index]!;
  const maximumNumericDifference = numericDifference(
    before.result,
    after.result,
  );
  console.log(
    JSON.stringify({
      name,
      javascriptMedianMs: before.medianMs,
      wasmMedianMs: after.medianMs,
      speedup: before.medianMs / after.medianMs,
      sameOutput: before.output === after.output,
      maximumNumericDifference,
    }),
  );
  if (maximumNumericDifference > 1e-8) process.exitCode = 1;
});
resetRustKernelForTests();

function measure(graph: GraphModel) {
  return measureTask(() => createManualLayoutCommand(graph, "force"));
}

function measureTask(run: () => unknown) {
  for (let warmup = 0; warmup < 3; warmup++) run();
  const samples: number[] = [];
  let output = "";
  let result: unknown;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const start = performance.now();
    result = run();
    samples.push(performance.now() - start);
    output = JSON.stringify(result);
  }
  samples.sort((a, b) => a - b);
  return { medianMs: samples[Math.floor(samples.length / 2)]!, output, result };
}

function numericDifference(first: unknown, second: unknown): number {
  if (first === second) return 0;
  if (typeof first === "number" && typeof second === "number")
    return Math.abs(first - second);
  if (
    first &&
    second &&
    typeof first === "object" &&
    typeof second === "object"
  ) {
    const a = first as Record<string, unknown>,
      b = second as Record<string, unknown>;
    if (Object.keys(a).join() !== Object.keys(b).join()) return Infinity;
    return Math.max(
      0,
      ...Object.keys(a).map((key) => numericDifference(a[key], b[key])),
    );
  }
  return Infinity;
}

function fixture(count: number): GraphModel {
  return {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: String(index),
      x: index * 20,
      y: 0,
    })),
    edges: Array.from({ length: count - 1 }, (_, index) => ({
      id: `e${index}`,
      source: `n${index}`,
      target: `n${index + 1}`,
    })),
  };
}
