import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelDiagnostics,
  type RustKernelCalls,
} from "../../features/graph-editor/compute/rust-kernel";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { createEdgeRoutingTask } from "../../features/graph-editor/core/layout/edge-routing";

// Compare complete immutable routing tasks, including exact output and yields.
// --reference accepts a saved original module. --module can select a candidate
// bundle built the same way. Both must share the instrumented Rust kernel.
// Paired runs alternate order.
const PASSES = 15;
const WARMUPS = 5;
const modulePath = argument("--module");
const createCurrentTask: typeof createEdgeRoutingTask = modulePath
  ? (await import(pathToFileURL(resolve(modulePath)).href))
      .createEdgeRoutingTask
  : createEdgeRoutingTask;
const referencePath = argument("--reference");
const reference: typeof createEdgeRoutingTask | undefined = referencePath
  ? (await import(pathToFileURL(resolve(referencePath)).href))
      .createEdgeRoutingTask
  : undefined;
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));
const identity = (path: string) => ({
  path,
  sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
});
const provenance = {
  environment: `Bun ${process.versions.bun}; CPU routing tasks with one shared Rust kernel; excludes browser scheduling and paint`,
  ...(referencePath ? { reference: identity(resolve(referencePath)) } : {}),
  current: identity(
    modulePath
      ? resolve(modulePath)
      : fileURLToPath(
          new URL(
            "../../features/graph-editor/core/layout/edge-routing.ts",
            import.meta.url,
          ),
        ),
  ),
  scoring: identity(
    fileURLToPath(
      new URL(
        "../../features/graph-editor/core/layout/edge-routing-scoring.ts",
        import.meta.url,
      ),
    ),
  ),
  snapshot: identity(
    fileURLToPath(
      new URL(
        "../../features/graph-editor/compute/wasm-routing.ts",
        import.meta.url,
      ),
    ),
  ),
  wasm: identity(
    fileURLToPath(new URL(`../../public${RUST_KERNEL_URL}`, import.meta.url)),
  ),
};
console.log(JSON.stringify(provenance));
const results = [];
for (const [name, nodeCount, edgeCount, labels, parallel, sparse] of [
  ["unlabelled dense", 150, 220, false, false, false],
  ["labelled small", 40, 55, true, false, false],
  ["labelled dense", 100, 150, true, false, false],
  ["labelled parallel", 100, 300, true, true, false],
  ["sparse", 1000, 400, true, false, true],
  ["one edge", 1000, 1, true, false, true],
] as const) {
  const graph: GraphModel = {
    ...createEmptyGraphModel({ autoEdgeRouting: true, allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: index % 5 === 0 ? "long vertex label" : `${index}`,
      x: sparse ? (index % 32) * 250 : ((index * 73) % 400) - 200,
      y: sparse ? Math.floor(index / 32) * 250 : ((index * 137) % 280) - 140,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${parallel ? index % 20 : (index * 7) % nodeCount}`,
      target: `n${parallel ? (index % 20) + 1 : (index * 7 + 1) % nodeCount}`,
      ...(labels ? { label: `edge ${index}` } : {}),
    })),
  };
  const saved = JSON.stringify(graph);
  const current: number[] = [];
  const previous: number[] = [];
  let sample;
  for (let pass = 0; pass < PASSES; pass++) {
    const variants =
      reference && pass % 2
        ? ([
            ["reference", reference],
            ["current", createCurrentTask],
          ] as const)
        : ([
            ["current", createCurrentTask],
            ...(reference ? [["reference", reference] as const] : []),
          ] as const);
    const samples = [];
    for (const [variant, createTask] of variants) {
      const kernels: RustKernelCalls = {};
      let steps = 0;
      const started = performance.now();
      const routes = withRustKernelDiagnostics(kernels, () => {
        const task = createTask(graph, { mode: "quality" });
        let step;
        do {
          step = task.next();
          steps++;
        } while (!step.done);
        return [...step.value];
      });
      const elapsed = performance.now() - started;
      const measured = {
        steps,
        kernels,
        signature: createHash("sha256")
          .update(JSON.stringify(routes))
          .digest("hex"),
      };
      samples.push(measured);
      sample = measured;
      if (pass >= WARMUPS)
        (variant === "current" ? current : previous).push(elapsed);
    }
    if (samples.length > 1)
      assert.deepEqual(
        samples[0],
        samples[1],
        "exact route output, yields and kernel work",
      );
  }
  assert.equal(
    JSON.stringify(graph),
    saved,
    "routing leaves source graph unchanged",
  );
  const result = {
    name,
    medianMs: median(current),
    ...(previous.length
      ? {
          beforeMedianMs: median(previous),
          speedup: median(previous) / median(current),
        }
      : {}),
    ...sample,
  };
  results.push(result);
  console.log(JSON.stringify(result));
}
const output = argument("--output");
if (output)
  writeFileSync(
    output,
    `${JSON.stringify({ ...provenance, passes: PASSES, warmups: WARMUPS, results }, null, 2)}\n`,
  );

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}

function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
}
