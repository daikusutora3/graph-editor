import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";

import type {
  EdgeLabelHitbox,
  NodeHitbox,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";
import {
  SelectEdgeHitboxes,
  SelectNodeHitboxes,
} from "../../features/graph-editor/canvas/GraphCanvasHitboxOverlays";
import { I18nProvider } from "../../features/graph-editor/i18n/I18nProvider";

const warmupPasses = 5;
const measurementPasses = 10;
const noOperation = () => {};
const emptySelection = new Set<string>();

// Measure the real overlay components with deterministic input. This is the
// CPU cost of producing initial HTML, not browser mounting or frame latency.
function overlay(nodeCount: number, edgeCount: number) {
  const nodes: NodeHitbox[] = Array.from({ length: nodeCount }, (_, index) => ({
    id: `n${index}`,
    label: "1",
    x: (index % 32) * 90,
    y: Math.floor(index / 32) * 90,
    width: 72,
  }));
  const edges: EdgeLabelHitbox[] = Array.from(
    { length: edgeCount },
    (_, index) => {
      const source = nodes[index % nodeCount]!;
      const target = nodes[(index + 1) % nodeCount]!;
      return {
        id: `e${index}`,
        label: "1",
        sourceX: source.x,
        sourceY: source.y,
        targetX: target.x,
        targetY: target.y,
        sourceWidth: 48,
        targetWidth: 48,
        nodeHeight: 48,
        x: (source.x + target.x) / 2,
        y: (source.y + target.y) / 2,
        labelWidth: 32,
        labelHeight: 32,
        bowPx: 24,
        controlPointDistancesPx: [24],
        controlPointWeights: [0.5],
        loopDirectionDeg: 0,
        loopSweepDeg: 90,
      };
    },
  );

  return (
    <I18nProvider initialLocale="en">
      <SelectNodeHitboxes
        nodes={nodes}
        selectedNodeIds={emptySelection}
        rangeSelectionActive={false}
        onClick={noOperation}
        onContextMenu={noOperation}
        onDoubleClick={noOperation}
        onPointerCancel={noOperation}
        onPointerDown={noOperation}
        onPointerMove={noOperation}
        onPointerUp={noOperation}
        onRangeSelectionPointerDown={() => false}
      />
      <SelectEdgeHitboxes
        edges={edges}
        selectedEdgeIds={emptySelection}
        rangeSelectionActive={false}
        weighted
        zoom={1}
        onContextMenu={noOperation}
        onBendPreview={() => null}
        onBendCommit={noOperation}
        onBendCancel={noOperation}
        onEdit={noOperation}
        onSelect={noOperation}
        onRangeSelectionPointerDown={() => false}
      />
    </I18nProvider>
  );
}

const results = (
  [
    [100, 400],
    [1_000, 5_000],
  ] as const
).map(([nodeCount, edgeCount]) => {
  const element = overlay(nodeCount, edgeCount);
  const ssrTimesMs: number[] = [];
  let markup = "";
  for (let index = 0; index < warmupPasses + measurementPasses; index++) {
    const start = performance.now();
    markup = renderToStaticMarkup(element);
    const elapsed = performance.now() - start;
    if (index >= warmupPasses) ssrTimesMs.push(elapsed);
  }
  const buttonCount = [...markup.matchAll(/<button(?=[\s>])/g)].length;
  const pathCount = [...markup.matchAll(/<path(?=[\s>])/g)].length;
  const svgCount = [...markup.matchAll(/<svg(?=[\s>])/g)].length;
  assert.equal(buttonCount, nodeCount + edgeCount);
  assert.equal(pathCount, edgeCount);
  assert.equal(svgCount, 1);

  return {
    nodeCount,
    edgeCount,
    weighted: true,
    label: "1",
    geometry: "fixed grid coordinates and one quadratic control per edge",
    buttonCount,
    pathCount,
    buttonAndPathCount: buttonCount + pathCount,
    svgCount,
    markupBytes: Buffer.byteLength(markup),
    medianSsrMs: median(ssrTimesMs),
    ssrTimesMs,
  };
});

const report = {
  environment: {
    runtime: "Bun",
    version: process.versions.bun,
    platform: process.platform,
    architecture: process.arch,
  },
  measurement:
    "CPU renderToStaticMarkup of actual SelectNodeHitboxes and SelectEdgeHitboxes; excludes browser DOM commit, layout, rasterization, events and React updates",
  warmupPasses,
  measurementPasses,
  results,
};
const outputIndex = process.argv.indexOf("--output");
const outputPath =
  outputIndex >= 0
    ? process.argv[outputIndex + 1]
    : "/tmp/graph-editor-overlay-mount.json";
assert(outputPath, "--output requires a file path");
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

function median(values: number[]) {
  assert(values.length > 0);
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
