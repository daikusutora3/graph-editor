import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import type { ElementDefinition } from "cytoscape";

import { syncCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-elements-sync";
import { graphModelToCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { refreshCytoscapeGeometry } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-geometry-refresh";
import { withCytoscapeBatch } from "../../features/graph-editor/adapters/cytoscape/cytoscape-batch";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { defaultEdgeRoutingMeta } from "../../features/graph-editor/core/layout/edge-routing";
import { createCalculationCanvas } from "../fixtures/calculation-canvas";

const referencePath = argument("--reference");
const reference: typeof syncCytoscapeElements | undefined = referencePath
  ? (await import(pathToFileURL(referencePath).href)).syncCytoscapeElements
  : undefined;
const iterations = Number(argument("--iterations") ?? 15);
const reports = [];

for (const [name, graph] of [
  ["reversed parallel 200", fixture(2, 200, true)],
  ["reversed parallel 1000", fixture(2, 1000, true)],
  ["sparse parallel 1000/5000", fixture(1000, 5000, false)],
] as const) {
  const definitions = graphModelToCytoscapeElements(graph, {
    edgeRoutingMeta: new Map(
      graph.edges.map((edge) => [edge.id, defaultEdgeRoutingMeta]),
    ),
  });
  for (const [operation, next] of [
    ["unchanged", definitions],
    [
      "remove half of edges",
      definitions.filter(
        (definition) =>
          definition.group === "nodes" ||
          Number(String(definition.data.id).slice(1)) % 2 === 1,
      ),
    ],
    ["remove every edge", definitions.filter((item) => item.group === "nodes")],
    ["reset graph", []],
  ] as const) {
    const timings = { reference: [] as number[], current: [] as number[] };
    let signature: string | undefined;
    for (let iteration = 0; iteration < iterations + 5; iteration++) {
      const implementations = reference
        ? iteration % 2
          ? ([
              ["current", syncCytoscapeElements],
              ["reference", reference],
            ] as const)
          : ([
              ["reference", reference],
              ["current", syncCytoscapeElements],
            ] as const)
        : ([["current", syncCytoscapeElements]] as const);
      for (const [version, synchronize] of implementations) {
        const { cy } = createCalculationCanvas(graph);
        try {
          const start = performance.now();
          const result = withCytoscapeBatch(cy, () =>
            synchronize(cy, next as ElementDefinition[]),
          );
          refreshCytoscapeGeometry(result.changedElements);
          const elapsed = performance.now() - start;
          const currentSignature = createHash("sha256")
            .update(
              JSON.stringify({
                counts: {
                  added: result.added,
                  recreated: result.recreated,
                  removed: result.removed,
                  skipped: result.skipped,
                  updated: result.updated,
                },
                elements: cy.elements().jsons(),
                bounds: cy.elements().boundingBox(),
              }),
            )
            .digest("hex");
          signature ??= currentSignature;
          assert.equal(
            currentSignature,
            signature,
            `${name}, ${operation}: exact element order, data and final bounds`,
          );
          if (iteration >= 5) timings[version].push(elapsed);
        } finally {
          cy.destroy();
        }
      }
    }
    const currentMs = median(timings.current);
    const referenceMs = reference ? median(timings.reference) : undefined;
    const report = {
      name,
      operation,
      currentMedianMs: currentMs,
      referenceMedianMs: referenceMs,
      speedup: referenceMs === undefined ? undefined : referenceMs / currentMs,
      signature,
    };
    reports.push(report);
    console.log(JSON.stringify(report));
  }
}

const outputPath = argument("--output");
if (outputPath)
  writeFileSync(outputPath, JSON.stringify({ iterations, reports }, null, 2));

function fixture(
  nodeCount: number,
  edgeCount: number,
  reversed: boolean,
): GraphModel {
  return {
    ...createEmptyGraphModel({ allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: String(index),
      x: (index % 32) * 90,
      y: Math.floor(index / 32) * 90,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${reversed ? index % 2 : index % nodeCount}`,
      target: `n${reversed ? (index + 1) % 2 : (index + 1) % nodeCount}`,
    })),
  };
}

function median(values: number[]) {
  return values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)]!;
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
