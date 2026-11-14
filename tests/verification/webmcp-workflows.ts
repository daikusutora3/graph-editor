import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";

import {
  cancelScheduledStoredGraphWrite,
  flushStoredGraphWrite,
  getStorageSnapshot,
  readStoredGraph,
  uninstallStorageFlushListeners,
} from "../../features/graph-editor/adapters/browser/stored-graph";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { applyManualLayoutAtom } from "../../features/graph-editor/shell/state/editor-actions";
import {
  editorModeAtom,
  selectionAtom,
} from "../../features/graph-editor/shell/state/editor-atoms";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { undoAtom } from "../../features/graph-editor/shell/state/history-atoms";
import {
  registerGraphWebMcp,
  type GraphModelContext,
} from "../../features/graph-editor/webmcp/graph-webmcp";

type Tool = Parameters<GraphModelContext["registerTool"]>[0];
type Result = {
  ok: boolean;
  code?: string;
  revision?: string;
  [key: string]: unknown;
};

async function setup(graph: GraphModel) {
  const tools = new Map<string, Tool>();
  const context: GraphModelContext = {
    async registerTool(tool, { signal }) {
      tools.set(tool.name, tool);
      signal.addEventListener("abort", () => tools.delete(tool.name), {
        once: true,
      });
    },
  };
  const store = createStore();
  const dispose = registerGraphWebMcp(context, store, () => {});
  await Promise.resolve();
  store.set(syncExternalGraphAtom, structuredClone(graph));
  const call = async (name: string, input: unknown, signal?: AbortSignal) => {
    const tool = tools.get(name);
    assert(tool, `Expected WebMCP tool ${name}`);
    return (await tool.execute(
      input,
      signal ? { signal } : undefined,
    )) as Result;
  };
  const summary = async () =>
    (await call("get_graph_summary", {})) as Result & {
      revision: string;
      selection: { revision: string };
    };
  return { store, dispose, call, summary };
}

const fixture: GraphModel = {
  ...createEmptyGraphModel({
    directed: true,
    weighted: true,
    allowMultiEdges: false,
  }),
  nodes: [
    { id: "a", label: "A", order: 0, x: 10, y: 20, color: "blue" },
    { id: "b", label: "B", order: 1, x: 110, y: 20 },
    { id: "c", label: "C", order: 2, x: 210, y: 20 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b", weight: "2", routing: { bowPx: 10 } },
    { id: "ba", source: "b", target: "a", weight: "3" },
    { id: "bc", source: "b", target: "c", weight: "4", color: "green" },
    { id: "loop", source: "c", target: "c", weight: "5" },
  ],
};

// One-node and multi-node moves use graph coordinates and preserve all other data.
{
  const { store, dispose, call, summary } = await setup(fixture);
  const initial = structuredClone(store.get(graphAtom));
  const before = await summary();
  const moved = await call("update_graph_elements", {
    nodes: [
      {
        node: { label: "A" },
        label: "Start",
        color: "red",
        position: { x: -50, y: 55 },
      },
    ],
    expectedRevision: before.revision,
  });
  assert.equal(moved.ok, true);
  assert.deepEqual(store.get(graphAtom).nodes[0], {
    ...initial.nodes[0],
    label: "Start",
    color: "red",
    x: -50,
    y: 55,
  });
  assert.deepEqual(store.get(graphAtom).nodes.slice(1), initial.nodes.slice(1));
  assert.deepEqual(store.get(graphAtom).edges, initial.edges);
  assert.equal(
    (
      await call("update_graph_elements", {
        nodes: [{ node: { id: "b" }, position: { x: 1, y: 2 } }],
        expectedRevision: before.revision,
      })
    ).code,
    "stale-revision",
  );
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), initial);

  const invalidRevision = (await summary()).revision;
  const invalidMoves = await Promise.all(
    [
      { x: 0 },
      { x: 0, y: 1, z: 2 },
      { x: 1_000_000_001, y: 0 },
      { x: Number.NaN, y: 0 },
    ].map((position) =>
      call("update_graph_elements", {
        nodes: [{ node: { id: "a" }, position }],
        expectedRevision: invalidRevision,
      }),
    ),
  );
  for (const rejected of invalidMoves) {
    assert.equal(rejected.code, "invalid-input");
  }
  assert.deepEqual(store.get(graphAtom), initial);
  const beforeBatch = await summary();
  const batch = await call("update_graph_elements", {
    nodes: [
      { node: { label: "A" }, position: { x: 30, y: -20 }, color: "red" },
      { node: { id: "b" }, position: { x: 130, y: 80 }, label: "New B" },
    ],
    edges: [{ edge: { id: "bc" }, weight: 12 }],
    expectedRevision: beforeBatch.revision,
  });
  assert.equal(batch.ok, true);
  const after = store.get(graphAtom);
  assert.deepEqual(after.nodes[0], {
    ...initial.nodes[0],
    x: 30,
    y: -20,
    color: "red",
  });
  assert.deepEqual(after.nodes[1], {
    ...initial.nodes[1],
    x: 130,
    y: 80,
    label: "New B",
  });
  assert.deepEqual(after.nodes[2], initial.nodes[2]);
  assert.deepEqual(after.edges[0], initial.edges[0]);
  assert.deepEqual(after.edges[2], { ...initial.edges[2], weight: "12" });
  assert.deepEqual(after.settings, initial.settings);
  const staleBatch = await call("update_graph_elements", {
    nodes: [{ node: { id: "c" }, position: { x: 0, y: 0 } }],
    expectedRevision: beforeBatch.revision,
  });
  assert.equal(staleBatch.code, "stale-revision");
  store.set(undoAtom);
  assert.deepEqual(
    store.get(graphAtom),
    initial,
    "one Undo restores the complete batch",
  );
  const duplicate = await call("update_graph_elements", {
    nodes: [
      { node: { id: "a" }, position: { x: 0, y: 0 } },
      { node: { label: "A" }, position: { x: 4, y: 7 } },
    ],
    expectedRevision: (await summary()).revision,
  });
  assert.equal(duplicate.code, "duplicate-target");
  const partial = await call("update_graph_elements", {
    nodes: [
      { node: { id: "a" }, position: { x: 0, y: 0 } },
      { node: { id: "b" }, position: { x: 4 } },
    ],
    expectedRevision: (await summary()).revision,
  });
  assert.equal(partial.code, "invalid-input");
  assert.deepEqual(store.get(graphAtom), initial);
  dispose();
}

// Reversal is validated as one operation; opposite edges may be swapped together.
{
  const { store, dispose, call, summary } = await setup(fixture);
  const initial = structuredClone(store.get(graphAtom));
  const before = await summary();
  const collision = await call("reverse_edges", {
    edges: [{ id: "ab" }, { id: "bc" }],
    expectedRevision: before.revision,
  });
  assert.equal(collision.code, "edge-not-allowed");
  assert.deepEqual(
    store.get(graphAtom),
    initial,
    "a collision cannot partially reverse other edges",
  );
  const all = await call("reverse_edges", {
    allEdges: true,
    expectedRevision: before.revision,
  });
  assert.equal(all.ok, true);
  assert.equal(all.reversedEdges, 3);
  assert.equal(all.unchangedSelfLoops, 1);
  const reversed = store.get(graphAtom);
  assert.deepEqual(
    reversed.edges,
    initial.edges.map((edge) =>
      edge.source === edge.target
        ? edge
        : { ...edge, source: edge.target, target: edge.source },
    ),
  );
  assert.deepEqual(reversed.nodes, initial.nodes);
  assert.deepEqual(reversed.settings, initial.settings);
  assert.equal(
    (
      await call("reverse_edges", {
        allEdges: true,
        expectedRevision: before.revision,
      })
    ).code,
    "stale-revision",
  );
  store.set(undoAtom);
  assert.deepEqual(
    store.get(graphAtom),
    initial,
    "one Undo restores every reversed edge",
  );

  store.set(selectionAtom, { nodeIds: [], edgeIds: ["bc"] });
  const selected = await summary();
  store.set(selectionAtom, { nodeIds: [], edgeIds: ["ab"] });
  store.set(selectionAtom, { nodeIds: [], edgeIds: ["bc"] });
  const staleSelection = await call("reverse_edges", {
    selectedEdges: true,
    expectedRevision: selected.revision,
    expectedSelectionRevision: selected.selection.revision,
  });
  assert.equal(staleSelection.code, "stale-selection");
  assert.deepEqual(store.get(graphAtom), initial);
  const current = await summary();
  const controller = new AbortController();
  controller.abort();
  const cancelled = await call(
    "reverse_edges",
    {
      selectedEdges: true,
      expectedRevision: current.revision,
      expectedSelectionRevision: current.selection.revision,
    },
    controller.signal,
  );
  assert.equal(cancelled.code, "cancelled");
  assert.deepEqual(store.get(graphAtom), initial);
  const selectedResult = await call("reverse_edges", {
    selectedEdges: true,
    expectedRevision: current.revision,
    expectedSelectionRevision: current.selection.revision,
  });
  assert.equal(selectedResult.ok, true);
  assert.equal(selectedResult.reversedEdges, 1);
  assert.deepEqual(store.get(graphAtom).edges[2], {
    ...initial.edges[2],
    source: "c",
    target: "b",
  });
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), initial);

  const undirected = {
    ...initial,
    settings: { ...initial.settings, directed: false },
  };
  store.set(syncExternalGraphAtom, undirected);
  const rejected = await call("reverse_edges", {
    allEdges: true,
    expectedRevision: (await summary()).revision,
  });
  assert.equal(rejected.code, "undirected-graph");
  assert.deepEqual(store.get(graphAtom), undirected);

  const parallel = {
    ...initial,
    settings: { ...initial.settings, allowMultiEdges: true },
    edges: [
      ...initial.edges,
      { id: "parallel", source: "a", target: "b", weight: "8" },
    ],
  };
  store.set(syncExternalGraphAtom, parallel);
  const ambiguous = await call("reverse_edges", {
    edges: [{ source: { label: "A" }, target: { label: "B" } }],
    expectedRevision: (await summary()).revision,
  });
  assert.equal(ambiguous.code, "ambiguous-edge");
  assert.deepEqual(store.get(graphAtom), parallel);
  dispose();
}

// WebMCP layout cancellation preserves the user's mode; the UI path stays unchanged.
{
  const { store, dispose, call, summary } = await setup(fixture);
  const initial = structuredClone(store.get(graphAtom));
  store.set(editorModeAtom, "node");
  const controller = new AbortController();
  const pending = call(
    "apply_layout",
    {
      kind: "force",
      expectedRevision: (await summary()).revision,
    },
    controller.signal,
  );
  controller.abort();
  const result = await pending;
  assert.equal(result.ok, false);
  assert.equal(store.get(editorModeAtom), "node");
  assert.deepEqual(store.get(graphAtom), initial);
  store.set(editorModeAtom, "edge");
  await store.set(applyManualLayoutAtom, "circle");
  assert.equal(
    store.get(editorModeAtom),
    "select",
    "UI layout retains its existing mode behavior",
  );
  dispose();
}

// A successful mutation carries storage status; a large returned ID is never
// reported as a failed mutation merely because its response is too large.
{
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    "document",
  );
  const originalNavigator = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator",
  );
  let raw: string | null = null;
  const storage = {
    getItem: () => raw,
    setItem: (_key: string, value: string) => {
      raw = value;
    },
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search: "" },
      localStorage: storage,
      sessionStorage: storage,
      dispatchEvent() {},
      addEventListener() {},
      removeEventListener() {},
      setTimeout() {
        return 1;
      },
      clearTimeout() {},
    },
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: {
      addEventListener() {},
      removeEventListener() {},
      visibilityState: "visible",
    },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {},
  });
  try {
    const hugeId = `node-${"x".repeat(20_000)}`;
    const graph = {
      ...createEmptyGraphModel(),
      nodes: [{ id: hugeId, label: "Huge", order: 0, x: 0, y: 0 }],
    };
    const { store, dispose, call, summary } = await setup(graph);
    assert.equal(getStorageSnapshot().status, "unavailable");
    const moved = await call("update_graph_elements", {
      nodes: [{ node: { label: "Huge" }, position: { x: 10, y: 20 } }],
      expectedRevision: (await summary()).revision,
    });
    assert.equal(moved.ok, true);
    assert.equal(moved.status, "applied");
    assert.equal(moved.nodeCount, 1);
    assert.deepEqual(moved.storage, {
      status: "unavailable",
      scope: "original",
    });
    assert(JSON.stringify(moved).length <= 16_000);
    assert.equal(store.get(graphAtom).nodes[0]?.x, 10);

    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: {
        locks: {
          request: async (_key: string, action: () => void) => action(),
        },
      },
    });
    readStoredGraph();
    const pending = await call("update_graph_elements", {
      nodes: [{ node: { label: "Huge" }, color: "red" }],
      expectedRevision: (await summary()).revision,
    });
    assert.equal(pending.ok, true);
    assert.deepEqual(pending.storage, { status: "pending", scope: "original" });
    await flushStoredGraphWrite();
    assert.equal(getStorageSnapshot().status, "saved");
    const saved = await summary();
    assert.deepEqual(saved.storage, { status: "saved", scope: "original" });
    assert.equal(JSON.parse(raw!).nodes[0].color, "red");
    dispose();
  } finally {
    cancelScheduledStoredGraphWrite();
    uninstallStorageFlushListeners();
    for (const [key, descriptor] of [
      ["window", originalWindow],
      ["document", originalDocument],
      ["navigator", originalNavigator],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
}

console.log("WebMCP editing workflows verification passed");
