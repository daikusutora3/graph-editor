import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { updateNodeCommand } from "../../features/graph-editor/core/graph/graph-intents";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import { getStorageSnapshot } from "../../features/graph-editor/adapters/browser/stored-graph";
import { selectionAtom } from "../../features/graph-editor/shell/state/editor-atoms";
import { graphAtom } from "../../features/graph-editor/shell/state/graph-atoms";
import {
  executeCommandAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import {
  registerGraphWebMcp,
  type GraphModelContext,
} from "../../features/graph-editor/webmcp/graph-webmcp";

type Tool = Parameters<GraphModelContext["registerTool"]>[0];
const registered = new Map<string, Tool>();
const context: GraphModelContext = {
  async registerTool(tool, { signal }) {
    assert.equal(signal.aborted, false);
    assert.equal(registered.has(tool.name), false);
    registered.set(tool.name, tool);
    signal.addEventListener("abort", () => registered.delete(tool.name), {
      once: true,
    });
  },
};
const store = createStore();
let fits = 0;
const dispose = registerGraphWebMcp(context, store, () => fits++);
await Promise.resolve();
assert.deepEqual([...registered.keys()].sort(), [
  "add_edge",
  "add_graph_elements",
  "add_node",
  "apply_layout",
  "arrange_graph_nodes",
  "delete_graph_elements",
  "edit_history",
  "find_graph_elements",
  "get_graph",
  "get_graph_summary",
  "get_incident_edges",
  "replace_graph",
  "reverse_edges",
  "select_graph_elements",
  "update_graph_elements",
  "update_graph_settings",
]);
const get = registered.get("get_graph")!;
const replace = registered.get("replace_graph")!;
const summary = registered.get("get_graph_summary")!;
const updateElements = registered.get("update_graph_elements")!;
const addEdge = registered.get("add_edge")!;
const addNode = registered.get("add_node")!;
const layout = registered.get("apply_layout")!;
const deleteElements = registered.get("delete_graph_elements")!;
// Reuse the existing single-target contract cases against the public batch API.
const updateNode = {
  execute: (
    input: Record<string, unknown>,
    options?: { signal: AbortSignal },
  ) => {
    const { node, expectedRevision, ...change } = input;
    return updateElements.execute(
      { nodes: [{ node, ...change }], expectedRevision },
      options,
    );
  },
};
const updateEdge = {
  execute: (
    input: Record<string, unknown>,
    options?: { signal: AbortSignal },
  ) => {
    const { edge, expectedRevision, ...change } = input;
    return updateElements.execute(
      { edges: [{ edge, ...change }], expectedRevision },
      options,
    );
  },
};
const deleteElement = {
  execute: (
    input: Record<string, unknown>,
    options?: { signal: AbortSignal },
  ) => {
    const { node, edgeId, expectedRevision } = input;
    return deleteElements.execute(
      {
        ...(node === undefined ? {} : { nodes: [node] }),
        ...(edgeId === undefined ? {} : { edges: [{ id: edgeId }] }),
        expectedRevision,
      },
      options,
    );
  },
};
const updateSettings = registered.get("update_graph_settings")!;
const history = registered.get("edit_history")!;
const selectElements = registered.get("select_graph_elements")!;
assert.equal(get.annotations.readOnlyHint, true);
assert.equal(get.annotations.untrustedContentHint, true);
assert.equal(replace.annotations.readOnlyHint, false);
assert.equal(deleteElements.annotations.consequentialHint, true);
assert.equal(
  selectElements.description.includes("Saving is asynchronous"),
  false,
);

const read = async () =>
  (await get.execute({})) as {
    ok: boolean;
    revision: string;
    graph: string;
  };
const before = await read();
assert.equal(before.ok, true);
assert.equal(typeof before.revision, "string");
const emptyHistory = (await summary.execute({})) as {
  history: {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
  };
};
assert.deepEqual(emptyHistory.history, {
  canUndo: false,
  canRedo: false,
  undoLabel: null,
  redoLabel: null,
});
const emptyResults = await Promise.all(
  (["undo", "redo"] as const).map((action) =>
    history.execute({ action, expectedRevision: before.revision }),
  ),
);
assert(
  emptyResults.every(
    (result) => (result as { code: string }).code === "history-unavailable",
  ),
);
const fixture = {
  ...createEmptyGraphModel(),
  nodes: [
    { id: "a", label: "A", order: 0, x: 5, y: 10 },
    { id: "b", label: "B", order: 1, x: 90, y: 20 },
  ],
  edges: [{ id: "ab", source: "a", target: "b" }],
};
const input = serializeGraphModel(fixture);
const args = { input, format: "json", expectedRevision: before.revision };
const applied = (await replace.execute(args)) as {
  ok: boolean;
  revision: string;
};
assert.equal(applied.ok, true);
assert.equal(fits, 1);
assert.deepEqual(store.get(graphAtom), fixture);
assert.notEqual(applied.revision, before.revision);
const appliedHistory = (await summary.execute({})) as {
  history: {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
  };
};
assert.deepEqual(appliedHistory.history, {
  canUndo: true,
  canRedo: false,
  undoLabel: "Replace graph",
  redoLabel: null,
});
assert.equal(
  (
    (await history.execute({
      action: "undo",
      expectedRevision: before.revision,
    })) as { code: string }
  ).code,
  "stale-revision",
);
assert.deepEqual(store.get(graphAtom), fixture);

const stale = (await replace.execute(args)) as { ok: boolean; code: string };
assert.equal(stale.ok, false);
assert.equal(stale.code, "stale-revision");
assert.deepEqual(store.get(graphAtom), fixture);
const invalid = (await replace.execute({
  ...args,
  expectedRevision: applied.revision,
  input: "not json",
})) as { ok: boolean };
assert.equal(invalid.ok, false);
assert.deepEqual(store.get(graphAtom), fixture);
const partial = (await replace.execute({
  input: "3 2\n0 1\ninvalid",
  format: "contest-edge-list",
  expectedRevision: applied.revision,
})) as { ok: boolean };
assert.equal(partial.ok, false);
assert.deepEqual(store.get(graphAtom), fixture);
const unknown = (await replace.execute({
  ...args,
  expectedRevision: applied.revision,
  extra: true,
})) as { ok: boolean };
assert.equal(unknown.ok, false);

const historyUndo = (await history.execute({
  action: "undo",
  expectedRevision: applied.revision,
})) as { ok: boolean; revision: string };
assert.equal(historyUndo.ok, true);
const afterUndo = await read();
assert.equal(historyUndo.revision, afterUndo.revision);
const afterUndoHistory = (await summary.execute({})) as {
  history: {
    canUndo: boolean;
    canRedo: boolean;
    undoLabel: string | null;
    redoLabel: string | null;
  };
};
assert.deepEqual(afterUndoHistory.history, {
  canUndo: false,
  canRedo: true,
  undoLabel: null,
  redoLabel: "Replace graph",
});
assert.notEqual(
  afterUndo.revision,
  before.revision,
  "undo must not reuse an earlier revision",
);
assert.notEqual(afterUndo.revision, applied.revision);
assert.deepEqual(store.get(graphAtom), createEmptyGraphModel());
const historyRedo = (await history.execute({
  action: "redo",
  expectedRevision: afterUndo.revision,
})) as { ok: boolean; revision: string };
assert.equal(historyRedo.ok, true);
const afterRedo = await read();
assert.equal(historyRedo.revision, afterRedo.revision);
assert.notEqual(
  afterRedo.revision,
  applied.revision,
  "redo must not reuse an earlier revision",
);
assert.deepEqual(store.get(graphAtom), fixture);
const staleAfterRedo = (await replace.execute({
  ...args,
  expectedRevision: applied.revision,
})) as { ok: boolean; code: string };
assert.equal(staleAfterRedo.code, "stale-revision");

const json = JSON.parse(afterRedo.graph);
assert.deepEqual(json, fixture);
const badFormat = (await get.execute({ format: "unsupported" })) as {
  ok: boolean;
};
assert.equal(badFormat.ok, false);

const nodePage = (await summary.execute({
  section: "nodes",
  offset: 0,
  limit: 1,
})) as {
  revision: string;
  nodeCount: number;
  edgeCount: number;
  items: Array<{ id: string }>;
  nextOffset: number | null;
};
assert.equal(nodePage.nodeCount, 2);
assert.equal(nodePage.edgeCount, 1);
assert.deepEqual(
  nodePage.items.map((node) => node.id),
  ["a"],
);
assert.equal(nodePage.nextOffset, 1);
const beforeSelect = (await summary.execute({})) as {
  revision: string;
  selection: { revision: string };
};
const selectResult = (await selectElements.execute({
  nodeFilter: { neighborOf: { node: { id: "a" } } },
  expectedRevision: beforeSelect.revision,
  expectedSelectionRevision: beforeSelect.selection.revision,
})) as Record<string, unknown>;
assert.equal(selectResult.ok, true);
assert.equal("storage" in selectResult, false);
assert.deepEqual(store.get(selectionAtom), { nodeIds: ["b"], edgeIds: [] });
assert.deepEqual(store.get(graphAtom), fixture);
store.set(selectionAtom, { nodeIds: [], edgeIds: [] });
const nextNodePage = (await summary.execute({
  section: "nodes",
  offset: 1,
  limit: 1,
  expectedRevision: nodePage.revision,
})) as {
  items: Array<{ id: string }>;
  nextOffset: number | null;
};
assert.deepEqual(
  nextNodePage.items.map((node) => node.id),
  ["b"],
);
assert.equal(nextNodePage.nextOffset, null);
const edgePage = (await summary.execute({ section: "edges", limit: 1 })) as {
  items: Array<{ id: string }>;
};
assert.deepEqual(
  edgePage.items.map((edge) => edge.id),
  ["ab"],
);
assert.equal(
  ((await summary.execute({ limit: 11 })) as { ok: boolean }).ok,
  false,
);

const rename = (await updateNode.execute({
  node: { label: "A" },
  label: "Start",
  color: "blue",
  expectedRevision: nodePage.revision,
})) as { ok: boolean; revision: string; nodeCount: number };
assert.equal(rename.ok, true);
assert.equal(rename.nodeCount, 1);
assert.deepEqual(store.get(graphAtom).nodes[0], {
  ...fixture.nodes[0],
  label: "Start",
  color: "blue",
});
assert.deepEqual(store.get(graphAtom).nodes[1], fixture.nodes[1]);
assert.deepEqual(store.get(graphAtom).edges, fixture.edges);
const secondRename = (await updateNode.execute({
  node: { id: "a" },
  label: "Origin",
  expectedRevision: rename.revision,
})) as { ok: boolean; revision: string };
assert.equal(secondRename.ok, true);
assert.equal(store.get(graphAtom).nodes[0]?.color, "blue");
store.set(undoAtom);
assert.equal(store.get(graphAtom).nodes[0]?.label, "Start");
const staleUpdate = (await updateNode.execute({
  node: { id: "a" },
  label: "Wrong",
  expectedRevision: nodePage.revision,
})) as { ok: boolean; code: string };
assert.equal(staleUpdate.code, "stale-revision");
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), fixture);
store.set(redoAtom);
assert.equal(store.get(graphAtom).nodes[0]?.label, "Start");

const beforeEdge = await read();
const edge = (await addEdge.execute({
  source: { label: "Start" },
  target: { id: "b" },
  expectedRevision: beforeEdge.revision,
})) as { ok: boolean; revision: string; edgeId: string };
assert.equal(edge.ok, true);
assert.deepEqual(store.get(graphAtom).edges.at(-1), {
  id: edge.edgeId,
  source: "a",
  target: "b",
});
assert.deepEqual(store.get(graphAtom).nodes[0], {
  ...fixture.nodes[0],
  label: "Start",
  color: "blue",
});
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom).edges, fixture.edges);

const duplicate = {
  ...fixture,
  nodes: fixture.nodes.map((node) => ({ ...node, label: "same" })),
};
const revisionBeforeDuplicate = (await read()).revision;
const duplicateResult = (await replace.execute({
  input: serializeGraphModel(duplicate),
  format: "json",
  expectedRevision: revisionBeforeDuplicate,
})) as { ok: boolean; revision: string };
assert.equal(duplicateResult.ok, true);
const ambiguous = (await updateNode.execute({
  node: { label: "same" },
  label: "changed",
  expectedRevision: duplicateResult.revision,
})) as { ok: boolean; code: string };
assert.equal(ambiguous.code, "ambiguous-node");
assert.deepEqual(store.get(graphAtom), duplicate);
const ambiguousEdge = (await addEdge.execute({
  source: { label: "same" },
  target: { id: "b" },
  expectedRevision: duplicateResult.revision,
})) as { ok: boolean; code: string };
assert.equal(ambiguousEdge.code, "ambiguous-node");
assert.deepEqual(store.get(graphAtom), duplicate);

const impossible = (await layout.execute({
  kind: "dagLayer",
  expectedRevision: duplicateResult.revision,
})) as { ok: boolean; code: string };
assert.equal(impossible.code, "dagRequiresDirected");
assert.deepEqual(store.get(graphAtom), duplicate);
const cancel = new AbortController();
cancel.abort();
const cancelled = (await layout.execute(
  { kind: "circle", expectedRevision: duplicateResult.revision },
  { signal: cancel.signal },
)) as { ok: boolean; code: string };
assert.equal(cancelled.code, "cancelled");
assert.deepEqual(store.get(graphAtom), duplicate);
const cancelInProgress = new AbortController();
const pendingLayout = layout.execute(
  { kind: "force", expectedRevision: duplicateResult.revision },
  { signal: cancelInProgress.signal },
);
cancelInProgress.abort();
const interrupted = (await pendingLayout) as { ok: boolean };
assert.equal(interrupted.ok, false);
assert.deepEqual(store.get(graphAtom), duplicate);
const moved = (await layout.execute({
  kind: "circle",
  expectedRevision: duplicateResult.revision,
})) as { ok: boolean; revision: string };
assert.equal(moved.ok, true);
assert.notDeepEqual(store.get(graphAtom), duplicate);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), duplicate);

const custom = {
  ...fixture,
  settings: {
    ...fixture.settings,
    directed: true,
    weighted: true,
    indexBase: 1 as const,
    allowSelfLoops: false,
    snapToGrid: true,
  },
};
const beforeCustom = (await read()).revision;
const customResult = (await replace.execute({
  input: serializeGraphModel(custom),
  format: "json",
  expectedRevision: beforeCustom,
})) as { ok: boolean; revision: string };
assert.equal(customResult.ok, true);
const textImport = (await replace.execute({
  input: "3 2\n1 2 4\n2 3 5",
  format: "contest-edge-list",
  expectedRevision: customResult.revision,
})) as { ok: boolean; revision: string };
assert.equal(textImport.ok, true);
assert.deepEqual(store.get(graphAtom).settings, custom.settings);
const loop = (await addEdge.execute({
  source: { label: "1" },
  target: { label: "1" },
  expectedRevision: textImport.revision,
})) as { ok: boolean; code: string };
assert.equal(loop.code, "edge-not-allowed");
assert.equal(store.get(graphAtom).edges.length, 2);
const numericWeight = (await addEdge.execute({
  source: { label: "1" },
  target: { label: "3" },
  weight: 7,
  expectedRevision: textImport.revision,
})) as { ok: boolean; revision: string };
assert.equal(numericWeight.ok, true);
assert.equal(store.get(graphAtom).edges.at(-1)?.weight, "7");
const invalidWeight = (await addEdge.execute({
  source: { label: "1" },
  target: { label: "3" },
  weight: Number.POSITIVE_INFINITY,
  expectedRevision: numericWeight.revision,
})) as { ok: boolean; code: string };
assert.equal(invalidWeight.code, "invalid-input");
const blankWeight = (await addEdge.execute({
  source: { label: "1" },
  target: { label: "3" },
  weight: "   ",
  expectedRevision: numericWeight.revision,
})) as { ok: boolean };
assert.equal(blankWeight.ok, true);
assert.equal(store.get(graphAtom).edges.at(-1)?.weight, "1");
const beforeNewNode = store.get(graphAtom);
const firstPage = (await summary.execute({ section: "nodes", limit: 1 })) as {
  revision: string;
};
const newNode = (await addNode.execute({
  label: "  Extra  ",
  position: { x: 500, y: -250 },
  expectedRevision: firstPage.revision,
})) as { ok: boolean; nodeId: string; revision: string };
assert.equal(newNode.ok, true);
assert.deepEqual(store.get(graphAtom).nodes.slice(0, -1), beforeNewNode.nodes);
assert.deepEqual(store.get(graphAtom).edges, beforeNewNode.edges);
assert.deepEqual(store.get(graphAtom).settings, beforeNewNode.settings);
assert.deepEqual(store.get(graphAtom).nodes.at(-1), {
  id: newNode.nodeId,
  label: "Extra",
  order: beforeNewNode.nodes.length,
  x: 500,
  y: -250,
});
const oldPage = (await summary.execute({
  section: "nodes",
  offset: 1,
  limit: 1,
  expectedRevision: firstPage.revision,
})) as { ok: boolean; code: string };
assert.equal(oldPage.code, "stale-revision");
const oldAdd = (await addNode.execute({
  expectedRevision: firstPage.revision,
})) as { ok: boolean; code: string };
assert.equal(oldAdd.code, "stale-revision");
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), beforeNewNode);
store.set(redoAtom);
assert.equal(store.get(graphAtom).nodes.at(-1)?.id, newNode.nodeId);
const afterRedoNode = await read();
const automatic = (await addNode.execute({
  expectedRevision: afterRedoNode.revision,
})) as { ok: boolean; nodeId: string };
assert.equal(automatic.ok, true);
const automaticNode = store.get(graphAtom).nodes.at(-1)!;
assert.equal(automaticNode.id, automatic.nodeId);
assert(
  !store
    .get(graphAtom)
    .nodes.slice(0, -1)
    .some((node) => node.label === automaticNode.label),
);
assert(
  !store
    .get(graphAtom)
    .nodes.slice(0, -1)
    .some((node) => node.x === automaticNode.x && node.y === automaticNode.y),
);

// Selection and storage state are reported independently of graph revisions.
const revisionBeforeSelection = (await read()).revision;
store.set(selectionAtom, { nodeIds: [newNode.nodeId], edgeIds: [] });
const selectedSummary = (await summary.execute({})) as {
  revision: string;
  selection: {
    revision: string;
    nodeCount: number;
    edgeCount: number;
    nodeIds: string[];
  };
  storage: { status: string; scope: string };
};
assert.equal(selectedSummary.revision, revisionBeforeSelection);
assert.equal(typeof selectedSummary.selection.revision, "string");
assert.deepEqual(selectedSummary.selection, {
  revision: selectedSummary.selection.revision,
  nodeCount: 1,
  edgeCount: 0,
  nodeIds: [newNode.nodeId],
  edgeIds: [],
  nodeIdsTruncated: false,
  edgeIdsTruncated: false,
});
assert.equal(selectedSummary.storage.status, getStorageSnapshot().status);
assert.equal(selectedSummary.storage.scope, "original");

const install = async (model: typeof fixture) => {
  const result = (await replace.execute({
    input: serializeGraphModel(model),
    format: "json",
    expectedRevision: (await read()).revision,
  })) as { ok: boolean; revision: string };
  assert.equal(result.ok, true);
  return result.revision;
};

let currentRevision = await install(fixture);
const numericExport = (await get.execute({ format: "edge-list" })) as {
  ok: boolean;
  nodeLabelsRenumbered: boolean;
};
assert.equal(numericExport.ok, true);
assert.equal(numericExport.nodeLabelsRenumbered, true);
const numericFixture = {
  ...fixture,
  nodes: fixture.nodes.map((node, index) => ({
    ...node,
    label: String(index + fixture.settings.indexBase),
  })),
};
currentRevision = await install(numericFixture);
assert.equal(
  (
    (await get.execute({ format: "edge-list" })) as {
      nodeLabelsRenumbered: boolean;
    }
  ).nodeLabelsRenumbered,
  false,
);
assert.equal(
  "nodeLabelsRenumbered" in ((await get.execute({ format: "json" })) as object),
  false,
);

const settingsChange = (await updateSettings.execute({
  weighted: true,
  directed: true,
  indexBase: numericFixture.settings.indexBase === 0 ? 1 : 0,
  expectedRevision: currentRevision,
})) as {
  ok: boolean;
  revision: string;
  relabeledNodes: number;
  initializedWeights: number;
};
assert.equal(settingsChange.ok, true);
assert.equal(settingsChange.relabeledNodes, 2);
assert.equal(settingsChange.initializedWeights, 1);
assert.equal(store.get(graphAtom).edges[0].weight, "1");
assert.equal(store.get(graphAtom).nodes[0].x, numericFixture.nodes[0].x);
const weightedGraph = store.get(graphAtom);
assert.equal(
  (
    (await updateSettings.execute({
      expectedRevision: settingsChange.revision,
    })) as { code: string }
  ).code,
  "invalid-input",
);
assert.equal(
  (
    (await updateSettings.execute({
      directed: false,
      expectedRevision: currentRevision,
    })) as { code: string }
  ).code,
  "stale-revision",
);
assert.deepEqual(store.get(graphAtom), weightedGraph);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), numericFixture);
store.set(redoAtom);
assert.deepEqual(store.get(graphAtom), weightedGraph);

const edgeUpdate = (await updateEdge.execute({
  edge: { id: "ab" },
  weight: 7,
  label: "cost",
  color: "blue",
  expectedRevision: (await read()).revision,
})) as { ok: boolean; revision: string };
assert.equal(edgeUpdate.ok, true);
assert.deepEqual(store.get(graphAtom).edges[0], {
  ...weightedGraph.edges[0],
  weight: "7",
  label: "cost",
  color: "blue",
});
assert.deepEqual(store.get(graphAtom).nodes, weightedGraph.nodes);
const changedEdgeGraph = store.get(graphAtom);
assert.equal(
  (
    (await updateEdge.execute({
      edge: { id: "missing" },
      label: "x",
      expectedRevision: edgeUpdate.revision,
    })) as { code: string }
  ).code,
  "edge-not-found",
);
assert.equal(
  (
    (await updateEdge.execute({
      edge: { id: "ab" },
      label: "x",
      expectedRevision: currentRevision,
    })) as { code: string }
  ).code,
  "stale-revision",
);
assert.deepEqual(store.get(graphAtom), changedEdgeGraph);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), weightedGraph);
store.set(redoAtom);
assert.deepEqual(store.get(graphAtom), changedEdgeGraph);

const hiddenWeights = (await updateSettings.execute({
  weighted: false,
  expectedRevision: (await read()).revision,
})) as { ok: boolean; revision: string };
assert.equal(hiddenWeights.ok, true);
assert.equal(store.get(graphAtom).edges[0].weight, "7");
assert.equal(
  (
    (await updateEdge.execute({
      edge: { id: "ab" },
      weight: 2,
      expectedRevision: hiddenWeights.revision,
    })) as { code: string }
  ).code,
  "unweighted-graph",
);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), changedEdgeGraph);

const parallel = {
  ...fixture,
  edges: [...fixture.edges, { id: "ba", source: "b", target: "a" }],
};
currentRevision = await install(parallel);
assert.equal(
  (
    (await updateEdge.execute({
      edge: { source: { id: "a" }, target: { id: "b" } },
      label: "ambiguous",
      expectedRevision: currentRevision,
    })) as { code: string }
  ).code,
  "ambiguous-edge",
);
assert.deepEqual(store.get(graphAtom), parallel);
const preciseEdge = (await updateEdge.execute({
  edge: { id: "ba" },
  label: "specific",
  expectedRevision: currentRevision,
})) as { ok: boolean };
assert.equal(preciseEdge.ok, true);
assert.deepEqual(store.get(graphAtom).edges[0], parallel.edges[0]);
assert.equal(store.get(graphAtom).edges[1].label, "specific");
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), parallel);

currentRevision = await install(duplicate);
assert.equal(
  (
    (await deleteElement.execute({
      node: { label: "same" },
      expectedRevision: currentRevision,
    })) as { code: string }
  ).code,
  "ambiguous-node",
);
assert.equal(
  (
    (await deleteElement.execute({
      edgeId: "missing",
      expectedRevision: currentRevision,
    })) as { code: string }
  ).code,
  "edge-not-found",
);
assert.deepEqual(store.get(graphAtom), duplicate);
const deletedNode = (await deleteElement.execute({
  node: { id: "a" },
  expectedRevision: currentRevision,
})) as { ok: boolean; deletedNodes: number; deletedEdges: number };
assert.equal(deletedNode.ok, true);
assert.equal(deletedNode.deletedNodes, 1);
assert.equal(deletedNode.deletedEdges, 1);
assert.deepEqual(store.get(graphAtom).nodes, [duplicate.nodes[1]]);
assert.deepEqual(store.get(graphAtom).edges, []);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), duplicate);
const deletedEdge = (await deleteElement.execute({
  edgeId: "ab",
  expectedRevision: (await read()).revision,
})) as { ok: boolean; deletedNodes: number; deletedEdges: number };
assert.equal(deletedEdge.ok, true);
assert.equal(deletedEdge.deletedNodes, 0);
assert.equal(deletedEdge.deletedEdges, 1);
assert.deepEqual(store.get(graphAtom).nodes, duplicate.nodes);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), duplicate);

// Root selection for tool calls must not depend on the editor's selection.
currentRevision = await install(fixture);
store.set(selectionAtom, { nodeIds: ["a"], edgeIds: [] });
const firstTree = (await layout.execute({
  kind: "tree",
  expectedRevision: currentRevision,
})) as { ok: boolean };
assert.equal(firstTree.ok, true);
const treeWithFirstSelected = store.get(graphAtom);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), fixture);
store.set(selectionAtom, { nodeIds: ["b"], edgeIds: [] });
const secondTree = (await layout.execute({
  kind: "tree",
  expectedRevision: (await read()).revision,
})) as { ok: boolean };
assert.equal(secondTree.ok, true);
assert.deepEqual(store.get(graphAtom), treeWithFirstSelected);
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), fixture);

const alreadyCancelled = new AbortController();
alreadyCancelled.abort();
const revisionBeforeCancelledEdits = (await read()).revision;
const cancelledEdits = [
  [
    deleteElement,
    { node: { id: "a" }, expectedRevision: revisionBeforeCancelledEdits },
  ],
  [
    updateEdge,
    {
      edge: { id: "ab" },
      label: "cancelled",
      expectedRevision: revisionBeforeCancelledEdits,
    },
  ],
  [
    updateNode,
    {
      node: { id: "a" },
      label: "cancelled",
      expectedRevision: revisionBeforeCancelledEdits,
    },
  ],
  [
    replace,
    {
      input: serializeGraphModel(duplicate),
      format: "json",
      expectedRevision: revisionBeforeCancelledEdits,
    },
  ],
] as const;
const cancelledResults = await Promise.all(
  cancelledEdits.map(([tool, payload]) =>
    tool.execute(payload, { signal: alreadyCancelled.signal }),
  ),
);
assert(cancelledResults.every((result) => !(result as { ok: boolean }).ok));
assert.deepEqual(store.get(graphAtom), fixture);

// Commands issued by the editor share the same history as WebMCP edits.
const userEdit = store.set(
  executeCommandAtom,
  updateNodeCommand("a", { label: "User edit" }),
);
assert.equal(userEdit.status, "applied");
const afterUserEdit = (await summary.execute({})) as {
  revision: string;
  history: { canUndo: boolean; undoLabel: string | null };
};
assert.equal(afterUserEdit.history.canUndo, true);
assert.equal(afterUserEdit.history.undoLabel, "Update node");
const undoUserEdit = (await history.execute({
  action: "undo",
  expectedRevision: afterUserEdit.revision,
})) as { ok: boolean; revision: string };
assert.equal(undoUserEdit.ok, true);
assert.deepEqual(store.get(graphAtom), fixture);
const redoUserEdit = (await history.execute({
  action: "redo",
  expectedRevision: undoUserEdit.revision,
})) as { ok: boolean };
assert.equal(redoUserEdit.ok, true);
assert.equal(store.get(graphAtom).nodes[0].label, "User edit");
store.set(undoAtom);
assert.deepEqual(store.get(graphAtom), fixture);
const beforeDisposeLayout = store.get(graphAtom);
const pendingAtDispose = layout.execute({
  kind: "force",
  expectedRevision: (await read()).revision,
});
dispose();
const disposedLayoutResult = (await pendingAtDispose) as { ok: boolean };
assert.equal(disposedLayoutResult.ok, false);
assert.deepEqual(store.get(graphAtom), beforeDisposeLayout);
assert.equal(registered.size, 0);
const disposeBeforeRegistration = registerGraphWebMcp(context, store, () => {});
disposeBeforeRegistration();
await Promise.resolve();
assert.equal(registered.size, 0, "unmount before registration leaves no tools");

const otherStore = createStore();
const disposeWithFailedFit = registerGraphWebMcp(context, otherStore, () => {
  throw new Error("viewport unavailable");
});
await Promise.resolve();
const readOther = (await registered.get("get_graph")!.execute({})) as {
  revision: string;
};
const fitFailure = (await registered.get("replace_graph")!.execute({
  ...args,
  expectedRevision: readOther.revision,
})) as { ok: boolean; fitRequested: boolean };
assert.equal(
  fitFailure.ok,
  true,
  "a viewport failure must not report a failed edit",
);
assert.equal(fitFailure.fitRequested, false);
assert.deepEqual(otherStore.get(graphAtom), fixture);
disposeWithFailedFit();
assert.equal(registered.size, 0);
console.log("WebMCP tool verification passed");
