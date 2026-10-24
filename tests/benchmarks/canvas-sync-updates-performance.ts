import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { withCytoscapeBatch } from "../../features/graph-editor/adapters/cytoscape/cytoscape-batch";
import { graphModelToCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { syncCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-elements-sync";
import { refreshCytoscapeGeometry } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-geometry-refresh";
import {
  readNodeHitboxes,
  readEdgeLabelHitboxes,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";
import { createRenderedHitboxReader } from "../../features/graph-editor/adapters/cytoscape/rendered-hitbox-reader";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { defaultEdgeRoutingMeta } from "../../features/graph-editor/core/layout/edge-routing";
import { createCalculationCanvas } from "../fixtures/calculation-canvas";

const referencePath = argument("--reference");
const reference: typeof syncCytoscapeElements | undefined = referencePath
  ? (await import(pathToFileURL(referencePath).href)).syncCytoscapeElements
  : undefined;
const candidatePath = argument("--candidate");
const current: typeof syncCytoscapeElements = candidatePath
  ? (await import(pathToFileURL(candidatePath).href)).syncCytoscapeElements
  : syncCytoscapeElements;
const iterations = Number(argument("--iterations") ?? 15);
const singleEdits = process.argv.includes("--single-edits");
const bulkEdits = process.argv.includes("--bulk-edits");
const cachedReader = process.argv.includes("--cached-reader");
const preciseSetters = process.argv.includes("--precise-setters");
const reports = [];

for (const [nodeCount, edgeCount] of singleEdits || bulkEdits
  ? ([[1000, 5000]] as const)
  : ([
      [200, 1000],
      [1000, 5000],
    ] as const)) {
  const graph = fixture(nodeCount, edgeCount, singleEdits);
  const edgeRoutingMeta = new Map(
    graph.edges.map((edge, index) => [
      edge.id,
      {
        ...defaultEdgeRoutingMeta,
        controlPointDistancesPx: [index % 2 ? -60 : 90],
      },
    ]),
  );
  const operations = singleEdits
    ? ([
        "unchanged",
        "move one low-degree node",
        "move one high-degree node",
        "color one low-degree node",
        "color one high-degree node",
        "label one low-degree node",
        "color one edge",
        "manual curve on one edge",
      ] as const)
    : bulkEdits
      ? ([
          "unchanged",
          "move every node",
          "color every element",
          "label every element",
          "change every field",
        ] as const)
      : ([
          "unchanged",
          "move every node",
          "color every element",
          "label every element",
          "mixed edit during drag",
          "distant origin rebase",
        ] as const);
  for (const operation of operations) {
    const editedNodeId = operation.includes("high-degree")
      ? graph.nodes[0]!.id
      : operation.includes("low-degree")
        ? graph.nodes[1]!.id
        : undefined;
    const next: GraphModel = {
      ...graph,
      nodes: graph.nodes.map((node) => ({
        ...node,
        ...(operation === "move every node" ||
        operation === "mixed edit during drag" ||
        operation === "change every field" ||
        (operation.startsWith("move one") && node.id === editedNodeId)
          ? { x: node.x + 24, y: node.y - 24 }
          : operation === "distant origin rebase"
            ? { x: node.x + 1e9, y: node.y - 1e9 }
            : {}),
        ...(operation === "color every element" ||
        operation === "mixed edit during drag" ||
        operation === "change every field" ||
        (operation.startsWith("color one") && node.id === editedNodeId)
          ? { color: "green" as const }
          : {}),
        ...(operation === "label every element" ||
        operation === "mixed edit during drag" ||
        operation === "change every field" ||
        (operation.startsWith("label one") && node.id === editedNodeId)
          ? { label: `${node.label} updated` }
          : {}),
      })),
      edges: graph.edges.map((edge) => ({
        ...edge,
        ...(operation === "color every element" ||
        operation === "change every field" ||
        (operation === "color one edge" && edge.id === "e0")
          ? { color: "pink" as const }
          : {}),
        ...(operation === "label every element" ||
        operation === "change every field"
          ? { label: `${edge.label} updated` }
          : {}),
        ...((operation === "manual curve on one edge" && edge.id === "e0") ||
        operation === "change every field"
          ? { routing: { bowPx: -140, bowT: 0.25 } }
          : {}),
      })),
    };
    const definitions = graphModelToCytoscapeElements(next, {
      edgeRoutingMeta,
    });
    const definitionSnapshot = JSON.stringify(definitions);
    const timings = { reference: [] as number[], current: [] as number[] };
    const syncTimings = { reference: [] as number[], current: [] as number[] };
    const eventsByVersion: Record<string, Record<string, number>> = {};
    let signature: string | undefined;
    for (let iteration = 0; iteration < iterations + 5; iteration++) {
      const implementations = reference
        ? iteration % 2
          ? ([
              ["current", current],
              ["reference", reference],
            ] as const)
          : ([
              ["reference", reference],
              ["current", current],
            ] as const)
        : ([["current", current]] as const);
      for (const [version, synchronize] of implementations) {
        const { cy, renderer } = createCalculationCanvas(
          graph,
          edgeRoutingMeta,
        );
        const hitboxReader = cachedReader
          ? createRenderedHitboxReader(cy)
          : undefined;
        try {
          cy.nodes()[0]!
            .select()
            .addClass("edge-source label-editing range-preview");
          cy.edges()[0]!.select().addClass("label-editing range-preview");
          hitboxReader?.read(graph, true);
          const identities = cy.elements().toArray();
          const events: Record<string, number> = {
            data: 0,
            class: 0,
            position: 0,
            style: 0,
          };
          cy.on("data class position style", (event) => {
            events[event.type]! += 1;
          });
          const start = performance.now();
          const result = withCytoscapeBatch(cy, () =>
            synchronize(cy, definitions, {
              skipNodePositionIds:
                operation === "mixed edit during drag"
                  ? new Set(["__proto__"])
                  : undefined,
            }),
          );
          const syncElapsed = performance.now() - start;
          const syncEvents = { ...events };
          refreshCytoscapeGeometry(result.changedElements);
          const snapshot = hitboxReader?.read(next, true);
          const nodeHitboxes = snapshot
            ? snapshot.nodes
            : readNodeHitboxes(cy, next);
          const edgeHitboxes = snapshot
            ? snapshot.edges
            : readEdgeLabelHitboxes(cy, next);
          const elapsed = performance.now() - start;
          renderer.flushRenderedStyleQueue();
          if (hitboxReader) {
            assert.deepEqual(nodeHitboxes, readNodeHitboxes(cy, next));
            assert.deepEqual(edgeHitboxes, readEdgeLabelHitboxes(cy, next));
          }
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
                changedIds: result.changedElements.map((element) =>
                  element.id(),
                ),
                elements: cy.elements().jsons(),
                bounds: cy.elements().boundingBox(),
                edges: cy
                  .edges()
                  .map((edge) => [
                    edge.midpoint(),
                    edge.sourceEndpoint(),
                    edge.targetEndpoint(),
                  ]),
                pan: cy.pan(),
                nodeHitboxes,
                edgeHitboxes,
              }),
            )
            .digest("hex");
          signature ??= currentSignature;
          assert.equal(
            currentSignature,
            signature,
            `${nodeCount}/${edgeCount}, ${operation}: exact state/order/geometry`,
          );
          identities.forEach((element) =>
            assert.equal(cy.getElementById(element.id()), element),
          );
          assert.equal(JSON.stringify(definitions), definitionSnapshot);
          if (eventsByVersion[version])
            assert.deepEqual(syncEvents, eventsByVersion[version]);
          else eventsByVersion[version] = syncEvents;
          if (iteration >= 5) {
            timings[version].push(elapsed);
            syncTimings[version].push(syncElapsed);
          }
        } finally {
          hitboxReader?.dispose();
          cy.destroy();
        }
      }
    }
    if (singleEdits) {
      const changed = operation !== "unchanged";
      const moved = operation.startsWith("move one");
      const colored = operation.startsWith("color one");
      assert.deepEqual(eventsByVersion.current, {
        data: Number(changed && (!moved || !preciseSetters)),
        class: Number(colored),
        position: Number(preciseSetters ? moved : editedNodeId !== undefined),
        style: Number(changed && (!moved || !preciseSetters)),
      });
      if (reference)
        assert.deepEqual(eventsByVersion.reference, {
          data: Number(changed),
          class: Number(colored),
          position: Number(editedNodeId !== undefined),
          style: Number(changed),
        });
    }
    const currentMs = median(timings.current);
    const referenceMs = reference ? median(timings.reference) : undefined;
    const report = {
      nodeCount,
      edgeCount,
      fixture: singleEdits ? "hub and leaf" : "sparse parallel",
      hitboxReader: cachedReader
        ? "production incremental reader"
        : "complete snapshots",
      operation,
      editedNodeId,
      editedNodeDegree: editedNodeId
        ? graph.edges.filter(
            (edge) =>
              edge.source === editedNodeId || edge.target === editedNodeId,
          ).length
        : undefined,
      currentMedianMs: currentMs,
      referenceMedianMs: referenceMs,
      currentP95Ms: percentile(timings.current, 0.95),
      referenceP95Ms: reference
        ? percentile(timings.reference, 0.95)
        : undefined,
      currentSyncMedianMs: median(syncTimings.current),
      referenceSyncMedianMs: reference
        ? median(syncTimings.reference)
        : undefined,
      currentSyncP95Ms: percentile(syncTimings.current, 0.95),
      referenceSyncP95Ms: reference
        ? percentile(syncTimings.reference, 0.95)
        : undefined,
      speedup: referenceMs === undefined ? undefined : referenceMs / currentMs,
      syncEvents: eventsByVersion,
      signature,
      samplesMs: timings,
    };
    reports.push(report);
    console.log(JSON.stringify({ ...report, samplesMs: undefined }));
  }
}

const outputPath = argument("--output");
if (outputPath)
  writeFileSync(
    outputPath,
    JSON.stringify(
      {
        iterations,
        implementationForm: {
          reference: referencePath ? "saved module" : undefined,
          current: candidatePath ? "saved module" : "source module",
        },
        moduleSha256: {
          reference: referencePath ? hashFile(referencePath) : undefined,
          current: candidatePath ? hashFile(candidatePath) : undefined,
        },
        sourceSha256: {
          reference: argument("--reference-source")
            ? hashFile(argument("--reference-source")!)
            : undefined,
          current: argument("--candidate-source")
            ? hashFile(argument("--candidate-source")!)
            : undefined,
        },
        preciseSetters,
        reports,
      },
      null,
      2,
    ),
  );

function fixture(
  nodeCount: number,
  edgeCount: number,
  hubAndLeaf: boolean,
): GraphModel {
  const nodeId = (index: number) => (index === 0 ? "__proto__" : `n${index}`);
  const endpoints = (index: number) =>
    hubAndLeaf
      ? index === 0
        ? [1, 2]
        : index % 5 === 0
          ? [0, 2 + (index % (nodeCount - 2))]
          : [2 + (index % (nodeCount - 2)), 2 + ((index + 1) % (nodeCount - 2))]
      : [index % nodeCount, (index + 1) % nodeCount];
  return {
    ...createEmptyGraphModel({ allowMultiEdges: true, showNodeLabels: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: nodeId(index),
      order: index,
      label: String(index),
      x: (index % 32) * 90,
      y: Math.floor(index / 32) * 90,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => {
      const [source, target] = endpoints(index);
      return {
        id: `e${index}`,
        source: nodeId(source!),
        target: nodeId(target!),
        label: String(index),
      };
    }),
  };
}

function median(values: number[]) {
  return percentile(values, 0.5);
}

function percentile(values: number[], fraction: number) {
  return values.toSorted((a, b) => a - b)[
    Math.ceil(values.length * fraction) - 1
  ]!;
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}

function hashFile(path: string) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}
