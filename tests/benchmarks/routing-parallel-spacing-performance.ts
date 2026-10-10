import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { parallelRoutingFixture } from "../fixtures/parallel-routing";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelDiagnostics,
  type RustKernelCalls,
} from "../../features/graph-editor/compute/rust-kernel";
import { createEdgeRoutingTask } from "../../features/graph-editor/core/layout/edge-routing";

// Capture the old version, then compare the new version on the same machine:
// node scripts/toolchain.mjs run tests/benchmarks/routing-parallel-spacing-performance.ts --output /tmp/parallel-spacing-before.json
// node scripts/toolchain.mjs run tests/benchmarks/routing-parallel-spacing-performance.ts --baseline /tmp/parallel-spacing-before.json --output /tmp/parallel-spacing-after.json
// Current Wasm is initialized. Measured runs have no mocks, spies or diagnostics.
const PASSES = 7;
const WARMUPS = 2;
type Metric = {
  edgeCount: number;
  medianMs: number;
  medianMaxStepMs: number;
  steps: number;
  signature: string;
  kernels: RustKernelCalls;
};
const baselinePath = argument("--baseline");
const baseline = baselinePath
  ? (JSON.parse(readFileSync(baselinePath, "utf8")) as { metrics: Metric[] })
  : undefined;
const metrics: Metric[] = [];
await initializeRustKernelFromBytes(
  readFileSync(`${process.cwd()}/public${RUST_KERNEL_URL}`),
);
for (const edgeCount of [100, 200]) {
  const graph = parallelRoutingFixture(edgeCount);
  const times: number[] = [];
  const maxSteps: number[] = [];
  const signatures = new Set<string>();
  const stepCounts = new Set<number>();
  const kernels: RustKernelCalls = {};
  for (let pass = 0; pass < PASSES; pass++) {
    const task = createEdgeRoutingTask(graph, { mode: "quality" });
    let elapsed = 0;
    let maxStep = 0;
    let steps = 0;
    let step;
    do {
      const started = performance.now();
      // Only the first discarded warmup verifies the active Rust kernel.
      step =
        pass === 0
          ? withRustKernelDiagnostics(kernels, () => task.next())
          : task.next();
      const duration = performance.now() - started;
      elapsed += duration;
      maxStep = Math.max(maxStep, duration);
      steps++;
    } while (!step.done);
    if (pass >= WARMUPS) {
      times.push(elapsed);
      maxSteps.push(maxStep);
    }
    stepCounts.add(steps);
    signatures.add(
      createHash("sha256")
        .update(JSON.stringify([...step.value]))
        .digest("hex"),
    );
  }
  assert.equal(signatures.size, 1, "each pass must produce identical routes");
  assert.equal(
    stepCounts.size,
    1,
    "each pass must yield the same routing work",
  );
  assert((kernels.routing_node_shape ?? 0) > 0, "current Wasm must be active");
  const metric: Metric = {
    edgeCount,
    medianMs: median(times),
    medianMaxStepMs: median(maxSteps),
    steps: [...stepCounts][0]!,
    signature: [...signatures][0]!,
    kernels,
  };
  const before = baseline?.metrics.find((item) => item.edgeCount === edgeCount);
  if (before) {
    assert.equal(metric.signature, before.signature, "before/after routes");
    assert.equal(metric.steps, before.steps, "before/after generator steps");
    assert.deepEqual(metric.kernels, before.kernels, "before/after Rust calls");
  }
  metrics.push(metric);
  console.log(
    JSON.stringify({
      ...metric,
      ...(before
        ? { beforeMedianMs: before.medianMs, sameOutput: true, sameWork: true }
        : {}),
    }),
  );
}
const outputPath = argument("--output");
if (outputPath)
  writeFileSync(
    outputPath,
    JSON.stringify({ passes: PASSES, warmups: WARMUPS, metrics }, null, 2),
  );

function median(values: number[]) {
  return values.toSorted((first, second) => first - second)[
    Math.floor(values.length / 2)
  ]!;
}
function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}
