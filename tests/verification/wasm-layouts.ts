import { readFileSync } from "node:fs";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import { tryRustForceLayout } from "../../features/graph-editor/compute/wasm-layouts";
import {
  getRustKernelReady,
  initializeRustKernelFromBytes,
  resetRustKernelForTests,
} from "../../features/graph-editor/compute/rust-kernel";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { layoutForce } from "../../features/graph-editor/layouts/layout-algorithms";
import {
  ensureNodeClearance,
  LAYOUT_NODE_CLEARANCE,
} from "../../features/graph-editor/layouts/layout-geometry";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Wasm layouts");
resetRustKernelForTests();
expect(
  !getRustKernelReady(),
  "JavaScript fallback works before Wasm is loaded",
);

const graphs: Array<[string, GraphModel]> = [
  ["empty", fixture(0)],
  ["single vertex", fixture(1)],
  ["chain", fixture(30)],
  ["long labels", fixture(40, true)],
  ["chain 100", fixture(100)],
  ["chain 200", fixture(200)],
  ["chain 300", fixture(300)],
];
for (let seed = 0; seed < 20; seed++) {
  const graph = fixture(8 + seed);
  graph.nodes.reverse();
  graph.edges = Array.from({ length: graph.nodes.length * 2 }, (_, index) => ({
    id: `e${index}`,
    source: `n${index % graph.nodes.length}`,
    target: `n${(index * 17 + seed) % graph.nodes.length}`,
  }));
  graphs.push([`reordered graph ${seed}`, graph]);
}
const isolated = fixture(12);
isolated.edges = [];
graphs.push(["isolated vertices", isolated]);
const disconnected = fixture(20);
disconnected.edges = disconnected.edges.filter((edge) => edge.id !== "e9");
graphs.push(["disconnected components", disconnected]);
for (let seed = 0; seed < 8; seed++) {
  const graph = fixture(100 + seed * 10);
  graph.edges.push(
    ...Array.from({ length: graph.nodes.length * 2 }, (_, index) => ({
      id: `extra${index}`,
      source: `n${index % graph.nodes.length}`,
      target: `n${(index * 17 + seed) % graph.nodes.length}`,
    })),
  );
  graphs.push([`connected random graph ${seed}`, graph]);
}

const originals = graphs.map(([name, graph]) => ({
  name,
  graph,
  input: JSON.stringify(graph),
  result: layoutForce(graph),
}));
const clearanceFixtures = graphs.map(([name, graph]) => ({
  name,
  nodes: graph.nodes,
  positions: Object.fromEntries(
    graph.nodes.map((node, index) => [
      node.id,
      { x: (index % 7) * 20 - 65.5, y: Math.floor(index / 7) * 24 },
    ]),
  ),
}));
const originalClearance = clearanceFixtures.map(({ nodes, positions }) =>
  ensureNodeClearance(positions, nodes),
);

await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));
expect(getRustKernelReady(), "compiled Rust Wasm has loaded");
const coincident = tryRustForceLayout(
  [
    { x: 0, y: 0 },
    { x: 0, y: 0 },
  ],
  [[0, 1]],
  [0.25, -0.25],
  124,
);
expect(
  coincident !== null &&
    coincident.every(Number.isFinite) &&
    Math.hypot(
      coincident[0]! - coincident[2]!,
      coincident[1]! - coincident[3]!,
    ) > 1,
  "coincident force seeds separate without zero-distance divisions",
);

let maximumForceDifference = 0;
let exactForceFixtures = 0;
for (const { name, graph, input, result } of originals) {
  const accelerated = layoutForce(graph);
  const exact = JSON.stringify(accelerated) === JSON.stringify(result);
  if (exact) exactForceFixtures++;
  const maximumDifference = Math.max(
    0,
    ...Object.keys(result).flatMap((id) => [
      Math.abs(result[id]!.x - accelerated[id]!.x),
      Math.abs(result[id]!.y - accelerated[id]!.y),
    ]),
  );
  maximumForceDifference = Math.max(maximumForceDifference, maximumDifference);
  expect(
    exact,
    `${name}: force coordinates match the JavaScript fallback exactly (${maximumDifference})`,
  );
  expect(
    Object.keys(accelerated).join() === Object.keys(result).join(),
    `${name}: force vertex ordering matches the JavaScript fallback`,
  );
  expect(
    JSON.stringify(layoutForce(graph)) === JSON.stringify(accelerated),
    `${name}: Rust force layout is deterministic`,
  );
  expect(JSON.stringify(graph) === input, `${name}: input is not mutated`);
  for (let first = 0; first < graph.nodes.length; first++) {
    const a = accelerated[graph.nodes[first]!.id]!;
    for (let second = first + 1; second < graph.nodes.length; second++) {
      const b = accelerated[graph.nodes[second]!.id]!;
      expect(
        Math.hypot(a.x - b.x, a.y - b.y) >=
          LAYOUT_NODE_CLEARANCE - Math.SQRT2 - 1e-8,
        `${name}: force vertices retain minimum separation`,
      );
    }
  }
}
for (const [index, { name, nodes, positions }] of clearanceFixtures.entries()) {
  const accelerated = ensureNodeClearance(positions, nodes);
  const original = originalClearance[index]!;
  expect(
    Object.keys(accelerated).join() === Object.keys(original).join(),
    `${name}: clearance preserves node order`,
  );
  for (const id of Object.keys(original)) {
    expect(
      Math.abs(accelerated[id]!.x - original[id]!.x) < 1e-8 &&
        Math.abs(accelerated[id]!.y - original[id]!.y) < 1e-8,
      `${name}: capsule clearance matches for ${id}`,
    );
  }
}
resetRustKernelForTests();
console.log(
  JSON.stringify({
    exactForceFixtures,
    forceFixtures: originals.length,
    maximumForceDifference,
  }),
);
finish();

function fixture(count: number, longLabels = false): GraphModel {
  return {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: longLabels ? "長いラベル".repeat(12) : String(index),
      x: index * 20,
      y: 0,
    })),
    edges: Array.from({ length: Math.max(0, count - 1) }, (_, index) => ({
      id: `e${index}`,
      source: `n${index}`,
      target: `n${index + 1}`,
    })),
  };
}
