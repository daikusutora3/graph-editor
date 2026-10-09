/* oxlint-disable no-await-in-loop -- Keep backend timings isolated and alternate their order. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import { initializeRustKernelFromBytes } from "../../features/graph-editor/compute/rust-kernel";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { createEdgeRoutingTask } from "../../features/graph-editor/core/layout/edge-routing";

// --baseline-root takes a saved source snapshot containing features/, lib/,
// node_modules (or a symlink), and wasm/. Each version loads its own real asset.
// This compares the previously Rust-enabled app, rather than all-JS routing.
type Backend = { name: string; route: typeof createEdgeRoutingTask };
const backends: Backend[] = [];
const baselineIndex = process.argv.indexOf("--baseline-root");
if (baselineIndex >= 0) {
  const root = resolve(process.argv[baselineIndex + 1]!);
  const base = `${root}/features/graph-editor`;
  const runtime: typeof import("../../features/graph-editor/compute/rust-kernel") =
    await import(pathToFileURL(`${base}/compute/rust-kernel.ts`).href);
  const routing: typeof import("../../features/graph-editor/core/layout/edge-routing") =
    await import(pathToFileURL(`${base}/core/layout/edge-routing.ts`).href);
  const asset: typeof import("../../features/graph-editor/compute/kernel-asset") =
    await import(pathToFileURL(`${base}/compute/kernel-asset.ts`).href);
  await runtime.initializeRustKernelFromBytes(
    readFileSync(`${root}/wasm/${asset.RUST_KERNEL_URL.split("/").at(-1)}`),
  );
  backends.push({ name: "before", route: routing.createEdgeRoutingTask });
}
await initializeRustKernelFromBytes(
  readFileSync(`${process.cwd()}/public${RUST_KERNEL_URL}`),
);
backends.push({ name: "after", route: createEdgeRoutingTask });

const fixtures: [string, GraphModel][] = [
  ["quality 40/55", mixedGraph(40, 55)],
  ["sparse valid 1000/400", sparseGraph()],
  ["dense 150/220", denseGraph(150, 220)],
  ["parallel 100/300", denseGraph(100, 300, true)],
  ["dense one edge 1000/1", mixedGraph(1000, 1)],
];
for (const [name, model] of fixtures) {
  const samples = new Map<
    string,
    { times: number[]; slices: number[]; signature: string; steps: number }
  >();
  let expectedSignature: string | undefined;
  for (let pass = 0; pass < 16; pass++) {
    for (let slot = 0; slot < backends.length; slot++) {
      const backend = backends[(slot + pass) % backends.length]!;
      const started = performance.now();
      const task = backend.route(model, { mode: "quality" });
      let step: ReturnType<typeof task.next>;
      let steps = 0;
      let maximumSlice = 0;
      do {
        const sliceStarted = performance.now();
        step = task.next();
        steps++;
        while (!step.done && performance.now() - sliceStarted < 4) {
          step = task.next();
          steps++;
        }
        maximumSlice = Math.max(maximumSlice, performance.now() - sliceStarted);
      } while (!step.done);
      const elapsed = performance.now() - started;
      const signature = createHash("sha256")
        .update(JSON.stringify([...step.value]))
        .digest("hex");
      expectedSignature ??= signature;
      if (signature !== expectedSignature)
        throw new Error(`${name}: routing results differ across runs/backends`);
      if (pass < 5) continue;
      const sample = samples.get(backend.name) ?? {
        times: [],
        slices: [],
        signature,
        steps,
      };
      sample.times.push(elapsed);
      sample.slices.push(maximumSlice);
      samples.set(backend.name, sample);
    }
  }
  const before = samples.get("before");
  const after = samples.get("after")!;
  console.log(
    JSON.stringify({
      name,
      ...(before
        ? {
            beforeMs: median(before.times),
            speedup: median(before.times) / median(after.times),
            beforeMedianMaxSliceMs: median(before.slices),
            beforeSteps: before.steps,
          }
        : {}),
      afterMs: median(after.times),
      afterMedianMaxSliceMs: median(after.slices),
      afterSteps: after.steps,
      signature: after.signature,
      sameOutput: true,
    }),
  );
}

function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
}

function mixedGraph(nodeCount: number, edgeCount: number): GraphModel {
  return {
    ...createEmptyGraphModel({ autoEdgeRouting: true, allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      order: i,
      label: i % 5 === 0 ? "long vertex label" : String(i),
      x: i < 2 ? i * 440 - 220 : ((i * 73) % 600) - 300,
      y: i < 2 ? 0 : ((i * 137) % 400) - 200,
    })),
    edges: Array.from({ length: edgeCount }, (_, i) => ({
      id: `e${i}`,
      source: `n${(i * 2) % nodeCount}`,
      target: `n${(i * 2 + 1) % nodeCount}`,
      label: "edge label",
      ...(i === 0 ? {} : { routing: { bowPx: i % 2 === 0 ? 128 : -128 } }),
    })),
  };
}

function sparseGraph(): GraphModel {
  return {
    ...createEmptyGraphModel({ autoEdgeRouting: true, allowMultiEdges: true }),
    nodes: Array.from({ length: 1000 }, (_, i) => ({
      id: `n${i}`,
      order: i,
      label: String(i),
      x: i < 500 ? (i % 25) * 120 : 10000 + (i % 25) * 120,
      y: Math.floor(i / 25) * 120,
    })),
    edges: Array.from({ length: 500 }, (_, i) => [
      ...(i % 25 < 24
        ? [{ id: `h${i}`, source: `n${i}`, target: `n${i + 1}` }]
        : []),
      ...(i < 475
        ? [{ id: `v${i}`, source: `n${i}`, target: `n${i + 25}` }]
        : []),
    ])
      .flat()
      .slice(0, 400),
  };
}

function denseGraph(
  nodeCount: number,
  edgeCount: number,
  parallel = false,
): GraphModel {
  return {
    ...createEmptyGraphModel({ autoEdgeRouting: true, allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      order: i,
      label: i % 5 === 0 ? "long vertex label" : String(i),
      x: ((i * 73) % 400) - 200,
      y: ((i * 137) % 280) - 140,
    })),
    edges: Array.from({ length: edgeCount }, (_, i) => ({
      id: `e${i}`,
      source: `n${parallel ? i % 20 : (i * 7) % nodeCount}`,
      target: `n${parallel ? (i % 20) + 1 : (i * 7 + 1) % nodeCount}`,
    })),
  };
}
