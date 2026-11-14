import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { selectionAtom } from "../../features/graph-editor/shell/state/editor-atoms";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { undoAtom } from "../../features/graph-editor/shell/state/history-atoms";
import { createBatchEditTool } from "../../features/graph-editor/webmcp/batch-edit-tool";

const fixture: GraphModel = {
  ...createEmptyGraphModel({ weighted: true, allowMultiEdges: true }),
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0, color: "blue" },
    { id: "b", label: "B", order: 1, x: 100, y: 0 },
    { id: "c", label: "C", order: 2, x: 200, y: 0, color: "blue" },
    { id: "d", label: "D", order: 3, x: 300, y: 0 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", weight: "9007199254740993" },
    { id: "bc", source: "b", target: "c", weight: "9007199254740992" },
    { id: "cd", source: "c", target: "d", weight: "unknown" },
  ],
};
const store = createStore();
let graphRevision = 0;
let selectionRevision = 0;
store.sub(graphAtom, () => graphRevision++);
store.sub(selectionAtom, () => selectionRevision++);
store.set(syncExternalGraphAtom, structuredClone(fixture));
store.set(selectionAtom, { nodeIds: ["d"], edgeIds: ["bc"] });
const ctx = {
  store,
  revision: () => String(graphRevision),
  selectionRevision: () => String(selectionRevision),
  requestFit: () => {},
};
const tool = createBatchEditTool(ctx);
const initialSelection = structuredClone(store.get(selectionAtom));
const initialSelectionRevision = ctx.selectionRevision();
const execute = async (input: Record<string, unknown>, signal?: AbortSignal) =>
  (await tool.execute(
    { expectedRevision: ctx.revision(), ...input },
    signal ? { signal } : undefined,
  )) as {
    ok: boolean;
    code?: string;
    nodeCount?: number;
    edgeCount?: number;
    nonNumericWeights?: number;
  };

// The filters are resolved on the graph snapshot and committed together.
const result = await execute({
  nodeFilter: { color: "blue" },
  nodeColor: "red",
  edgeFilter: { minWeight: "9007199254740993" },
  edgeColor: "green",
});
assert.equal(result.ok, true);
assert.equal(result.nodeCount, 2);
assert.equal(result.edgeCount, 1);
assert.equal(result.nonNumericWeights, 1);
assert.deepEqual(store.get(selectionAtom), initialSelection);
assert.equal(ctx.selectionRevision(), initialSelectionRevision);
assert.deepEqual(
  store.get(graphAtom).nodes.map((node) => node.color),
  ["red", undefined, "red", undefined],
);
assert.deepEqual(
  store.get(graphAtom).edges.map((edge) => edge.color),
  ["green", undefined, undefined],
);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), fixture);
assert.deepEqual(store.get(selectionAtom), initialSelection);

const before = structuredClone(store.get(graphAtom));
for (const input of [
  { nodeFilter: {}, nodeColor: "red" },
  { nodeFilter: { color: "blue" }, nodeColor: "red", allNodes: true },
  {
    nodeFilter: { color: "blue" },
    nodeColor: "red",
    nodes: [{ node: { id: "a" } }],
  },
  {
    nodeFilter: { color: "blue" },
    nodeColor: "red",
    selectedNodes: true,
    expectedSelectionRevision: ctx.selectionRevision(),
  },
  {
    edgeFilter: { minWeight: 1 },
    edgeColor: "red",
    edges: [{ edge: { id: "ab" } }],
  },
  {
    edgeFilter: { minWeight: 1 },
    edgeColor: "red",
    selectedEdges: true,
    expectedSelectionRevision: ctx.selectionRevision(),
  },
  { nodeFilter: { color: "blue" } },
  { edgeFilter: { minWeight: 1 } },
  {
    nodeFilter: { color: "blue" },
    nodeColor: "red",
    expectedRevision: "stale",
  },
]) {
  // Each rejection is checked against the same unchanged graph.
  // oxlint-disable-next-line no-await-in-loop
  const failed = await execute(input);
  assert.equal(failed.ok, false);
  assert.deepEqual(store.get(graphAtom), before);
  assert.deepEqual(store.get(selectionAtom), initialSelection);
}
const aborted = new AbortController();
aborted.abort();
assert.equal(
  (
    await execute(
      { nodeFilter: { color: "blue" }, nodeColor: "red" },
      aborted.signal,
    )
  ).code,
  "cancelled",
);
assert.deepEqual(store.get(graphAtom), before);
assert.deepEqual(store.get(selectionAtom), initialSelection);

// Existing selection is independent: an explicit edge can be edited alongside
// a filtered node set in one transaction without disturbing the selection.
const mixed = await execute({
  nodeFilter: { color: "blue" },
  nodeColor: "red",
  edges: [{ edge: { id: "bc" }, weight: "11" }],
});
assert.equal(mixed.ok, true);
assert.equal(store.get(graphAtom).edges[1].weight, "11");
assert.deepEqual(store.get(selectionAtom), initialSelection);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), fixture);

// Weight and color can be applied together to a filtered subset.
const filteredWeight = await execute({
  edgeFilter: { minWeight: "9007199254740993" },
  edgeWeight: " 12 ",
  edgeColor: "red",
});
assert.equal(filteredWeight.ok, true);
assert.equal(filteredWeight.edgeCount, 1);
assert.equal(filteredWeight.nonNumericWeights, 1);
assert.deepEqual(
  store.get(graphAtom).edges.map((edge) => edge.weight),
  ["12", "9007199254740992", "unknown"],
);
assert.deepEqual(
  store.get(graphAtom).edges.map((edge) => edge.color),
  ["red", undefined, undefined],
);
assert.deepEqual(store.get(selectionAtom), initialSelection);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), fixture);

const allWeight = await execute({ allEdges: true, edgeWeight: 0 });
assert.equal(allWeight.ok, true);
assert.deepEqual(
  store.get(graphAtom).edges.map((edge) => edge.weight),
  ["0", "0", "0"],
);
assert.deepEqual(store.get(selectionAtom), initialSelection);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), fixture);

const selectedWeight = await execute({
  selectedEdges: true,
  expectedSelectionRevision: ctx.selectionRevision(),
  edgeWeight: " ",
});
assert.equal(selectedWeight.ok, true);
assert.deepEqual(
  store.get(graphAtom).edges.map((edge) => edge.weight),
  ["9007199254740993", "1", "unknown"],
);
assert.deepEqual(store.get(selectionAtom), initialSelection);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), fixture);

for (const invalid of [
  { edges: [{ edge: { id: "ab" }, weight: "3" }], edgeWeight: "4" },
  { allEdges: true, edgeWeight: Number.NaN },
  { allEdges: true, edgeWeight: {} },
]) {
  // Sequentially assert that each rejected operation leaves shared state unchanged.
  // oxlint-disable-next-line no-await-in-loop
  const failed = await execute(invalid);
  assert.equal(failed.ok, false);
  assert.deepEqual(store.get(graphAtom), fixture);
  assert.deepEqual(store.get(selectionAtom), initialSelection);
}
const unweightedStore = createStore();
const unweightedGraph = {
  ...fixture,
  settings: { ...fixture.settings, weighted: false },
};
unweightedStore.set(syncExternalGraphAtom, unweightedGraph);
const unweightedTool = createBatchEditTool({
  store: unweightedStore,
  revision: () => "current",
  selectionRevision: () => "selection",
  requestFit: () => {},
});
const unweighted = (await unweightedTool.execute({
  allEdges: true,
  edgeWeight: 4,
  expectedRevision: "current",
})) as { ok: boolean; code?: string };
assert.equal(unweighted.ok, false);
assert.equal(unweighted.code, "unweighted-graph");
assert.deepEqual(unweightedStore.get(graphAtom), unweightedGraph);

console.log("WebMCP direct filtered batch verification passed");
