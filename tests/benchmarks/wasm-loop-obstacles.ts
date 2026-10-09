/* oxlint-disable no-await-in-loop -- Each measurement depends on a single loaded backend. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import { initializeRustKernelFromBytes } from "../../features/graph-editor/compute/rust-kernel";
import { scoreRustLoopObstacles } from "../../features/graph-editor/compute/wasm-routing";
import type { GraphNode } from "../../features/graph-editor/core/graph/model";

// Measure the same adapter workload, including snapshot validation, all ABI
// copies and freeing. Each backend loads its matching real Wasm asset.
type Backend = { name: string; score: typeof scoreRustLoopObstacles };
const backends: Backend[] = [];
const baselineIndex = process.argv.indexOf("--baseline-root");
if (baselineIndex >= 0) {
  const root = resolve(process.argv[baselineIndex + 1]!);
  const base = `${root}/features/graph-editor/compute`;
  const runtime: typeof import("../../features/graph-editor/compute/rust-kernel") =
    await import(pathToFileURL(`${base}/rust-kernel.ts`).href);
  const adapter: typeof import("../../features/graph-editor/compute/wasm-routing") =
    await import(pathToFileURL(`${base}/wasm-routing.ts`).href);
  const asset: typeof import("../../features/graph-editor/compute/kernel-asset") =
    await import(pathToFileURL(`${base}/kernel-asset.ts`).href);
  await runtime.initializeRustKernelFromBytes(
    readFileSync(`${root}/public${asset.RUST_KERNEL_URL}`),
  );
  backends.push({ name: "before", score: adapter.scoreRustLoopObstacles });
}
const kernelIndex = process.argv.indexOf("--kernel");
await initializeRustKernelFromBytes(
  readFileSync(
    kernelIndex >= 0
      ? process.argv[kernelIndex + 1]!
      : `public${RUST_KERNEL_URL}`,
  ),
);
backends.push({ name: "after", score: scoreRustLoopObstacles });

const points = Array.from({ length: 18 }, (_, index) => ({
  x: Math.cos(index * 0.23 - 2.1) * (70 + index * 0.9),
  y: Math.sin(index * 0.23 - 2.1) * (70 + index * 0.9),
}));
const directionPoints = Array.from({ length: 7 }, (_, index) => {
  const angle = ((-135 - 35 + (70 * index) / 6) * Math.PI) / 180;
  return { x: Math.cos(angle) * 71.4, y: Math.sin(angle) * 71.4 };
});
const bounds = { x1: -200, y1: -200, x2: 200, y2: 200 };
for (const [count, wide, pill, radius] of [
  [16, false, true, 140],
  [64, false, true, 140],
  [256, false, true, 200],
  [1000, false, true, 250],
  [64, true, true, 140],
  [256, true, true, 180],
  [64, false, false, 140],
  [1000, false, false, 140],
] as const) {
  const nodes: GraphNode[] = Array.from({ length: count }, (_, order) => ({
    id: `obstacle-${order}`,
    order,
    label: wide && order % 2 ? "wide ".repeat(8) : "1",
    x: Math.cos(order * 0.371 + 0.081) * (radius + (order % 5) * 1.7),
    y: Math.sin(order * 0.371 + 0.081) * (radius + (order % 7) * 2.3),
  }));
  const activeBounds = pill
    ? { x1: -Infinity, y1: -Infinity, x2: Infinity, y2: Infinity }
    : bounds;
  const activePoints = pill ? points : directionPoints;
  const clearance = pill ? 30 : 42;
  const samples = new Map<string, number[]>();
  let signature: string | undefined;
  for (let pass = 0; pass < 16; pass++) {
    for (let slot = 0; slot < backends.length; slot++) {
      const backend = backends[(slot + pass) % backends.length]!;
      const output = backend.score(
        nodes,
        activePoints,
        clearance,
        activeBounds,
        pill,
      );
      if (!output)
        throw new Error(
          "Benchmark fixture must select the Rust kernel without a threshold tie",
        );
      const hash = createHash("sha256")
        .update(JSON.stringify([...output]))
        .digest("hex");
      signature ??= hash;
      if (hash !== signature)
        throw new Error(
          "Loop score, collisions or work units differ between backends",
        );
      const started = performance.now();
      let sum = 0;
      for (let iteration = 0; iteration < 80; iteration++)
        sum += backend.score(
          nodes,
          activePoints,
          clearance,
          activeBounds,
          pill,
        )!.length;
      const elapsed = (performance.now() - started) / 80;
      if (sum === 0) throw new Error("No loop outputs were consumed");
      if (pass >= 5) {
        const times = samples.get(backend.name) ?? [];
        times.push(elapsed);
        samples.set(backend.name, times);
      }
    }
  }
  const before = samples.get("before");
  const after = median(samples.get("after")!);
  console.log(
    JSON.stringify({
      count,
      wide,
      pill,
      radius,
      ...(before
        ? { beforeMs: median(before), speedup: median(before) / after }
        : {}),
      afterMs: after,
      signature,
    }),
  );
}
function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}
