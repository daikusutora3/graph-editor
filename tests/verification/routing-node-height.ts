import { readFileSync } from "node:fs";

import { withMeasuredNodeGeometry } from "../../features/graph-editor/adapters/browser/node-geometry";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import { restoreRoutingInteractionNodes } from "../../features/graph-editor/compute/routing-interaction";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import { createRustInteractiveRerouteBatch } from "../../features/graph-editor/compute/wasm-interactive-routing";
import {
  countRustCurveNodeCollisions,
  projectRustEdgeObstacles,
  scoreRustCurveNodeAndShape,
  scoreRustLoopObstacles,
} from "../../features/graph-editor/compute/wasm-routing";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphNode } from "../../features/graph-editor/core/graph/model";
import { nodeGeometryHeight } from "../../features/graph-editor/core/graph/node-size";
import {
  computeEdgeRouting,
  createEdgeRoutingCacheKey,
  defaultEdgeRoutingMeta,
  projectedEdgeObstacles,
} from "../../features/graph-editor/core/layout/edge-routing";
import { countCurveNodeCollisions } from "../../features/graph-editor/core/layout/edge-routing-collisions";
import { scoreCurveNodeAndShape } from "../../features/graph-editor/core/layout/edge-routing-scoring";
import type { ResolvedEdgeRoutingOptions } from "../../features/graph-editor/core/layout/edge-routing-shared";
import { interactiveRerouteEdgeIdsTask } from "../../features/graph-editor/core/layout/interactive-routing";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Measured routing height");
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));

type MeasuredNode = GraphNode & {
  measuredWidth: number;
  measuredHeight: number;
};
const node = (
  id: string,
  x: number,
  y: number,
  height = 72,
  width = height,
): MeasuredNode => ({
  id,
  label: "",
  order: 0,
  x,
  y,
  measuredWidth: width,
  measuredHeight: height,
});
const source = node("source", -200, 0);
const target = node("target", 200, 0);
const edge = { id: "edge", source: source.id, target: target.id };
const straight = { controlPointDistancesPx: [0], controlPointWeights: [0.5] };
const model = {
  ...createEmptyGraphModel({ autoEdgeRouting: true, allowSelfLoops: true }),
  nodes: [source, target, node("obstacle", 0, 35)],
  edges: [edge],
};
function options(): ResolvedEdgeRoutingOptions {
  return {
    avoidNodes: true,
    work: {
      units: 0,
      samples: new Map(),
      labelAnchors: new Map(),
      labelSizes: new Map(),
    },
    candidateBowPx: [0, 16, -16, 64, -64, 180, -180],
    duplicateBowPx: 36,
    loopDirectionDeg: -45,
    loopDirectionStepDeg: 42,
    loopSweepDeg: 70,
    loopSweepStepDeg: 16,
    maxLoopSweepDeg: 120,
    nodeClearancePx: 30,
    previousMeta: new Map(),
    rerouteEdgeIds: null,
    separateParallelEdges: true,
    variant: 0,
  };
}

const plain = {
  ...model,
  nodes: model.nodes.map(
    ({ measuredWidth: _width, measuredHeight: _height, ...entry }) => entry,
  ),
};
const measured = withMeasuredNodeGeometry(plain, {
  nodeSize: 72,
  nodeFontSize: 24,
  fontFamily: "sans-serif",
});
expect(
  measured.nodes.every((entry) => nodeGeometryHeight(entry) === 72),
  "root 24px geometry passes the displayed 72px height to routing",
);
expect(
  plain.nodes.every((entry) => !("measuredHeight" in entry)),
  "measurement leaves the stored graph untouched",
);
expect(
  nodeGeometryHeight(plain.nodes[0]!) === 48,
  "fixtures and non-browser clients retain default 48px geometry",
);

for (const height of [32, 48, 72, 96]) {
  const threshold = height / 2 + 6;
  for (const gap of [threshold - 1e-7, threshold, threshold + 1e-7]) {
    const nodes = [source, target, node("obstacle", 0, gap, height)];
    const expected = gap < threshold ? 1 : 0;
    const js = withRustKernelSuppressed(() =>
      countCurveNodeCollisions(straight, edge, source, target, nodes),
    );
    const rust = countRustCurveNodeCollisions(
      straight,
      source,
      target,
      edge,
      nodes,
    );
    expect(
      js === expected,
      `${height}px final collision keeps its strict visible-radius boundary at ${gap}`,
    );
    expect(
      rust === null || rust.collisions === js,
      `${height}px Wasm final collision agrees or falls back at the exact threshold`,
    );
    if (gap !== threshold)
      expect(
        rust !== null,
        `${height}px non-boundary collision uses the numeric kernel`,
      );
  }
}

const mutable = model.nodes[2]!;
expect(
  countRustCurveNodeCollisions(straight, source, target, edge, model.nodes)
    ?.collisions === 1,
  "72px obstacle intersects the straight edge",
);
mutable.measuredHeight = 48;
expect(
  countRustCurveNodeCollisions(straight, source, target, edge, model.nodes)
    ?.collisions === 0,
  "height-only mutation invalidates the Wasm numeric snapshot",
);
mutable.measuredHeight = 72;
const tallKey = createEdgeRoutingCacheKey(model);
mutable.measuredHeight = 48;
expect(
  createEdgeRoutingCacheKey(model) !== tallKey,
  "height-only mutation invalidates the routing task cache even at constant width",
);
mutable.measuredHeight = 72;
const hidden = {
  ...model,
  settings: { ...model.settings, showNodeLabels: false },
};
const hiddenKey = createEdgeRoutingCacheKey(hidden);
mutable.measuredHeight = 48;
expect(
  createEdgeRoutingCacheKey(hidden) !== hiddenKey,
  "hidden labels retain the measured circle height in routing cache keys",
);
mutable.measuredHeight = 72;

for (const height of [32, 48, 72, 96]) {
  const nodes = [source, target, node("obstacle", 0, 35, height, 200)];
  for (const bow of [0, 18, -35, 96]) {
    const curve = {
      controlPointDistancesPx: [bow],
      controlPointWeights: [0.5],
    };
    const opts = options();
    const js = withRustKernelSuppressed(() =>
      scoreCurveNodeAndShape(curve, source, target, edge, nodes, opts),
    );
    const rust = scoreRustCurveNodeAndShape(
      curve,
      source,
      target,
      edge,
      nodes,
      30,
    );
    expect(
      rust !== null &&
        rust.collisions === js.collisions &&
        Math.abs(rust.score - js.score) < 1e-8 &&
        rust.units === opts.work.units,
      `${height}px capsule candidate scoring, collision count and work agree for bow ${bow}`,
    );
  }
}

const projectionNodes = [
  source,
  target,
  ...Array.from({ length: 254 }, (_, i) =>
    node(
      `p${i}`,
      i < 4 ? i * 60 - 90 : i * 100 + 5000,
      i < 4 ? 35 : 5000,
      [32, 48, 72, 96][i % 4]!,
      180,
    ),
  ),
];
const projectionJs = withRustKernelSuppressed(() =>
  projectedEdgeObstacles(edge, source, target, projectionNodes, 30),
);
const projectionRust = projectRustEdgeObstacles(
  edge,
  source,
  target,
  projectionNodes,
  30,
);
expect(
  projectionRust !== null &&
    JSON.stringify(projectionRust) === JSON.stringify(projectionJs),
  "mixed measured heights preserve exact projected capsule clusters across JS and Wasm",
);

const loopNodes = [
  node("loop-obstacle", 0, 35),
  ...Array.from({ length: 15 }, (_, i) =>
    node(`far${i}`, 5000 + i * 100, 5000),
  ),
];
const loop = scoreRustLoopObstacles(
  loopNodes,
  [{ x: 0, y: 0 }],
  30,
  { x1: -100, y1: -100, x2: 100, y2: 100 },
  true,
);
expect(
  loop !== null && loop[0] === 49 && loop[2] === 1,
  "self-loop obstacle scoring uses the 72px radius plus its existing safety gap",
);
const loopModel = {
  ...model,
  edges: [
    edge,
    { id: "loop", source: "source", target: "source", label: "loop" },
  ],
};
const loopJs = withRustKernelSuppressed(() => computeEdgeRouting(loopModel));
const loopRust = computeEdgeRouting(loopModel);
expect(
  JSON.stringify([...loopJs]) === JSON.stringify([...loopRust]),
  "full straight and self-loop routing agree for enlarged geometry",
);

const moved = Array.from({ length: 128 }, (_, i) =>
  node(`m${i}`, i === 0 ? 0 : 5000 + i * 100, i === 0 ? 90 : 5000),
);
const dragModel = {
  ...model,
  nodes: [source, target, ...moved],
  edges: Array.from({ length: 128 }, (_, i) => ({ ...edge, id: `drag${i}` })),
};
const movedIds = new Set(moved.map((entry) => entry.id));
const previous = new Map(
  dragModel.edges.map((entry) => [
    entry.id,
    { ...defaultEdgeRoutingMeta, status: "ready" as const },
  ]),
);
function dragIds(javascript: boolean) {
  const task = interactiveRerouteEdgeIdsTask(dragModel, previous, movedIds);
  const advance = () =>
    javascript ? withRustKernelSuppressed(() => task.next()) : task.next();
  let step = advance();
  while (!step.done) step = advance();
  return step.value ? [...step.value] : null;
}
const rustBatch = createRustInteractiveRerouteBatch(moved, 128);
expect(
  rustBatch?.(
    Array.from({ length: 8 }, () => ({ source, target, curve: straight })),
  )?.every((decision) => decision === 1) === true,
  "interactive Wasm batching includes the enlarged 96px reroute clearance",
);
expect(
  dragIds(true)?.length === 128 &&
    JSON.stringify(dragIds(true)) === JSON.stringify(dragIds(false)),
  "enlarged drag obstacles select the same ordered reroute set in JS and Wasm",
);
moved[0]!.measuredHeight = 48;
expect(
  dragIds(true)?.length === 0 && dragIds(false)?.length === 0,
  "the same drag at default height retains its original 84px threshold",
);

const previousPosition = node("obstacle", 0, 35);
const cloned = structuredClone({
  model,
  interaction: {
    movedNodeIds: new Set(["obstacle"]),
    previousNodes: [previousPosition],
  },
});
const restored = restoreRoutingInteractionNodes(
  cloned.model,
  cloned.interaction,
);
expect(
  restored.length === model.nodes.length + 1 &&
    restored.every((entry) => nodeGeometryHeight(entry) === 72),
  "worker cloning and compact interaction preserve current and previous measured heights",
);
finish();
