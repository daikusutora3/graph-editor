import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { selectionAtom } from "../../features/graph-editor/shell/state/editor-atoms";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  historyAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { createBatchDeleteTool } from "../../features/graph-editor/webmcp/batch-delete-tool";

const fixture: GraphModel = {
  ...createEmptyGraphModel({
    directed: true,
    weighted: true,
    allowMultiEdges: true,
  }),
  nodes: [
    { id: "a", label: "A", order: 0, x: 10, y: 20, color: "blue" },
    { id: "b", label: "B", order: 1, x: 110, y: 20 },
    { id: "c", label: "C", order: 2, x: 210, y: 20, color: "blue" },
    { id: "d", label: "C", order: 3, x: 310, y: 20 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", weight: "9007199254740992" },
    { id: "bc", source: "b", target: "c", weight: "9007199254740993" },
    { id: "bd", source: "b", target: "d", weight: "unknown" },
  ],
};
const store = createStore();
let graphSequence = 0;
let selectionSequence = 0;
store.sub(graphAtom, () => graphSequence++);
store.sub(selectionAtom, () => selectionSequence++);
const context = {
  store,
  revision: () => String(graphSequence),
  selectionRevision: () => String(selectionSequence),
  requestFit: () => {},
};
const remove = createBatchDeleteTool(context);
const resultOf = async (input: Record<string, unknown>, signal?: AbortSignal) =>
  (await remove.execute(
    { expectedRevision: context.revision(), ...input },
    signal ? { signal } : undefined,
  )) as {
    ok: boolean;
    code?: string;
    deletedNodes?: number;
    deletedEdges?: number;
    nonNumericWeights?: number;
  };
store.set(syncExternalGraphAtom, structuredClone(fixture));

// Exact decimal filtering deletes only the intended edge and preserves unrelated selection.
{
  store.set(selectionAtom, { nodeIds: ["d"], edgeIds: ["ab"] });
  const selection = structuredClone(store.get(selectionAtom));
  const historyLength = store.get(historyAtom).length;
  const result = await resultOf({
    edgeFilter: { minWeight: "9007199254740993" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.deletedEdges, 1);
  assert.equal(result.nonNumericWeights, 1);
  assert.deepEqual(
    store.get(graphAtom).edges.map((edge) => edge.id),
    ["ab", "bd"],
  );
  assert.deepEqual(store.get(selectionAtom), selection);
  assert.equal(store.get(historyAtom).length, historyLength + 1);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), fixture);
  assert.deepEqual(store.get(selectionAtom), selection);
}

// Existing selected elements are pruned only when those elements are deleted.
{
  store.set(selectionAtom, { nodeIds: ["c", "d"], edgeIds: ["ab", "bc"] });
  const result = await resultOf({ nodeFilter: { color: "blue" } });
  assert.equal(result.ok, true);
  assert.equal(result.deletedNodes, 2);
  assert.equal(result.deletedEdges, 2);
  assert.deepEqual(store.get(selectionAtom), { nodeIds: ["d"], edgeIds: [] });
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), fixture);
}

// Filters and explicit selectors may be combined across distinct element types.
{
  store.set(selectionAtom, { nodeIds: ["d"], edgeIds: [] });
  const result = await resultOf({
    nodes: [{ id: "a" }],
    edgeFilter: { minWeight: "9007199254740993" },
  });
  assert.equal(result.ok, true);
  assert.equal(result.deletedNodes, 1);
  assert.equal(result.deletedEdges, 2);
  assert.equal(result.nonNumericWeights, 1);
  assert.deepEqual(store.get(selectionAtom), { nodeIds: ["d"], edgeIds: [] });
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), fixture);
}

// Rejections and cancellation do not partially change the graph, selection or history.
{
  const selection = structuredClone(store.get(selectionAtom));
  const before = structuredClone(store.get(graphAtom));
  const historyLength = store.get(historyAtom).length;
  for (const [input, code] of [
    [{ nodeFilter: {} }, "invalid-input"],
    [{ nodeFilter: { color: "red" } }, "no-targets"],
    [
      { nodeFilter: { neighborOf: { node: { label: "C" } } } },
      "ambiguous-node",
    ],
    [{ nodes: [{ id: "a" }], nodeFilter: { color: "blue" } }, "invalid-input"],
    [
      {
        selectedEdges: true,
        edgeFilter: { minWeight: 10 },
        expectedSelectionRevision: context.selectionRevision(),
      },
      "invalid-input",
    ],
    [
      {
        nodeFilter: { color: "blue" },
        edgeFilter: { minWeight: "9999999999999999" },
      },
      "no-targets",
    ],
    [
      { nodeFilter: { color: "blue" }, expectedRevision: "stale" },
      "stale-revision",
    ],
  ] as const) {
    // Shared state must be inspected after each individual rejection.
    // oxlint-disable-next-line no-await-in-loop
    const result = await resultOf(input);
    assert.equal(result.code, code);
    assert.deepEqual(store.get(graphAtom), before);
    assert.deepEqual(store.get(selectionAtom), selection);
    assert.equal(store.get(historyAtom).length, historyLength);
  }
  const abort = new AbortController();
  abort.abort();
  assert.equal(
    (await resultOf({ nodeFilter: { color: "blue" } }, abort.signal)).code,
    "cancelled",
  );
  assert.deepEqual(store.get(graphAtom), before);
  assert.deepEqual(store.get(selectionAtom), selection);
}

console.log("WebMCP filtered deletion verification passed");
