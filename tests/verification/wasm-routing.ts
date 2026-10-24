/* oxlint-disable no-await-in-loop -- Each comparison depends on the global kernel state from the previous step. */
import { readFileSync } from "node:fs";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  getRustKernelReady,
  initializeRustKernelFromBytes,
  resetRustKernelForTests,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import {
  scoreRustCurveNodeAndShape,
  scoreRustLoopObstacles,
} from "../../features/graph-editor/compute/wasm-routing";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { parseGraphModelJson } from "../../features/graph-editor/core/graph/graph-json";
import type {
  GraphEdge,
  GraphModel,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";
import type { EdgeCurveGeometry } from "../../features/graph-editor/core/layout/edge-route-geometry";
import { createEdgeRoutingTask } from "../../features/graph-editor/core/layout/edge-routing";
import {
  createLoopDirectionTask,
  scoreLoopDirection,
} from "../../features/graph-editor/core/layout/edge-routing-loops";
import {
  scoreCurveLabelOverlap,
  scoreCurveNodeAndShape,
} from "../../features/graph-editor/core/layout/edge-routing-scoring";
import type { ResolvedEdgeRoutingOptions } from "../../features/graph-editor/core/layout/edge-routing-shared";
import {
  createSampleGraph,
  type SampleGraphKind,
} from "../../features/graph-editor/samples/sample-graphs";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Rust routing");
const bytes = readFileSync(`${process.cwd()}/public${RUST_KERNEL_URL}`);
let seed = 3971;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
}

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

function fixture(): GraphModel {
  const nodes = Array.from({ length: 90 }, (_, index) => ({
    id: `n${index}`,
    order: index,
    label: index % 4 === 0 ? "長い頂点ラベル".repeat(3) : String(index),
    x: Math.round(random() * 900 - 450),
    y: Math.round(random() * 700 - 350),
  }));
  nodes[0]!.x = -220;
  nodes[0]!.y = 0;
  nodes[1]!.x = 220;
  nodes[1]!.y = 0;
  nodes[2]!.x = 0;
  nodes[2]!.y = -200;
  nodes[3]!.x = 0;
  nodes[3]!.y = 200;
  return {
    ...createEmptyGraphModel({
      autoEdgeRouting: true,
      allowSelfLoops: true,
      allowMultiEdges: true,
    }),
    nodes,
    edges: Array.from({ length: 60 }, (_, index) => ({
      id: `e${index}`,
      source: `n${(index * 2) % nodes.length}`,
      target: `n${(index * 2 + 1) % nodes.length}`,
      label: index % 3 === 0 ? "long edge label" : "1",
      ...(index % 5 === 0 && index > 0
        ? { routing: { bowPx: index % 2 === 0 ? 64 : -64 } }
        : {}),
    })),
  };
}

const model = fixture();
const source = model.nodes[0]!;
const target = model.nodes[1]!;
const edge = model.edges[0]!;
const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
const curves: EdgeCurveGeometry[] = [
  { controlPointDistancesPx: [], controlPointWeights: [] },
  { controlPointDistancesPx: [0], controlPointWeights: [0.5] },
  { controlPointDistancesPx: [180], controlPointWeights: [0.05] },
  { controlPointDistancesPx: [-180], controlPointWeights: [0.95] },
  { controlPointDistancesPx: [64, -64], controlPointWeights: [0.2, 0.8] },
  { controlPointDistancesPx: [1, 32, 0], controlPointWeights: [0.1, 0.5] },
  ...Array.from({ length: 60 }, () => {
    const count = 1 + Math.floor(random() * 4);
    return {
      controlPointDistancesPx: Array.from(
        { length: count },
        () => random() * 360 - 180,
      ),
      controlPointWeights: Array.from(
        { length: count },
        (_, index) => (index + 1) / (count + 1),
      ),
    };
  }),
];

function scores(curve: EdgeCurveGeometry) {
  const opts = options();
  const node = scoreCurveNodeAndShape(
    curve,
    source,
    target,
    edge,
    model.nodes,
    opts,
  );
  const label = scoreCurveLabelOverlap(
    edge,
    model.edges,
    nodesById,
    curve,
    opts,
    new Map(),
    true,
  );
  return { ...node, label, units: opts.work.units };
}

resetRustKernelForTests();
const pairNodes = new Map(
  ['a","b', "c", "a", 'b","c'].map((id, order) => [
    id,
    { id, order, label: id, x: order % 2 ? 100 : -100, y: 0 },
  ]),
);
const pairEdge = { id: "chosen", source: 'a","b', target: "c", label: "L" };
const pairEdges = [
  pairEdge,
  { ...pairEdge, id: "same" },
  {
    ...pairEdge,
    id: "reverse",
    source: pairEdge.target,
    target: pairEdge.source,
  },
  { id: "different", source: "a", target: 'b","c', label: "L" },
  { id: "loop", source: "a", target: "a", label: "L" },
];
for (const includeParallelLabels of [false, true]) {
  const opts = options();
  const score = scoreCurveLabelOverlap(
    pairEdge,
    pairEdges,
    pairNodes,
    curves[1]!,
    opts,
    new Map(),
    includeParallelLabels,
  );
  expect(
    opts.work.units === (includeParallelLabels ? 3 : 1) && score > 0,
    "label scoring excludes both parallel orientations and loops, keeping distinct escaped endpoint IDs",
  );
}
pairEdges[3]!.source = pairEdge.target;
pairEdges[3]!.target = pairEdge.source;
const mutatedPairOptions = options();
expect(
  scoreCurveLabelOverlap(
    pairEdge,
    pairEdges,
    pairNodes,
    curves[1]!,
    mutatedPairOptions,
    new Map(),
  ) === 0 && mutatedPairOptions.work.units === 0,
  "public label scoring reads changed endpoints before excluding parallel labels",
);
const reference = curves.map(scores);
let maximumNodeScoreDifference = 0;
let maximumLabelScoreDifference = 0;
const sampleKinds: SampleGraphKind[] = [
  "tree",
  "cycle",
  "complete",
  "petersen",
  "octahedral",
  "grid",
];
const routeModels = sampleKinds.map((kind) =>
  createSampleGraph(kind, {
    autoEdgeRouting: true,
    allowSelfLoops: true,
    allowMultiEdges: true,
  }),
);
const loops = {
  ...model,
  nodes: model.nodes.slice(0, 20),
  edges: Array.from({ length: 8 }, (_, index) => ({
    id: `loop${index}`,
    source: "n0",
    target: "n0",
    label: index % 2 === 0 ? "long loop label" : "1",
  })),
};
routeModels.push(loops);
function completeRoutes(graph: GraphModel) {
  const task = createEdgeRoutingTask(graph, { mode: "quality" });
  let step = task.next();
  while (!step.done) step = task.next();
  return JSON.stringify([...step.value]);
}
const referenceRoutes = routeModels.map(completeRoutes);
function loopScore(nodes: GraphNode[]) {
  const opts = options();
  const score = scoreLoopDirection(23, source, nodes, opts);
  const units = opts.work.units;
  opts.work.units = 0;
  const task = createLoopDirectionTask(source, nodes, opts);
  let step = task.next();
  const trace: number[] = [];
  while (!step.done) {
    trace.push(opts.work.units);
    step = task.next();
  }
  return { score, units, direction: step.value, trace };
}
const loopReference = loopScore(model.nodes);
const denseLoopNodes = Array.from({ length: 180 }, (_, index) => ({
  id: `dense-loop${index}`,
  order: index,
  label: "1",
  x: source.x + Math.cos(index * 0.37) * 51,
  y: source.y + Math.sin(index * 0.37) * 51,
}));
const denseLoopReference = loopScore(denseLoopNodes);

await initializeRustKernelFromBytes(bytes);
expect(
  getRustKernelReady(),
  "routing comparisons must execute the Rust module",
);
for (const [index, curve] of curves.entries()) {
  const actual = scores(curve);
  const expected = reference[index]!;
  maximumNodeScoreDifference = Math.max(
    maximumNodeScoreDifference,
    Math.abs(actual.score - expected.score),
  );
  maximumLabelScoreDifference = Math.max(
    maximumLabelScoreDifference,
    Math.abs(actual.label - expected.label),
  );
  expect(
    actual.collisions === expected.collisions,
    `curve ${index}: collisions`,
  );
  expect(actual.units === expected.units, `curve ${index}: work units`);
  expect(
    close(actual.score, expected.score),
    `curve ${index}: node/shape score`,
  );
  expect(close(actual.label, expected.label), `curve ${index}: label score`);
}
for (const [index, graph] of routeModels.entries())
  expect(
    completeRoutes(graph) === referenceRoutes[index],
    `complete routing choices must match for ${sampleKinds[index] ?? "loops"}`,
  );
const loopActual = loopScore(model.nodes);
expect(close(loopActual.score, loopReference.score), "loop obstacle score");
expect(loopActual.units === loopReference.units, "loop obstacle work units");
expect(loopActual.direction === loopReference.direction, "loop direction ties");
expect(
  JSON.stringify(loopActual.trace) === JSON.stringify(loopReference.trace),
  "loop generator yields retain the original work accounting",
);
const denseLoopActual = loopScore(denseLoopNodes);
expect(
  close(denseLoopActual.score, denseLoopReference.score),
  "dense Rust loop score",
);
expect(
  denseLoopActual.direction === denseLoopReference.direction,
  "dense Rust loop direction",
);
expect(
  denseLoopActual.units === denseLoopReference.units,
  "dense Rust loop units",
);
expect(
  JSON.stringify(denseLoopActual.trace) ===
    JSON.stringify(denseLoopReference.trace),
  "dense Rust loop work trace",
);

const mutable = [
  source,
  target,
  { id: "obstacle", label: "1", order: 2, x: 0, y: 0 },
] as (GraphNode & { measuredWidth?: number })[];
const straight = curves[1]!;
function mutationScore() {
  const opts = options();
  return scoreCurveNodeAndShape(straight, source, target, edge, mutable, opts);
}
mutationScore();
for (const mutate of [
  () => {
    mutable[2]!.y = 80;
  },
  () => {
    mutable[2]!.y = 0;
    mutable[2]!.x = 350;
  },
  () => {
    mutable[2]!.label = "広い頂点".repeat(20);
  },
  () => {
    mutable[2]!.measuredWidth = 48;
  },
  () => {
    mutable[2]!.id = edge.source;
  },
]) {
  mutate();
  const actual = mutationScore();
  resetRustKernelForTests();
  const expected = mutationScore();
  expect(
    actual.collisions === expected.collisions,
    "mutated snapshot collisions",
  );
  expect(close(actual.score, expected.score), "mutated snapshot score");
  await initializeRustKernelFromBytes(bytes);
}

type SnapshotNode = GraphNode & { measuredWidth?: number };
function snapshotNodes(): SnapshotNode[] {
  return [
    { ...source },
    { ...target },
    { id: "snapshot-obstacle", label: "1", order: 2, x: 350, y: 0 },
  ];
}
function snapshotScore(nodes: SnapshotNode[]) {
  return scoreRustCurveNodeAndShape(straight, source, target, edge, nodes, 30);
}
function expectFreshSnapshot(nodes: SnapshotNode[], label: string) {
  expect(
    JSON.stringify(snapshotScore(nodes)) ===
      JSON.stringify(snapshotScore(nodes.map((node) => ({ ...node })))),
    label,
  );
}
const snapshotWidths = [undefined, null, 48, 0, -24, NaN, Infinity];
for (const measuredWidth of snapshotWidths) {
  const nodes = snapshotNodes();

  Object.assign(nodes[2]!, { measuredWidth });
  const before = snapshotScore(nodes);
  nodes[2]!.label = "非常に広い頂点".repeat(12);
  const after = snapshotScore(nodes);
  expectFreshSnapshot(
    nodes,
    `label mutation with width ${String(measuredWidth)}`,
  );
  if (measuredWidth == null) {
    expect(
      before?.collisions === 0 && after?.collisions === 1,
      "nullish widths invalidate label-derived obstacle geometry",
    );
  } else if (Number.isFinite(measuredWidth)) {
    expect(
      JSON.stringify(before) === JSON.stringify(after),
      "numeric measured widths keep geometry unchanged when the label changes",
    );
  } else {
    expect(
      before === null && after === null,
      "non-finite measured widths preserve the Rust fallback decision",
    );
  }
}
const changingWidths = snapshotNodes();
snapshotScore(changingWidths);
for (const measuredWidth of snapshotWidths) {
  Object.assign(changingWidths[2]!, { measuredWidth });
  expectFreshSnapshot(
    changingWidths,
    `changed measured width ${String(measuredWidth)}`,
  );
}
for (const measuredWidth of [undefined, null]) {
  const nodes = snapshotNodes();
  Object.assign(nodes[2]!, { measuredWidth: 48 });
  snapshotScore(nodes);
  nodes[2]!.label = "非常に広い頂点".repeat(12);
  snapshotScore(nodes);
  Object.assign(nodes[2]!, { measuredWidth });
  expect(
    snapshotScore(nodes)?.collisions === 1,
    "removing a measurement restores the latest label geometry",
  );
  expectFreshSnapshot(nodes, "nullish measurement restores the changed label");
}
for (const mutate of [
  (nodes: SnapshotNode[]) => {
    nodes[2] = { ...nodes[2]! };
  },
  (nodes: SnapshotNode[]) => nodes.reverse(),
  (nodes: SnapshotNode[]) => {
    nodes[2]!.x = 0;
  },
  (nodes: SnapshotNode[]) => {
    nodes[2]!.y = 160;
  },
  (nodes: SnapshotNode[]) => {
    nodes[2]!.id = edge.source;
  },
  (nodes: SnapshotNode[]) =>
    nodes.push({ id: "extra", order: 3, label: "L", x: 0, y: 0 }),
]) {
  const nodes = snapshotNodes();
  snapshotScore(nodes);
  mutate(nodes);
  expectFreshSnapshot(
    nodes,
    "replacement, reordering and geometry mutations refresh snapshots",
  );
}

const degenerate: GraphEdge = {
  id: "same",
  source: source.id,
  target: source.id,
};
const wasmDegenerate = scoreCurveNodeAndShape(
  curves[4]!,
  source,
  source,
  degenerate,
  model.nodes,
  options(),
);
resetRustKernelForTests();
const jsDegenerate = scoreCurveNodeAndShape(
  curves[4]!,
  source,
  source,
  degenerate,
  model.nodes,
  options(),
);
expect(
  wasmDegenerate.collisions === jsDegenerate.collisions,
  "zero length collisions",
);
expect(close(wasmDegenerate.score, jsDegenerate.score), "zero length score");
await initializeRustKernelFromBytes(bytes);

for (const translation of [0, 1e9, 1e20]) {
  for (const offset of [30 - 1e-8, 30, 30 + 1e-8, -30 + 1e-8]) {
    const a = { ...source, x: translation, y: -translation };
    const b = { ...target, x: translation + 440, y: -translation };
    const nodes = [
      a,
      b,
      {
        id: "boundary",
        order: 2,
        label: "1",
        x: translation + 220,
        y: -translation + offset,
      },
    ];
    const actualOptions = options();
    const actual = scoreCurveNodeAndShape(
      straight,
      a,
      b,
      edge,
      nodes,
      actualOptions,
    );
    resetRustKernelForTests();
    const referenceOptions = options();
    const expected = scoreCurveNodeAndShape(
      straight,
      a,
      b,
      edge,
      nodes,
      referenceOptions,
    );
    expect(
      actual.collisions === expected.collisions,
      "translated clearance boundary collisions",
    );
    expect(
      actualOptions.work.units === referenceOptions.work.units,
      "translated clearance boundary units",
    );
    expect(
      close(actual.score, expected.score),
      "translated clearance boundary score",
    );
    await initializeRustKernelFromBytes(bytes);
  }
}
const symmetryNodes = [
  source,
  target,
  { id: "middle", order: 2, label: "1", x: 0, y: 0 },
];
const positive = scoreCurveNodeAndShape(
  { controlPointDistancesPx: [64], controlPointWeights: [0.5] },
  source,
  target,
  edge,
  symmetryNodes,
  options(),
);
const negative = scoreCurveNodeAndShape(
  { controlPointDistancesPx: [-64], controlPointWeights: [0.5] },
  source,
  target,
  edge,
  symmetryNodes,
  options(),
);
expect(
  positive.score === negative.score,
  "symmetric candidate scores retain exact ties",
);

const extremeSource = { id: "a", label: "1", order: 0, x: 0, y: 0 };
const extremeTarget = { id: "b", label: "2", order: 1, x: 1e160, y: 0 };
const extremeEdge = { id: "extreme", source: "a", target: "b" };
const extremeModel: GraphModel = {
  ...createEmptyGraphModel(),
  nodes: [
    extremeSource,
    extremeTarget,
    { id: "c", label: "3", order: 2, x: 5e159, y: 20 },
  ],
  edges: [extremeEdge],
};
expect(
  parseGraphModelJson(JSON.stringify(extremeModel)) === null,
  "large finite coordinates outside the document contract are rejected",
);
const extremeScore = () =>
  scoreCurveNodeAndShape(
    straight,
    extremeSource,
    extremeTarget,
    extremeEdge,
    extremeModel.nodes,
    options(),
  );
expect(
  scoreRustCurveNodeAndShape(
    straight,
    extremeSource,
    extremeTarget,
    extremeEdge,
    extremeModel.nodes,
    30,
  ) === null,
  "unsafe candidate arithmetic selects the JS fallback",
);
expect(
  JSON.stringify(extremeScore()) ===
    JSON.stringify(withRustKernelSuppressed(extremeScore)),
  "extreme candidate scores remain independent of the loaded backend",
);

const loopThresholdNodes = Array.from({ length: 16 }, (_, order) => ({
  id: `loop-threshold-${order}`,
  label: "1",
  order,
  x: 29.870358479547487,
  y: 2.785979953862811,
}));
const unboundedLoopBounds = {
  x1: -Infinity,
  y1: -Infinity,
  x2: Infinity,
  y2: Infinity,
};
expect(
  scoreRustLoopObstacles(
    loopThresholdNodes,
    [{ x: 0, y: 0 }],
    30,
    unboundedLoopBounds,
    true,
  ) === null,
  "loop hypot rounding at strict clearance requests the JS reference",
);
for (const x of [29.99, 30.01]) {
  const result = scoreRustLoopObstacles(
    loopThresholdNodes.map((node) => ({ ...node, x, y: 0 })),
    [{ x: 0, y: 0 }],
    30,
    unboundedLoopBounds,
    true,
  );
  expect(
    result?.[2] === Number(x < 30) && result[1] === 1,
    "unambiguous loop clearance retains Rust and exact sample units",
  );
}

const thresholdLoopModel = parseGraphModelJson(
  JSON.stringify({
    ...createEmptyGraphModel(),
    nodes: [
      { id: "source", label: "wide ".repeat(4), order: 0, x: 0, y: 0 },
      ...Array.from({ length: 16 }, (_, index) => ({
        id: `threshold-${index}`,
        label: "1",
        order: index + 1,
        x: 25.638510610240907,
        y: -21.214021930723533,
      })),
    ],
    edges: [
      { id: "automatic", source: "source", target: "source" },
      {
        id: "manual",
        source: "source",
        target: "source",
        routing: { loopDirectionDeg: 135, loopSweepDeg: 30 },
      },
    ],
  }),
)!;
expect(
  Boolean(thresholdLoopModel),
  "strict loop fixture is a valid JSON graph",
);
const expectedThresholdRoutes = withRustKernelSuppressed(() =>
  completeRoutes(thresholdLoopModel),
);
const actualThresholdRoutes = completeRoutes(thresholdLoopModel);
expect(
  actualThresholdRoutes === expectedThresholdRoutes,
  "standard product routing retains JS loop statuses at the strict threshold",
);
expect(
  new Map<string, { status: string }>(JSON.parse(actualThresholdRoutes)).get(
    "automatic",
  )?.status === "unresolved",
  "the near-threshold automatic loop remains unresolved",
);
console.log(
  JSON.stringify({ maximumNodeScoreDifference, maximumLabelScoreDifference }),
);
await import("./edge-routing");
finish();

function close(a: number, b: number) {
  return Math.abs(a - b) <= Math.max(1e-8, Math.abs(b) * 1e-11);
}
