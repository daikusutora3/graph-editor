import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import * as tikz from "../../features/graph-editor/io/export-tikz";

// Run alone; compares uninterrupted work to the same output in 4 ms slices.
const createTask = (
  tikz as unknown as {
    createTikzExportTask?: (model: GraphModel) => Generator<void, string>;
  }
).createTikzExportTask;
const results = [];
const baselineIndex = process.argv.indexOf("--baseline");
const baseline =
  baselineIndex >= 0
    ? (JSON.parse(
        readFileSync(process.argv[baselineIndex + 1]!, "utf8"),
      ) as Array<{ name: string; signature: string }>)
    : null;
for (const [name, count, loops, longLabels] of [
  ["small", 20, false, false],
  ["limits", 1000, false, false],
  ["compact loops / long labels", 600, true, true],
] as const) {
  const model: GraphModel = {
    ...createEmptyGraphModel({ allowMultiEdges: true, allowSelfLoops: true }),
    nodes: Array.from({ length: count }, (_, i) => ({
      id: `n${i}`,
      order: i,
      label: longLabels ? "長いラベル".repeat(20) : String(i),
      x: (i % 32) * (longLabels ? 2 : 90),
      y: Math.floor(i / 32) * (longLabels ? 2 : 90),
    })),
    edges: Array.from({ length: loops ? count : count * 5 }, (_, i) => ({
      id: `e${i}`,
      source: `n${i % count}`,
      target: `n${loops ? i % count : (i + 1) % count}`,
    })),
  };
  serializeGraphModel(model); // Every benchmark fixture must be accepted input.
  const times: number[] = [],
    slices: number[] = [],
    totals: number[] = [];
  let signature = "";
  for (let pass = 0; pass < 6; pass++) {
    const start = performance.now();
    const expected = tikz.exportTikz(model);
    const elapsed = performance.now() - start;
    if (pass > 0) times.push(elapsed);
    signature = createHash("sha256").update(expected).digest("hex");
    if (createTask) {
      const task = createTask(model);
      let total = 0;
      while (true) {
        const sliceStart = performance.now();
        let step = task.next();
        while (!step.done && performance.now() - sliceStart < 4)
          step = task.next();
        const duration = performance.now() - sliceStart;
        total += duration;
        if (pass > 0) slices.push(duration);
        if (step.done) {
          if (step.value !== expected)
            throw new Error(`${name}: changed output`);
          break;
        }
      }
      if (pass > 0) totals.push(total);
    }
  }
  const result = {
    name,
    syncMedianMs: median(times),
    syncMaxMs: Math.max(...times),
    signature,
    ...(createTask
      ? { slicedMedianMs: median(totals), maxSliceMs: Math.max(...slices) }
      : {}),
  };
  results.push(result);
  if (
    baseline &&
    baseline.find((item) => item.name === name)?.signature !== signature
  )
    throw new Error(`${name}: baseline output mismatch`);
  console.log(JSON.stringify(result));
}
const output = process.argv[process.argv.indexOf("--output") + 1];
if (process.argv.includes("--output") && output)
  writeFileSync(output, JSON.stringify(results, null, 2));
function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
}
