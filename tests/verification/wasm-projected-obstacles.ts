import { readFileSync } from "node:fs";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import {
  projectRustEdgeObstacles,
  type ProjectedObstacleCluster,
} from "../../features/graph-editor/compute/wasm-routing";
import type {
  GraphEdge,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";
import {
  nodeGeometryWidth,
  NODE_SIZE_PX,
  pillExtentTowards,
} from "../../features/graph-editor/core/graph/node-size";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Rust projected obstacles");
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));

// Frozen projection algorithm: retain exact host hypot, clamps, stable sorting
// and cluster construction instead of comparing two Rust-backed callers.
function reference(
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode,
  nodes: GraphNode[],
  baseClearancePx: number,
): ProjectedObstacleCluster[] {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return [];
  const unitX = dx / length;
  const unitY = dy / length;
  const normalX = -unitY;
  const normalY = unitX;
  const clamp = (value: number) => Math.min(0.92, Math.max(0.08, value));
  const obstacles = nodes
    .filter((node) => node.id !== edge.source && node.id !== edge.target)
    .map((node) => {
      const relativeX = node.x - source.x;
      const relativeY = node.y - source.y;
      const halfWidth = nodeGeometryWidth(node) / 2;
      const halfHeight = NODE_SIZE_PX / 2;
      const acrossExtra =
        pillExtentTowards(halfWidth, halfHeight, normalX, normalY) - halfHeight;
      const alongExtra =
        pillExtentTowards(halfWidth, halfHeight, unitX, unitY) - halfHeight;
      const clearancePx = baseClearancePx + acrossExtra;
      const extentWeight = Math.min(
        0.22,
        (baseClearancePx + alongExtra) / length,
      );
      return {
        endWeight: clamp(
          (relativeX * unitX + relativeY * unitY) / length + extentWeight,
        ),
        negativeDistancePx:
          relativeX * normalX + relativeY * normalY - clearancePx,
        positiveDistancePx:
          relativeX * normalX + relativeY * normalY + clearancePx,
        startWeight: clamp(
          (relativeX * unitX + relativeY * unitY) / length - extentWeight,
        ),
        perpendicularDistance: Math.abs(
          relativeX * normalX + relativeY * normalY,
        ),
        clearancePx,
      };
    })
    .filter(
      (obstacle) =>
        obstacle.startWeight < obstacle.endWeight &&
        obstacle.perpendicularDistance < obstacle.clearancePx * 1.8,
    )
    .toSorted((a, b) => a.startWeight - b.startWeight);
  const clusters: ProjectedObstacleCluster[] = [];
  for (const obstacle of obstacles) {
    const previous = clusters.at(-1);
    if (previous && obstacle.startWeight <= previous.endWeight + 0.06) {
      previous.endWeight = Math.max(previous.endWeight, obstacle.endWeight);
      previous.positiveDistancePx = Math.max(
        previous.positiveDistancePx,
        obstacle.positiveDistancePx,
      );
      previous.negativeDistancePx = Math.min(
        previous.negativeDistancePx,
        obstacle.negativeDistancePx,
      );
      continue;
    }
    clusters.push({
      endWeight: obstacle.endWeight,
      negativeDistancePx: obstacle.negativeDistancePx,
      positiveDistancePx: obstacle.positiveDistancePx,
      startWeight: obstacle.startWeight,
    });
  }
  if (clusters.length <= 2) return clusters;
  return [
    {
      startWeight: clusters[0]?.startWeight ?? 0.2,
      endWeight: clusters.at(-1)?.endWeight ?? 0.8,
      positiveDistancePx: Math.max(
        ...clusters.map((cluster) => cluster.positiveDistancePx),
      ),
      negativeDistancePx: Math.min(
        ...clusters.map((cluster) => cluster.negativeDistancePx),
      ),
    },
  ];
}

const edge: GraphEdge = { id: "edge", source: "source", target: "target" };
const source: GraphNode = { id: "source", order: 0, label: "", x: 0, y: 0 };
const target: GraphNode = {
  id: "target",
  order: 1,
  label: "",
  x: 2000,
  y: 170,
};
let seed = 12592;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
function fixture(count = 200, longLabels = false): GraphNode[] {
  return [
    source,
    target,
    ...Array.from({ length: count - 2 }, (_, index) => ({
      id: `node${index}`,
      order: index + 2,
      label: longLabels && index % 3 === 0 ? "長い頂点ラベル".repeat(3) : "",
      x: random() * 2600 - 300,
      y: random() * 400 - 120,
    })),
  ];
}

let checked = 0;
let rustResults = 0;
let boundaryFallbacks = 0;
function compare(
  name: string,
  nodes: GraphNode[],
  from = source,
  to = target,
  clearance = 30,
  ids = edge,
) {
  const expected = reference(ids, from, to, nodes, clearance);
  const actual = projectRustEdgeObstacles(ids, from, to, nodes, clearance);
  if (actual) {
    rustResults++;
    expect(
      JSON.stringify(actual) === JSON.stringify(expected),
      `${name}: exact ordered clusters match the frozen JS reference`,
    );
  } else boundaryFallbacks++;
  checked++;
  return actual;
}

for (const longLabels of [false, true]) {
  for (const count of [64, 100, 300, 1000]) {
    for (let pass = 0; pass < 8; pass++)
      compare(
        `${longLabels ? "wide" : "circle"} ${count}/${pass}`,
        fixture(count, longLabels),
      );
  }
}

for (const translation of [0, 1e9, -1e9, 1e12]) {
  const nodes = fixture(130, true).map((node) => ({
    ...node,
    x: node.x + translation,
    y: node.y + translation,
  }));
  compare(`translation ${translation}`, nodes, nodes[0]!, nodes[1]!);
  compare(`reverse ${translation}`, nodes, nodes[1]!, nodes[0]!, 30, {
    ...edge,
    source: "target",
    target: "source",
  });
}

const diverseWidths = fixture(300).map((node, index) => ({
  ...node,
  measuredWidth:
    index < 2
      ? 48
      : index < 42
        ? 64 + (index - 2) * 9.25
        : index % 3 === 0
          ? 64 + (index % 8) * 9.25
          : 64 + (20 + (index % 20)) * 9.25,
}));
expect(
  compare(
    "40 distinct widths followed by cached and uncached repeated widths",
    diverseWidths,
  ) !== null,
  "width-cache cap and later repeats exercise the actual Rust kernel",
);

const horizontalTarget = { ...target, x: 1000, y: 0 };
function sparse(points: { x: number; y: number; measuredWidth?: number }[]) {
  return [
    source,
    horizontalTarget,
    ...points.map((point, index) => ({
      id: `s${index}`,
      order: index + 2,
      label: "",
      ...point,
    })),
    ...Array.from({ length: 256 }, (_, index) => ({
      id: `far${index}`,
      order: index + 100,
      label: "",
      x: 10000 + index * 100,
      y: 10000,
    })),
  ];
}
const shapeCases = [
  [],
  [{ x: 300, y: 0 }],
  [
    { x: 300, y: -12 },
    { x: 300, y: 12 },
  ],
  [
    { x: 300, y: 0 },
    { x: 700, y: 0 },
  ],
  [
    { x: 150, y: 0 },
    { x: 500, y: 10 },
    { x: 850, y: -10 },
  ],
  [
    { x: 300, y: 0, measuredWidth: 470 },
    { x: 700, y: 0, measuredWidth: 620 },
  ],
];
for (const [index, points] of shapeCases.entries())
  compare(
    `stable cluster count ${index}`,
    sparse(points),
    source,
    horizontalTarget,
  );
for (const epsilon of [-1e-13, 0, 1e-13]) {
  for (const y of [54 + epsilon, -54 + epsilon]) {
    const result = compare(
      `strict perpendicular boundary ${y}`,
      sparse([{ x: 500, y }]),
      source,
      horizontalTarget,
    );
    expect(
      result === null,
      "strict perpendicular threshold requests original JS",
    );
  }
  for (const x of [110 + epsilon, 890 + epsilon]) {
    const result = compare(
      `clamp boundary ${x}`,
      sparse([{ x, y: 0 }]),
      source,
      horizontalTarget,
    );
    expect(result === null, "ambiguous .08/.92 clamp requests original JS");
  }
  const merge = compare(
    `merge boundary ${epsilon}`,
    sparse([
      { x: 300, y: 0 },
      { x: 420 + epsilon, y: 0 },
    ]),
    source,
    horizontalTarget,
  );
  expect(merge === null, "ambiguous <= end+.06 merge requests original JS");
}
const extent = compare(
  "extent cap .22",
  sparse([{ x: 500, y: 0 }]),
  source,
  horizontalTarget,
  220,
);
expect(extent === null, "ambiguous extent cap requests original JS");
for (const delta of [-1e-15, 0, 1e-15]) {
  const guardedTarget = {
    ...target,
    x: Math.sqrt(0.84) * 1000,
    y: (0.4 + delta) * 1000,
  };
  const guardedNodes = sparse([
    { x: guardedTarget.x / 2, y: guardedTarget.y / 2, measuredWidth: 192 },
  ]);
  guardedNodes[1] = guardedTarget;
  const result = compare(
    `squared capsule bisection tie ${delta}`,
    guardedNodes,
    source,
    guardedTarget,
  );
  expect(
    result === null,
    "squared 576±epsilon comparison requests exact host JS",
  );
}

const mutated = fixture(300);
const first = compare("snapshot before mutation", mutated);
mutated[4]!.x = 700;
mutated[4]!.y = 30;
compare("mutated coordinates refresh cached geometry", mutated);
mutated[4]!.label = "非常に長いラベル".repeat(7);
compare("mutated label refreshes estimated width", mutated);
(mutated[4] as GraphNode & { measuredWidth?: number }).measuredWidth = 580;
compare("mutated measured width refreshes cached geometry", mutated);
mutated[4]!.id = "renamed";
compare("mutated node ID refreshes exclusions", mutated);
mutated[4] = { ...mutated[4]!, x: 1100 };
compare("replaced node identity refreshes cached geometry", mutated);
mutated.push({ id: "added", label: "", order: 200, x: 600, y: 10 });
compare("changed length refreshes cached geometry", mutated);
expect(first !== null, "fixture exercises actual compiled kernel");

const duplicates = [...fixture(64), { ...source, x: 900 }];
expect(
  projectRustEdgeObstacles(edge, source, target, duplicates, 30) === null,
  "duplicate IDs retain JS exclusion semantics",
);
expect(
  projectRustEdgeObstacles(edge, source, target, fixture(63), 30) === null,
  "small graph stays in JS",
);
const smallCircles = fixture(64);
expect(
  projectRustEdgeObstacles(edge, source, target, smallCircles, 30) === null,
  "small all-circle projections avoid Rust transfer overhead",
);
smallCircles[4]!.label = "長い頂点ラベル".repeat(3);
expect(
  compare("mutated width enables small pill projection", smallCircles) !== null,
  "a cached circle snapshot refreshes its wide-pill dispatch flag",
);
expect(
  withRustKernelSuppressed(() =>
    projectRustEdgeObstacles(edge, source, target, fixture(64), 30),
  ) === null,
  "suppression preserves reference and fallback paths",
);
for (const value of [NaN, Infinity, 1e20]) {
  const nodes = fixture(64);
  nodes[5]!.x = value;
  expect(
    projectRustEdgeObstacles(edge, source, target, nodes, 30) === null,
    `unsafe obstacle coordinate ${value} retains JS`,
  );
  expect(
    projectRustEdgeObstacles(
      edge,
      { ...source, x: value },
      target,
      fixture(64),
      30,
    ) === null,
    `unsafe source coordinate ${value} retains JS`,
  );
}
const samePoint = compare("coincident source-target", fixture(64), source, {
  ...target,
  x: source.x,
  y: source.y,
});
expect(
  samePoint?.length === 0,
  "degenerate chord remains an empty obstacle list",
);
for (const measuredWidth of [188, 192, 168.5]) {
  const browserSource = { ...source, id: "a", label: "A", x: -220, y: 0 };
  const browserTarget = { ...target, id: "b", label: "B", x: 220, y: 0 };
  const browserNodes = [
    browserSource,
    browserTarget,
    {
      id: "c",
      order: 2,
      label: "幅のある頂点ラベル",
      x: 0,
      y: 0,
      measuredWidth,
    },
    ...Array.from({ length: 61 }, (_, index) => ({
      id: `far${index}`,
      order: index + 3,
      label: String(index),
      x: 10000 + index * 120,
      y: 10000,
    })),
  ];
  const result = compare(
    `Safari projection fixture measuredWidth ${measuredWidth}`,
    browserNodes,
    browserSource,
    browserTarget,
    30,
    { ...edge, source: "a", target: "b" },
  );
  expect(
    result !== null && result.length === 1,
    "Safari measured capsule fixture executes Rust and creates one cluster",
  );
}
expect(
  rustResults >= 50,
  "random, wide and translated geometry exercise Rust rather than only falling back",
);

finish(
  `Rust projected obstacles verification passed (${checked} fixtures, ${rustResults} Rust results, ${boundaryFallbacks} exact JS fallbacks)`,
);
