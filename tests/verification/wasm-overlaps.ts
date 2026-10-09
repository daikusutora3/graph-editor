import { readFile } from "node:fs/promises";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  getRustKernelReady,
  initializeRustKernelFromBytes,
  resetRustKernelForTests,
} from "../../features/graph-editor/compute/rust-kernel";
import {
  NODE_SIZE_PX,
  nodeGeometryWidth,
} from "../../features/graph-editor/core/graph/node-size";
import {
  createOverlapTask,
  OVERLAP_GAP_PX,
  resolveNodeOverlaps,
} from "../../features/graph-editor/layouts/resolve-node-overlaps";
import {
  overlapGraph,
  overlapNode,
  overlapVerificationFixtures,
} from "../fixtures/overlaps";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Wasm overlaps");
const negativeTies = Array.from({ length: 20 }, (_, index) =>
  overlapNode(index, ((index % 5) - 2) * 12, (Math.floor(index / 5) - 2) * 12),
);
const denseFractional = Array.from({ length: 40 }, (_, index) => ({
  ...overlapNode(
    index,
    ((index * 71) % 113) - 56.25,
    ((index * 37) % 97) - 48.75,
    "wide measured label",
  ),
  measuredWidth: 90.123456789 + ((index * 19) % 101),
}));
const fixtures = [
  ...overlapVerificationFixtures,
  [
    "negative half-grid coordinates",
    overlapGraph(negativeTies, { snapToGrid: true }),
  ],
  ["dense fractional measured capsules", overlapGraph(denseFractional)],
] as const;

resetRustKernelForTests();
expect(!getRustKernelReady(), "reference calculations use the JS fallback");
const references = fixtures.map(([, graph]) => resolveNodeOverlaps(graph));
const bytes = new Uint8Array(
  await readFile(new URL(`../../public${RUST_KERNEL_URL}`, import.meta.url)),
);
await initializeRustKernelFromBytes(bytes);
expect(getRustKernelReady(), "the built Rust Wasm module is instantiated");

let maximumError = 0;
for (const [index, [name, graph]] of fixtures.entries()) {
  const input = JSON.stringify(graph);
  const expected = references[index]!;
  const actual = resolveNodeOverlaps(graph);
  expect(JSON.stringify(graph) === input, `${name}: input remains unchanged`);
  expect(actual.status === expected.status, `${name}: status matches JS`);
  expect(
    actual.remainingPairs === expected.remainingPairs,
    `${name}: collision count matches JS`,
  );
  expect(
    JSON.stringify(Object.keys(actual.positions)) ===
      JSON.stringify(Object.keys(expected.positions)),
    `${name}: stable node ordering matches JS`,
  );
  const spans = graph.nodes.map((node) =>
    Math.max(
      0,
      (nodeGeometryWidth({
        ...node,
        label: graph.settings.showNodeLabels ? node.label : "",
      }) -
        NODE_SIZE_PX) /
        2,
    ),
  );
  for (const [nodeIndex, node] of graph.nodes.entries()) {
    const point = actual.positions[node.id]!;
    const reference = expected.positions[node.id]!;
    const error = Math.max(
      Math.abs(point.x - reference.x),
      Math.abs(point.y - reference.y),
    );
    maximumError = Math.max(maximumError, error);
    // JS engines and Rust can differ in the last bits of hypot. The tolerance
    // is far below the resolver's collision threshold, while grid output is exact.
    expect(error < 1e-6, `${name}/${node.id}: coordinates agree with JS`);
    if (graph.settings.snapToGrid && actual.status !== "unchanged") {
      expect(
        point.x === reference.x && point.y === reference.y,
        `${name}/${node.id}: snapped coordinates agree exactly with JS`,
      );
      expect(
        point.x % 24 === 0 && point.y % 24 === 0,
        `${name}/${node.id}: snapped positions remain on grid`,
      );
    }
    for (
      let otherIndex = nodeIndex + 1;
      otherIndex < graph.nodes.length;
      otherIndex++
    ) {
      const other = actual.positions[graph.nodes[otherIndex]!.id]!;
      expect(
        Math.hypot(
          Math.max(
            0,
            Math.abs(other.x - point.x) -
              spans[nodeIndex]! -
              spans[otherIndex]!,
          ),
          other.y - point.y,
        ) >=
          NODE_SIZE_PX + OVERLAP_GAP_PX - 0.00001,
        `${name}: Rust output preserves capsule clearance`,
      );
    }
  }
  const task = createOverlapTask(graph);
  let step = task.next();
  expect(
    !step.done,
    `${name}: the resumable API retains a scheduling boundary`,
  );
  while (!step.done) step = task.next();
  expect(
    JSON.stringify(step.value) === JSON.stringify(actual),
    `${name}: resumable Rust and synchronous Rust agree`,
  );
  const repeated = resolveNodeOverlaps({
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      ...actual.positions[node.id],
    })),
  });
  expect(
    repeated.status === "unchanged" &&
      JSON.stringify(repeated.positions) === JSON.stringify(actual.positions),
    `${name}: resolved Rust positions are idempotent`,
  );
}
resetRustKernelForTests();
finish(
  `Wasm overlap equivalence passed (${fixtures.length} fixtures, max error ${maximumError} px)`,
);
