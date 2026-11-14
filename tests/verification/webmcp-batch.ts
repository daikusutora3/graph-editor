import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
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
import {
  registerGraphWebMcp,
  type GraphModelContext,
} from "../../features/graph-editor/webmcp/graph-webmcp";

type Tool = Parameters<GraphModelContext["registerTool"]>[0];
type Response = {
  ok: boolean;
  code?: string;
  revision?: string;
  [key: string]: unknown;
};

const fixture: GraphModel = {
  ...createEmptyGraphModel({ weighted: true, directed: false }),
  nodes: [
    { id: "a", label: "A", order: 0, x: 10, y: 20, color: "green" },
    { id: "b", label: "B", order: 1, x: 100, y: 20 },
    { id: "c", label: "C", order: 2, x: 200, y: 20 },
    { id: "d", label: "D", order: 3, x: 300, y: 20 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", weight: "2", routing: { bowPx: 24 } },
    { id: "bc1", source: "b", target: "c", weight: "3" },
    { id: "bc2", source: "c", target: "b", weight: "4" },
    { id: "cd", source: "c", target: "d", weight: "5", color: "green" },
  ],
};

async function setup(initial: GraphModel = fixture) {
  const registered = new Map<string, Tool>();
  const context: GraphModelContext = {
    async registerTool(tool, { signal }) {
      registered.set(tool.name, tool);
      signal.addEventListener("abort", () => registered.delete(tool.name), {
        once: true,
      });
    },
  };
  const store = createStore();
  const dispose = registerGraphWebMcp(context, store, () => {});
  await Promise.resolve();
  store.set(syncExternalGraphAtom, structuredClone(initial));
  const call = async (
    name: string,
    args: unknown,
    signal?: AbortSignal,
  ): Promise<Response> => {
    const tool = registered.get(name);
    assert(tool, `Expected registered WebMCP tool ${name}`);
    return (await tool.execute(
      args,
      signal ? { signal } : undefined,
    )) as Response;
  };
  const revision = async () => {
    const result = await call("get_graph_summary", {});
    assert.equal(result.ok, true);
    assert.equal(typeof result.revision, "string");
    return result.revision as string;
  };
  return { call, dispose, revision, store };
}

// Editing nodes and edges together must preserve untouched data and be one Undo.
{
  const { call, dispose, revision, store } = await setup();
  const before = structuredClone(store.get(graphAtom));
  const result = await call("update_graph_elements", {
    nodes: [{ node: { label: "A" } }, { node: { id: "b" } }],
    edges: [
      { edge: { id: "ab" }, weight: 7 },
      { edge: { id: "cd" }, label: " cost " },
    ],
    nodeColor: "red",
    edgeColor: "blue",
    expectedRevision: await revision(),
  });
  assert.equal(result.ok, true);
  const after = structuredClone(store.get(graphAtom));
  assert.deepEqual(after.nodes[0], { ...before.nodes[0], color: "red" });
  assert.deepEqual(after.nodes[1], { ...before.nodes[1], color: "red" });
  assert.deepEqual(after.nodes.slice(2), before.nodes.slice(2));
  assert.deepEqual(after.edges[0], {
    ...before.edges[0],
    weight: "7",
    color: "blue",
  });
  assert.deepEqual(after.edges[3], {
    ...before.edges[3],
    label: "cost",
    color: "blue",
  });
  assert.deepEqual(after.edges.slice(1, 3), before.edges.slice(1, 3));
  assert.deepEqual(after.settings, before.settings);
  assert.equal(store.get(historyAtom).length, 1);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);
  store.set(redoAtom);
  assert.deepEqual(store.get(graphAtom), after);
  dispose();
}

// Invalid selections or patches must not partially apply or change history.
{
  const { call, dispose, revision, store } = await setup();
  const before = structuredClone(store.get(graphAtom));
  const expectedRevision = await revision();
  const cases = [
    {
      nodes: [
        { node: { id: "a" }, color: "red" },
        { node: { id: "missing" }, color: "blue" },
      ],
    },
    {
      nodes: [
        { node: { id: "a" }, color: "red" },
        { node: { label: "A" }, color: "blue" },
      ],
    },
    {
      edges: [
        {
          edge: { source: { label: "B" }, target: { label: "C" } },
          color: "red",
        },
      ],
    },
    { edges: [{ edge: { id: "ab" }, color: "white" }] },
    { nodes: [{ node: { id: "a" }, label: "x".repeat(257) }] },
    { edges: [{ edge: { id: "ab" }, weight: Number.POSITIVE_INFINITY }] },
    { nodes: [{ node: { id: "a" }, color: "red" }], nodeColor: "blue" },
    { nodes: [{ node: { id: "a" } }] },
    { nodes: [] },
    { edges: [{ edge: { id: "missing" }, weight: 1 }] },
    { allNodes: true },
    { allEdges: true },
    {
      allNodes: true,
      nodes: [{ node: { id: "a" }, label: "new" }],
      nodeColor: "blue",
    },
    {
      allEdges: true,
      edges: [{ edge: { id: "ab" }, label: "new" }],
      edgeColor: "red",
    },
  ];
  for (const args of cases) {
    // Each rejected operation must leave the same state for the next case.
    // oxlint-disable-next-line no-await-in-loop
    const result = await call("update_graph_elements", {
      ...args,
      expectedRevision,
    });
    assert.equal(
      result.ok,
      false,
      `Invalid update succeeded: ${JSON.stringify(args)}`,
    );
    assert.deepEqual(store.get(graphAtom), before);
    assert.equal(store.get(historyAtom).length, 0);
    // oxlint-disable-next-line no-await-in-loop
    assert.equal(await revision(), expectedRevision);
  }
  const stale = await call("update_graph_elements", {
    nodes: [{ node: { id: "a" }, color: "red" }],
    expectedRevision: "old",
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "stale-revision");
  const cancelled = new AbortController();
  cancelled.abort();
  const rejected = await call(
    "update_graph_elements",
    { nodes: [{ node: { id: "a" }, color: "red" }], expectedRevision },
    cancelled.signal,
  );
  assert.equal(rejected.ok, false);
  assert.deepEqual(store.get(graphAtom), before);
  assert.equal(store.get(historyAtom).length, 0);
  dispose();
}

// Explicitly coloring every node and edge is still a single transaction.
{
  const { call, dispose, revision, store } = await setup();
  const before = structuredClone(store.get(graphAtom));
  const result = await call("update_graph_elements", {
    allNodes: true,
    nodeColor: "blue",
    allEdges: true,
    edgeColor: "red",
    expectedRevision: await revision(),
  });
  assert.equal(result.ok, true);
  const after = structuredClone(store.get(graphAtom));
  assert.deepEqual(
    after.nodes,
    before.nodes.map((node) => ({ ...node, color: "blue" })),
  );
  assert.deepEqual(
    after.edges,
    before.edges.map((edge) => ({ ...edge, color: "red" })),
  );
  assert.deepEqual(after.settings, before.settings);
  assert.equal(store.get(historyAtom).length, 1);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);
  store.set(redoAtom);
  assert.deepEqual(store.get(graphAtom), after);
  dispose();
}

// An empty graph must not silently succeed for an explicit all-elements edit.
{
  const { call, dispose, revision, store } = await setup(
    createEmptyGraphModel(),
  );
  const before = structuredClone(store.get(graphAtom));
  const result = await call("update_graph_elements", {
    allNodes: true,
    nodeColor: "red",
    expectedRevision: await revision(),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(store.get(graphAtom), before);
  assert.equal(store.get(historyAtom).length, 0);
  dispose();
}

// A duplicate label must never resolve to an arbitrary node in a batch.
{
  const duplicate: GraphModel = {
    ...fixture,
    nodes: fixture.nodes.map((node) =>
      node.id === "b" ? { ...node, label: "A" } : node,
    ),
  };
  const { call, dispose, revision, store } = await setup(duplicate);
  const before = structuredClone(store.get(graphAtom));
  const result = await call("update_graph_elements", {
    nodes: [
      { node: { label: "A" }, color: "red" },
      { node: { id: "c" }, color: "blue" },
    ],
    expectedRevision: await revision(),
  });
  assert.equal(result.ok, false);
  assert.deepEqual(store.get(graphAtom), before);
  assert.equal(store.get(historyAtom).length, 0);
  dispose();
}

// Deleting nodes also removes incident edges. Explicitly named incident edges
// are counted only once; other edges, positions, settings and labels survive.
{
  const { call, dispose, revision, store } = await setup();
  const before = structuredClone(store.get(graphAtom));
  const result = await call("delete_graph_elements", {
    nodes: [{ label: "A" }],
    edges: [{ id: "ab" }, { id: "cd" }],
    expectedRevision: await revision(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.deletedNodes, 1);
  assert.equal(result.deletedEdges, 2);
  const after = structuredClone(store.get(graphAtom));
  assert.deepEqual(after.nodes, before.nodes.slice(1));
  assert.deepEqual(after.edges, before.edges.slice(1, 3));
  assert.deepEqual(after.settings, before.settings);
  assert.equal(store.get(historyAtom).length, 1);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);
  store.set(redoAtom);
  assert.deepEqual(store.get(graphAtom), after);
  dispose();
}

// Failed deletion and oversized inputs must leave every element unchanged.
{
  const { call, dispose, revision, store } = await setup();
  const before = structuredClone(store.get(graphAtom));
  const expectedRevision = await revision();
  const cases = [
    { nodes: [{ id: "a" }, { id: "missing" }] },
    { nodes: [{ id: "a" }, { label: "A" }] },
    { edges: [{ id: "ab" }, { id: "missing" }] },
    { edges: [{ id: "ab" }, { id: "ab" }] },
    {
      edges: [{ id: "ab" }, { source: { label: "B" }, target: { label: "A" } }],
    },
    {
      nodes: [{ id: "a" }],
      edges: [{ source: { label: "B" }, target: { label: "C" } }],
    },
    { edges: [{ id: "missing" }] },
    { edges: [{ id: "ab" }, { id: "missing" }] },
    { nodes: [] },
    { nodes: Array.from({ length: 1001 }, () => ({ id: "a" })) },
    { edges: Array.from({ length: 5001 }, () => ({ id: "ab" })) },
  ];
  for (const args of cases) {
    // Check the graph after each operation before trying the next input.
    // oxlint-disable-next-line no-await-in-loop
    const result = await call("delete_graph_elements", {
      ...args,
      expectedRevision,
    });
    assert.equal(result.ok, false, "Invalid deletion succeeded");
    assert.deepEqual(store.get(graphAtom), before);
    assert.equal(store.get(historyAtom).length, 0);
  }
  const stale = await call("delete_graph_elements", {
    nodes: [{ id: "a" }],
    expectedRevision: "old",
  });
  assert.equal(stale.code, "stale-revision");
  const cancelled = new AbortController();
  cancelled.abort();
  const result = await call(
    "delete_graph_elements",
    { nodes: [{ id: "a" }], expectedRevision },
    cancelled.signal,
  );
  assert.equal(result.ok, false);
  assert.deepEqual(store.get(graphAtom), before);
  assert.equal(store.get(historyAtom).length, 0);
  dispose();
}

// Undirected edges can be named by endpoints in reverse order.
{
  const { call, dispose, revision, store } = await setup();
  const before = structuredClone(store.get(graphAtom));
  const result = await call("delete_graph_elements", {
    edges: [{ source: { label: "B" }, target: { label: "A" } }],
    expectedRevision: await revision(),
  });
  assert.equal(result.ok, true);
  assert.equal(result.deletedEdges, 1);
  assert.deepEqual(store.get(graphAtom).edges, before.edges.slice(1));
  assert.equal(store.get(historyAtom).length, 1);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);
  dispose();
}

// The documented graph limits remain usable, including many parallel edges.
{
  const large: GraphModel = {
    ...createEmptyGraphModel(),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 100, y: 0 },
    ],
    edges: Array.from({ length: 5000 }, (_, index) => ({
      id: `e${index}`,
      source: "a",
      target: "b",
    })),
  };
  const { call, dispose, revision, store } = await setup(large);
  const expectedRevision = await revision();
  const ambiguous = await call("delete_graph_elements", {
    edges: [{ source: { label: "A" }, target: { label: "B" } }],
    expectedRevision,
  });
  assert.equal(ambiguous.ok, false);
  assert.deepEqual(store.get(graphAtom), large);
  const colored = await call("update_graph_elements", {
    allEdges: true,
    edgeColor: "blue",
    expectedRevision,
  });
  assert.equal(colored.ok, true);
  assert.equal(store.get(graphAtom).edges.length, 5000);
  assert(store.get(graphAtom).edges.every((edge) => edge.color === "blue"));
  assert.equal(store.get(historyAtom).length, 1);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), large);
  dispose();
}

console.log("WebMCP batch verification passed");
