import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { selectionAtom } from "../../features/graph-editor/shell/state/editor-atoms";
import {
  graphAtom,
  graphRevisionAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { undoAtom } from "../../features/graph-editor/shell/state/history-atoms";
import { createRelativeLayoutTool } from "../../features/graph-editor/webmcp/relative-layout-tool";

const store = createStore();
let selectionRevision = "1";
const revision = () => String(store.get(graphRevisionAtom));
const tool = createRelativeLayoutTool({
  store,
  revision,
  selectionRevision: () => selectionRevision,
  requestFit() {},
});
type Result = {
  ok: boolean;
  code?: string;
  status?: string;
  alignmentCoordinate?: number;
};
const call = async (args: Record<string, unknown>, signal?: AbortSignal) =>
  (await tool.execute(
    { expectedRevision: revision(), ...args },
    signal ? { signal } : undefined,
  )) as Result;
const graph = {
  ...createEmptyGraphModel(),
  nodes: [
    { id: "a", label: "A", order: 0, x: 10, y: 20 },
    { id: "b", label: "B", order: 1, x: 110, y: 80 },
    { id: "c", label: "C", order: 2, x: 210, y: 140 },
  ],
  edges: [{ id: "ab", source: "a", target: "b" }],
};
store.set(syncExternalGraphAtom, graph);
const initial = structuredClone(store.get(graphAtom));

// Translate several nodes together; preserve edges and undo once.
assert.equal(
  (
    await call({
      operation: "translate",
      nodes: [{ label: "A" }, { id: "c" }],
      dx: 50,
      dy: -25,
    })
  ).ok,
  true,
);
assert.deepEqual(store.get(graphAtom).nodes, [
  { ...initial.nodes[0], x: 60, y: -5 },
  initial.nodes[1],
  { ...initial.nodes[2], x: 260, y: 115 },
]);
assert.deepEqual(store.get(graphAtom).edges, initial.edges);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), initial);

// Horizontal alignment to the explicitly requested node and vertical alignment
// at the mean use only the relevant axis and leave other elements intact.
const horizontal = await call({
  operation: "align-horizontal",
  nodes: [{ id: "b" }, { id: "c" }],
  reference: { id: "a" },
});
assert.equal(horizontal.alignmentCoordinate, 20);
assert.deepEqual(
  store.get(graphAtom).nodes.map((node) => [node.x, node.y]),
  [
    [10, 20],
    [110, 20],
    [210, 20],
  ],
);
store.set(undoAtom);
const vertical = await call({
  operation: "align-vertical",
  nodes: [{ id: "a" }, { id: "c" }],
});
assert.equal(vertical.alignmentCoordinate, 110);
assert.deepEqual(
  store.get(graphAtom).nodes.map((node) => [node.x, node.y]),
  [
    [110, 20],
    [110, 80],
    [110, 140],
  ],
);
store.set(undoAtom);

// Relative placement is anchored on the original reference position.
assert.equal(
  (
    await call({
      operation: "place-relative",
      nodes: [{ id: "a" }],
      reference: { label: "B" },
      dx: 50,
      dy: 25,
    })
  ).ok,
  true,
);
assert.deepEqual(store.get(graphAtom).nodes[0], {
  ...initial.nodes[0],
  x: 160,
  y: 105,
});
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), initial);

store.set(selectionAtom, { nodeIds: ["a", "b"], edgeIds: [] });
assert.equal(
  (
    await call({
      operation: "translate",
      selectedNodes: true,
      expectedSelectionRevision: "old",
      dx: 5,
      dy: 0,
    })
  ).code,
  "stale-selection",
);
assert.equal(
  (await call({ operation: "translate", selectedNodes: true, dx: 5, dy: 0 }))
    .code,
  "invalid-input",
);
assert.equal(
  (
    await call({
      operation: "translate",
      selectedNodes: true,
      expectedSelectionRevision: selectionRevision,
      dx: 5,
      dy: 0,
    })
  ).ok,
  true,
);
assert.deepEqual(
  store.get(graphAtom).nodes.map((node) => node.x),
  [15, 115, 210],
);
store.set(undoAtom);
selectionRevision = "2";
assert.equal(
  (
    await call({
      operation: "translate",
      nodes: [{ id: "a" }, { label: "A" }],
      dx: 1,
      dy: 0,
    })
  ).code,
  "duplicate-target",
);
assert.equal(
  (
    await call({
      operation: "translate",
      nodes: [{ id: "a" }, { id: "missing" }],
      dx: 1,
      dy: 0,
    })
  ).code,
  "node-not-found",
);
assert.equal(
  (await call({ operation: "translate", nodes: [{ id: "a" }], dx: 1 })).code,
  "invalid-input",
);
assert.equal(
  (await call({ operation: "align-horizontal", nodes: [{ id: "a" }], dy: 1 }))
    .code,
  "invalid-input",
);
assert.equal(
  (
    await call({
      operation: "place-relative",
      nodes: [{ id: "a" }, { id: "b" }],
      reference: { id: "c" },
      dx: 1,
      dy: 1,
    })
  ).code,
  "invalid-input",
);
assert.equal(
  (
    await call({
      operation: "translate",
      allNodes: true,
      dx: 1_000_000_000,
      dy: 0,
    })
  ).code,
  "coordinate-out-of-range",
);
assert.equal(
  (
    await call({
      operation: "translate",
      nodes: [{ id: "a" }],
      dx: 1,
      dy: 0,
      expectedRevision: "old",
    })
  ).code,
  "stale-revision",
);
const abort = new AbortController();
abort.abort();
assert.equal(
  (
    await call(
      { operation: "translate", nodes: [{ id: "a" }], dx: 1, dy: 0 },
      abort.signal,
    )
  ).code,
  "cancelled",
);
assert.deepEqual(store.get(graphAtom), initial);

const ambiguous = {
  ...initial,
  nodes: initial.nodes.map((node) =>
    node.id === "b" ? { ...node, label: "A" } : node,
  ),
};
store.set(syncExternalGraphAtom, ambiguous);
assert.equal(
  (
    await call({
      operation: "translate",
      nodes: [{ label: "A" }],
      dx: 1,
      dy: 0,
    })
  ).code,
  "ambiguous-node",
);
assert.deepEqual(store.get(graphAtom), ambiguous);
console.log("WebMCP relative layout verification passed");
