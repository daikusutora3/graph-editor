import cytoscape from "cytoscape";

import {
  createGraphCanvasStylesheet,
  graphModelToCytoscapeElements,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { readCanvasPalette } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-viewport";
import {
  readRangeSelectionPreview,
  type RangeSelectionBox,
} from "../../features/graph-editor/canvas/range-selection-preview-geometry";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { readRangeSelectionPreviewReference } from "../fixtures/range-selection-preview-reference";

// Browser geometry calculation only; this excludes Cytoscape paint and class
// application. The frozen previous implementation uses the exact same canvas.
export async function runRangeSelectionPreviewBenchmark() {
  const host = document.createElement("div");
  host.style.width = "1200px";
  host.style.height = "800px";
  document.body.append(host);
  const graph = {
    ...createEmptyGraphModel({ allowMultiEdges: true, allowSelfLoops: true }),
    nodes: Array.from({ length: 1000 }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: `${index}`,
      x: (index % 32) * 90,
      y: Math.floor(index / 32) * 90,
    })),
    edges: Array.from({ length: 5000 }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % 1000}`,
      target: `n${(index + (index % 23 === 0 ? 0 : 1)) % 1000}`,
      ...(index % 5 === 0 ? { routing: { bowPx: 40, bowT: 0.5 } } : {}),
    })),
  };
  const cy = cytoscape({
    container: host,
    elements: graphModelToCytoscapeElements(graph),
    style: createGraphCanvasStylesheet(readCanvasPalette()),
    layout: { name: "preset", fit: false },
  });
  try {
    // Exercise actual segment getters as well as bezier curves and loops.
    cy.edges().slice(1, 5).style({
      "curve-style": "segments",
      "segment-distances": "40",
      "segment-weights": "0.5",
    });
    const boxes: Record<string, RangeSelectionBox> = {
      small: { x1: 0, y1: 0, x2: 200, y2: 200 },
      enclosing: { x1: -1000, y1: -1000, x2: 5000, y2: 5000 },
    };
    for (const viewport of [
      { zoom: 0.1, pan: { x: 100, y: -50 } },
      { zoom: 1.5, pan: { x: -100, y: 50 } },
      { zoom: 0.75, pan: { x: 200, y: 150 } },
    ]) {
      cy.zoom(viewport.zoom);
      cy.pan(viewport.pan);
      for (const box of Object.values(boxes))
        for (const filter of ["all", "nodes", "edges"] as const) {
          const before = readRangeSelectionPreviewReference(cy, box, filter);
          const after = readRangeSelectionPreview(cy, box, filter);
          if (
            JSON.stringify([[...before.nodeIds], [...before.edgeIds]]) !==
            JSON.stringify([[...after.nodeIds], [...after.edgeIds]])
          )
            throw new Error(
              `Viewport ${JSON.stringify(viewport)} changed ${filter} preview ids`,
            );
        }
    }
    cy.zoom(1);
    cy.pan({ x: 0, y: 0 });
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );
    const metrics = [];
    for (const [name, box] of Object.entries(boxes)) {
      for (const filter of ["all", "nodes", "edges"] as const) {
        const before: number[] = [];
        const after: number[] = [];
        const signature = (
          result: ReturnType<typeof readRangeSelectionPreview>,
        ) => JSON.stringify([[...result.nodeIds], [...result.edgeIds]]);
        const expected = signature(
          readRangeSelectionPreviewReference(cy, box, filter),
        );
        for (let index = 0; index < 35; index++) {
          // Alternate order to avoid assigning all warm-up benefit to one path.
          const samples =
            index % 2
              ? ([
                  [readRangeSelectionPreview, after],
                  [readRangeSelectionPreviewReference, before],
                ] as const)
              : ([
                  [readRangeSelectionPreviewReference, before],
                  [readRangeSelectionPreview, after],
                ] as const);
          for (const [read, times] of samples) {
            const start = performance.now();
            const result = read(cy, box, filter);
            const elapsed = performance.now() - start;
            if (signature(result) !== expected)
              throw new Error(`${name}/${filter} changed preview ids`);
            if (index >= 5) times.push(elapsed);
          }
        }
        const counts = () => ({
          source: 0,
          target: 0,
          controls: 0,
          segments: 0,
          modelControls: 0,
          modelSegments: 0,
        });
        const previousCalls = counts();
        const currentCalls = counts();
        let activeCalls = previousCalls;
        const restore: (() => void)[] = [];
        const getters = {
          renderedSourceEndpoint: "source",
          renderedTargetEndpoint: "target",
          renderedControlPoints: "controls",
          renderedSegmentPoints: "segments",
          controlPoints: "modelControls",
          segmentPoints: "modelSegments",
        } as const;
        cy.edges().forEach((edge) => {
          const instrumentedEdge = edge as unknown as Record<
            keyof typeof getters,
            () => unknown
          >;
          for (const [method, counter] of Object.entries(getters) as [
            keyof typeof getters,
            (typeof getters)[keyof typeof getters],
          ][]) {
            const original = instrumentedEdge[method];
            instrumentedEdge[method] = () => {
              activeCalls[counter]++;
              return original.call(edge);
            };
            restore.push(() => {
              instrumentedEdge[method] = original;
            });
          }
        });
        try {
          readRangeSelectionPreviewReference(cy, box, filter);
          activeCalls = currentCalls;
          readRangeSelectionPreview(cy, box, filter);
        } finally {
          restore.forEach((reset) => reset());
        }
        metrics.push({
          name: `${name}/${filter}`,
          beforeMedianMs: median(before),
          afterMedianMs: median(after),
          beforeMaxMs: Math.max(...before),
          afterMaxMs: Math.max(...after),
          previousCalls,
          currentCalls,
          samePreviewIds: true,
        });
      }
    }
    return {
      nodeCount: 1000,
      edgeCount: 5000,
      viewportEquivalenceVerified: true,
      metrics,
    };
  } finally {
    cy.destroy();
    host.remove();
  }
}

function median(values: number[]) {
  const sorted = values.toSorted((a, b) => a - b);
  return (sorted[14] + sorted[15]) / 2;
}

Object.assign(globalThis, { runRangeSelectionPreviewBenchmark });
