import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import * as currentAnalysis from "../../features/graph-editor/core/graph/graph-analysis";
import * as currentLayouts from "../../features/graph-editor/layouts/layout-algorithms";

// Run by itself. --reference-dir can point to unchanged modules with imports
// rebased to this checkout, preserving shared working-tree changes.
const referenceDir = argument("--reference-dir");
const analysis: typeof currentAnalysis = referenceDir
  ? await import(pathToFileURL(`${referenceDir}/graph-analysis.ts`).href)
  : currentAnalysis;
const layouts: typeof currentLayouts = referenceDir
  ? await import(pathToFileURL(`${referenceDir}/layout-algorithms.ts`).href)
  : currentLayouts;
const iterations = 7;
type Metric = {
  name: string;
  medianMs: number;
  maxMs: number;
  signature: string;
};
type Report = { iterations: number; metrics: Metric[] };
const report: Report = { iterations, metrics: [] };
const isolated = fixture(1000, []);
const denseDag = fixture(
  1000,
  Array.from({ length: 5000 }, (_, index) => [
    index % 500,
    500 + ((index * 73 + Math.floor(index / 500)) % 500),
  ]),
);
const path = fixture(
  1000,
  Array.from({ length: 999 }, (_, index) => [index, index + 1]),
);

for (const [name, graph] of [
  ["isolated 1000", isolated],
  ["wide DAG 1000/5000", denseDag],
  ["path 1000", path],
] as const) {
  measure(`${name} DAG predicate`, () => analysis.isDirectedAcyclic(graph));
  measure(`${name} SCC`, () => analysis.stronglyConnectedComponents(graph));
  measure(`${name} BFS`, () => layouts.layoutBfs(graph));
  measure(`${name} DAG layout`, () => layouts.layoutDag(graph));
}

for (const count of [20, 100, 200, 300]) {
  const graph = fixture(count, [
    ...Array.from({ length: count - 1 }, (_, index) => [index, index + 1]),
    ...Array.from({ length: count }, (_, index) => [
      index,
      (index * 31 + 1) % count,
    ]),
  ]);
  measure(`force ${count}`, () => layouts.layoutForce(graph));
}

const randomized = Array.from({ length: 100 }, (_, seed) =>
  randomFixture(seed),
);
measure("100 random/reordered/disconnected/root contracts", () =>
  randomized.map((graph, seed) => {
    const root = graph.nodes[seed % graph.nodes.length]?.id;
    return {
      connected: analysis.connectedComponents(graph),
      stronglyConnected: analysis.stronglyConnectedComponents(graph),
      bipartite: analysis.isBipartite(graph),
      forest: analysis.isForest(graph),
      dag: analysis.isDirectedAcyclic(graph),
      bfs: layouts.layoutBfs(graph, root),
      tree: layouts.layoutTree(graph, root),
      bipartiteLayout: layouts.layoutBipartite(graph),
      scc: layouts.layoutScc(graph),
      dagLayout: layouts.layoutDag(graph),
      radial: layouts.layoutRadial(graph, root),
    };
  }),
);
measure("20 random force contracts", () =>
  randomized.slice(0, 20).map((graph) => layouts.layoutForce(graph)),
);

const baselinePath = argument("--baseline");
const baseline: Report | undefined = baselinePath
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : undefined;
const previousByName = new Map(
  baseline?.metrics.map((metric) => [metric.name, metric]),
);
for (const metric of report.metrics) {
  const previous = previousByName.get(metric.name);
  console.log(
    JSON.stringify({
      ...metric,
      ...(previous
        ? {
            previousMedianMs: previous.medianMs,
            speedup: previous.medianMs / metric.medianMs,
            sameOutput: previous.signature === metric.signature,
          }
        : {}),
    }),
  );
  if (previous && previous.signature !== metric.signature) process.exitCode = 1;
}
const outputPath = argument("--output");
if (outputPath) writeFileSync(outputPath, JSON.stringify(report, null, 2));

function measure(name: string, run: () => unknown) {
  run();
  const times: number[] = [];
  let result: unknown;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const start = performance.now();
    result = run();
    times.push(performance.now() - start);
  }
  report.metrics.push({
    name,
    medianMs: times.toSorted((a, b) => a - b)[Math.floor(iterations / 2)]!,
    maxMs: Math.max(...times),
    signature: createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
  });
}

function fixture(count: number, edges: number[][]): GraphModel {
  return {
    ...createEmptyGraphModel({ directed: true }),
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: String(index),
      x: index * 100,
      y: 0,
    })),
    edges: edges.map(([source, target], index) => ({
      id: `e${index}`,
      source: `n${source}`,
      target: `n${target}`,
    })),
  };
}

function randomFixture(seed: number) {
  let state = seed + 1;
  const random = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const count = 4 + (seed % 27);
  const graph = fixture(
    count,
    Array.from({ length: count * 2 }, () => [
      Math.floor(random() * (count + 1)),
      Math.floor(random() * (count + 1)),
    ]),
  );
  graph.settings.directed = seed % 3 !== 0;
  graph.nodes = graph.nodes
    .map((node) => ({ ...node, order: Math.floor(random() * count) }))
    .toReversed();
  return graph;
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
