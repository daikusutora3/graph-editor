/* oxlint-disable no-await-in-loop -- Every measurement owns the same warm Worker lane until its reply. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import { computeOverlapsInWorker } from "../../features/graph-editor/compute/worker-client";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { resolveNodeOverlaps } from "../../features/graph-editor/layouts/resolve-node-overlaps";
import {
  bounded,
  installRealComputeWorkers,
} from "../fixtures/real-compute-workers";

const referencePath = argument("--reference");
if (!referencePath)
  throw new Error(
    "Supply --reference with a saved original worker-client module; comparing the current module with itself does not measure an improvement.",
  );
const referenceFile = resolve(referencePath);
const reference: typeof computeOverlapsInWorker = (
  await import(pathToFileURL(referenceFile).href)
).computeOverlapsInWorker;
const currentFile = fileURLToPath(
  new URL(
    "../../features/graph-editor/compute/worker-client.ts",
    import.meta.url,
  ),
);
const workerFile = fileURLToPath(
  new URL(
    "../../features/graph-editor/compute/graph-compute.worker.ts",
    import.meta.url,
  ),
);
const wasmFile = fileURLToPath(
  new URL(`../../public${RUST_KERNEL_URL}`, import.meta.url),
);
const identity = (path: string) => ({
  path,
  sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
});
const provenance = {
  environment: `Bun ${process.versions.bun}; real native Workers, production client/Worker and checked-in Wasm; excludes browser scheduling and paint`,
  reference: identity(referenceFile),
  current: identity(currentFile),
  worker: identity(workerFile),
  harness: identity(
    fileURLToPath(
      new URL("../fixtures/real-compute-workers.ts", import.meta.url),
    ),
  ),
  wasm: identity(wasmFile),
};
console.log(JSON.stringify(provenance));
const runtime = installRealComputeWorkers();
const PASSES = 20;
const WARMUPS = 5;
const results = [];
try {
  for (const [name, edgeCount, overlapping] of [
    ["1000 nodes / no edges", 0, false],
    ["1000 nodes / 5000 edges", 5000, false],
    ["1000 nodes / 5000 edges / overlap", 5000, true],
  ] as const) {
    const graph: GraphModel = {
      ...createEmptyGraphModel({ allowMultiEdges: true, weighted: true }),
      nodes: Array.from({ length: 1000 }, (_, order) => ({
        id: `n${order}`,
        order,
        label: order % 5 === 0 ? `Long node label ${order}` : `${order}`,
        x: overlapping && order < 2 ? 0 : (order % 32) * 400,
        y: overlapping && order < 2 ? 0 : Math.floor(order / 32) * 128,
      })),
      edges: Array.from({ length: edgeCount }, (_, index) => ({
        id: `e${index}`,
        source: `n${index % 1000}`,
        target: `n${(index + 1) % 1000}`,
        label: `edge ${index}`,
        weight: `${index % 100}`,
      })),
    };
    const saved = JSON.stringify(graph);
    const expected = resolveNodeOverlaps(graph);
    const full: number[] = [];
    const projected: number[] = [];
    for (let pass = 0; pass < PASSES; pass++) {
      const variants = pass % 2 ? ["full", "projected"] : ["projected", "full"];
      for (const variant of variants) {
        const started = performance.now();
        const actual = await bounded(
          variant === "full"
            ? reference(graph)
            : computeOverlapsInWorker(graph),
          `${name} ${variant}`,
        );
        const elapsed = performance.now() - started;
        assert.deepEqual(actual, expected, "same complete overlap result");
        assert.equal(
          JSON.stringify(graph),
          saved,
          "source graph stays unchanged",
        );
        if (pass >= WARMUPS)
          (variant === "full" ? full : projected).push(elapsed);
      }
    }
    const result = {
      name,
      fullMedianMs: median(full),
      projectedMedianMs: median(projected),
      speedup: median(full) / median(projected),
      resultStatus: expected.status,
      resultPairs: expected.remainingPairs,
    };
    results.push(result);
    console.log(JSON.stringify(result));
  }
} finally {
  runtime.restore();
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
