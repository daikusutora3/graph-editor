import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  GRAPH_MAX_ABS_COORDINATE,
  isGraphCoordinate,
} from "../../features/graph-editor/core/graph/graph-coordinates";
import { parseGraphModelJson } from "../../features/graph-editor/core/graph/graph-json";
import { createMoveNodesCommand } from "../../features/graph-editor/core/graph/graph-intents";
import { prepareGraphTransaction } from "../../features/graph-editor/core/graph/graph-transaction";
import type {
  GraphModel,
  NodePositionMap,
} from "../../features/graph-editor/core/graph/model";
import {
  NODE_SIZE_PX,
  nodeGeometryWidth,
} from "../../features/graph-editor/core/graph/node-size";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import {
  isComputeResult,
  isComputeResultOutsideCoordinateRange,
} from "../../features/graph-editor/compute/worker-result";
import {
  computeLayoutInWorker,
  computeOverlapsInWorker,
  computeRoutingInWorker,
} from "../../features/graph-editor/compute/worker-client";
import {
  OVERLAP_GAP_PX,
  resolveNodeOverlaps,
} from "../../features/graph-editor/layouts/resolve-node-overlaps";
import {
  bounded,
  installRealComputeWorkers,
} from "../fixtures/real-compute-workers";

const limit = GRAPH_MAX_ABS_COORDINATE;
function coincident(y: number, snapToGrid: boolean): GraphModel {
  return {
    ...createEmptyGraphModel({ snapToGrid }),
    nodes: [
      { id: "__proto__", label: "A", order: 0, x: 0, y },
      { id: "constructor", label: "B", order: 1, x: 0, y },
    ],
  };
}
function countPairs(model: GraphModel, positions: NodePositionMap) {
  const spans = model.nodes.map((node) =>
    Math.max(
      0,
      (nodeGeometryWidth({
        ...node,
        label: model.settings.showNodeLabels ? node.label : "",
      }) -
        NODE_SIZE_PX) /
        2,
    ),
  );
  let count = 0;
  for (let first = 0; first < model.nodes.length; first++)
    for (let second = first + 1; second < model.nodes.length; second++) {
      const a = positions[model.nodes[first]!.id]!,
        b = positions[model.nodes[second]!.id]!;
      if (
        Math.hypot(
          Math.max(0, Math.abs(a.x - b.x) - spans[first]! - spans[second]!),
          a.y - b.y,
        ) <
        NODE_SIZE_PX + OVERLAP_GAP_PX - 0.00001
      )
        count++;
    }
  return count;
}
const cases: [string, GraphModel, "resolved" | "unresolved" | "unchanged"][] =
  [];
for (const snap of [false, true]) {
  for (const y of [
    0,
    limit - 100,
    limit - 15,
    limit,
    -limit + 100,
    -limit + 15,
    -limit,
  ])
    cases.push([
      `coincident ${y} snap=${snap}`,
      coincident(y, snap),
      "resolved",
    ]);
  for (const direction of [-1, 1]) {
    const horizontal = coincident(0, snap);
    horizontal.nodes[0]!.x = direction * limit;
    horizontal.nodes[1]!.x = direction * (limit - 30);
    cases.push([
      `horizontal boundary ${direction} snap=${snap}`,
      horizontal,
      "resolved",
    ]);
    const wholeRange = coincident(direction * limit, snap);
    wholeRange.nodes.push({
      id: "opposite",
      label: "C",
      order: 2,
      x: 0,
      y: -direction * limit,
    });
    cases.push([
      `full span ${direction} snap=${snap}`,
      wholeRange,
      "unresolved",
    ]);
  }
  cases.push([
    `separated boundary snap=${snap}`,
    {
      ...coincident(limit, snap),
      nodes: coincident(limit, snap).nodes.map((node, index) => ({
        ...node,
        x: index * 200,
      })),
    },
    "unchanged",
  ]);
}

const references = cases.map(([, model]) =>
  withRustKernelSuppressed(() => resolveNodeOverlaps(model)),
);
await initializeRustKernelFromBytes(
  readFileSync(new URL(`../../public${RUST_KERNEL_URL}`, import.meta.url)),
);
for (const [index, [name, model, status]] of cases.entries()) {
  const saved = JSON.stringify(model);
  assert(parseGraphModelJson(saved), `${name}: input is supported`);
  const result = resolveNodeOverlaps(model);
  assert.deepEqual(
    result,
    references[index],
    `${name}: JS/Rust finalization agrees exactly`,
  );
  assert.equal(result.status, status, name);
  assert(
    isComputeResult("overlap", result),
    `${name}: output remains inside the shared contract`,
  );
  assert.equal(
    result.remainingPairs,
    countPairs(model, result.positions),
    `${name}: collision count describes the returned positions`,
  );
  assert.equal(JSON.stringify(model), saved, `${name}: input stays unchanged`);
  if (status === "unresolved" || status === "unchanged")
    assert.deepEqual(
      result.positions,
      Object.fromEntries(
        model.nodes.map((node) => [node.id, { x: node.x, y: node.y }]),
      ),
      `${name}: no feasible translation preserves the original positions`,
    );
  else {
    assert.equal(
      result.remainingPairs,
      0,
      `${name}: translation never clips capsules back into overlap`,
    );
    for (const point of Object.values(result.positions)) {
      assert(isGraphCoordinate(point.x) && isGraphCoordinate(point.y));
      if (model.settings.snapToGrid)
        assert(
          point.x % 24 === 0 && point.y % 24 === 0,
          `${name}: translated snapped output stays on grid`,
        );
    }
    assert(
      prepareGraphTransaction(
        model,
        createMoveNodesCommand("Resolve overlaps", result.positions),
        0,
      ),
      `${name}: bounded result can be applied`,
    );
    const repeated = resolveNodeOverlaps({
      ...model,
      nodes: model.nodes.map((node) => ({
        ...node,
        ...result.positions[node.id],
      })),
    });
    assert.equal(
      repeated.status,
      "unchanged",
      `${name}: resolved output is idempotent`,
    );
    assert.deepEqual(repeated.positions, result.positions);
  }
}

const unsupported = {
  positions: { a: { x: limit + 1, y: 0 } },
  status: "resolved",
  remainingPairs: 0,
};
assert(isComputeResultOutsideCoordinateRange("overlap", unsupported));
for (const value of [
  { ...unsupported, status: "bad" },
  { ...unsupported, remainingPairs: -1 },
  { ...unsupported, positions: { a: { x: NaN, y: 0 } } },
  { ...unsupported, positions: { a: { x: Infinity, y: 0 } } },
])
  assert(
    !isComputeResultOutsideCoordinateRange("overlap", value),
    "malformed/non-finite output remains a protocol failure",
  );

const host = installRealComputeWorkers();
try {
  const normal = {
    ...coincident(0, false),
    nodes: coincident(0, false).nodes.map((node, index) => ({
      ...node,
      x: index * 200,
    })),
    edges: [{ id: "ab", source: "__proto__", target: "constructor" }],
  };
  const initialRoute = await bounded(
    computeRoutingInWorker(normal, {}),
    "initial routing",
  );
  assert(initialRoute instanceof Map);
  const boundary = coincident(limit, true);
  const result = await bounded(
    computeOverlapsInWorker(boundary),
    "boundary overlap",
  );
  assert(
    result &&
      result.status === "resolved" &&
      isComputeResult("overlap", result),
  );
  assert.equal(countPairs(boundary, result.positions), 0);
  const before = host.counts();
  const finalRoute = await bounded(
    computeRoutingInWorker(normal, {}),
    "routing after boundary overlap",
  );
  assert(finalRoute instanceof Map);
  assert.deepEqual([...finalRoute], [...initialRoute]);
  const noTranslation = cases.find(([name]) =>
    name.startsWith("full span 1 snap=true"),
  )![1];
  const unresolved = await bounded(
    computeOverlapsInWorker(noTranslation),
    "untranslatable overlap",
  );
  assert(
    unresolved &&
      unresolved.status === "unresolved" &&
      unresolved.remainingPairs === 1,
  );
  const force = await bounded(
    computeLayoutInWorker(normal, "force"),
    "force after unresolved overlap",
  );
  assert(force && isComputeResult("layout", force));
  assert.equal(
    host.counts().createdWorkers,
    before.createdWorkers,
    "both owners remain warm after boundary and unresolved results",
  );
  assert.equal(host.counts().liveWorkers, 2);
  host.pagehide();
  assert.equal(host.counts().liveWorkers, 0);
} finally {
  host.restore();
}
console.log(
  `Overlap boundary verification passed (${cases.length} JS/Rust cases, bounded translation/grid/full-span failure and real Worker recovery)`,
);
