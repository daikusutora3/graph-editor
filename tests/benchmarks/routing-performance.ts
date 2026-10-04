import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";

import { withMeasuredNodeGeometry } from "../../features/graph-editor/adapters/browser/node-geometry";
import { computeCytoscapeEdgeRoutingMeta } from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  computeEdgeRouting,
  createEdgeRoutingTask,
} from "../../features/graph-editor/core/layout/edge-routing";
import { exportTikz } from "../../features/graph-editor/io/export-tikz";

// Run each version in isolation to avoid competing benchmark processes.
// bun tests/benchmarks/routing-performance.ts --output /tmp/routing-before.json
// bun tests/benchmarks/routing-performance.ts --baseline /tmp/routing-before.json
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

for (const [name, nodeCount, edgeCount, longLabels] of [
  ["small", 20, 30, false],
  ["long labels / parallel", 100, 500, true],
  ["limits / parallel", 1000, 5000, false],
] as const) {
  const graph = fixture(nodeCount, edgeCount, longLabels);
  const previousMeta = computeEdgeRouting(graph, { mode: "quality" });
  const moved = {
    ...graph,
    nodes: graph.nodes.map((node, index) =>
      index === 0 ? { ...node, x: node.x + 17 } : node,
    ),
  };
  const measured = withMeasuredNodeGeometry(graph);
  const measuredMoved = withMeasuredNodeGeometry(moved);
  const measuredPrevious = computeCytoscapeEdgeRoutingMeta(graph, {
    mode: "quality",
  });

  measure(`${name}: core initial`, () =>
    computeEdgeRouting(graph, { mode: "quality" }),
  );
  measure(`${name}: core drag`, () =>
    computeEdgeRouting(moved, { mode: "quality", previousMeta }),
  );
  measure(`${name}: measured initial`, () =>
    computeCytoscapeEdgeRoutingMeta(graph, { mode: "quality" }),
  );
  measure(`${name}: measured drag`, () =>
    computeCytoscapeEdgeRoutingMeta(moved, {
      mode: "quality",
      previousMeta: measuredPrevious,
    }),
  );
  measureSliced(`${name}: measured initial sliced`, () =>
    createEdgeRoutingTask(measured, { mode: "quality" }),
  );
  measureSliced(`${name}: measured drag sliced`, () =>
    createEdgeRoutingTask(measuredMoved, {
      mode: "quality",
      previousMeta: measuredPrevious,
    }),
  );
  measure(`${name}: TikZ export`, () => exportTikz(graph));
}

// 600 loop sources still qualify for quality routing (600² < 400,000).
// More nodes would exercise the inexpensive fallback and miss loop scoring.
for (const [name, spacing, longLabels] of [
  ["loops / grid", 90, false],
  ["loops / collapsed", 0, false],
  ["loops / compact long labels", 2, true],
] as const) {
  const base = fixture(600, 600, longLabels);
  const graph: GraphModel = {
    ...base,
    settings: { ...base.settings, allowSelfLoops: true },
    nodes: base.nodes.map((node, index) => ({
      ...node,
      x: (index % 32) * spacing,
      y: Math.floor(index / 32) * spacing,
    })),
    edges: base.edges.map((edge) => ({ ...edge, target: edge.source })),
  };
  measure(`${name}: core initial`, () =>
    computeEdgeRouting(graph, { mode: "quality" }),
  );
  measureSliced(`${name}: core initial sliced`, () =>
    createEdgeRoutingTask(graph, { mode: "quality" }),
  );
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

function measureSliced<T>(name: string, createTask: () => Generator<void, T>) {
  const totals: number[] = [];
  const slices: number[] = [];
  let result: T | undefined;
  for (let iteration = 0; iteration < ITERATIONS; iteration++) {
    const task = createTask();
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

function fixture(
  nodeCount: number,
  edgeCount: number,
  longLabels: boolean,
): GraphModel {
  return {
    ...createEmptyGraphModel({ allowMultiEdges: true, autoEdgeRouting: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: longLabels ? "長いラベル".repeat(20) : String(index),
      x: (index % 32) * 90,
      y: Math.floor(index / 32) * 90,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % nodeCount}`,
      target: `n${(index + 1) % nodeCount}`,
    })),
  };
}

function median(values: number[]) {
  const ordered = values.toSorted((a, b) => a - b);
  return ordered[Math.floor(ordered.length / 2)]!;
}

function signature(value: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(value instanceof Map ? [...value] : value))
    .digest("hex");
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
