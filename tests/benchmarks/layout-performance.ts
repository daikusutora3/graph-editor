import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  createManualLayoutCommand,
  createManualLayoutTask,
  type LayoutKind,
} from "../../features/graph-editor/layouts/manual-layouts";

// Run without concurrent benchmarks. An optional original module can provide
// the baseline without replacing files in the shared checkout.
// bun tests/benchmarks/layout-performance.ts --output /tmp/layout-after.json
const ITERATIONS = 5;
const SLICE_MS = 4;
type Metric = {
  name: string;
  medianMs: number;
  maxMs: number;
  signature: string;
  maxSliceMs?: number;
};
type Report = { iterations: number; sliceMs: number; metrics: Metric[] };
const report: Report = {
  iterations: ITERATIONS,
  sliceMs: SLICE_MS,
  metrics: [],
};
const referencePath = argument("--reference");
const reference = referencePath
  ? ((await import(pathToFileURL(referencePath).href)) as {
      createManualLayoutCommand: typeof createManualLayoutCommand;
    })
  : undefined;
const command =
  reference?.createManualLayoutCommand ?? createManualLayoutCommand;

for (const [name, nodeCount, longLabels, kind] of [
  ["force 100", 100, false, "force"],
  ["force 200", 200, false, "force"],
  ["force 300", 300, false, "force"],
  ["force 300 long labels", 300, true, "force"],
  ["grid 1000 long labels", 1000, true, "grid"],
  ["bfs 1000 long labels", 1000, true, "bfs"],
  ["dag 1000 long labels", 1000, true, "dagLayer"],
] as const) {
  const graph = fixture(nodeCount, longLabels);
  measure(name, () => command(graph, kind));
  // The live editor slices force/spread. Other task samples below measure the
  // clearance generator in isolation; their editor commands stay synchronous.
  if (!reference) measureSliced(`${name} sliced`, graph, kind);
}

const baselinePath = argument("--baseline");
const baseline = baselinePath
  ? (JSON.parse(readFileSync(baselinePath, "utf8")) as Report)
  : undefined;
const baselineByName = new Map(
  baseline?.metrics.map((metric) => [metric.name, metric]),
);
for (const metric of report.metrics) {
  const before = baselineByName.get(metric.name);
  console.log(
    JSON.stringify({
      ...metric,
      ...(before
        ? {
            previousMedianMs: before.medianMs,
            speedup: before.medianMs / metric.medianMs,
            sameOutput: before.signature === metric.signature,
          }
        : {}),
    }),
  );
}
const outputPath = argument("--output");
if (outputPath) writeFileSync(outputPath, JSON.stringify(report, null, 2));

function measure(name: string, run: () => unknown) {
  run();
  const times: number[] = [];
  let result: unknown;
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const start = performance.now();
    result = run();
    times.push(performance.now() - start);
  }
  report.metrics.push({
    name,
    medianMs: median(times),
    maxMs: Math.max(...times),
    signature: signature(result),
  });
}

function measureSliced(name: string, graph: GraphModel, kind: LayoutKind) {
  const totals: number[] = [];
  const slices: number[] = [];
  let result: unknown;
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const task = createManualLayoutTask(graph, kind);
    let total = 0;
    while (true) {
      const start = performance.now();
      let step = task.next();
      while (!step.done && performance.now() - start < SLICE_MS)
        step = task.next();
      const elapsed = performance.now() - start;
      total += elapsed;
      slices.push(elapsed);
      if (step.done) {
        result = step.value;
        break;
      }
    }
    totals.push(total);
  }
  report.metrics.push({
    name,
    medianMs: median(totals),
    maxMs: Math.max(...totals),
    maxSliceMs: Math.max(...slices),
    signature: signature(result),
  });
}

function fixture(nodeCount: number, longLabels: boolean): GraphModel {
  return {
    ...createEmptyGraphModel({ directed: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: longLabels ? "長いラベル".repeat(20) : String(index),
      x: index * 20,
      y: 0,
    })),
    edges: Array.from({ length: nodeCount - 1 }, (_, index) => ({
      id: `e${index}`,
      source: `n${index}`,
      target: `n${index + 1}`,
    })),
  };
}

function median(values: number[]) {
  const ordered = values.toSorted((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)]!;
}

function signature(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
