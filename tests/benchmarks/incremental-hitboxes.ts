import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { createCalculationCanvas } from "../fixtures/calculation-canvas";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  readNodeHitboxes,
  readEdgeLabelHitboxes,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";
import { createRenderedHitboxReader } from "../../features/graph-editor/adapters/cytoscape/rendered-hitbox-reader";
import { refreshCytoscapeGeometry } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-geometry-refresh";
import {
  defaultEdgeRoutingMeta,
  type EdgeRoutingMeta,
} from "../../features/graph-editor/core/layout/edge-routing";
import {
  createRoutingDelta,
  restoreRoutingDelta,
} from "../../features/graph-editor/compute/routing-result";
import type { ComputeJob } from "../../features/graph-editor/compute/worker-protocol";

// Real Cytoscape projection/geometry APIs, with deterministic font measurement.
// These CPU and clone timings exclude browser rasterization and pointer latency.
const results = [];
for (const [nodeCount, edgeCount] of [
  [100, 400],
  [1000, 5000],
]) {
  const graph = {
    ...createEmptyGraphModel({ weighted: true, allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount! }, (_, i) => ({
      id: `n${i}`,
      order: i,
      label: String(i),
      x: (i % 32) * 90,
      y: Math.floor(i / 32) * 90,
    })),
    edges: Array.from({ length: edgeCount! }, (_, i) => ({
      id: `e${i}`,
      source: `n${i % nodeCount!}`,
      target: `n${(i + 1) % nodeCount!}`,
      label: "1",
    })),
  };
  const baseline = createCalculationCanvas(graph);
  const optimized = createCalculationCanvas(graph);
  const reader = createRenderedHitboxReader(optimized.cy);
  reader.read(graph, true);
  const fullTimes: number[] = [],
    partialTimes: number[] = [];
  try {
    for (let i = 0; i < 30; i++) {
      const position = { x: (i % 2) * 24, y: 24 };
      let full, partial;
      const fullRead = () => {
        const start = performance.now();
        baseline.cy.getElementById("n0").position(position);
        refreshCytoscapeGeometry(
          baseline.cy.collection(baseline.cy.getElementById("n0")),
        );
        full = {
          nodes: readNodeHitboxes(baseline.cy, graph),
          edges: readEdgeLabelHitboxes(baseline.cy, graph),
        };
        if (i >= 5) fullTimes.push(performance.now() - start);
      };
      const partialRead = () => {
        const start = performance.now();
        optimized.cy.getElementById("n0").position(position);
        refreshCytoscapeGeometry(
          optimized.cy.collection(optimized.cy.getElementById("n0")),
        );
        partial = reader.read(graph, true);
        if (i >= 5) partialTimes.push(performance.now() - start);
      };
      if (i % 2) {
        partialRead();
        fullRead();
      } else {
        fullRead();
        partialRead();
      }
      assert.deepEqual(
        partial,
        full,
        "incremental geometry must equal full geometry",
      );
    }
    const job: ComputeJob = {
      kind: "routing",
      model: {
        ...graph,
        nodes: graph.nodes.map((node) => ({ ...node, measuredWidth: 48 })),
      },
      options: {
        mode: "quality",
        previousMeta: new Map(
          graph.edges.map((edge) => [
            edge.id,
            {
              ...defaultEdgeRoutingMeta,
              controlPointDistancesPx: [24, -36],
              controlPointWeights: [0.33, 0.67],
            },
          ]),
        ),
      },
      interaction: {
        nodes: [...graph.nodes, { ...graph.nodes[0]!, x: 24 }],
        movedNodeIds: new Set(["n0"]),
      },
    };
    const cloneTimes: number[] = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      const copy: ComputeJob = structuredClone(job);
      if (i >= 5) cloneTimes.push(performance.now() - start);
      assert.equal(copy.model.nodes.length, nodeCount);
    }
    assert.equal(job.kind, "routing");
    const previous = job.options.previousMeta!;
    // Like the router, retain baseline objects for unaffected edges. Reverse
    // key order to also check that delta restoration preserves router order.
    const routed = new Map(
      [...previous]
        .reverse()
        .map(([id, meta], index) => [
          id,
          index < 10
            ? { ...meta, bowPx: 48, controlPointDistancesPx: [48] }
            : meta,
        ]),
    );
    const fullResponseTimes: number[] = [],
      deltaResponseTimes: number[] = [];
    for (let i = 0; i < 30; i++) {
      let clonedFull, restoredDelta;
      const fullResponse = () => {
        const start = performance.now();
        clonedFull = structuredClone(routed) as Map<string, EdgeRoutingMeta>;
        if (i >= 5) fullResponseTimes.push(performance.now() - start);
      };
      const deltaResponse = () => {
        const start = performance.now();
        // Include the client's per-request shallow snapshot, encoding in the
        // Worker, clone transport, and client restoration in the comparison.
        const snapshot = new Map(previous);
        const delta = createRoutingDelta(routed, previous)!;
        restoredDelta = restoreRoutingDelta(structuredClone(delta), snapshot);
        if (i >= 5) deltaResponseTimes.push(performance.now() - start);
      };
      if (i % 2) {
        deltaResponse();
        fullResponse();
      } else {
        fullResponse();
        deltaResponse();
      }
      assert.deepEqual([...restoredDelta!], [...clonedFull!]);
    }
    results.push({
      nodeCount,
      edgeCount,
      fullMedianMs: median(fullTimes),
      incrementalMedianMs: median(partialTimes),
      speedup: median(fullTimes) / median(partialTimes),
      workerPayloadCloneMedianMs: median(cloneTimes),
      workerFullResponseMedianMs: median(fullResponseTimes),
      workerDeltaResponseMedianMs: median(deltaResponseTimes),
      workerResponseSpeedup:
        median(fullResponseTimes) / median(deltaResponseTimes),
      equivalencePasses: 30,
    });
  } finally {
    reader.dispose();
    baseline.cy.destroy();
    optimized.cy.destroy();
  }
}
const report = {
  environment:
    "Bun CPU, real Cytoscape projections with stubbed font metrics; not browser frame latency",
  results,
};
const outputIndex = process.argv.indexOf("--output");
if (outputIndex >= 0)
  writeFileSync(
    process.argv[outputIndex + 1]!,
    `${JSON.stringify(report, null, 2)}\n`,
  );
console.log(JSON.stringify(report, null, 2));

function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)]!;
}
