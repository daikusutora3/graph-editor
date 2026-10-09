import { readFileSync } from "node:fs";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import {
  canRustSelectInteractiveRoute,
  createRustInteractiveRerouteBatch,
} from "../../features/graph-editor/compute/wasm-interactive-routing";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type {
  GraphModel,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";
import {
  defaultEdgeRoutingMeta,
  type EdgeRoutingMeta,
} from "../../features/graph-editor/core/layout/edge-routing";
import { interactiveRerouteEdgeIdsTask } from "../../features/graph-editor/core/layout/interactive-routing";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Rust interactive selection");
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));

function fixture(count = 1000, edges = 400): GraphModel {
  return {
    ...createEmptyGraphModel({ autoEdgeRouting: true }),
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: String(index),
      x: (index % 25) * 120 + (index >= count / 2 ? 10000 : 0),
      y: Math.floor(index / 25) * 120,
    })),
    edges: Array.from({ length: edges }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % Math.floor(count / 2)}`,
      target: `n${(index + 1) % Math.floor(count / 2)}`,
    })),
  };
}

function meta(model: GraphModel): Map<string, EdgeRoutingMeta> {
  return new Map(
    model.edges.map((edge) => [
      edge.id,
      { ...defaultEdgeRoutingMeta, status: "ready" as const },
    ]),
  );
}

let cases = 0;
function compare(
  name: string,
  model: GraphModel,
  previous: Map<string, EdgeRoutingMeta>,
  moved: Set<string>,
) {
  const drain = (javascript: boolean) => {
    const task = interactiveRerouteEdgeIdsTask(model, previous, moved);
    let yields = 0;
    let step = javascript
      ? withRustKernelSuppressed(() => task.next())
      : task.next();
    while (!step.done) {
      yields++;
      step = javascript
        ? withRustKernelSuppressed(() => task.next())
        : task.next();
    }
    return { ids: step.value ? [...step.value] : null, yields };
  };
  const before = drain(true);
  const after = drain(false);
  expect(
    JSON.stringify(before.ids) === JSON.stringify(after.ids),
    `${name}: exact ordered reroute IDs agree`,
  );
  expect(
    model.edges.length === 0 ||
      moved.size === 0 ||
      previous.size === 0 ||
      after.yields > 0,
    `${name}: resumable task yields`,
  );
  cases++;
  return { ...after, referenceYields: before.yields };
}

const model = fixture();
const moved = new Set(model.nodes.slice(500).map((node) => node.id));
compare("distant 500-node drag", model, meta(model), moved);
const wholeGraph = compare(
  "whole graph drag keeps the cheap endpoint path",
  model,
  meta(model),
  new Set(model.nodes.map((node) => node.id)),
);
expect(
  wholeGraph.yields === wholeGraph.referenceYields,
  "whole graph movement retains identical JS scheduling",
);
const pendingRoutes = meta(model);
for (const route of pendingRoutes.values()) route.status = "pending";
const allPending = compare(
  "pending routes retain the direct JS path",
  model,
  pendingRoutes,
  moved,
);
expect(
  allPending.yields === allPending.referenceYields,
  "all pending routes do not construct Rust batches",
);
const fewEdges = fixture(1000, 64);
const smallGraph = compare(
  "small edge set retains JS",
  fewEdges,
  meta(fewEdges),
  moved,
);
expect(
  smallGraph.yields === smallGraph.referenceYields,
  "small edge sets retain identical JS scheduling",
);
for (const count of [0, 1, 64, 127, 128, 256, 500])
  compare(
    `moved threshold ${count}`,
    model,
    meta(model),
    new Set([...moved].slice(0, count)),
  );
compare("no previous routes", model, new Map(), moved);
compare(
  "nonexistent moved nodes",
  model,
  meta(model),
  new Set(Array.from({ length: 200 }, (_, i) => `absent${i}`)),
);

for (const translation of [0, 1e9, 1e12, 1e20]) {
  for (const gap of [0, 83.999999999, 84, 84.000000001, 85]) {
    const graph = fixture();
    graph.nodes = graph.nodes.map((node, index) => ({
      ...node,
      label: index >= 500 ? "長いラベル".repeat(index % 3) : node.label,
      x: translation + (index < 500 ? index * 120 : (index - 500) * 120 + 60),
      y: translation + (index < 500 ? 0 : gap),
      measuredWidth: index % 7 === 0 ? 300 : 48,
    }));
    compare(
      `translated ${translation} strict distance ${gap}`,
      graph,
      meta(graph),
      moved,
    );
  }
}

for (const translation of [0, 1e9]) {
  for (const clearance of [84 - 1e-10, 84, 84 + 1e-10]) {
    const graph = fixture(300, 128);
    graph.edges = graph.edges.map((edge) => ({
      ...edge,
      source: "n0",
      target: "n1",
    }));
    graph.nodes = graph.nodes.map((node, index) => ({
      ...node,
      label: "",
      measuredWidth: 48,
      x:
        translation +
        (index === 0 ? -120 : index === 1 ? 120 : clearance / Math.sqrt(2)),
      y:
        translation +
        (index === 0 ? -120 : index === 1 ? 120 : -clearance / Math.sqrt(2)),
    }));
    compare(
      `diagonal strict threshold ${translation}/${clearance}`,
      graph,
      meta(graph),
      new Set(graph.nodes.slice(150).map((node) => node.id)),
    );
  }
}

let seed = 8182;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2 ** 32;
}
for (let pass = 0; pass < 20; pass++) {
  const graph = fixture(300, 200);
  graph.nodes = graph.nodes.map((node, index) => ({
    ...node,
    x: random() * 1800 - 900,
    y: random() * 1800 - 900,
    label: index % 3 ? "" : "測定済みの長いラベル",
    measuredWidth: index % 3 ? 48 : 390,
  }));
  const previous = meta(graph);
  graph.edges.forEach((edge, index) => {
    const curve = previous.get(edge.id)!;
    if (index % 13 === 0) curve.status = "pending";
    else if (index % 17 === 0) curve.status = "unresolved";
    else if (index % 11 === 0) curve.bowPx = 40;
    else if (index % 7 === 0) curve.controlPointDistancesPx = [0, 0];
    else if (index % 5 === 0) curve.controlPointDistancesPx = [32];
    else if (index % 3 === 0) curve.controlPointWeights = [];
    else curve.controlPointWeights = [random()];
  });
  compare(
    `random metadata ${pass}`,
    graph,
    previous,
    new Set(graph.nodes.slice(150).map((node) => node.id)),
  );
}

const mixed = fixture(400, 150);
const mixedMeta = meta(mixed);
mixed.edges[9]!.source = "missing";
mixed.edges[22]!.target = mixed.edges[22]!.source;
mixed.nodes.push({ ...mixed.nodes[0]!, x: 300, y: 30 });
mixedMeta.delete("e2");
mixedMeta.get("e30")!.controlPointWeights = [NaN];
mixedMeta.get("e31")!.controlPointWeights = [-1];
mixedMeta.get("e32")!.controlPointWeights = [2];
mixedMeta.get("e33")!.controlPointDistancesPx = [NaN];
mixedMeta.get("e34")!.controlPointDistancesPx = [];
mixedMeta.get("e35")!.controlPointWeights = [0.2, 0.8];
compare(
  "missing endpoints, duplicate IDs, loops and malformed curves",
  mixed,
  mixedMeta,
  new Set(mixed.nodes.slice(200).map((node) => node.id)),
);

const packedNodes = model.nodes
  .slice(500)
  .map((node) => ({ ...node, measuredWidth: 48 }));
expect(
  createRustInteractiveRerouteBatch(packedNodes.slice(0, 127), 400) === null,
  "small moved set stays in JS",
);
expect(
  createRustInteractiveRerouteBatch(packedNodes, 127) === null,
  "few total edges stay in JS",
);
const solve = createRustInteractiveRerouteBatch(packedNodes, 400)!;
const candidate = {
  source: model.nodes[0]!,
  target: model.nodes[1]!,
  curve: defaultEdgeRoutingMeta,
};
expect(
  solve(Array.from({ length: 7 }, () => candidate)) === null,
  "small candidate batch stays in JS",
);
expect(
  solve(Array.from({ length: 8 }, () => candidate))?.every(
    (value) => value === 0,
  ) === true,
  "actual Rust straight selection executes",
);
const thresholdNodes: Array<GraphNode & { measuredWidth: number }> = Array.from(
  { length: 128 },
  (_, index) => ({ ...packedNodes[index]!, x: 60, y: 84, measuredWidth: 48 }),
);
const strictSolve = createRustInteractiveRerouteBatch(thresholdNodes, 128)!;
expect(
  strictSolve(Array.from({ length: 8 }, () => candidate))?.every(
    (value) => value === 2,
  ) === true,
  "84px ties request exact JS recheck",
);
expect(
  !canRustSelectInteractiveRoute({
    ...candidate,
    source: { ...candidate.source, x: Infinity },
  }),
  "nonfinite coordinates use JS",
);
expect(
  !canRustSelectInteractiveRoute({
    ...candidate,
    source: { ...candidate.source, x: 1e20 },
  }),
  "extreme translated coordinates use JS",
);
expect(
  createRustInteractiveRerouteBatch(
    thresholdNodes.map((node) => ({ ...node, measuredWidth: Infinity })),
    128,
  ) === null,
  "nonfinite capsule geometry stays in JS",
);

const cancellable = interactiveRerouteEdgeIdsTask(model, meta(model), moved);
let next = cancellable.next();
let yielded = 0;
while (!next.done && yielded++ < 80) next = cancellable.next();
expect(!next.done, "large selection still exposes cancellable stages");
expect(
  cancellable.return(null).done === true,
  "generator can close between Rust batches without held Wasm memory",
);
compare("task reuse after cancellation", model, meta(model), moved);

finish(
  `Rust interactive selection verification passed (${cases} reference fixtures)`,
);
