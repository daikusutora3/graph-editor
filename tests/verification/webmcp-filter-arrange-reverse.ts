import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { GRAPH_MAX_ABS_COORDINATE } from "../../features/graph-editor/core/graph/graph-coordinates";
import {
  graphAtom,
  graphRevisionAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { selectionAtom } from "../../features/graph-editor/shell/state/editor-atoms";
import { undoAtom } from "../../features/graph-editor/shell/state/history-atoms";
import { createRelativeLayoutTool } from "../../features/graph-editor/webmcp/relative-layout-tool";
import { createReverseEdgesTool } from "../../features/graph-editor/webmcp/reverse-edges-tool";

const store = createStore();
let selectionSequence = 0;
store.sub(selectionAtom, () => selectionSequence++);
const revision = () => String(store.get(graphRevisionAtom));
const context = {
  store,
  revision,
  selectionRevision: () => String(selectionSequence),
  requestFit() {},
};
const arrange = createRelativeLayoutTool(context);
const reverse = createReverseEdgesTool(context);
type Result = {
  ok: boolean;
  code?: string;
  nodeCount?: number;
  reversedEdges?: number;
  nonNumericWeights?: number;
  status?: string;
};
const call = async (
  tool: typeof arrange,
  input: Record<string, unknown>,
  signal?: AbortSignal,
) =>
  (await tool.execute(
    { expectedRevision: revision(), ...input },
    signal ? { signal } : undefined,
  )) as Result;

const fixture = {
  ...createEmptyGraphModel({
    directed: true,
    weighted: true,
    allowMultiEdges: true,
  }),
  nodes: [
    { id: "a", label: "A", order: 0, x: 10, y: 20, color: "blue" as const },
    { id: "b", label: "B", order: 1, x: 110, y: 80 },
    { id: "c", label: "C", order: 2, x: 210, y: 140, color: "blue" as const },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", weight: "10" },
    { id: "ac", source: "a", target: "c", weight: "11" },
    { id: "bc", source: "b", target: "c", weight: "unknown" },
    { id: "ca", source: "c", target: "a", weight: "9007199254740993" },
  ],
};
store.set(syncExternalGraphAtom, fixture);
store.set(selectionAtom, { nodeIds: ["b"], edgeIds: ["bc"] });
const initial = structuredClone(store.get(graphAtom));
const initialSelection = structuredClone(store.get(selectionAtom));
const initialSelectionRevision = context.selectionRevision();

// Filtered translation does not depend on or change the user's selection.
const moved = await call(arrange, {
  operation: "translate",
  nodeFilter: { color: "blue" },
  dx: 50,
  dy: -5,
});
assert.equal(moved.ok, true);
assert.equal(moved.nodeCount, 2);
assert.deepEqual(
  store.get(graphAtom).nodes.map(({ x, y }) => [x, y]),
  [
    [60, 15],
    [110, 80],
    [260, 135],
  ],
);
assert.deepEqual(store.get(selectionAtom), initialSelection);
assert.equal(context.selectionRevision(), initialSelectionRevision);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), initial);
assert.deepEqual(store.get(selectionAtom), initialSelection);

// Alignment can use directed neighbors as targets and an explicit anchor.
const aligned = await call(arrange, {
  operation: "align-horizontal",
  nodeFilter: { neighborOf: { node: { label: "A" }, direction: "out" } },
  reference: { id: "a" },
});
assert.equal(aligned.ok, true);
assert.deepEqual(
  store.get(graphAtom).nodes.map(({ y }) => y),
  [20, 20, 20],
);
assert.deepEqual(store.get(selectionAtom), initialSelection);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), initial);

// Weight conditions preserve precise decimal boundaries and report skipped values.
const reversed = await call(reverse, {
  edgeFilter: { minWeight: "9007199254740993" },
});
assert.equal(reversed.ok, true);
assert.equal(reversed.reversedEdges, 1);
assert.equal(reversed.nonNumericWeights, 1);
assert.deepEqual(
  store.get(graphAtom).edges.map(({ source, target }) => [source, target]),
  [
    ["a", "b"],
    ["a", "c"],
    ["b", "c"],
    ["a", "c"],
  ],
);
assert.deepEqual(store.get(selectionAtom), initialSelection);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), initial);

// Ambiguous, conflicting, empty, stale, cancelled and out-of-bounds requests are atomic.
const rejected: Array<[typeof arrange, Record<string, unknown>, string]> = [
  [
    arrange,
    { operation: "translate", nodeFilter: {}, dx: 1, dy: 0 },
    "invalid-input",
  ],
  [
    arrange,
    { operation: "translate", nodeFilter: { color: "red" }, dx: 1, dy: 0 },
    "no-targets",
  ],
  [
    arrange,
    {
      operation: "translate",
      nodeFilter: { color: "blue" },
      nodes: [{ id: "a" }],
      dx: 1,
      dy: 0,
    },
    "invalid-input",
  ],
  [
    arrange,
    {
      operation: "translate",
      nodeFilter: { color: "blue" },
      allNodes: true,
      dx: 1,
      dy: 0,
    },
    "invalid-input",
  ],
  [
    arrange,
    {
      operation: "translate",
      nodeFilter: { color: "blue" },
      selectedNodes: true,
      expectedSelectionRevision: initialSelectionRevision,
      dx: 1,
      dy: 0,
    },
    "invalid-input",
  ],
  [
    arrange,
    {
      operation: "translate",
      nodeFilter: { color: "blue" },
      dx: GRAPH_MAX_ABS_COORDINATE,
      dy: 0,
    },
    "coordinate-out-of-range",
  ],
  [
    arrange,
    {
      operation: "translate",
      nodeFilter: { color: "blue" },
      dx: 1,
      dy: 0,
      expectedRevision: "stale",
    },
    "stale-revision",
  ],
  [reverse, { edgeFilter: {} }, "invalid-input"],
  [
    reverse,
    { edgeFilter: { minWeight: 20_000_000 }, allEdges: true },
    "invalid-input",
  ],
  [
    reverse,
    { edgeFilter: { minWeight: 20_000_000 }, edges: [{ id: "ab" }] },
    "invalid-input",
  ],
  [reverse, { edgeFilter: { minWeight: "1e10001" } }, "invalid-input"],
];
for (const [tool, input, code] of rejected) {
  // Cases share the same graph and selection; check them serially.
  // oxlint-disable-next-line no-await-in-loop
  const response = await call(tool, input);
  assert.equal(response.code, code);
  assert.deepEqual(store.get(graphAtom), initial);
  assert.deepEqual(store.get(selectionAtom), initialSelection);
}
const aborted = new AbortController();
aborted.abort();
assert.equal(
  (
    await call(
      arrange,
      { operation: "translate", nodeFilter: { color: "blue" }, dx: 1, dy: 0 },
      aborted.signal,
    )
  ).code,
  "cancelled",
);
assert.equal(
  (await call(reverse, { edgeFilter: { minWeight: 10 } }, aborted.signal)).code,
  "cancelled",
);
assert.deepEqual(store.get(graphAtom), initial);
assert.deepEqual(store.get(selectionAtom), initialSelection);

// Reversal preflight rejects collisions atomically when parallel edges are disabled.
const collision = {
  ...initial,
  settings: { ...initial.settings, allowMultiEdges: false },
  edges: initial.edges.map((edge) =>
    edge.id === "ca" ? { ...edge, color: "green" as const } : edge,
  ),
};
store.set(syncExternalGraphAtom, collision);
assert.equal(
  (await call(reverse, { edgeFilter: { color: "green" } })).code,
  "edge-not-allowed",
);
assert.deepEqual(store.get(graphAtom), collision);
assert.deepEqual(store.get(selectionAtom), initialSelection);

const withLoop = {
  ...initial,
  settings: { ...initial.settings, allowSelfLoops: true },
  edges: [
    ...initial.edges,
    {
      id: "aa",
      source: "a",
      target: "a",
      weight: "1",
      color: "green" as const,
    },
  ],
};
store.set(syncExternalGraphAtom, withLoop);
const loop = await call(reverse, { edgeFilter: { color: "green" } });
assert.equal(loop.ok, true);
assert.equal(loop.status, "noop");
assert.equal(loop.reversedEdges, 0);
assert.deepEqual(store.get(graphAtom), withLoop);
assert.deepEqual(store.get(selectionAtom), initialSelection);

const ambiguous = {
  ...initial,
  nodes: initial.nodes.map((node) =>
    node.id === "b" ? { ...node, label: "A" } : node,
  ),
};
store.set(syncExternalGraphAtom, ambiguous);
assert.equal(
  (
    await call(arrange, {
      operation: "translate",
      nodeFilter: { neighborOf: { node: { label: "A" } } },
      dx: 1,
      dy: 0,
    })
  ).code,
  "ambiguous-node",
);
assert.deepEqual(store.get(graphAtom), ambiguous);
console.log("WebMCP filtered arrangement and reversal verification passed");
