import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { undoAtom } from "../../features/graph-editor/shell/state/history-atoms";
import { createFilterEditTool } from "../../features/graph-editor/webmcp/filter-edit-tool";
import { createFindElementsTool } from "../../features/graph-editor/webmcp/find-elements-tool";

const fixture: GraphModel = {
  ...createEmptyGraphModel({
    directed: true,
    weighted: true,
    allowSelfLoops: true,
    allowMultiEdges: true,
  }),
  nodes: [
    { id: "a", label: "A", order: 0, x: 10, y: 20, color: "blue" },
    { id: "b", label: "B", order: 1, x: 110, y: 20 },
    { id: "c", label: "C", order: 2, x: 210, y: 20, color: "blue" },
    { id: "d", label: "C", order: 3, x: 310, y: 20, color: "red" },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", weight: "3" },
    { id: "ba", source: "b", target: "a", weight: "10", color: "red" },
    { id: "bc", source: "b", target: "c", weight: "3.5", color: "red" },
    { id: "loop", source: "b", target: "b" },
    { id: "bd", source: "b", target: "d", weight: "unknown", color: "red" },
    { id: "parallel", source: "b", target: "c", weight: "11" },
  ],
};
const store = createStore();
let revision = 0;
store.sub(graphAtom, () => revision++);
const tool = createFilterEditTool({
  store,
  revision: () => String(revision),
  selectionRevision: () => "0",
  requestFit: () => {},
});
store.set(syncExternalGraphAtom, structuredClone(fixture));
const call = async (input: Record<string, unknown>, signal?: AbortSignal) =>
  (await tool.execute(
    { expectedRevision: String(revision), ...input },
    signal ? { signal } : undefined,
  )) as {
    ok: boolean;
    code?: string;
    nodeCount?: number;
    edgeCount?: number;
    nonNumericWeights?: number;
  };
const before = () => structuredClone(store.get(graphAtom));
const undo = (initial: GraphModel) => {
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), initial);
};

// Filtered reads report totals, exclusions and empty results without editing.
{
  const initial = before();
  const find = createFindElementsTool({
    store,
    revision: () => String(revision),
    selectionRevision: () => "0",
    requestFit: () => {},
  });
  const read = async (input: unknown) =>
    (await find.execute(input)) as {
      ok: boolean;
      code?: string;
      matchCount?: number;
      nonNumericWeights?: number;
      nextOffset?: number | null;
    };
  const nodes = await read({ nodeFilter: { color: "blue" }, limit: 1 });
  assert.equal(nodes.matchCount, 2);
  assert.equal(nodes.nextOffset, 1);
  const edges = await read({ edgeFilter: { minWeight: 10 } });
  assert.equal(edges.matchCount, 2);
  assert.equal(edges.nonNumericWeights, 1);
  assert.equal((await read({ nodeFilter: { color: "pink" } })).matchCount, 0);
  assert.equal((await read({ nodeFilter: {} })).code, "invalid-input");
  assert.equal(
    (await read({ nodeFilter: { color: "blue" }, expectedRevision: "stale" }))
      .code,
    "stale-revision",
  );
  assert.deepEqual(store.get(graphAtom), initial);
}

// Shared colors filter without materializing IDs, retaining untouched properties.
{
  const initial = before();
  const result = await call({
    nodeFilter: { color: "blue" },
    nodeColor: "red",
  });
  assert.equal(result.ok, true);
  assert.equal(result.nodeCount, 2);
  assert.deepEqual(
    store.get(graphAtom).nodes,
    initial.nodes.map((n) => (n.color === "blue" ? { ...n, color: "red" } : n)),
  );
  assert.deepEqual(store.get(graphAtom).edges, initial.edges);
  undo(initial);
}
// Numeric weight matches are inclusive; absent weights are 1 and nonnumbers never match.
{
  const initial = before();
  const result = await call({
    edgeFilter: { minWeight: 3, maxWeight: 10 },
    edgeColor: "blue",
  });
  assert.equal(result.ok, true);
  assert.equal(result.edgeCount, 3);
  assert.equal(result.nonNumericWeights, 1);
  assert.deepEqual(
    store.get(graphAtom).edges,
    initial.edges.map((e) =>
      ["ab", "ba", "bc"].includes(e.id) ? { ...e, color: "blue" } : e,
    ),
  );
  undo(initial);
  const defaultWeight = await call({
    edgeFilter: { minWeight: 1, maxWeight: 1 },
    edgeColor: "green",
  });
  assert.equal(defaultWeight.edgeCount, 1);
  assert.equal(
    store.get(graphAtom).edges.find((e) => e.id === "loop")?.color,
    "green",
  );
  undo(initial);
  const combined = await call({
    edgeFilter: { color: "red", minWeight: 3, maxWeight: 3.5 },
    edgeColor: "blue",
  });
  assert.equal(combined.edgeCount, 1);
  assert.equal(combined.nonNumericWeights, 1);
  undo(initial);
}
// Direction refers to the reference node; parallel edges are deduplicated; self-loops exclude the reference node.
{
  const initial = before();
  const result = await call({
    nodeFilter: {
      neighborOf: { node: { label: "B" }, direction: "out" },
      color: "blue",
    },
    nodeColor: "green",
  });
  assert.equal(result.nodeCount, 2);
  assert.equal(
    store.get(graphAtom).nodes.find((n) => n.id === "c")?.color,
    "green",
  );
  undo(initial);
  const incoming = await call({
    nodeFilter: { neighborOf: { node: { id: "b" }, direction: "in" } },
    nodeColor: "green",
  });
  assert.equal(incoming.nodeCount, 1);
  assert.deepEqual(
    store
      .get(graphAtom)
      .nodes.filter((n) => n.color === "green")
      .map((n) => n.id),
    ["a"],
  );
  undo(initial);
  const all = await call({
    nodeFilter: { neighborOf: { node: { id: "b" } } },
    nodeColor: "green",
  });
  assert.equal(all.nodeCount, 3);
  undo(initial);
  const defaultColor = await call({
    nodeFilter: { color: "paper" },
    nodeColor: "red",
  });
  assert.equal(defaultColor.nodeCount, 1);
  assert.equal(
    store.get(graphAtom).nodes.find((n) => n.id === "b")?.color,
    "red",
  );
  undo(initial);
  const reset = await call({
    nodeFilter: { color: "blue" },
    nodeColor: "paper",
  });
  assert.equal(store.get(graphAtom).nodes[0].color, undefined);
  assert.equal("color" in store.get(graphAtom).nodes[0], false);
  assert.equal(reset.nodeCount, 2);
  undo(initial);
}
// Reject ambiguous, stale, malformed and no-match requests without partial effects.
{
  const initial = before();
  for (const [input, code] of [
    [{ nodeFilter: {}, nodeColor: "red" }, "invalid-input"],
    [{ nodeFilter: { color: "Blue" }, nodeColor: "red" }, "invalid-input"],
    [
      {
        nodeFilter: { neighborOf: { node: { label: "C" } } },
        nodeColor: "red",
      },
      "ambiguous-node",
    ],
    [
      {
        nodeFilter: { neighborOf: { node: { label: "missing" } } },
        nodeColor: "red",
      },
      "node-not-found",
    ],
    [
      { edgeFilter: { minWeight: 10, maxWeight: 3 }, edgeColor: "red" },
      "invalid-input",
    ],
    [
      { edgeFilter: { minWeight: Infinity }, edgeColor: "red" },
      "invalid-input",
    ],
    [
      {
        nodeFilter: { color: "blue" },
        nodeColor: "red",
        edgeFilter: { minWeight: 99 },
        edgeColor: "blue",
      },
      "no-targets",
    ],
    [
      {
        nodeFilter: { color: "blue" },
        nodeColor: "red",
        expectedRevision: "stale",
      },
      "stale-revision",
    ],
  ] as const) {
    // Cases share one store and assert that each rejection leaves it unchanged.
    // oxlint-disable-next-line no-await-in-loop
    assert.equal((await call(input)).code, code);
    assert.deepEqual(store.get(graphAtom), initial);
  }
  const abort = new AbortController();
  abort.abort();
  assert.equal(
    (
      await call(
        { nodeFilter: { color: "blue" }, nodeColor: "red" },
        abort.signal,
      )
    ).code,
    "cancelled",
  );
  assert.deepEqual(store.get(graphAtom), initial);
  store.set(syncExternalGraphAtom, {
    ...initial,
    settings: { ...initial.settings, weighted: false, directed: false },
  });
  assert.equal(
    (await call({ edgeFilter: { minWeight: 3 }, edgeColor: "red" })).code,
    "unweighted-graph",
  );
  const undirected = before();
  const match = await call({
    nodeFilter: { neighborOf: { node: { id: "b" }, direction: "in" } },
    nodeColor: "green",
  });
  assert.equal(match.nodeCount, 3);
  undo(undirected);
}

// Large graphs need no returned ID list and a single Undo restores all matches.
{
  const graph = {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: 1000 }, (_, i) => ({
      id: String(i),
      label: String(i),
      order: i,
      x: i,
      y: i,
      color: (i % 2 ? "blue" : "red") as "blue" | "red",
    })),
  };
  store.set(syncExternalGraphAtom, graph);
  const initial = before();
  const result = await call({
    nodeFilter: { color: "blue" },
    nodeColor: "green",
  });
  assert.equal(result.nodeCount, 500);
  assert(JSON.stringify(result).length < 1000);
  undo(initial);
}
// Exact decimal comparisons must not round big integers or decimal fractions.
// Non-decimal notation and unbounded exponents are excluded and reported.
{
  const weights = [
    "9007199254740993",
    "9007199254740992",
    "0.10000000000000001",
    "0.1",
    "1e+3",
    "0x10",
    "1e99999999999999999999",
    "-3e-2",
    "1e-10000",
  ];
  const graph: GraphModel = {
    ...fixture,
    edges: weights.map((weight, i) => ({
      id: `e${i}`,
      source: "a",
      target: "b",
      weight,
    })),
  };
  store.set(syncExternalGraphAtom, graph);
  const initial = before();
  const exact = await call({
    edgeFilter: {
      minWeight: "9007199254740993",
      maxWeight: "9007199254740993",
    },
    edgeColor: "blue",
  });
  assert.equal(exact.edgeCount, 1);
  assert.equal(exact.nonNumericWeights, 2);
  assert.deepEqual(
    store
      .get(graphAtom)
      .edges.filter((e) => e.color === "blue")
      .map((e) => e.id),
    ["e0"],
  );
  undo(initial);
  const bound = await call({
    edgeFilter: { minWeight: "9007199254740992", maxWeight: 9007199254740992 },
    edgeColor: "blue",
  });
  assert.deepEqual(
    store
      .get(graphAtom)
      .edges.filter((e) => e.color === "blue")
      .map((e) => e.id),
    ["e1"],
  );
  assert.equal(bound.edgeCount, 1);
  undo(initial);
  const small = await call({
    edgeFilter: {
      minWeight: "0.10000000000000001",
      maxWeight: "0.10000000000000001",
    },
    edgeColor: "blue",
  });
  assert.equal(small.edgeCount, 1);
  assert.deepEqual(
    store
      .get(graphAtom)
      .edges.filter((e) => e.color === "blue")
      .map((e) => e.id),
    ["e2"],
  );
  undo(initial);
  const exponential = await call({
    edgeFilter: { minWeight: "1000", maxWeight: "1e3" },
    edgeColor: "blue",
  });
  assert.equal(exponential.edgeCount, 1);
  assert.deepEqual(
    store
      .get(graphAtom)
      .edges.filter((e) => e.color === "blue")
      .map((e) => e.id),
    ["e4"],
  );
  undo(initial);
  const negative = await call({
    edgeFilter: { minWeight: "-.03", maxWeight: "-0.0300" },
    edgeColor: "blue",
  });
  assert.equal(negative.edgeCount, 1);
  assert.deepEqual(
    store
      .get(graphAtom)
      .edges.filter((e) => e.color === "blue")
      .map((e) => e.id),
    ["e7"],
  );
  undo(initial);
  const tiny = await call({
    edgeFilter: { minWeight: "1e-10000", maxWeight: "1e-10000" },
    edgeColor: "blue",
  });
  assert.equal(tiny.edgeCount, 1);
  assert.deepEqual(
    store
      .get(graphAtom)
      .edges.filter((e) => e.color === "blue")
      .map((e) => e.id),
    ["e8"],
  );
  undo(initial);
  for (const invalidBound of [
    "0x10",
    "1e10001",
    "1".repeat(257),
    "1e" + "9".repeat(200),
  ]) {
    // Each invalid boundary is checked against the unchanged shared store.
    // oxlint-disable-next-line no-await-in-loop
    const result = await call({
      edgeFilter: { minWeight: invalidBound },
      edgeColor: "blue",
    });
    assert.equal(result.code, "invalid-input");
    assert.deepEqual(store.get(graphAtom), initial);
  }
  assert.equal(
    (
      await call({
        edgeFilter: { minWeight: "0.10000000000000001", maxWeight: "0.1" },
        edgeColor: "blue",
      })
    ).code,
    "invalid-input",
  );
  assert.deepEqual(store.get(graphAtom), initial);
}

console.log("WebMCP filtered edits verification passed");
