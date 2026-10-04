import { Profiler } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import cytoscape from "cytoscape";

import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";
import {
  SelectEdgeHitboxes,
  SelectNodeHitboxes,
} from "../../features/graph-editor/canvas/GraphCanvasHitboxOverlays";
import type {
  EdgeLabelHitbox,
  NodeHitbox,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";
import {
  readNodeHitboxes,
  readEdgeLabelHitboxes,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";
import {
  reconcileEdgeLabelHitboxes,
  reconcileNodeHitboxes,
} from "../../features/graph-editor/canvas/rendered-hitbox-reconciliation";
import {
  graphModelToCytoscapeElements,
  createGraphCanvasStylesheet,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { readCanvasPalette } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-viewport";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";

// Bundle this entry for a browser and call runCanvasHitboxBenchmark().
// React's development Profiler measures reconciliation on real DOM updates.
// It does not measure Cytoscape rendering or end-to-end pointer latency.
export function runCanvasHitboxBenchmark(nodeCount = 1_000, edgeCount = 5_000) {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  let nodes: NodeHitbox[] = Array.from({ length: nodeCount }, (_, index) => ({
    id: `n${index}`,
    label: `${index}`,
    x: (index % 32) * 90,
    y: Math.floor(index / 32) * 90,
    width: 72,
  }));
  let edges: EdgeLabelHitbox[] = Array.from(
    { length: edgeCount },
    (_, index) => ({
      id: `e${index}`,
      label: "",
      sourceX: (index % 32) * 90,
      sourceY: Math.floor((index % nodeCount) / 32) * 90,
      targetX: ((index + 1) % 32) * 90,
      targetY: Math.floor(((index + 1) % nodeCount) / 32) * 90,
      sourceWidth: 48,
      targetWidth: 48,
      nodeHeight: 48,
      x: (index % 32) * 90 + 45,
      y: Math.floor((index % nodeCount) / 32) * 90,
      bowPx: 0,
      controlPointDistancesPx: [0],
      controlPointWeights: [0.5],
      loopDirectionDeg: -45,
      loopSweepDeg: 70,
    }),
  );
  let selectedNodes = new Set<string>();
  let selectedEdges = new Set<string>();
  let commitDuration = 0;
  let callbackRevision = 0;
  let observedRevision = -1;

  const render = () => {
    callbackRevision += 1;
    const revision = callbackRevision;
    const observe = () => {
      observedRevision = revision;
    };
    commitDuration = 0;
    flushSync(() => {
      root.render(
        <I18nProvider initialLocale="en">
          <Profiler
            id="hitboxes"
            onRender={(_id, _phase, duration) => {
              commitDuration += duration;
            }}
          >
            <SelectNodeHitboxes
              nodes={nodes}
              selectedNodeIds={selectedNodes}
              rangeSelectionActive={false}
              onClick={observe}
              onContextMenu={observe}
              onDoubleClick={observe}
              onPointerCancel={observe}
              onPointerDown={observe}
              onPointerMove={observe}
              onPointerUp={observe}
              onRangeSelectionPointerDown={() => false}
            />
            <SelectEdgeHitboxes
              edges={edges}
              selectedEdgeIds={selectedEdges}
              rangeSelectionActive={false}
              weighted={false}
              zoom={1}
              onContextMenu={observe}
              onBendPreview={() => {
                observe();
                return null;
              }}
              onBendCommit={observe}
              onBendCancel={observe}
              onEdit={observe}
              onRangeSelectionPointerDown={() => false}
              onSelect={observe}
            />
          </Profiler>
        </I18nProvider>,
      );
    });
    return commitDuration;
  };

  render();
  const measure = (operation: string, prepare: (index: number) => void) => {
    const times: number[] = [];
    for (let index = 0; index < 15; index += 1) {
      prepare(index);
      const duration = render();
      if (index >= 5) times.push(duration);
    }
    return {
      operation,
      medianMs: median(times),
      maxMs: Math.max(...times),
    };
  };
  const results = [
    measure("unchanged geometry with fresh callbacks", () => {}),
    measure("one node and edge selection", (index) => {
      selectedNodes = new Set(index % 2 ? [] : ["n0"]);
      selectedEdges = new Set(index % 2 ? [] : ["e0"]);
    }),
    measure("one node and edge geometry change", (index) => {
      nodes = nodes.map((node, nodeIndex) =>
        nodeIndex === 0 ? { ...node, x: index } : node,
      );
      edges = edges.map((edge, edgeIndex) =>
        edgeIndex === 0 ? { ...edge, sourceX: index } : edge,
      );
    }),
  ];

  // A skipped render must still dispatch the callback from the latest commit.
  render();
  const nodeButton = host.querySelector<HTMLButtonElement>("button")!;
  nodeButton.click();
  if (observedRevision !== callbackRevision) {
    throw new Error("Node hitbox dispatched a stale callback");
  }
  observedRevision = -1;
  const edgeButton = host.querySelector<HTMLButtonElement>("svg + button")!;
  edgeButton.click();
  if (observedRevision !== callbackRevision) {
    throw new Error("Edge hitbox dispatched a stale callback");
  }
  for (const element of [nodeButton, edgeButton]) {
    for (const type of ["dblclick", "contextmenu"]) {
      observedRevision = -1;
      element.dispatchEvent(new MouseEvent(type, { bubbles: true }));
      if (observedRevision !== callbackRevision) {
        throw new Error(`${type} dispatched a stale hitbox callback`);
      }
    }
  }
  const edgePath = host.querySelector<SVGPathElement>("path")!;
  edgePath.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      pointerId: 1,
      button: 0,
      clientX: 40,
      clientY: 0,
    }),
  );
  // Changing parent callbacks during a bend must not reset its shared session.
  render();
  observedRevision = -1;
  edgePath.dispatchEvent(
    new PointerEvent("pointermove", {
      bubbles: true,
      pointerId: 1,
      clientX: 50,
      clientY: 40,
    }),
  );
  if (observedRevision !== callbackRevision) {
    throw new Error("Bend preview dispatched a stale callback");
  }
  observedRevision = -1;
  edgePath.dispatchEvent(
    new PointerEvent("pointerup", {
      bubbles: true,
      pointerId: 1,
      clientX: 50,
      clientY: 40,
    }),
  );
  if (observedRevision !== callbackRevision) {
    throw new Error("Bend commit dispatched a stale callback");
  }
  observedRevision = -1;
  edgeButton.click();
  if (observedRevision !== -1) {
    throw new Error("Bending an edge should suppress its immediate click");
  }
  edgeButton.click();
  if (observedRevision !== callbackRevision) {
    throw new Error("Edge clicks should resume after one suppressed click");
  }
  flushSync(() => root.unmount());
  host.remove();
  return { nodeCount, edgeCount, results, latestCallbacksVerified: true };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[midpoint]
    : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
}

export async function runCanvasHitboxReadBenchmark(
  nodeCount = 1_000,
  edgeCount = 5_000,
) {
  const host = document.createElement("div");
  host.style.width = "1200px";
  host.style.height = "800px";
  document.body.append(host);
  const graph = {
    ...createEmptyGraphModel({ allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: `${index}`,
      x: (index % 32) * 90,
      y: Math.floor(index / 32) * 90,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % nodeCount}`,
      target: `n${(index + 1) % nodeCount}`,
    })),
  };
  const cy = cytoscape({
    container: host,
    elements: graphModelToCytoscapeElements(graph),
    style: createGraphCanvasStylesheet(readCanvasPalette()),
    layout: { name: "preset", fit: false },
  });
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );
  let currentNodes = readNodeHitboxes(cy, graph);
  let currentEdges = readEdgeLabelHitboxes(cy, graph);
  const reads: number[] = [];
  const reconciliations: number[] = [];
  const preservedNodes: number[] = [];
  const preservedEdges: number[] = [];
  for (let index = 0; index < 25; index += 1) {
    cy.getElementById("n0").position({ x: index % 2, y: 0 });
    const start = performance.now();
    const nextNodes = readNodeHitboxes(cy, graph);
    const nextEdges = readEdgeLabelHitboxes(cy, graph);
    const readTime = performance.now() - start;
    const reconcileStart = performance.now();
    const reconciledNodes = reconcileNodeHitboxes(currentNodes, nextNodes);
    const reconciledEdges = reconcileEdgeLabelHitboxes(currentEdges, nextEdges);
    const reconcileTime = performance.now() - reconcileStart;
    if (index >= 5) {
      reads.push(readTime);
      reconciliations.push(reconcileTime);
      preservedNodes.push(
        reconciledNodes.filter(
          (node, nodeIndex) => node === currentNodes[nodeIndex],
        ).length,
      );
      preservedEdges.push(
        reconciledEdges.filter(
          (edge, edgeIndex) => edge === currentEdges[edgeIndex],
        ).length,
      );
    }
    currentNodes = reconciledNodes;
    currentEdges = reconciledEdges;
  }
  cy.destroy();
  host.remove();
  return {
    nodeCount,
    edgeCount,
    readMedianMs: median(reads),
    readMaxMs: Math.max(...reads),
    reconciliationMedianMs: median(reconciliations),
    reconciliationMaxMs: Math.max(...reconciliations),
    preservedNodeCount: Math.min(...preservedNodes),
    preservedEdgeCount: Math.min(...preservedEdges),
  };
}

Object.assign(globalThis, {
  runCanvasHitboxBenchmark,
  runCanvasHitboxReadBenchmark,
});
