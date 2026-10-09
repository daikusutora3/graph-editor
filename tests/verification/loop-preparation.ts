import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import type {
  GraphEdge,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";
import { createLoopGroupRoutingTask } from "../../features/graph-editor/core/layout/edge-routing-loops";
import type { ResolvedEdgeRoutingOptions } from "../../features/graph-editor/core/layout/edge-routing-shared";
import { createVerification } from "./harness";

import referenceContracts from "../fixtures/loop-placement-contracts.json";

const { expect, finish } = createVerification("Loop preparation");
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));
let fixtures = 0;
for (const count of [1, 2, 8, 32, 64, 128]) {
  for (const wide of [false, true]) {
    for (const labels of [false, true]) {
      const graph = fixture(count, wide, labels, false);
      compare(graph, "plain group");
    }
  }
}
for (const translation of [0, 1e9, 1e20])
  for (const manual of [false, true]) {
    const graph = fixture(8, true, true, manual);
    for (const node of graph.nodes) {
      node.x += translation;
      node.y -= translation;
    }
    compare(graph, "translated manual/automatic group");
  }
for (const mutating of [true, false]) {
  compare(
    fixture(32, true, true, true),
    "source width mutation",
    mutating ? "width" : undefined,
  );
}
for (const cached of [true, false])
  compare(
    fixture(8, true, true, false),
    "label mutation at a yield",
    "label",
    cached,
  );
expect(
  fixtures === referenceContracts.length,
  "all recorded baseline fixtures must run",
);
let stableFixtures = 0;
for (const count of [2, 8, 128, 512]) {
  for (const labels of ["none", "mixed", "all"] as const) {
    const graph = immutableFixture(count, labels);
    const legacy = drain(structuredClone(graph));
    const stable = drain(graph, undefined, true, true);
    expect(
      JSON.stringify(stable.routes) === JSON.stringify(legacy.routes) &&
        stable.units === legacy.units,
      `${labels} ${count}: stable labels retain ordered routes, statuses and work units`,
    );
    verifyScheduling(stable, `${labels} ${count}`);
    stableFixtures++;
  }
}
for (const count of [2000, 2001, 5000]) {
  const graph = immutableFixture(count, "none");
  const stable = drain(graph, undefined, true, true);
  const pairUnits = count * count <= 4_000_000 ? (count * (count - 1)) / 2 : 0;
  expect(
    stable.units === 1 + 24 * (2 * count + pairUnits),
    `unlabeled ${count}: retain the original pair-budget threshold and accounting`,
  );
  expect(
    stable.trace.length < count * 64,
    `unlabeled ${count}: no per-pair generator expansion`,
  );
  verifyScheduling(stable, `unlabeled ${count}`);
  stableFixtures++;
}
const cancellable = immutableFixture(2000, "none");
const cancellationOptions = makeOptions();
cancellationOptions.work.stableLabels = true;
const cancellationTask = createLoopGroupRoutingTask(
  cancellable.source,
  cancellable.nodes,
  cancellable.edges,
  cancellationOptions,
);
let cancellationStep = cancellationTask.next();
while (!cancellationStep.done && cancellationOptions.work.units < 25_000)
  cancellationStep = cancellationTask.next();
expect(
  !cancellationStep.done,
  "the large group remains cancellable at the budget",
);
expect(
  cancellationOptions.work.units <= 25_000 + 4096,
  "a synchronous budget checkpoint cannot charge an entire group at once",
);
cancellationTask.return(new Map());
const stoppedUnits = cancellationOptions.work.units;
expect(
  cancellationTask.next().done === true &&
    cancellationOptions.work.units === stoppedUnits,
  "cancelled loop work never resumes",
);
console.log(JSON.stringify({ fixtures, stableFixtures }));
finish();

/** Fixed hashes were recorded from the saved pre-change source and kernel,
 * then matched against the optimized task. They include every yield's units,
 * ordered metadata, all statuses and the final counter, not only the outcome. */
function compare(
  graph: ReturnType<typeof fixture>,
  context: string,
  mutate?: "width" | "label",
  cacheLabels = true,
) {
  const saved = JSON.stringify(graph);
  const expected = withRustKernelSuppressed(() =>
    drain(structuredClone(graph), mutate, cacheLabels),
  );
  const actual = drain(graph, mutate, cacheLabels);
  expect(
    hash(actual) === referenceContracts[fixtures],
    `${context}: original ordered routes and complete work/yield trace`,
  );
  expect(
    JSON.stringify(actual) === JSON.stringify(expected),
    `${context}: JS/Rust obstacle backends agree`,
  );
  if (!mutate)
    expect(
      JSON.stringify(graph) === saved,
      `${context}: no persistent graph mutation`,
    );
  if (!mutate) {
    const stable = drain(structuredClone(graph), undefined, cacheLabels, true);
    expect(
      JSON.stringify(stable.routes) === JSON.stringify(actual.routes) &&
        stable.units === actual.units,
      `${context}: immutable-label scheduling retains results and accounting`,
    );
    verifyScheduling(stable, context);
  }
  fixtures++;
}

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
function drain(
  graph: ReturnType<typeof fixture>,
  mutate?: "width" | "label",
  cacheLabels = true,
  stableLabels = false,
) {
  const options = makeOptions();
  if (!cacheLabels) delete options.work.labelSizes;
  if (stableLabels) options.work.stableLabels = true;
  const task = createLoopGroupRoutingTask(
    graph.source,
    graph.nodes,
    graph.edges,
    options,
  );
  const trace: number[] = [];
  let step = task.next();
  while (!step.done) {
    trace.push(options.work.units);
    if (mutate === "width" && trace.length === 50)
      graph.source.measuredWidth = 48;
    if (mutate === "width" && trace.length === 200)
      graph.source.measuredWidth = 188;
    if (mutate === "label" && trace.length === 20)
      graph.edges[0]!.label = "a wider changed loop label";
    if (mutate === "label" && trace.length === 50) graph.edges[1]!.label = "";
    if (mutate === "label" && trace.length === 200)
      graph.edges[1]!.label = "a changed label after scoring starts";
    step = task.next();
  }
  return { routes: [...step.value], trace, units: options.work.units };
}

function verifyScheduling(result: ReturnType<typeof drain>, context: string) {
  const units = [0, ...result.trace, result.units];
  expect(
    units.every(
      (value, index) =>
        index === 0 ||
        (value >= units[index - 1]! && value - units[index - 1]! <= 4096),
    ),
    `${context}: work advances monotonically in bounded resumable chunks`,
  );
}

function immutableFixture(count: number, labels: "none" | "mixed" | "all") {
  const graph = fixture(count, true, true, false);
  for (const [index, edge] of graph.edges.entries())
    if (labels === "none" || (labels === "mixed" && index % 3 !== 0)) {
      delete edge.label;
      delete edge.weight;
    }
  return graph;
}

function fixture(
  count: number,
  wide: boolean,
  labels: boolean,
  manual: boolean,
) {
  const source = {
    id: "source",
    order: 0,
    label: wide ? "wide" : "",
    measuredWidth: wide ? 240 : 48,
    x: 0,
    y: 0,
  };
  const nodes: GraphNode[] = [source];
  if (manual)
    nodes.push(
      ...Array.from({ length: 32 }, (_, index) => ({
        id: `n${index}`,
        order: index + 1,
        label: index % 2 ? "" : "wide obstacle label",
        x: Math.cos(index * 0.31) * 120,
        y: Math.sin(index * 0.31) * 120,
      })),
    );
  const edges: GraphEdge[] = Array.from({ length: count }, (_, index) => ({
    id: `loop${count - index}`,
    source: "source",
    target: "source",
    ...(labels
      ? { label: index % 2 ? "long loop label" : "1" }
      : { label: "", weight: "1" }),
    ...(manual && index === 0
      ? { routing: { loopDirectionDeg: 15, loopSweepDeg: 50 } }
      : {}),
  }));
  return { source, nodes, edges };
}

function makeOptions(): ResolvedEdgeRoutingOptions {
  return {
    avoidNodes: true,
    work: { units: 0, samples: new Map(), labelSizes: new Map() },
    candidateBowPx: [],
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
