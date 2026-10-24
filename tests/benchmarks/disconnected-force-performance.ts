import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelDiagnostics,
  type RustKernelCalls,
} from "../../features/graph-editor/compute/rust-kernel";
import { createForceLayoutTask } from "../../features/graph-editor/layouts/layout-algorithms";
import { disconnectedForceFixture } from "../fixtures/disconnected-force";

const PASSES = 9;
const WARMUPS = 2;
const RUNS_PER_PASS = 10;
type Metric = {
  nodeCount: number;
  edgeCount: number;
  medianMs: number;
  steps: number;
  signature: string;
  kernels: RustKernelCalls;
};
const modulePath = argument("--module");
const createTask: typeof createForceLayoutTask = modulePath
  ? (await import(pathToFileURL(resolve(modulePath)).href))
      .createForceLayoutTask
  : createForceLayoutTask;
const baselinePath = argument("--baseline");
const baseline = baselinePath
  ? (JSON.parse(readFileSync(baselinePath, "utf8")) as { metrics: Metric[] })
  : undefined;
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));
const metrics: Metric[] = [];
for (const nodeCount of [100, 300]) {
  const graph = disconnectedForceFixture(nodeCount, 5000);
  const saved = JSON.stringify(graph);
  const times: number[] = [];
  const signatures = new Set<string>();
  const stepCounts = new Set<number>();
  const kernels: RustKernelCalls = {};
  for (let pass = 0; pass < PASSES; pass++) {
    const started = performance.now();
    let result;
    for (let run = 0; run < RUNS_PER_PASS; run++) {
      result =
        pass === 0 && run === 0
          ? withRustKernelDiagnostics(kernels, finishTask)
          : finishTask();
    }
    const elapsed = (performance.now() - started) / RUNS_PER_PASS;
    if (pass >= WARMUPS) times.push(elapsed);
    stepCounts.add(result!.steps);
    signatures.add(
      createHash("sha256")
        .update(JSON.stringify(result!.positions))
        .digest("hex"),
    );
  }
  assert.equal(
    JSON.stringify(graph),
    saved,
    "benchmark leaves input untouched",
  );
  assert.equal(signatures.size, 1, "all passes preserve coordinates and order");
  assert.equal(stepCounts.size, 1, "all passes preserve generator scheduling");
  assert.equal(
    kernels.force_layout,
    nodeCount / 2,
    "Rust runs every component",
  );
  const metric: Metric = {
    nodeCount,
    edgeCount: graph.edges.length,
    medianMs: times.toSorted((a, b) => a - b)[Math.floor(times.length / 2)]!,
    steps: [...stepCounts][0]!,
    signature: [...signatures][0]!,
    kernels,
  };
  const before = baseline?.metrics.find((item) => item.nodeCount === nodeCount);
  if (before) {
    assert.equal(metric.signature, before.signature, "before/after positions");
    assert.equal(metric.steps, before.steps, "before/after scheduling");
    assert.deepEqual(metric.kernels, before.kernels, "before/after Rust work");
  }
  metrics.push(metric);
  console.log(
    JSON.stringify({
      ...metric,
      ...(before ? { beforeMs: before.medianMs } : {}),
    }),
  );

  function finishTask() {
    const task = createTask(graph);
    let steps = 0;
    let step;
    do {
      step = task.next();
      steps++;
    } while (!step.done);
    return { positions: step.value, steps };
  }
}
const output = argument("--output");
if (output)
  writeFileSync(
    output,
    JSON.stringify(
      { passes: PASSES, warmups: WARMUPS, runsPerPass: RUNS_PER_PASS, metrics },
      null,
      2,
    ),
  );

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index < 0 ? undefined : process.argv[index + 1];
}
