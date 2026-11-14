import assert from "node:assert/strict";
import { chromium } from "playwright";

// An isolated headless browser and the authorized local editor preview only.
const browser = await chromium.launch({
  headless: true,
  args: ["--enable-features=WebMCP,WebMCPTesting"],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://127.0.0.1:3323/en");
  await page.waitForFunction(() => !!document.modelContext);
  async function waitForTools() {
    for (let attempt = 0; attempt < 100; attempt++) {
      // Registration is asynchronous; polling must be sequential.
      // oxlint-disable-next-line no-await-in-loop
      const current = await page.webmcp.tools();
      if (current.length === 16) return current;
      // oxlint-disable-next-line no-await-in-loop
      await page.waitForTimeout(100);
    }
    throw new Error("WebMCP tools did not register");
  }
  const tools = await waitForTools();
  assert.deepEqual(tools.map((tool) => tool.name).sort(), [
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
  const call = (name, input) => page.webmcp.callTool(name, input);
  const before = await call("get_graph", {});
  assert.equal(before.ok, true);
  const emptyHistory = await call("get_graph_summary", {});
  assert.deepEqual(emptyHistory.history, {
    canUndo: false,
    canRedo: false,
    undoLabel: null,
    redoLabel: null,
  });
  const nothingToUndo = await call("edit_history", {
    action: "undo",
    expectedRevision: emptyHistory.revision,
  });
  assert.equal(nothingToUndo.code, "history-unavailable");
  const graph = JSON.parse(before.graph);
  graph.nodes = [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 100, y: 0 },
  ];
  graph.edges = [{ id: "ab", source: "a", target: "b" }];
  const replacement = {
    format: "json",
    input: JSON.stringify(graph),
    expectedRevision: before.revision,
  };
  const updated = await call("replace_graph", replacement);
  assert.equal(updated.ok, true);
  assert.equal(updated.nodeCount, 2);
  assert.equal(updated.edgeCount, 1);
  assert.equal(updated.fitRequested, true);
  await page.getByRole("button", { name: "Select node A" }).waitFor();
  const stale = await call("replace_graph", replacement);
  assert.equal(stale.ok, false);
  assert.equal(stale.code, "stale-revision");
  const summary = await call("get_graph_summary", {
    section: "nodes",
    limit: 1,
  });
  assert.equal(summary.nodeCount, 2);
  assert.equal(summary.edgeCount, 1);
  assert.equal(summary.items[0].id, "a");
  assert.equal(summary.nextOffset, 1);
  assert.equal(summary.storage.scope, "original");
  assert.equal(typeof summary.storage.status, "string");
  assert.equal(summary.selection.nodeCount, 0);
  const numericExport = await call("get_graph", { format: "edge-list" });
  assert.equal(numericExport.nodeLabelsRenumbered, true);
  const changed = await call("update_graph_elements", {
    nodes: [{ node: { label: "A" }, label: "Start", color: "blue" }],
    expectedRevision: summary.revision,
  });
  assert.equal(changed.ok, true);
  await page.getByRole("button", { name: "Select node Start" }).waitFor();
  // An omitted root must use the same default even when a different node is selected.
  await page.getByRole("button", { name: "Select node B" }).click();
  const selectedB = await call("get_graph_summary", {});
  assert.deepEqual(selectedB.selection.nodeIds, ["b"]);
  assert.equal(selectedB.revision, changed.revision);
  const layoutB = await call("apply_layout", {
    kind: "tree",
    expectedRevision: selectedB.revision,
  });
  assert.equal(layoutB.ok, true);
  const graphLayoutB = JSON.parse((await call("get_graph", {})).graph);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Select node Start" }).click();
  const selectedA = await call("get_graph_summary", {});
  assert.deepEqual(selectedA.selection.nodeIds, ["a"]);
  const layoutA = await call("apply_layout", {
    kind: "tree",
    expectedRevision: selectedA.revision,
  });
  assert.equal(layoutA.ok, true);
  assert.deepEqual(
    JSON.parse((await call("get_graph", {})).graph),
    graphLayoutB,
  );
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const afterTreeUndo = await call("get_graph", {});
  const added = await call("add_edge", {
    source: { label: "Start" },
    target: { id: "b" },
    expectedRevision: afterTreeUndo.revision,
  });
  assert.equal(added.ok, true);
  const positioned = await call("apply_layout", {
    kind: "circle",
    expectedRevision: added.revision,
  });
  assert.equal(positioned.ok, true);
  const current = await call("get_graph", {});
  const graphAfterLayout = JSON.parse(current.graph);
  assert.equal(graphAfterLayout.nodes[0].label, "Start");
  assert.equal(graphAfterLayout.nodes[0].color, "blue");
  assert.equal(graphAfterLayout.edges.length, 2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const undone = await call("get_graph", {});
  assert.notDeepEqual(JSON.parse(undone.graph), graphAfterLayout);
  assert.notEqual(undone.revision, positioned.revision);
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  const redone = await call("get_graph", {});
  assert.deepEqual(JSON.parse(redone.graph), graphAfterLayout);
  assert.notEqual(redone.revision, positioned.revision);
  await page.waitForFunction((expected) => {
    const raw = localStorage.getItem("graph-editor-graph");
    return (
      raw !== null &&
      JSON.stringify(JSON.parse(raw)) === JSON.stringify(expected)
    );
  }, graphAfterLayout);
  await page.reload();
  await page.waitForFunction(() => !!document.modelContext);
  await waitForTools();
  const reloaded = await call("get_graph", {});
  assert.deepEqual(JSON.parse(reloaded.graph), graphAfterLayout);
  const weighted = await call("replace_graph", {
    input: "2 1\n1 2 3",
    format: "contest-edge-list",
    weighted: true,
    directed: true,
    indexBase: 1,
    expectedRevision: reloaded.revision,
  });
  assert.equal(weighted.ok, true);
  const numericWeight = await call("add_edge", {
    source: { label: "2" },
    target: { label: "1" },
    weight: 7,
    expectedRevision: weighted.revision,
  });
  assert.equal(numericWeight.ok, true);
  const weightedEdges = await call("get_graph_summary", { section: "edges" });
  assert.equal(weightedEdges.items.at(-1).weight, "7");
  const firstPage = await call("get_graph_summary", {
    section: "nodes",
    limit: 1,
  });
  const node = await call("add_node", {
    label: "  Extra  ",
    position: { x: 500, y: 200 },
    expectedRevision: firstPage.revision,
  });
  assert.equal(node.ok, true);
  await page.getByRole("button", { name: "Select node Extra" }).waitFor();
  const stalePage = await call("get_graph_summary", {
    section: "nodes",
    offset: 1,
    limit: 1,
    expectedRevision: firstPage.revision,
  });
  assert.equal(stalePage.code, "stale-revision");
  const withNode = await call("get_graph", {});
  const beforeUndo = JSON.parse(withNode.graph);
  assert.equal(beforeUndo.nodes.length, 3);
  assert.equal(beforeUndo.edges.length, 2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const withoutNode = JSON.parse((await call("get_graph", {})).graph);
  assert.equal(withoutNode.nodes.length, 2);
  assert.deepEqual(withoutNode.edges, beforeUndo.edges);

  const beforeEdgeEdit = await call("get_graph", {});
  const weightedBeforeEdit = JSON.parse(beforeEdgeEdit.graph);
  const edgeId = weightedBeforeEdit.edges[0].id;
  const edgeUpdate = await call("update_graph_elements", {
    edges: [{ edge: { id: edgeId }, weight: 12, label: "cost", color: "blue" }],
    expectedRevision: beforeEdgeEdit.revision,
  });
  assert.equal(edgeUpdate.ok, true);
  const editedGraph = JSON.parse((await call("get_graph", {})).graph);
  assert.equal(editedGraph.edges[0].weight, "12");
  assert.equal(editedGraph.edges[0].label, "cost");
  assert.equal(editedGraph.edges[0].color, "blue");
  assert.deepEqual(editedGraph.nodes, weightedBeforeEdit.nodes);
  assert.deepEqual(editedGraph.edges[1], weightedBeforeEdit.edges[1]);
  const staleEdgeUpdate = await call("update_graph_elements", {
    edges: [{ edge: { id: edgeId }, color: "red" }],
    expectedRevision: beforeEdgeEdit.revision,
  });
  assert.equal(staleEdgeUpdate.code, "stale-revision");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(
    JSON.parse((await call("get_graph", {})).graph),
    weightedBeforeEdit,
  );

  // User-initiated edits use the same history as WebMCP edits.
  const beforeUserEdit = await call("get_graph", {});
  await page.getByRole("button", { name: "Node", exact: true }).click();
  await page.getByRole("button", { name: "Add node near center" }).click();
  const userEditSummary = await call("get_graph_summary", {});
  assert.equal(userEditSummary.nodeCount, weightedBeforeEdit.nodes.length + 1);
  assert.equal(userEditSummary.history.canUndo, true);
  assert.equal(userEditSummary.history.canRedo, false);
  assert.equal(userEditSummary.history.undoLabel, "Add node");
  const staleHistory = await call("edit_history", {
    action: "undo",
    expectedRevision: beforeUserEdit.revision,
  });
  assert.equal(staleHistory.code, "stale-revision");
  const userGraph = JSON.parse((await call("get_graph", {})).graph);
  assert.equal(userGraph.nodes.length, weightedBeforeEdit.nodes.length + 1);
  const toolUndo = await call("edit_history", {
    action: "undo",
    expectedRevision: userEditSummary.revision,
  });
  assert.equal(toolUndo.ok, true);
  assert.deepEqual(
    JSON.parse((await call("get_graph", {})).graph),
    weightedBeforeEdit,
  );
  const undoneSummary = await call("get_graph_summary", {});
  assert.equal(undoneSummary.history.canRedo, true);
  assert.equal(undoneSummary.history.redoLabel, "Add node");
  const toolRedo = await call("edit_history", {
    action: "redo",
    expectedRevision: undoneSummary.revision,
  });
  assert.equal(toolRedo.ok, true);
  assert.deepEqual(JSON.parse((await call("get_graph", {})).graph), userGraph);
  const noRedo = await call("edit_history", {
    action: "redo",
    expectedRevision: toolRedo.revision,
  });
  assert.equal(noRedo.code, "history-unavailable");
  const restoreForRemainingTests = await call("edit_history", {
    action: "undo",
    expectedRevision: toolRedo.revision,
  });
  assert.equal(restoreForRemainingTests.ok, true);

  const beforeSettings = await call("get_graph", {});
  const settings = await call("update_graph_settings", {
    weighted: false,
    expectedRevision: beforeSettings.revision,
  });
  assert.equal(settings.ok, true);
  const settingsGraph = JSON.parse((await call("get_graph", {})).graph);
  assert.equal(settingsGraph.settings.weighted, false);
  assert.deepEqual(settingsGraph.edges, weightedBeforeEdit.edges);
  const unweightedEdit = await call("update_graph_elements", {
    edges: [{ edge: { id: edgeId }, weight: 10 }],
    expectedRevision: settings.revision,
  });
  assert.equal(unweightedEdit.code, "unweighted-graph");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  const afterSettingsUndo = await call("get_graph", {});
  assert.deepEqual(JSON.parse(afterSettingsUndo.graph), weightedBeforeEdit);

  const deleted = await call("delete_graph_elements", {
    nodes: [{ label: "1" }],
    expectedRevision: afterSettingsUndo.revision,
  });
  assert.equal(deleted.ok, true);
  assert.equal(deleted.deletedNodes, 1);
  assert.equal(deleted.deletedEdges, 2);
  const afterDelete = JSON.parse((await call("get_graph", {})).graph);
  assert.equal(afterDelete.nodes.length, 1);
  assert.equal(afterDelete.edges.length, 0);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(
    JSON.parse((await call("get_graph", {})).graph),
    weightedBeforeEdit,
  );
  const beforeBatch = await call("get_graph_summary", {});
  const batch = await call("update_graph_elements", {
    nodes: [
      { node: { label: "1" }, label: "Start", color: "red" },
      { node: { label: "2" }, color: "blue" },
    ],
    edges: [{ edge: { id: edgeId }, weight: 8 }],
    expectedRevision: beforeBatch.revision,
  });
  assert.equal(batch.ok, true);
  assert.equal(batch.nodeCount, 2);
  assert.equal(batch.edgeCount, 1);
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: "Select node Start" }).waitFor();
  const batchGraph = JSON.parse((await call("get_graph", {})).graph);
  assert.equal(batchGraph.nodes[0].color, "red");
  assert.equal(batchGraph.nodes[1].color, "blue");
  assert.equal(batchGraph.edges[0].weight, "8");
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(
    JSON.parse((await call("get_graph", {})).graph),
    weightedBeforeEdit,
  );
  const incident = await call("get_incident_edges", {
    node: { label: "1" },
    direction: "out",
  });
  assert.equal(incident.matchCount, 1);
  assert.equal(incident.items[0].neighbor.label, "2");
  const beforeAdd = await call("get_graph_summary", {});
  const addedGraph = await call("add_graph_elements", {
    nodes: [{ label: "3" }],
    edges: [{ source: { label: "2" }, target: { label: "3" }, weight: 9 }],
    expectedRevision: beforeAdd.revision,
  });
  assert.equal(addedGraph.ok, true);
  assert.equal(addedGraph.nodeCount, 1);
  assert.equal(addedGraph.edgeCount, 1);
  assert(["pending", "saved"].includes(addedGraph.storage.status));
  await page.getByRole("button", { name: "Select node 3" }).waitFor();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(
    JSON.parse((await call("get_graph", {})).graph),
    weightedBeforeEdit,
  );
  const beforeMove = await call("get_graph_summary", {});
  const move = await call("update_graph_elements", {
    nodes: [
      { node: { label: "1" }, position: { x: 10, y: 20 } },
      { node: { label: "2" }, position: { x: 150, y: 220 } },
    ],
    expectedRevision: beforeMove.revision,
  });
  assert.equal(move.ok, true);
  const moved = JSON.parse((await call("get_graph", {})).graph);
  assert.equal(moved.nodes[0].x, 10);
  assert.equal(moved.nodes[1].y, 220);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(
    JSON.parse((await call("get_graph", {})).graph),
    weightedBeforeEdit,
  );
  const beforeReverse = await call("get_graph_summary", {});
  const reversed = await call("reverse_edges", {
    allEdges: true,
    expectedRevision: beforeReverse.revision,
  });
  assert.equal(reversed.ok, true);
  assert.equal(reversed.reversedEdges, 2);
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  assert.deepEqual(
    JSON.parse((await call("get_graph", {})).graph),
    weightedBeforeEdit,
  );
  assert.deepEqual(errors, []);
  console.log(
    `Native WebMCP verification passed (Chromium ${browser.version()})`,
  );
} finally {
  await browser.close();
}
