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
  const call = async (
    name: string,
    input: unknown,
    signal?: AbortSignal,
  ): Promise<Result> => {
    const tool = tools.get(name);
    assert(tool, `Expected registered WebMCP tool ${name}`);
    return (await tool.execute(
      input,
      signal ? { signal } : undefined,
    )) as Result;
  };
  return { call, dispose, store, tools };
}

const graph: GraphModel = {
  ...createEmptyGraphModel({ weighted: true, indexBase: 1 }),
  nodes: Array.from({ length: 1_000 }, (_, index) => ({
    id: `n${index + 1}`,
    label: index === 999 ? "997" : String(index + 1),
    order: index,
    x: index * 100,
    y: index % 2 ? 100 : 0,
    ...(index === 20 ? { color: "blue" as const } : {}),
  })),
  edges: Array.from({ length: 5_000 }, (_, index) => ({
    id: `e${index + 1}`,
    source: `n${(index % 1_000) + 1}`,
    target: `n${((index + 1) % 1_000) + 1}`,
    weight: String(index % 7),
    ...(index === 123 ? { routing: { bowPx: 24 } } : {}),
  })),
};

{
  const { call, dispose, store } = await setup(graph);
  const before = structuredClone(store.get(graphAtom));
  const summary = await call("get_graph_summary", {});
  assert.equal(summary.ok, true);
  assert.equal(summary.nodeCount, 1_000);
  assert.equal(summary.edgeCount, 5_000);
  assert(JSON.stringify(summary).length <= 16_000);
  const revision = summary.revision;
  assert.equal(typeof revision, "string");

  const exportLimited = await call("get_graph", { format: "json" });
  assert.equal(exportLimited.ok, false);
  assert.equal(exportLimited.code, "output-too-large");
  assert.equal(exportLimited.revision, revision);
  assert((exportLimited.outputChars as number) > 16_000);
  assert.equal("graph" in exportLimited, false);
  assert(JSON.stringify(exportLimited).length <= 16_000);
  const defaultExport = await call("get_graph", {});
  assert.equal(defaultExport.ok, false);
  assert.equal(defaultExport.code, "output-too-large");
  assert.equal("graph" in defaultExport, false);
  const exportAllowed = await call("get_graph", {
    format: "json",
    allowLargeOutput: true,
  });
  assert.equal(exportAllowed.ok, true);
  assert.deepEqual(JSON.parse(exportAllowed.graph as string), before);

  const latePage = await call("get_graph_summary", {
    section: "nodes",
    offset: 990,
    limit: 10,
    expectedRevision: revision,
  });
  assert.equal(latePage.ok, true);
  assert(JSON.stringify(latePage).length <= 16_000);
  assert.equal((latePage.items as unknown[]).length, 10);
  assert.equal(latePage.nextOffset, null);

  const duplicate = await call("find_graph_elements", {
    node: { label: "997" },
    offset: 0,
    limit: 1,
    expectedRevision: revision,
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.matchCount, 2);
  assert.equal((duplicate.items as { id: string }[])[0]?.id, "n997");
  assert.equal(duplicate.nextOffset, 1);
  assert(JSON.stringify(duplicate).length <= 12_000);
  const second = await call("find_graph_elements", {
    node: { label: "997" },
    offset: 1,
    limit: 1,
    expectedRevision: revision,
  });
  assert.equal((second.items as { id: string }[])[0]?.id, "n1000");
  assert.equal(second.nextOffset, null);

  const parallel = await call("find_graph_elements", {
    edge: { source: { label: "999" }, target: { label: "998" } },
    limit: 2,
    expectedRevision: revision,
  });
  assert.equal(parallel.ok, true);
  assert.equal(
    parallel.matchCount,
    5,
    "undirected endpoints work in either order",
  );
  assert.equal((parallel.items as unknown[]).length, 2);
  assert.equal(parallel.nextOffset, 2);
  assert(JSON.stringify(parallel).length <= 12_000);

  const ambiguous = await call("update_graph_elements", {
    nodes: [
      { node: { label: "996" }, color: "red" },
      { node: { label: "997" }, color: "red" },
    ],
    expectedRevision: revision,
  });
  assert.equal(ambiguous.code, "ambiguous-node");
  assert.deepEqual(store.get(graphAtom), before);
  const changed = await call("update_graph_elements", {
    nodes: [{ node: { label: "996" }, color: "red" }],
    edges: [{ edge: { id: "e4999" }, weight: 42 }],
    expectedRevision: revision,
  });
  assert.equal(changed.ok, true);
  const expected = structuredClone(before);
  expected.nodes[995]!.color = "red";
  expected.edges[4998]!.weight = "42";
  assert.deepEqual(
    store.get(graphAtom),
    expected,
    "unrelated data survives the edit",
  );
  const stale = await call("find_graph_elements", {
    node: { label: "997" },
    expectedRevision: revision,
  });
  assert.equal(stale.code, "stale-revision");
  store.set(undoAtom);
  assert.deepEqual(
    store.get(graphAtom),
    before,
    "one Undo reverts the entire edit",
  );
  const directed: GraphModel = {
    ...before,
    settings: { ...before.settings, directed: true },
  };
  store.set(syncExternalGraphAtom, directed);
  const reverseInDirectedGraph = await call("find_graph_elements", {
    edge: { source: { label: "999" }, target: { label: "998" } },
  });
  assert.equal(reverseInDirectedGraph.ok, true);
  assert.equal(reverseInDirectedGraph.matchCount, 0);
  const forwardInDirectedGraph = await call("find_graph_elements", {
    edge: { source: { label: "998" }, target: { label: "999" } },
  });
  assert.equal(forwardInDirectedGraph.ok, true);
  assert.equal(forwardInDirectedGraph.matchCount, 5);
  dispose();
}

// Valid imported IDs can be much larger than an output budget: never truncate
// an ID into a different selector, and never return an oversized page.
{
  const hugeId = `node-${"x".repeat(20_000)}`;
  const graphWithHugeId: GraphModel = {
    ...createEmptyGraphModel(),
    nodes: [
      { id: "small", label: "small", order: 0, x: 0, y: 0 },
      { id: hugeId, label: "huge", order: 1, x: 100, y: 0 },
      { id: "last", label: "last", order: 2, x: 200, y: 0 },
    ],
    edges: [{ id: "huge-edge", source: hugeId, target: "last" }],
  };
  const { call, dispose, store } = await setup(graphWithHugeId);
  store.set(selectionAtom, { nodeIds: ["small", hugeId], edgeIds: [] });
  const summary = await call("get_graph_summary", {});
  assert.equal(summary.ok, true);
  assert(JSON.stringify(summary).length <= 16_000);
  const selection = summary.selection as {
    nodeCount: number;
    nodeIds: string[];
    nodeIdsTruncated: boolean;
  };
  assert.equal(selection.nodeCount, 2);
  assert.equal(selection.nodeIdsTruncated, true);
  assert(selection.nodeIds.every((id) => id === "small" || id === hugeId));
  assert(!selection.nodeIds.includes(hugeId));

  const firstPage = await call("get_graph_summary", {
    section: "nodes",
    offset: 0,
    limit: 3,
  });
  assert.equal(firstPage.ok, true);
  assert(JSON.stringify(firstPage).length <= 16_000);
  assert.deepEqual(
    (firstPage.items as { id: string }[]).map(({ id }) => id),
    ["small"],
  );
  assert.equal(firstPage.nextOffset, 1);
  const blockedPage = await call("get_graph_summary", {
    section: "nodes",
    offset: 1,
    limit: 1,
  });
  assert.equal(blockedPage.ok, false);
  assert.equal(blockedPage.code, "output-too-large");
  assert(JSON.stringify(blockedPage).length <= 16_000);
  const blockedFind = await call("find_graph_elements", {
    node: { label: "huge" },
  });
  assert.equal(blockedFind.ok, false);
  assert.equal(blockedFind.code, "element-too-large");
  assert(JSON.stringify(blockedFind).length <= 12_000);
  assert.deepEqual(store.get(graphAtom), graphWithHugeId);
  dispose();
}

// The selection is a separate mutable state: a graph revision cannot detect
// selection changes, including A → B → A. Each operation must use both tokens.
{
  const { call, dispose, store } = await setup(graph);
  const readTokens = async () => {
    const summary = await call("get_graph_summary", {});
    assert.equal(summary.ok, true);
    const selection = summary.selection as { revision: string };
    assert.equal(typeof summary.revision, "string");
    assert.equal(typeof selection.revision, "string");
    return { graph: summary.revision as string, selection: selection.revision };
  };
  const before = structuredClone(store.get(graphAtom));
  store.set(selectionAtom, { nodeIds: ["n996", "n997"], edgeIds: ["e1"] });
  const first = await readTokens();
  assert.equal((await readTokens()).selection, first.selection);
  store.set(selectionAtom, { nodeIds: ["n998"], edgeIds: [] });
  const second = await readTokens();
  assert.equal(
    second.graph,
    first.graph,
    "selection must not alter graph revision",
  );
  assert.notEqual(second.selection, first.selection);
  store.set(selectionAtom, { nodeIds: ["n996", "n997"], edgeIds: ["e1"] });
  const again = await readTokens();
  assert.equal(again.graph, first.graph);
  assert.notEqual(
    again.selection,
    first.selection,
    "A → B → A must change the selection token",
  );

  const baseArgs = {
    selectedNodes: true,
    nodeColor: "red",
    expectedRevision: again.graph,
  };
  const missingToken = await call("update_graph_elements", baseArgs);
  assert.equal(missingToken.code, "invalid-input");
  assert.deepEqual(store.get(graphAtom), before);
  const staleSelection = await call("update_graph_elements", {
    ...baseArgs,
    expectedSelectionRevision: first.selection,
  });
  assert.equal(staleSelection.code, "stale-selection");
  assert.deepEqual(store.get(graphAtom), before);
  const staleDelete = await call("delete_graph_elements", {
    selectedNodes: true,
    expectedRevision: again.graph,
    expectedSelectionRevision: first.selection,
  });
  assert.equal(staleDelete.code, "stale-selection");
  assert.deepEqual(store.get(graphAtom), before);
  const missingDeleteToken = await call("delete_graph_elements", {
    selectedNodes: true,
    expectedRevision: again.graph,
  });
  assert.equal(missingDeleteToken.code, "invalid-input");
  const overlappingDelete = await call("delete_graph_elements", {
    selectedNodes: true,
    nodes: [{ id: "n1" }],
    expectedRevision: again.graph,
    expectedSelectionRevision: again.selection,
  });
  assert.equal(overlappingDelete.ok, false);
  const overlappingEdgeDelete = await call("delete_graph_elements", {
    selectedEdges: true,
    edges: [{ id: "e1" }],
    expectedRevision: again.graph,
    expectedSelectionRevision: again.selection,
  });
  assert.equal(overlappingEdgeDelete.ok, false);
  const overlappingEdgeEdit = await call("update_graph_elements", {
    selectedEdges: true,
    allEdges: true,
    edgeColor: "red",
    expectedRevision: again.graph,
    expectedSelectionRevision: again.selection,
  });
  assert.equal(overlappingEdgeEdit.ok, false);
  assert.deepEqual(store.get(graphAtom), before);

  for (const extra of [
    { allNodes: true },
    { nodes: [{ node: { id: "n1" } }] },
  ]) {
    // Each rejected request must preserve the graph for the next case.
    // oxlint-disable-next-line no-await-in-loop
    const result = await call("update_graph_elements", {
      ...baseArgs,
      ...extra,
      expectedSelectionRevision: again.selection,
    });
    assert.equal(result.ok, false);
    assert.deepEqual(store.get(graphAtom), before);
  }
  const aborted = new AbortController();
  aborted.abort();
  const cancelled = await call(
    "update_graph_elements",
    { ...baseArgs, expectedSelectionRevision: again.selection },
    aborted.signal,
  );
  assert.equal(cancelled.code, "cancelled");
  const cancelledDelete = await call(
    "delete_graph_elements",
    {
      selectedEdges: true,
      expectedRevision: again.graph,
      expectedSelectionRevision: again.selection,
    },
    aborted.signal,
  );
  assert.equal(cancelledDelete.code, "cancelled");
  assert.deepEqual(store.get(graphAtom), before);

  const applied = await call("update_graph_elements", {
    selectedNodes: true,
    selectedEdges: true,
    nodeColor: "red",
    edgeColor: "blue",
    expectedRevision: again.graph,
    expectedSelectionRevision: again.selection,
  });
  assert.equal(applied.ok, true);
  assert.equal(applied.nodeCount, 2);
  assert.equal(applied.edgeCount, 1);
  assert.equal(applied.selectionRevision, again.selection);
  const expected = structuredClone(before);
  expected.nodes[995]!.color = "red";
  expected.nodes[996]!.color = "red";
  expected.edges[0]!.color = "blue";
  assert.deepEqual(store.get(graphAtom), expected);
  const staleGraph = await call("update_graph_elements", {
    ...baseArgs,
    expectedSelectionRevision: again.selection,
  });
  assert.equal(staleGraph.code, "stale-revision");
  assert.deepEqual(store.get(graphAtom), expected);
  store.set(undoAtom);
  assert.deepEqual(
    store.get(graphAtom),
    before,
    "one Undo restores all selected changes",
  );

  store.set(selectionAtom, { nodeIds: [], edgeIds: [] });
  const empty = await readTokens();
  const emptyEdit = await call("update_graph_elements", {
    selectedNodes: true,
    nodeColor: "red",
    expectedRevision: empty.graph,
    expectedSelectionRevision: empty.selection,
  });
  assert.equal(emptyEdit.code, "no-targets");
  const emptyDelete = await call("delete_graph_elements", {
    selectedEdges: true,
    expectedRevision: empty.graph,
    expectedSelectionRevision: empty.selection,
  });
  assert.equal(emptyDelete.code, "no-targets");
  assert.deepEqual(store.get(graphAtom), before);
  dispose();
}

// "Selected elements" can include nodes, edges, or both. A request for both
// kinds must work when exactly one kind is selected, with a single Undo.
{
  const { call, dispose, store } = await setup(graph);
  const before = structuredClone(store.get(graphAtom));
  const tokens = async () => {
    const summary = await call("get_graph_summary", {});
    assert.equal(summary.ok, true);
    return {
      graph: summary.revision as string,
      selection: (summary.selection as { revision: string }).revision,
    };
  };
  const bothColors = {
    selectedNodes: true,
    selectedEdges: true,
    nodeColor: "red",
    edgeColor: "blue",
  };
  const bothTargets = { selectedNodes: true, selectedEdges: true };

  store.set(selectionAtom, { nodeIds: ["n1", "n2"], edgeIds: [] });
  let current = await tokens();
  const nodesOnly = await call("update_graph_elements", {
    ...bothColors,
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(nodesOnly.ok, true);
  assert.equal(nodesOnly.nodeCount, 2);
  assert.equal(nodesOnly.edgeCount, 0);
  const nodesChanged = structuredClone(before);
  nodesChanged.nodes[0]!.color = "red";
  nodesChanged.nodes[1]!.color = "red";
  assert.deepEqual(store.get(graphAtom), nodesChanged);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);

  current = await tokens();
  const unavailableEdges = await call("update_graph_elements", {
    selectedEdges: true,
    edgeColor: "blue",
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(unavailableEdges.code, "no-targets");
  const unavailableEdgeDelete = await call("delete_graph_elements", {
    selectedEdges: true,
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(unavailableEdgeDelete.code, "no-targets");
  assert.deepEqual(store.get(graphAtom), before);
  const nodesDeleted = await call("delete_graph_elements", {
    ...bothTargets,
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(nodesDeleted.ok, true);
  assert.equal(nodesDeleted.deletedNodes, 2);
  const remainingNodes = before.nodes.filter(
    (node) => !["n1", "n2"].includes(node.id),
  );
  const remainingEdges = before.edges.filter(
    (edge) =>
      !["n1", "n2"].includes(edge.source) &&
      !["n1", "n2"].includes(edge.target),
  );
  assert.equal(
    nodesDeleted.deletedEdges,
    before.edges.length - remainingEdges.length,
  );
  assert.deepEqual(store.get(graphAtom), {
    ...before,
    nodes: remainingNodes,
    edges: remainingEdges,
  });
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);

  store.set(selectionAtom, { nodeIds: [], edgeIds: ["e1", "e2"] });
  current = await tokens();
  const edgesOnly = await call("update_graph_elements", {
    ...bothColors,
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(edgesOnly.ok, true);
  assert.equal(edgesOnly.nodeCount, 0);
  assert.equal(edgesOnly.edgeCount, 2);
  const edgesChanged = structuredClone(before);
  edgesChanged.edges[0]!.color = "blue";
  edgesChanged.edges[1]!.color = "blue";
  assert.deepEqual(store.get(graphAtom), edgesChanged);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);

  current = await tokens();
  const unavailableNodes = await call("update_graph_elements", {
    selectedNodes: true,
    nodeColor: "red",
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(unavailableNodes.code, "no-targets");
  const unavailableNodeDelete = await call("delete_graph_elements", {
    selectedNodes: true,
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(unavailableNodeDelete.code, "no-targets");
  assert.deepEqual(store.get(graphAtom), before);
  const edgesDeleted = await call("delete_graph_elements", {
    ...bothTargets,
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(edgesDeleted.ok, true);
  assert.equal(edgesDeleted.deletedNodes, 0);
  assert.equal(edgesDeleted.deletedEdges, 2);
  assert.deepEqual(store.get(graphAtom), {
    ...before,
    edges: before.edges.filter((edge) => !["e1", "e2"].includes(edge.id)),
  });
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);

  store.set(selectionAtom, { nodeIds: [], edgeIds: [] });
  current = await tokens();
  const noElements = await call("update_graph_elements", {
    ...bothColors,
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(noElements.code, "no-targets");
  const nothingToDelete = await call("delete_graph_elements", {
    ...bothTargets,
    expectedRevision: current.graph,
    expectedSelectionRevision: current.selection,
  });
  assert.equal(nothingToDelete.code, "no-targets");
  assert.deepEqual(store.get(graphAtom), before);
  dispose();
}

// A selected target can be combined with explicit targets of the other kind.
{
  const { call, dispose, store } = await setup(graph);
  const before = structuredClone(store.get(graphAtom));
  store.set(selectionAtom, { nodeIds: ["n1"], edgeIds: [] });
  let summary = await call("get_graph_summary", {});
  let selection = summary.selection as { revision: string };
  const edited = await call("update_graph_elements", {
    selectedNodes: true,
    nodeColor: "red",
    edges: [{ edge: { id: "e4" }, weight: 99 }],
    expectedRevision: summary.revision,
    expectedSelectionRevision: selection.revision,
  });
  assert.equal(edited.ok, true);
  assert.equal(edited.nodeCount, 1);
  assert.equal(edited.edgeCount, 1);
  const expected = structuredClone(before);
  expected.nodes[0]!.color = "red";
  expected.edges[3]!.weight = "99";
  assert.deepEqual(store.get(graphAtom), expected);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);

  store.set(selectionAtom, { nodeIds: [], edgeIds: ["e1"] });
  summary = await call("get_graph_summary", {});
  selection = summary.selection as { revision: string };
  const removed = await call("delete_graph_elements", {
    selectedEdges: true,
    nodes: [{ id: "n5" }],
    expectedRevision: summary.revision,
    expectedSelectionRevision: selection.revision,
  });
  assert.equal(removed.ok, true);
  assert.equal(removed.deletedNodes, 1);
  const remainingEdges = before.edges.filter(
    (edge) => edge.id !== "e1" && edge.source !== "n5" && edge.target !== "n5",
  );
  assert.equal(
    removed.deletedEdges,
    before.edges.length - remainingEdges.length,
  );
  assert.deepEqual(store.get(graphAtom), {
    ...before,
    nodes: before.nodes.filter((node) => node.id !== "n5"),
    edges: remainingEdges,
  });
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);
  dispose();
}

// Selected-ID previews are bounded, but the selected operation applies to
// the complete selection rather than silently dropping entries after 10.
{
  const { call, dispose, store } = await setup(graph);
  const before = structuredClone(store.get(graphAtom));
  store.set(selectionAtom, {
    nodeIds: before.nodes.map((node) => node.id),
    edgeIds: before.edges.map((edge) => edge.id),
  });
  const summary = await call("get_graph_summary", {});
  const selection = summary.selection as {
    revision: string;
    nodeCount: number;
    edgeCount: number;
    nodeIdsTruncated: boolean;
    edgeIdsTruncated: boolean;
  };
  assert.equal(selection.nodeCount, 1_000);
  assert.equal(selection.edgeCount, 5_000);
  assert.equal(selection.nodeIdsTruncated, true);
  assert.equal(selection.edgeIdsTruncated, true);
  assert(JSON.stringify(summary).length <= 16_000);
  const updated = await call("update_graph_elements", {
    selectedNodes: true,
    selectedEdges: true,
    nodeColor: "red",
    edgeColor: "blue",
    expectedRevision: summary.revision,
    expectedSelectionRevision: selection.revision,
  });
  assert.equal(updated.ok, true);
  assert.equal(updated.nodeCount, 1_000);
  assert.equal(updated.edgeCount, 5_000);
  const changed = store.get(graphAtom);
  assert(changed.nodes.every((node) => node.color === "red"));
  assert(changed.edges.every((edge) => edge.color === "blue"));
  assert.deepEqual(changed.settings, before.settings);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);

  const beforeDelete = await call("get_graph_summary", {});
  const selectionBeforeDelete = beforeDelete.selection as { revision: string };
  const deleted = await call("delete_graph_elements", {
    selectedNodes: true,
    selectedEdges: true,
    expectedRevision: beforeDelete.revision,
    expectedSelectionRevision: selectionBeforeDelete.revision,
  });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.deletedNodes, 1_000);
  assert.equal(
    deleted.deletedEdges,
    5_000,
    "connected selected edges count only once",
  );
  assert.equal(store.get(graphAtom).nodes.length, 0);
  assert.equal(store.get(graphAtom).edges.length, 0);
  assert.notEqual(deleted.selectionRevision, selectionBeforeDelete.revision);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);
  dispose();
}

// Selection revisions from a disposed editor session cannot authorize a new one.
{
  const first = await setup(graph);
  first.store.set(selectionAtom, { nodeIds: ["n1"], edgeIds: [] });
  const old = await first.call("get_graph_summary", {});
  const oldSelection = old.selection as { revision: string };
  const oldUpdate = first.tools.get("update_graph_elements")!;
  first.dispose();
  assert.equal(first.tools.size, 0);
  const afterDispose = (await oldUpdate.execute({
    selectedNodes: true,
    nodeColor: "red",
    expectedRevision: old.revision,
    expectedSelectionRevision: oldSelection.revision,
  })) as Result;
  assert.equal(afterDispose.code, "cancelled");
  assert.deepEqual(first.store.get(graphAtom), graph);
  const next = await setup(graph);
  next.store.set(selectionAtom, { nodeIds: ["n1"], edgeIds: [] });
  const current = await next.call("get_graph_summary", {});
  const currentSelection = current.selection as { revision: string };
  assert.notEqual(oldSelection.revision, currentSelection.revision);
  const rejected = await next.call("update_graph_elements", {
    selectedNodes: true,
    nodeColor: "red",
    expectedRevision: current.revision,
    expectedSelectionRevision: oldSelection.revision,
  });
  assert.equal(rejected.code, "stale-selection");
  assert.deepEqual(next.store.get(graphAtom), graph);
  next.dispose();
}

console.log("Large graph WebMCP verification passed");
