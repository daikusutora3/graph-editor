import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import cytoscape from "cytoscape";

import {
  computeCytoscapeEdgeRoutingMeta,
  createCytoscapeRoutingTask,
  graphModelToCytoscapeElements,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

// Keep timing runs separate from builds and other benchmarks. The optional
// original adapter supplies a baseline without changing the shared checkout.
// bun tests/benchmarks/interactive-routing-performance.ts --output /tmp/drag.json
const ITERATIONS = 5;
const SLICE_MS = 4;
type Metric = {
  name: string;
  firstStepMedianMs: number;
  medianMs: number;
  maxSliceMs: number;
  signature: string;
};
const metrics: Metric[] = [];
const referencePath = argument("--reference");
const reference = referencePath
  ? ((await import(pathToFileURL(referencePath).href)) as {
      createCytoscapeRoutingTask: typeof createCytoscapeRoutingTask;
    })
  : undefined;
const createTask =
  reference?.createCytoscapeRoutingTask ?? createCytoscapeRoutingTask;

for (const longLabels of [false, true]) {
  const graph = fixture(longLabels);
  let previousMeta = computeCytoscapeEdgeRoutingMeta(graph, {
    mode: "quality",
  });
  for (let pass = 0; pass < 100; pass++) {
    const pending = new Set(
      [...previousMeta]
        .filter(([, route]) => route.status === "pending")
        .map(([id]) => id),
    );
    if (pending.size === 0) break;
    previousMeta = computeCytoscapeEdgeRoutingMeta(graph, {
      mode: "quality",
      previousMeta,
      rerouteEdgeIds: pending,
    });
  }
  if (
    [...previousMeta.values()].some(
      (route) => route.status !== "ready" || route.bowPx !== 0,
    )
  )
    throw new Error(
      "Interactive benchmark needs settled straight quality routes",
    );

  const cy = cytoscape({
    headless: true,
    elements: graphModelToCytoscapeElements(graph, {
      edgeRoutingMeta: previousMeta,
    }),
    layout: { name: "preset" },
  });
  try {
    const movedNodeIds = new Set(graph.nodes.slice(500).map((node) => node.id));
    for (const id of movedNodeIds) {
      const node = cy.getElementById(id);
      const position = node.position();
      node.position({ x: position.x + 20, y: position.y + 20 });
    }
    const totals: number[] = [];
    const firstSteps: number[] = [];
    const slices: number[] = [];
    let signature = "";
    for (let iteration = 0; iteration <= ITERATIONS; iteration++) {
      const task = createTask(
        cy,
        graph,
        { mode: "quality" },
        { movedNodeIds, previousMeta },
      );
      let total = 0;
      let first = true;
      while (true) {
        const start = performance.now();
        let step = task.next();
        if (first && iteration > 0) firstSteps.push(performance.now() - start);
        first = false;
        while (!step.done && performance.now() - start < SLICE_MS)
          step = task.next();
        const elapsed = performance.now() - start;
        total += elapsed;
        if (iteration > 0) slices.push(elapsed);
        if (step.done) {
          signature = createHash("sha256")
            .update(JSON.stringify([...step.value]))
            .digest("hex");
          break;
        }
      }
      if (iteration > 0) totals.push(total);
    }
    metrics.push({
      name: `1000 nodes / 400 edges / 500 dragged${longLabels ? " / long labels" : ""}`,
      firstStepMedianMs: median(firstSteps),
      medianMs: median(totals),
      maxSliceMs: Math.max(...slices),
      signature,
    });
  } finally {
    cy.destroy();
  }
}

const baselinePath = argument("--baseline");
const baseline = baselinePath
  ? (JSON.parse(readFileSync(baselinePath, "utf8")) as Metric[])
  : [];
for (const metric of metrics) {
  const before = baseline.find((item) => item.name === metric.name);
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
if (outputPath) writeFileSync(outputPath, JSON.stringify(metrics, null, 2));

function fixture(longLabels: boolean): GraphModel {
  return {
    ...createEmptyGraphModel({ allowMultiEdges: true, autoEdgeRouting: true }),
    nodes: Array.from({ length: 1000 }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label:
        longLabels && index >= 500 ? "長いラベル".repeat(20) : String(index),
      x: index < 500 ? (index % 25) * 120 : 10000 + (index % 25) * 120,
      y: Math.floor(index / 25) * 120,
    })),
    edges: Array.from({ length: 500 }, (_, index) => [
      ...(index % 25 < 24
        ? [{ id: `h${index}`, source: `n${index}`, target: `n${index + 1}` }]
        : []),
      ...(index < 475
        ? [{ id: `v${index}`, source: `n${index}`, target: `n${index + 25}` }]
        : []),
    ])
      .flat()
      .slice(0, 400),
  };
}

function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
