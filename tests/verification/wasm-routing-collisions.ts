import { readFileSync } from "node:fs";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import { countRustCurveNodeCollisions } from "../../features/graph-editor/compute/wasm-routing";
import type {
  GraphEdge,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";
import type { EdgeCurveGeometry } from "../../features/graph-editor/core/layout/edge-route-geometry";
import {
  countCurveNodeCollisions,
  shouldUseRustCurveNodeCollisions,
} from "../../features/graph-editor/core/layout/edge-routing-collisions";
import { createEdgeRoutingTask } from "../../features/graph-editor/core/layout/edge-routing";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { collisionFixture } from "../fixtures/routing-collisions";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Rust final-route collisions");
await initializeRustKernelFromBytes(
  readFileSync(`${process.cwd()}/public${RUST_KERNEL_URL}`),
);
let cases = 0;
let rawCases = 0;
function check(
  curve: EdgeCurveGeometry,
  source: GraphNode,
  target: GraphNode,
  edge: GraphEdge,
  nodes: GraphNode[],
) {
  const referenceWork = { units: 0, samples: new Map() };
  const expected = withRustKernelSuppressed(() =>
    countCurveNodeCollisions(curve, edge, source, target, nodes, referenceWork),
  );
  const actualWork = { units: 0, samples: new Map() };
  const actual = countCurveNodeCollisions(
    curve,
    edge,
    source,
    target,
    nodes,
    actualWork,
  );
  const raw = countRustCurveNodeCollisions(curve, source, target, edge, nodes);
  expect(actual === expected, `case ${cases}: dispatched collision count`);
  expect(
    actualWork.units === referenceWork.units,
    `case ${cases}: dispatched work units`,
  );
  if (raw) {
    rawCases++;
    expect(raw.collisions === expected, `case ${cases}: raw collision count`);
    expect(raw.units === referenceWork.units, `case ${cases}: raw work units`);
  }
  cases++;
}
for (const count of [3, 31, 32, 50, 1000]) {
  for (const controls of [0, 1, 3]) {
    for (const dense of [true, false]) {
      const fixture = collisionFixture(count, controls, dense);
      check(
        fixture.curve,
        fixture.source,
        fixture.target,
        fixture.edge,
        fixture.nodes,
      );
      if (count >= 50 && controls > 0)
        expect(
          shouldUseRustCurveNodeCollisions(
            fixture.curve,
            fixture.source,
            fixture.target,
            fixture.nodes,
          ) === dense,
          "dense/sparse backend selection",
        );
    }
  }
}
const fixture = collisionFixture(50, 3, true);
for (const curve of [
  { controlPointDistancesPx: [], controlPointWeights: [] },
  { controlPointDistancesPx: [64, -64, 32], controlPointWeights: [0.2, 0.8] },
  { controlPointDistancesPx: [180], controlPointWeights: [-1] },
  { controlPointDistancesPx: [-180], controlPointWeights: [2] },
  fixture.curve,
]) {
  check(curve, fixture.source, fixture.target, fixture.edge, fixture.nodes);
  check(
    curve,
    fixture.source,
    fixture.source,
    { ...fixture.edge, target: fixture.source.id },
    fixture.nodes,
  );
}
for (const translation of [0, 1e9, 1e20]) {
  for (const y of [30 - 1e-8, 30, 30 + 1e-8, -30 + 1e-8, 48, 48 + 1e-8]) {
    const source = { ...fixture.source, x: translation, y: -translation };
    const target = { ...fixture.target, x: translation + 800, y: -translation };
    const nodes = [
      source,
      target,
      {
        id: "boundary",
        order: 2,
        label: "1",
        x: translation + 400,
        y: -translation + y,
      },
    ];
    check(
      { controlPointDistancesPx: [0], controlPointWeights: [0.5] },
      source,
      target,
      fixture.edge,
      nodes,
    );
  }
}
let seed = 3671;
const random = () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
for (let index = 0; index < 60; index++) {
  const count = 1 + Math.floor(random() * 4);
  const curve = {
    controlPointDistancesPx: Array.from(
      { length: count },
      () => random() * 360 - 180,
    ),
    controlPointWeights: Array.from(
      { length: count },
      (_, i) => (i + 1) / (count + 1),
    ),
  };
  const nodes = fixture.nodes.map((node) => ({
    ...node,
    x: random() * 1400 - 700,
    y: random() * 900 - 450,
    measuredWidth: 48 + random() * 400,
  }));
  check(curve, fixture.source, fixture.target, fixture.edge, nodes);
}

// Curve-piece AABB rejection must retain near-threshold geometry even after
// large translations. Include circular/wide spines, far pieces, and multiple
// control points while staying inside the final-route Rust coordinate gate.
const rawBeforeRejectionCases = rawCases;
for (const translation of [0, 1e9, 1e12 - 1000]) {
  const source = { ...fixture.source, x: translation - 220, y: -translation };
  const target = { ...fixture.target, x: translation + 220, y: -translation };
  const nodes = [
    source,
    target,
    ...Array.from({ length: 90 }, (_, index) => ({
      id: `piece-rejection${index}`,
      order: index + 2,
      label: "1",
      measuredWidth: index % 2 === 0 ? 48 : 192,
      x: translation + ((index * 73) % 720) - 360,
      y: -translation + ((index * 37) % 400) - 200,
    })),
  ];
  for (const curve of [
    { controlPointDistancesPx: [0], controlPointWeights: [0.5] },
    { controlPointDistancesPx: [128], controlPointWeights: [0.5] },
    { controlPointDistancesPx: [90, -60], controlPointWeights: [0.3, 0.7] },
  ])
    check(curve, source, target, fixture.edge, nodes);
}
expect(
  rawCases - rawBeforeRejectionCases >= 6,
  "prepared-piece rejection comparisons execute the Rust kernel",
);
for (const mutate of [
  () => {
    fixture.nodes[2]!.y = 4000;
  },
  () => {
    fixture.nodes[2]!.x = 0;
    fixture.nodes[2]!.y = 0;
  },
  () => {
    fixture.nodes[2]!.label = "広い頂点".repeat(20);
    delete fixture.nodes[2]!.measuredWidth;
  },
  () => {
    fixture.nodes[2]!.measuredWidth = 48;
  },
  () => {
    fixture.nodes[2]!.id = fixture.edge.source;
  },
]) {
  mutate();
  check(
    fixture.curve,
    fixture.source,
    fixture.target,
    fixture.edge,
    fixture.nodes,
  );
}
expect(
  countRustCurveNodeCollisions(
    fixture.curve,
    fixture.source,
    fixture.target,
    fixture.edge,
    fixture.nodes,
  ) === null,
  "duplicate IDs retain the exact public JS exclusion rules",
);
const smallStraight = collisionFixture(50, 0, true);
expect(
  !shouldUseRustCurveNodeCollisions(
    smallStraight.curve,
    smallStraight.source,
    smallStraight.target,
    smallStraight.nodes,
  ),
  "small straight checks retain the inexpensive JS path",
);
const nonfiniteCurve = {
  controlPointDistancesPx: [Number.NaN],
  controlPointWeights: [0.5],
};
expect(
  countRustCurveNodeCollisions(
    nonfiniteCurve,
    smallStraight.source,
    smallStraight.target,
    smallStraight.edge,
    smallStraight.nodes,
  ) === null,
  "nonfinite curve inputs retain JS",
);
const nonfiniteNodes = smallStraight.nodes.map((node, index) =>
  index === 2 ? { ...node, measuredWidth: Number.NaN } : node,
);
expect(
  countRustCurveNodeCollisions(
    smallStraight.curve,
    smallStraight.source,
    smallStraight.target,
    smallStraight.edge,
    nonfiniteNodes,
  ) === null,
  "nonfinite node geometry retains JS",
);

for (const [tx, ty, x, y, expected] of [
  [
    39.76905130695133, 113.2184726895089, -8.420092518901559, 66.55149917149228,
    256,
  ],
  [
    23.933966519708743, 117.5889673678337, -17.430258582104052,
    64.77797531384404, 0,
  ],
]) {
  const source = { id: "s", order: 0, label: "", x: 0, y: 0 };
  const target = { id: "t", order: 1, label: "", x: tx!, y: ty! };
  const curve = { controlPointDistancesPx: [0], controlPointWeights: [0.5] };
  const nodes = [
    source,
    target,
    ...Array.from({ length: 256 }, (_, index) => ({
      id: `tie${index}`,
      order: index + 2,
      label: "",
      x: x!,
      y: y!,
    })),
  ];
  expect(
    shouldUseRustCurveNodeCollisions(curve, source, target, nodes),
    "strict boundary fixture reaches the Rust dispatch",
  );
  expect(
    countRustCurveNodeCollisions(
      curve,
      source,
      target,
      smallStraight.edge,
      nodes,
    ) === null,
    "strict hypot rounding boundary requests the original JS decision",
  );
  const work = { units: 0, samples: new Map() };
  expect(
    countCurveNodeCollisions(
      curve,
      smallStraight.edge,
      source,
      target,
      nodes,
      work,
    ) === expected,
    "strict 30px host rounding preserves the reference count",
  );
  expect(work.units === 256, "strict boundary recheck counts work once");
  check(curve, source, target, smallStraight.edge, nodes);
}
const overflowTarget = { ...smallStraight.target, x: 1e308, y: 1e308 };
expect(
  !shouldUseRustCurveNodeCollisions(
    smallStraight.curve,
    smallStraight.source,
    overflowTarget,
    smallStraight.nodes,
  ),
  "overflow-sized finite coordinates retain JS",
);
expect(
  countRustCurveNodeCollisions(
    smallStraight.curve,
    smallStraight.source,
    overflowTarget,
    smallStraight.edge,
    smallStraight.nodes,
  ) === null,
  "raw collision helper rejects overflow-sized geometry",
);

const routingFixture = collisionFixture(100, 3, true);
const model = {
  ...createEmptyGraphModel({ autoEdgeRouting: true, allowMultiEdges: true }),
  nodes: routingFixture.nodes,
  edges: Array.from({ length: 6 }, (_, index) => ({
    ...routingFixture.edge,
    id: `parallel${index}`,
    label: "parallel label",
    ...(index === 2 ? { routing: { bowPx: 96 } } : {}),
  })),
};
function route() {
  const task = createEdgeRoutingTask(model, { mode: "quality" });
  let step = task.next();
  while (!step.done) step = task.next();
  return JSON.stringify([...step.value]);
}
const expectedRoutes = withRustKernelSuppressed(route);
expect(
  route() === expectedRoutes,
  "parallel/manual final routes and statuses match the reference",
);
expect(
  rawCases >= 80,
  "verification executes many nonfallback Rust collision fixtures",
);
console.log(JSON.stringify({ cases, rawCases }));
finish();
