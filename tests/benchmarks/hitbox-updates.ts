import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import type { Core } from "cytoscape";
import { createCalculationCanvas } from "../fixtures/calculation-canvas";
import { createRenderedHitboxReader as createReferenceReader } from "../fixtures/rendered-hitbox-reader-reference";
import {
  reconcileNodeHitboxes,
  reconcileEdgeLabelHitboxes,
} from "../fixtures/hitbox-reconciliation-reference";
import { createRenderedHitboxReader } from "../../features/graph-editor/adapters/cytoscape/rendered-hitbox-reader";
import { refreshCytoscapeGeometry } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-geometry-refresh";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type {
  NodeHitbox,
  EdgeLabelHitbox,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";

// Compare the entire eb9e11e reader + React-state reconciliation pipeline with
// the indexed, identity-preserving reader. This is CPU geometry preparation,
// not React commit, DOM layout, canvas raster or end-to-end pointer latency.
const iterations = 60;
const warmup = 10;
const results = [];
for (const [nodeCount, edgeCount] of [
  [100, 400],
  [1000, 5000],
] as const) {
  const graph = {
    ...createEmptyGraphModel({ weighted: true, allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      label: String(index),
      order: index,
      x: (index % 32) * 90,
      y: Math.floor(index / 32) * 90,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % nodeCount}`,
      target: `n${(index + 1) % nodeCount}`,
      label: "1",
    })),
  };
  for (const scenario of [
    "idle",
    "unrelated-data",
    "one-node",
    "group",
  ] as const) {
    const reference = createCalculationCanvas(graph);
    const optimized = createCalculationCanvas(graph);
    assert.equal(reference.cy.zoom(), 1, "fixture movement must be visible");
    assert.equal(optimized.cy.zoom(), 1);
    const oldReader = createReferenceReader(reference.cy);
    const newReader = createRenderedHitboxReader(optimized.cy);
    let oldNodes: NodeHitbox[] = [],
      oldEdges: EdgeLabelHitbox[] = [];
    const readOld = () => {
      const snapshot = oldReader.read(graph, true);
      oldNodes = reconcileNodeHitboxes(oldNodes, snapshot.nodes);
      oldEdges = reconcileEdgeLabelHitboxes(oldEdges, snapshot.edges!);
      return { nodes: oldNodes, edges: oldEdges };
    };
    readOld();
    newReader.read(graph, true);
    const oldTotal: number[] = [],
      newTotal: number[] = [];
    const oldRead: number[] = [],
      newRead: number[] = [];
    const movedNodeCount =
      scenario === "one-node"
        ? 1
        : scenario === "group"
          ? Math.min(128, nodeCount)
          : 0;
    const prepare = (cy: Core, iteration: number) => {
      if (scenario === "unrelated-data") {
        cy.getElementById("n0").data("benchmarkRevision", iteration);
        cy.getElementById("e0").data("benchmarkRevision", iteration);
      } else if (movedNodeCount) {
        const moved = cy.nodes().slice(0, movedNodeCount);
        moved.forEach((node, index) => {
          node.position({
            x: graph.nodes[index]!.x + (iteration % 2 ? 24 : -24),
            y: graph.nodes[index]!.y + 24,
          });
        });
        refreshCytoscapeGeometry(cy.collection(moved));
      }
    };
    try {
      for (let iteration = 0; iteration < iterations; iteration++) {
        let before, after;
        const runOld = () => {
          const start = performance.now();
          prepare(reference.cy, iteration);
          const readStart = performance.now();
          before = readOld();
          const end = performance.now();
          if (iteration >= warmup) {
            oldRead.push(end - readStart);
            oldTotal.push(end - start);
          }
        };
        const runNew = () => {
          const start = performance.now();
          prepare(optimized.cy, iteration);
          const readStart = performance.now();
          after = newReader.read(graph, true);
          const end = performance.now();
          if (iteration >= warmup) {
            newRead.push(end - readStart);
            newTotal.push(end - start);
          }
        };
        if (iteration % 2) {
          runNew();
          runOld();
        } else {
          runOld();
          runNew();
        }
        assert.deepEqual(
          after,
          before,
          "geometry and order match the previous pipeline",
        );
        if (movedNodeCount) {
          assert.equal(after!.nodes[0]!.x, iteration % 2 ? 24 : -24);
        }
      }
      results.push({
        nodeCount,
        edgeCount,
        scenario,
        movedNodeCount,
        previousPipelineMedianMs: median(oldRead),
        indexedPipelineMedianMs: median(newRead),
        pipelineSpeedup: median(oldRead) / median(newRead),
        previousTotalMedianMs: median(oldTotal),
        indexedTotalMedianMs: median(newTotal),
        totalSpeedup: median(oldTotal) / median(newTotal),
        equivalencePasses: iterations,
      });
    } finally {
      oldReader.dispose();
      newReader.dispose();
      reference.cy.destroy();
      optimized.cy.destroy();
    }
  }
}
const report = {
  environment:
    "Bun CPU; real Cytoscape projection/cache with deterministic font metrics, zoom=1, no raster or DOM",
  referenceCommit: "eb9e11ea1d718c20c377707f2992c1bd3b5251e2",
  iterations,
  warmup,
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
