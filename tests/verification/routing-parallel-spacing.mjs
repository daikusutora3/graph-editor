import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mock } from "bun:test";
import {
  manualParallelRoutingFixture,
  parallelRoutingFixture,
} from "../fixtures/parallel-routing.ts";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset.ts";
import { initializeRustKernelFromBytes } from "../../features/graph-editor/compute/rust-kernel.ts";
import * as shared from "../../features/graph-editor/core/layout/edge-routing-shared.ts";

await initializeRustKernelFromBytes(
  readFileSync(`${process.cwd()}/public${RUST_KERNEL_URL}`),
);
let uncachedLabelReads = 0;
const originalExports = { ...shared };
const originalLabelSize = shared.edgeLabelSize;
const modulePath =
  "../../features/graph-editor/core/layout/edge-routing-shared.ts";
mock.module(modulePath, () => ({
  ...originalExports,
  edgeLabelSize: (edge, work) => {
    if (!work) uncachedLabelReads++;
    return originalLabelSize(edge, work);
  },
}));
const { createEdgeRoutingTask, computeEdgeRouting, edgeRoutingProgress } =
  await import("../../features/graph-editor/core/layout/edge-routing.ts");

function finish(task) {
  let step;
  let steps = 0;
  do {
    step = task.next();
    if (++steps > 100_000) throw new Error("Routing task did not complete");
  } while (!step.done);
  return { routes: step.value, steps };
}
function route(graph, options) {
  uncachedLabelReads = 0;
  const result = finish(createEdgeRoutingTask(graph, options));
  return { ...result, uncachedLabelReads };
}
function equivalent(first, second, message) {
  assert.deepEqual([...first], [...second], message);
}

try {
  const graph = parallelRoutingFixture(100);
  const saved = JSON.stringify(graph);
  const complete = route(graph);
  assert.equal(
    complete.uncachedLabelReads,
    200,
    "each reversed parallel group scans labels once for lanes and once for colliding offsets",
  );
  assert.equal(complete.steps, 902, "spacing reuse preserves generator yields");
  assert.equal(
    JSON.stringify(graph),
    saved,
    "scratch caches never change the model",
  );

  // Count the actual rounding used by representativeBow, rather than timing a
  // mock. The old sibling loop repeats this calculation for every comparison.
  const nativeRound = Math.round;
  try {
    for (const [count, maxRounds, steps, hash] of [
      [
        100,
        4_000,
        902,
        "aacd07a682f661269b64528f1f288aec9a69403d57b55273544e3510ae6014de",
      ],
      [
        200,
        8_000,
        1758,
        "fae90d46cdc8f4a1a402633d43fc11d6c135f4de8d1b637a9bce3e211996ae27",
      ],
    ]) {
      let rounds = 0;
      Math.round = (value) => {
        rounds++;
        return nativeRound(value);
      };
      const result = route(parallelRoutingFixture(count));
      assert(
        rounds < maxRounds,
        "one candidate bow is reused across its sibling comparisons",
      );
      assert.equal(
        result.steps,
        steps,
        "bow reuse keeps scheduling boundaries",
      );
      assert.equal(
        createHash("sha256")
          .update(JSON.stringify([...result.routes]))
          .digest("hex"),
        hash,
        "bow reuse preserves every pre-change route value and order",
      );
    }
  } finally {
    Math.round = nativeRound;
  }

  // Fixed manual geometry removes one automatic lane, so the remaining
  // siblings run the reconciliation stage even in simple/parallel mode.
  // Preserve its geometry, orientation, tie decisions and scheduling while
  // ensuring each candidate's bow is evaluated once, not once per sibling.
  for (const [mode, count, maxRounds, steps, hash] of [
    [
      "simple",
      100,
      5_500,
      3172,
      "67dc22f5978ec7e6c7b4ae5481d5fbef796b33b74d9b2b955d02341595d2ef41",
    ],
    [
      "simple",
      200,
      11_000,
      6372,
      "50f5336289c8d45acfb82e9143e5a381de77a388880caa49dcc231c3d36437e8",
    ],
    [
      "parallel",
      100,
      5_500,
      3172,
      "67dc22f5978ec7e6c7b4ae5481d5fbef796b33b74d9b2b955d02341595d2ef41",
    ],
    [
      "parallel",
      200,
      11_000,
      6372,
      "50f5336289c8d45acfb82e9143e5a381de77a388880caa49dcc231c3d36437e8",
    ],
    [
      "quality",
      100,
      7_000,
      4064,
      "ec1264fd03036649105c65064a04504181dfce671f2d0c2f545fe9d1e68e2adf",
    ],
    [
      "quality",
      200,
      14_000,
      8120,
      "901feb5e6446aa0347a480f452376f91839caaa5449a4a0e187651becb1a2b00",
    ],
  ]) {
    const manualGraph = manualParallelRoutingFixture(count);
    const savedManual = JSON.stringify(manualGraph);
    let rounds = 0;
    let result;
    try {
      Math.round = (value) => {
        rounds++;
        return nativeRound(value);
      };
      result = route(manualGraph, { mode });
    } finally {
      Math.round = nativeRound;
    }
    assert(
      rounds < maxRounds,
      "manual reconciliation reuses one bow per candidate in every routing mode",
    );
    assert.equal(result.steps, steps, "manual reconciliation keeps yields");
    assert.equal(
      createHash("sha256")
        .update(JSON.stringify([...result.routes]))
        .digest("hex"),
      hash,
      "manual reconciliation preserves pre-change route values, ties and order",
    );
    assert.equal(
      JSON.stringify(manualGraph),
      savedManual,
      "manual routing leaves fixed geometry and the model untouched",
    );
    const fixed = result.routes.get("e0");
    assert.equal(fixed.bowPx, 0);
    assert.deepEqual(fixed.controlPointDistancesPx, [0]);
    assert.deepEqual(fixed.controlPointWeights, [0.3]);
    for (const edge of manualGraph.edges) {
      const meta = result.routes.get(edge.id);
      assert(meta, "all reversed/forward siblings retain their route");
      assert(
        meta.controlPointDistancesPx.every(
          (distance) => Number.isFinite(distance) && Math.abs(distance) <= 180,
        ),
        "reconciled manual siblings remain within supported curve bounds",
      );
    }
  }

  const retained = route(graph, {
    previousMeta: complete.routes,
    rerouteEdgeIds: new Set(),
  });
  assert.equal(
    retained.uncachedLabelReads,
    0,
    "retained groups need no spacing scan",
  );
  for (const [id, meta] of retained.routes)
    assert.equal(
      meta,
      complete.routes.get(id),
      "retained metadata stays identical",
    );
  assert.equal(
    route(graph, { mode: "parallel" }).uncachedLabelReads,
    100,
    "parallel-only routing never computes collision-offset spacing",
  );
  assert.equal(
    route(graph, { mode: "simple" }).uncachedLabelReads,
    100,
    "simple routing only computes its existing lane spacing",
  );

  // A second endpoint group must get its own spacing, including reversed edges.
  const second = {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      id: `other-${node.id}`,
      x: node.x + 1000,
    })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      id: `other-${edge.id}`,
      source: `other-${edge.source}`,
      target: `other-${edge.target}`,
    })),
  };
  const twoGroups = {
    ...graph,
    nodes: [...graph.nodes, ...second.nodes],
    edges: [...graph.edges, ...second.edges],
  };
  const grouped = route(twoGroups);
  assert.equal(
    grouped.uncachedLabelReads,
    400,
    "endpoint groups cannot share spacing caches",
  );
  const partial = route(twoGroups, {
    previousMeta: grouped.routes,
    rerouteEdgeIds: new Set(graph.edges.map((edge) => edge.id)),
  });
  assert.equal(
    partial.uncachedLabelReads,
    200,
    "an unrelated retained group remains lazy",
  );
  for (const edge of second.edges)
    assert.equal(partial.routes.get(edge.id), grouped.routes.get(edge.id));

  // Hidden weights and explicit empty labels use the same displayed text as before.
  const weighted = {
    ...parallelRoutingFixture(4),
    settings: { ...graph.settings, weighted: true, showNodeLabels: false },
    edges: parallelRoutingFixture(4).edges.map(
      ({ label: _label, ...edge }) => ({ ...edge, weight: "long edge label" }),
    ),
  };
  const explicit = {
    ...weighted,
    settings: { ...weighted.settings, weighted: false },
    edges: weighted.edges.map((edge) => ({ ...edge, label: edge.weight })),
  };
  equivalent(
    route(weighted).routes,
    route(explicit).routes,
    "visible weights match equivalent explicit labels",
  );
  const empty = {
    ...weighted,
    edges: weighted.edges.map((edge) => ({ ...edge, label: "" })),
  };
  const hidden = {
    ...weighted,
    settings: { ...weighted.settings, weighted: false },
  };
  equivalent(
    route(empty).routes,
    route(hidden).routes,
    "an empty label overrides a weight and matches hidden weights",
  );
  assert.equal(
    route(hidden).uncachedLabelReads,
    0,
    "hidden text causes no label scan",
  );

  // Drop a task after its lazy cache is populated, then interleave two snapshots.
  uncachedLabelReads = 0;
  const abandoned = createEdgeRoutingTask(graph);
  let step;
  for (let steps = 0; steps < 2000; steps++) {
    step = abandoned.next();
    if (step.done || uncachedLabelReads > 100) break;
  }
  assert(!step.done, "cancellation fixture reaches the cached offset phase");
  abandoned.return();
  const changed = {
    ...graph,
    nodes: graph.nodes.map((node) => ({ ...node, x: node.y, y: node.x })),
    edges: graph.edges.map((edge) => ({
      ...edge,
      label: "WIDE changed label for a new snapshot",
    })),
  };
  const changedExpected = route(changed);
  assert.equal(
    changedExpected.uncachedLabelReads,
    200,
    "new labels and endpoint orientation get a fresh cache",
  );
  const originalTask = createEdgeRoutingTask(graph);
  const changedTask = createEdgeRoutingTask(changed);
  let originalStep;
  let changedStep;
  do {
    if (!originalStep?.done) originalStep = originalTask.next();
    if (!changedStep?.done) changedStep = changedTask.next();
  } while (!originalStep.done || !changedStep.done);
  equivalent(
    originalStep.value,
    complete.routes,
    "interleaved tasks retain original labels and endpoints",
  );
  equivalent(
    changedStep.value,
    changedExpected.routes,
    "canceled or concurrent tasks cannot seed a new snapshot cache",
  );

  // Synchronous budget drafts resume the same generator and its local cache.
  const budgetGraph = {
    ...graph,
    nodes: [
      ...graph.nodes,
      ...Array.from({ length: 75 }, (_, index) => ({
        id: `obstacle-${index}`,
        label: String(index),
        order: index + 5,
        x: 50 + (index % 10) * 20,
        y: (Math.floor(index / 10) - 3) * 30,
      })),
    ],
  };
  let draft = computeEdgeRouting(budgetGraph);
  assert(
    edgeRoutingProgress(draft).pendingEdgeIds.length > 0,
    "fixture produces a pending budget draft",
  );
  let chunks = 1;
  while (edgeRoutingProgress(draft).pendingEdgeIds.length) {
    assert(++chunks < 100, "budget continuation must finish");
    draft = computeEdgeRouting(budgetGraph, {
      previousMeta: draft,
      rerouteEdgeIds: new Set(edgeRoutingProgress(draft).pendingEdgeIds),
    });
  }
  equivalent(
    draft,
    route(budgetGraph).routes,
    "pending chunks preserve the complete route result",
  );
} finally {
  mock.module(modulePath, () => originalExports);
}
console.log(
  "Routing parallel spacing verification passed (lazy group reads, retained/pending routes, display settings and task isolation)",
);
