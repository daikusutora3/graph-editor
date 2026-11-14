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
import { createFilterSelectionTool } from "../../features/graph-editor/webmcp/filter-selection-tool";
import { createRelativeLayoutTool } from "../../features/graph-editor/webmcp/relative-layout-tool";
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
const ctx = {
  store,
  revision: () => String(graphSequence),
  selectionRevision: () => String(selectionSequence),
  requestFit: () => {},
};
const select = createFilterSelectionTool(ctx);
const move = createRelativeLayoutTool(ctx);
const remove = createBatchDeleteTool(ctx);
store.set(syncExternalGraphAtom, structuredClone(fixture));
store.set(selectionAtom, { nodeIds: ["d"], edgeIds: ["ab"] });
const call = async (input: Record<string, unknown>, signal?: AbortSignal) =>
  (await select.execute(
    {
      expectedRevision: ctx.revision(),
      expectedSelectionRevision: ctx.selectionRevision(),
      ...input,
    },
    signal ? { signal } : undefined,
  )) as {
    ok: boolean;
    code?: string;
    nodeCount?: number;
    edgeCount?: number;
    selectionRevision?: string;
    nonNumericWeights?: number;
    status?: string;
  };

// Replace both selected types, return the new revision, then move in one undo step.
{
  const original = structuredClone(store.get(graphAtom));
  const result = await call({ nodeFilter: { color: "blue" } });
  assert.equal(result.ok, true);
  assert.equal(result.nodeCount, 2);
  assert.deepEqual(store.get(selectionAtom), {
    nodeIds: ["a", "c"],
    edgeIds: [],
  });
  assert.equal(result.selectionRevision, ctx.selectionRevision());
  assert.deepEqual(store.get(graphAtom), original);
  const unchanged = await call({ nodeFilter: { color: "blue" } });
  assert.equal(unchanged.status, "unchanged");
  assert.equal(unchanged.selectionRevision, result.selectionRevision);
  const moved = (await move.execute({
    operation: "translate",
    selectedNodes: true,
    dx: 50,
    dy: 0,
    expectedRevision: ctx.revision(),
    expectedSelectionRevision: result.selectionRevision,
  })) as { ok: boolean };
  assert.equal(moved.ok, true);
  assert.equal(store.get(graphAtom).nodes[0].x, 60);
  assert.equal(store.get(graphAtom).nodes[2].x, 260);
  assert.equal(store.get(graphAtom).nodes[1].x, 110);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), original);
}
// Matching is shared with color edits, including exact decimals and skipped weights.
{
  const original = structuredClone(store.get(graphAtom));
  const result = await call({ edgeFilter: { minWeight: "9007199254740993" } });
  assert.equal(result.edgeCount, 1);
  assert.equal(result.nonNumericWeights, 1);
  assert.deepEqual(store.get(selectionAtom), { nodeIds: [], edgeIds: ["bc"] });
  const deleted = (await remove.execute({
    selectedEdges: true,
    expectedRevision: ctx.revision(),
    expectedSelectionRevision: result.selectionRevision,
  })) as { ok: boolean };
  assert.equal(deleted.ok, true);
  assert.deepEqual(
    store.get(graphAtom).edges.map((edge) => edge.id),
    ["ab", "bd"],
  );
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), original);
}
// Every invalid, ambiguous, stale, cancelled, or empty result preserves selection and graph.
{
  const original = structuredClone(store.get(graphAtom));
  const selection = structuredClone(store.get(selectionAtom));
  for (const [input, code] of [
    [{}, "invalid-input"],
    [{ nodeFilter: {} }, "invalid-input"],
    [{ nodeFilter: { color: "Blue" } }, "invalid-input"],
    [
      { nodeFilter: { neighborOf: { node: { label: "C" } } } },
      "ambiguous-node",
    ],
    [{ nodeFilter: { color: "red" } }, "no-targets"],
    [
      {
        nodeFilter: { color: "blue" },
        edgeFilter: { minWeight: "9999999999999999999" },
      },
      "no-targets",
    ],
    [
      { nodeFilter: { color: "blue" }, expectedRevision: "old" },
      "stale-revision",
    ],
    [
      { nodeFilter: { color: "blue" }, expectedSelectionRevision: "old" },
      "stale-selection",
    ],
  ] as const) {
    // Each rejection must leave the same graph and selection unchanged.
    // oxlint-disable-next-line no-await-in-loop
    assert.equal((await call(input)).code, code);
    assert.deepEqual(store.get(selectionAtom), selection);
    assert.deepEqual(store.get(graphAtom), original);
  }
  const abort = new AbortController();
  abort.abort();
  assert.equal(
    (await call({ nodeFilter: { color: "blue" } }, abort.signal)).code,
    "cancelled",
  );
  assert.deepEqual(store.get(selectionAtom), selection);
}
console.log("WebMCP filtered selection verification passed");
