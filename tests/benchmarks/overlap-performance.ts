import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import * as current from "../../features/graph-editor/layouts/resolve-node-overlaps";
import { overlapGraph, overlapNode } from "../fixtures/overlaps";

// Run alone. For a comparison, use an original module with its imports rebased:
// bun tests/benchmarks/overlap-performance.ts --reference /tmp/overlap-original.ts
const referencePath = argument("--reference");
const reference = referencePath
  ? ((await import(pathToFileURL(referencePath).href)) as typeof current)
  : undefined;
const iterations = 5;
const sliceMs = 4;
const gridNodes = Array.from({ length: 1000 }, (_, index) =>
  overlapNode(index, (index % 32) * 128, Math.floor(index / 32) * 104),
);
const fixtures: Array<readonly [string, GraphModel]> = [
  ["separated grid 1000", overlapGraph(gridNodes)],
  [
    "separated line 1000",
    overlapGraph(
      Array.from({ length: 1000 }, (_, index) =>
        overlapNode(index, index * 128, 0),
      ),
    ),
  ],
  [
    "one collision grid 1000",
    overlapGraph(
      gridNodes.map((node, index) =>
        index === 1 ? { ...node, x: 0, y: 0 } : node,
      ),
    ),
  ],
  [
    "coincident 150",
    overlapGraph(
      Array.from({ length: 150 }, (_, index) => overlapNode(index, 0, 0)),
    ),
  ],
  [
    "wide labels 150",
    overlapGraph(
      Array.from({ length: 150 }, (_, index) =>
        overlapNode(
          index,
          (index % 15) * 160,
          Math.floor(index / 15) * 40,
          "長いラベル".repeat(4),
        ),
      ),
    ),
  ],
];
const metrics = [];
for (const [name, model] of fixtures) {
  current.resolveNodeOverlaps(model);
  reference?.resolveNodeOverlaps(model);
  const after = measure(current, model);
  const before = reference ? measure(reference, model) : undefined;
  const metric = {
    name,
    ...after,
    ...(before
      ? {
          previousMedianMs: before.medianMs,
          speedup: before.medianMs / after.medianMs,
          sameOutput: before.signature === after.signature,
        }
      : {}),
  };
  if (before && before.signature !== after.signature)
    throw new Error(`${name}: output changed`);
  metrics.push(metric);
  console.log(JSON.stringify(metric));
}
const outputPath = argument("--output");
if (outputPath)
  writeFileSync(
    outputPath,
    JSON.stringify({ iterations, sliceMs, metrics }, null, 2),
  );

function measure(module: typeof current, model: GraphModel) {
  const durations = [];
  let result;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const started = performance.now();
    result = module.resolveNodeOverlaps(model);
    durations.push(performance.now() - started);
  }
  let maxSliceMs = 0;
  const task = module.createOverlapTask(model);
  while (true) {
    const started = performance.now();
    let step = task.next();
    while (!step.done && performance.now() - started < sliceMs)
      step = task.next();
    maxSliceMs = Math.max(maxSliceMs, performance.now() - started);
    if (step.done) {
      if (JSON.stringify(step.value) !== JSON.stringify(result))
        throw new Error("Resumable output changed");
      break;
    }
  }
  return {
    medianMs: durations.toSorted((a, b) => a - b)[Math.floor(iterations / 2)]!,
    maxMs: Math.max(...durations),
    maxSliceMs,
    signature: createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
  };
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
