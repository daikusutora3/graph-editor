import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";

import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../../features/graph-editor/core/graph/graph-factory";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  historyAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { createAddElementsTool } from "../../features/graph-editor/webmcp/add-elements-tool";

const initial: GraphModel = {
  ...createEmptyGraphModel({
    directed: true,
    weighted: true,
    allowSelfLoops: false,
    allowMultiEdges: false,
    indexBase: 1,
  }),
  nodes: [
    createNode({ id: "a", label: "A", order: 0, x: 20, y: 30, color: "blue" }),
    createNode({ id: "z", label: "Z", order: 1, x: 200, y: 30 }),
  ],
  edges: [
    createEdge({
      id: "old",
      source: "a",
      target: "z",
      weight: "5",
      color: "red",
      routing: { bowPx: 15 },
    }),
  ],
};

function setup(graph: GraphModel = initial) {
  const store = createStore();
  store.set(syncExternalGraphAtom, structuredClone(graph));
  let fits = 0;
  const tool = createAddElementsTool({
    store,
    revision: () => "revision",
    selectionRevision: () => "selection",
    requestFit: () => fits++,
  });
  const call = async (input: unknown, signal?: AbortSignal) =>
    (await tool.execute(input, signal ? { signal } : undefined)) as {
      ok: boolean;
      code?: string;
      [key: string]: unknown;
    };
  return { store, call, fits: () => fits };
}

const good = {
  expectedRevision: "revision",
  nodes: [{ label: " B ", color: "green" }, { label: "C" }],
  edges: [
    { source: { label: "A" }, target: { label: "B" }, weight: 4 },
    {
      source: { label: "B" },
      target: { label: "C" },
      weight: 7,
      color: "blue",
    },
  ],
};

{
  const { store, call, fits } = setup();
  const before = structuredClone(store.get(graphAtom));
  const result = await call(good);
  assert.equal(result.ok, true);
  assert.equal(result.nodeCount, 2);
  assert.equal(result.edgeCount, 2);
  assert.equal(fits(), 1);
  const graph = store.get(graphAtom);
  assert.deepEqual(graph.nodes.slice(0, 2), before.nodes);
  assert.deepEqual(graph.edges.slice(0, 1), before.edges);
  assert.deepEqual(graph.settings, before.settings);
  assert.equal(graph.nodes[2]?.label, "B");
  assert.equal(graph.nodes[2]?.color, "green");
  assert.equal(graph.nodes[3]?.label, "C");
  assert.notDeepEqual(
    [graph.nodes[2]?.x, graph.nodes[2]?.y],
    [graph.nodes[3]?.x, graph.nodes[3]?.y],
  );
  assert.equal(graph.edges[1]?.source, "a");
  assert.equal(graph.edges[1]?.target, graph.nodes[2]?.id);
  assert.equal(graph.edges[1]?.weight, "4");
  assert.equal(graph.edges[2]?.source, graph.nodes[2]?.id);
  assert.equal(graph.edges[2]?.target, graph.nodes[3]?.id);
  assert.equal(graph.edges[2]?.weight, "7");
  assert.equal(store.get(historyAtom).length, 1);
  const after = structuredClone(graph);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);
  store.set(redoAtom);
  assert.deepEqual(store.get(graphAtom), after);
}

async function rejects(
  input: unknown,
  code: string,
  graph: GraphModel = initial,
  signal?: AbortSignal,
) {
  const { store, call } = setup(graph);
  const before = structuredClone(store.get(graphAtom));
  const result = await call(input, signal);
  assert.equal(result.ok, false);
  assert.equal(result.code, code);
  assert.deepEqual(store.get(graphAtom), before);
  assert.equal(store.get(historyAtom).length, 0);
}

await rejects({ ...good, expectedRevision: "stale" }, "stale-revision");
const cancelled = new AbortController();
cancelled.abort();
await rejects(good, "cancelled", initial, cancelled.signal);
await rejects(
  {
    ...good,
    edges: [{ source: { label: "B" }, target: { label: "missing" } }],
  },
  "node-not-found",
);
await rejects(
  { ...good, nodes: [{ label: "B" }, { label: "B" }] },
  "ambiguous-node",
);
await rejects({ ...good, nodes: [{ label: "A" }] }, "ambiguous-node");
await rejects(
  {
    expectedRevision: "revision",
    edges: [{ source: { label: "A" }, target: { label: "A" } }],
  },
  "edge-not-allowed",
);
await rejects(
  {
    expectedRevision: "revision",
    edges: [{ source: { label: "A" }, target: { label: "Z" } }],
  },
  "edge-not-allowed",
);
await rejects(
  {
    expectedRevision: "revision",
    nodes: [{ label: "B" }],
    edges: [
      { source: { label: "A" }, target: { label: "B" } },
      { source: { label: "A" }, target: { label: "B" } },
    ],
  },
  "edge-not-allowed",
);
await rejects(
  {
    expectedRevision: "revision",
    nodes: [{ position: { x: 1_000_000_001, y: 0 } }],
  },
  "invalid-input",
);
await rejects(
  {
    expectedRevision: "revision",
    edges: [{ source: { label: "A" }, target: { label: "Z" }, weight: 8 }],
  },
  "unweighted-graph",
  { ...initial, settings: { ...initial.settings, weighted: false } },
);

// Directed reversal is a distinct edge; the same endpoints in an undirected
// graph conflict with the original edge when multiple edges are disabled.
{
  const reverse = {
    expectedRevision: "revision",
    edges: [{ source: { label: "Z" }, target: { label: "A" } }],
  };
  const { call } = setup();
  assert.equal((await call(reverse)).ok, true);
  await rejects(reverse, "edge-not-allowed", {
    ...initial,
    settings: { ...initial.settings, directed: false },
  });
}

// Coordinate boundaries can make all four safe placement directions unavailable.
{
  const cap = 1_000_000_000;
  const boundary: GraphModel = {
    ...createEmptyGraphModel(),
    nodes: [
      createNode({ id: "left", label: "left", order: 0, x: -cap, y: 0 }),
      createNode({ id: "right", label: "right", order: 1, x: cap, y: 0 }),
      createNode({ id: "top", label: "top", order: 2, x: 0, y: -cap }),
      createNode({ id: "bottom", label: "bottom", order: 3, x: 0, y: cap }),
    ],
  };
  await rejects(
    { expectedRevision: "revision", nodes: [{ label: "new" }] },
    "position-unavailable",
    boundary,
  );
}

{
  const maxNodes: GraphModel = {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: 1_000 }, (_, i) =>
      createNode({ id: `n${i}`, order: i, x: i * 100 }),
    ),
  };
  await rejects(
    { expectedRevision: "revision", nodes: [{}] },
    "node-limit",
    maxNodes,
  );
  const maxEdges: GraphModel = {
    ...createEmptyGraphModel(),
    nodes: initial.nodes,
    edges: Array.from({ length: 5_000 }, (_, i) =>
      createEdge({ id: `e${i}`, source: "a", target: "z" }),
    ),
  };
  await rejects(
    {
      expectedRevision: "revision",
      edges: [{ source: { id: "a" }, target: { id: "z" } }],
    },
    "edge-limit",
    maxEdges,
  );
}

// Responses remain bounded for a large number of newly generated IDs.
{
  const { call } = setup({
    ...initial,
    settings: { ...initial.settings, allowMultiEdges: true },
  });
  const result = await call({
    expectedRevision: "revision",
    nodes: Array.from({ length: 22 }, (_, i) => ({ label: `new ${i}` })),
    edges: Array.from({ length: 12 }, () => ({
      source: { label: "A" },
      target: { label: "Z" },
    })),
  });
  assert.equal(result.ok, true);
  assert.equal((result.nodeIds as string[]).length, 10);
  assert.equal((result.edgeIds as string[]).length, 10);
  assert.equal(result.nodeIdsTruncated, true);
  assert.equal(result.edgeIdsTruncated, true);
  assert(JSON.stringify(result).length < 16_000);
}

// A short label may identify a huge ID. Reject repeated endpoints before
// constructing unbounded pair keys or a huge candidate graph.
for (const allowMultiEdges of [true, false]) {
  const hugeId = `x${"a".repeat(1_500_000)}`;
  const graph: GraphModel = {
    ...createEmptyGraphModel({ allowMultiEdges }),
    nodes: Array.from({ length: 1_000 }, (_, i) =>
      createNode({
        id: i === 0 ? hugeId : `n${i}`,
        label: String(i),
        order: i,
        x: i * 48,
      }),
    ),
  };
  serializeGraphModel(graph);
  const { store, call } = setup(graph);
  const before = store.get(graphAtom);
  const edges = Array.from({ length: 999 }, (_, i) => ({
    source: { label: "0" },
    target: { label: String(i + 1) },
  }));
  // Run sequentially to verify both constraint configurations.
  // oxlint-disable-next-line no-await-in-loop
  const result = await call({ expectedRevision: "revision", edges });
  assert.equal(result.code, "invalid-graph");
  assert.equal(store.get(graphAtom), before);
  assert.equal(store.get(historyAtom).length, 0);
}

// JSON escaping can increase ID size: check the encoded size, not only .length.
{
  const graph: GraphModel = {
    ...createEmptyGraphModel(),
    nodes: [
      createNode({ id: `x${"\n".repeat(300_000)}`, label: "A", order: 0 }),
      createNode({ id: "b", label: "B", order: 1, x: 100 }),
    ],
  };
  const { store, call } = setup(graph);
  const edge = { source: { label: "A" }, target: { label: "B" } };
  assert.equal(
    (await call({ expectedRevision: "revision", edges: [edge, edge] })).ok,
    true,
  );
  assert(serializeGraphModel(store.get(graphAtom)).length <= 2_000_000);
  store.set(undoAtom);
  const before = store.get(graphAtom);
  assert.equal(
    (await call({ expectedRevision: "revision", edges: [edge, edge, edge] }))
      .code,
    "invalid-graph",
  );
  assert.equal(store.get(graphAtom), before);
}

console.log("WebMCP atomic graph addition verification passed");
