import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

// Score recorded synthetic browser sessions independently of the acting agent.
const [scenario, tracePath] = process.argv.slice(2);
const scenarios = [
  "nodes_red",
  "edges_blue",
  "delete_nodes",
  "mixed_edits",
  "all_nodes",
  "undo_batch",
  "ambiguous_nodes",
  "ambiguous_edge",
  "large_nodes_red",
  "large_mixed_edits",
  "large_delete_nodes",
  "large_ambiguous_nodes",
  "large_ambiguous_edge",
  "large_selected_red",
  "add_path",
  "move_nodes",
  "incident",
  "reverse",
  "unsaved_edit",
  "large_blue_to_red",
  "large_heavy_to_blue",
  "large_neighbors_red",
  "relative_translate",
  "relative_align",
  "nonnumeric_weight",
  "precise_weight",
  "large_blue_move",
  "large_heavy_delete",
];
if (!scenarios.includes(scenario) || !tracePath)
  throw new Error(
    `Usage: node tests/browser/webmcp-eval-grade.mjs <${scenarios.join("|")}> <trace.jsonl>`,
  );
const events = readFileSync(tracePath, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const start = events.find((event) => event.event === "start");
const finish = events.findLast((event) => event.event === "finish");
if (!start || !finish || !finish.final?.ok)
  throw new Error("Trace has no complete initial and final state.");
const large = scenario.startsWith("large_");
const ambiguous = scenario.includes("ambiguous_");
const expectedFixture = large
  ? [
      "large_blue_to_red",
      "large_heavy_to_blue",
      "large_neighbors_red",
      "large_blue_move",
      "large_heavy_delete",
    ].includes(scenario)
    ? "case-c"
    : scenario === "large_selected_red"
      ? "large-3"
      : ambiguous
        ? "large-2"
        : "large-1"
  : ambiguous
    ? "ambiguous"
    : scenario === "precise_weight"
      ? "case-f"
      : scenario === "nonnumeric_weight"
        ? "case-e"
        : scenario.startsWith("relative_")
          ? "case-d"
          : scenario === "reverse"
            ? "directed-1"
            : scenario === "unsaved_edit"
              ? "case-b"
              : "basic";
if (start.fixture !== expectedFixture)
  throw new Error(`Scenario ${scenario} requires fixture ${expectedFixture}.`);
const initial = start.initialGraph;
const actual = JSON.parse(finish.final.graph);
const expected = structuredClone(initial);
if (scenario === "large_blue_to_red") {
  for (const node of expected.nodes)
    if (node.color === "blue") node.color = "red";
}
if (scenario === "large_blue_move") {
  for (const node of expected.nodes) if (node.color === "blue") node.x += 50;
}
if (scenario === "large_heavy_delete")
  expected.edges = expected.edges.filter((edge) => Number(edge.weight) < 10);
if (scenario === "large_heavy_to_blue") {
  for (const edge of expected.edges)
    if (Number(edge.weight) >= 10) edge.color = "blue";
}
if (scenario === "nonnumeric_weight") {
  for (const edge of expected.edges)
    if (Number(edge.weight) >= 10) edge.color = "blue";
}
if (scenario === "precise_weight")
  expected.edges.find((edge) => edge.id === "e1").color = "blue";
if (scenario === "large_neighbors_red") {
  const neighbors = new Set();
  for (const edge of expected.edges) {
    if (edge.source === "n4") neighbors.add(edge.target);
    if (edge.target === "n4") neighbors.add(edge.source);
  }
  neighbors.delete("n4");
  for (const node of expected.nodes)
    if (neighbors.has(node.id)) node.color = "red";
}
if (scenario === "relative_translate") {
  for (const node of expected.nodes)
    if (["1", "3"].includes(node.label)) node.x += 50;
}
if (scenario === "relative_align") {
  const y = expected.nodes.find((node) => node.label === "1").y;
  for (const node of expected.nodes)
    if (["1", "3", "5"].includes(node.label)) node.y = y;
}
if (scenario === "move_nodes") {
  Object.assign(
    expected.nodes.find((node) => node.label === "1"),
    { x: 100, y: 200 },
  );
  Object.assign(
    expected.nodes.find((node) => node.label === "3"),
    { x: 350, y: 250 },
  );
}
if (scenario === "reverse") {
  for (const edge of expected.edges.filter((candidate) =>
    ["e1", "e3"].includes(candidate.id),
  )) {
    [edge.source, edge.target] = [edge.target, edge.source];
  }
}
if (scenario === "unsaved_edit")
  expected.nodes.find((node) => node.label === "1").color = "red";
if (scenario === "nodes_red")
  for (const node of expected.nodes)
    if (["1", "2", "3"].includes(node.label)) node.color = "red";
if (scenario === "all_nodes")
  for (const node of expected.nodes) node.color = "red";
if (scenario === "edges_blue")
  for (const edge of expected.edges)
    if (["e1", "e3"].includes(edge.id)) edge.color = "blue";
if (scenario === "mixed_edits") {
  expected.nodes.find((node) => node.label === "6").label = "終点";
  expected.edges.find((edge) => edge.id === "e1").weight = "7";
  expected.edges.find((edge) => edge.id === "e3").weight = "9";
}
if (scenario === "delete_nodes") {
  expected.nodes = expected.nodes.filter(
    (node) => !["n2", "n4"].includes(node.id),
  );
  expected.edges = expected.edges.filter(
    (edge) =>
      !["n2", "n4"].includes(edge.source) &&
      !["n2", "n4"].includes(edge.target),
  );
}
if (scenario === "large_nodes_red")
  for (const node of expected.nodes)
    if (["998", "999", "1000"].includes(node.label)) node.color = "red";
if (scenario === "large_selected_red") {
  if (!Array.isArray(start.selectedNodeIds))
    throw new Error("Trace has no UI-selected node IDs.");
  const selectedIds = new Set(start.selectedNodeIds);
  if (selectedIds.size <= 10 || selectedIds.size >= expected.nodes.length)
    throw new Error(
      "Expected a proper UI-selected subset larger than 10 nodes.",
    );
  for (const node of expected.nodes)
    if (selectedIds.has(node.id)) node.color = "red";
}
if (scenario === "large_mixed_edits") {
  expected.nodes.find((node) => node.id === "n1000").label = "終点";
  const matchingEdge = expected.edges.find((edge) => edge.id === "e999");
  matchingEdge.weight = "7";
  matchingEdge.color = "blue";
}
if (scenario === "large_delete_nodes") {
  expected.nodes = expected.nodes.filter(
    (node) => !["n998", "n999"].includes(node.id),
  );
  expected.edges = expected.edges.filter(
    (edge) =>
      !["n998", "n999"].includes(edge.source) &&
      !["n998", "n999"].includes(edge.target),
  );
}
const calls = events.filter((event) => event.event === "call");
const discoveredTools =
  events.find((event) => event.event === "list")?.tools ?? [];
const isReadOnly = (name) =>
  ["get_graph", "get_graph_summary"].includes(name) ||
  discoveredTools.some(
    (tool) => tool.name === name && tool.annotations?.readOnly === true,
  );
const writes = calls.filter(
  (event) =>
    !isReadOnly(event.name) &&
    !["select_graph_elements_by_filter", "select_graph_elements"].includes(
      event.name,
    ) &&
    event.result?.ok === true &&
    event.result?.status !== "noop",
);
const expectedWrites =
  ambiguous || scenario === "incident" ? 0 : scenario === "undo_batch" ? 2 : 1;
const responseBytes = calls.map(
  (call) =>
    call.resultBytes ?? Buffer.byteLength(JSON.stringify(call.result), "utf8"),
);
const totalResponseBytes = responseBytes.reduce((sum, bytes) => sum + bytes, 0);
const maxResponseBytes = Math.max(0, ...responseBytes);
const originalNodeIds = new Set(initial.nodes.map((node) => node.id));
const originalEdgeIds = new Set(initial.edges.map((edge) => edge.id));
const newNodes = actual.nodes.filter((node) => !originalNodeIds.has(node.id));
const newEdges = actual.edges.filter((edge) => !originalEdgeIds.has(edge.id));
const node7 = newNodes.find((node) => node.label === "7");
const node8 = newNodes.find((node) => node.label === "8");
const pathEdge = (edge, first, second, weight) =>
  edge.weight === weight &&
  ((edge.source === first && edge.target === second) ||
    (!initial.settings.directed &&
      edge.source === second &&
      edge.target === first));
const preservesInitial =
  actual.version === initial.version &&
  isDeepStrictEqual(actual.settings, initial.settings) &&
  isDeepStrictEqual(
    actual.nodes.filter((node) => originalNodeIds.has(node.id)),
    initial.nodes,
  ) &&
  isDeepStrictEqual(
    actual.edges.filter((edge) => originalEdgeIds.has(edge.id)),
    initial.edges,
  );
const pathIsValid =
  scenario === "add_path" &&
  preservesInitial &&
  newNodes.length === 2 &&
  newEdges.length === 2 &&
  node7 &&
  node8 &&
  node7.id !== node8.id &&
  newNodes.every(
    (node) =>
      node.color === undefined &&
      Number.isFinite(node.x) &&
      Number.isFinite(node.y),
  ) &&
  newEdges.every(
    (edge) =>
      edge.color === undefined &&
      edge.label === undefined &&
      edge.routing === undefined,
  ) &&
  newEdges.some((edge) => pathEdge(edge, "n6", node7.id, "5")) &&
  newEdges.some((edge) => pathEdge(edge, node7.id, node8.id, "9"));
// The numeric labels in this fixture use 48px circular nodes. Touching is OK;
// exact geometry matters more than merely checking different coordinates.
const pathHasNoOverlap =
  scenario === "add_path" &&
  newNodes.every((node) =>
    actual.nodes.every(
      (other) =>
        node.id === other.id ||
        Math.hypot(node.x - other.x, node.y - other.y) >= 48 - 1e-6,
    ),
  );
const incidentCall = calls.find(
  (call) =>
    call.name === "get_incident_edges" &&
    call.result?.ok === true &&
    call.result.matchCount === 2 &&
    Array.isArray(call.result.items) &&
    isDeepStrictEqual(
      call.result.items.map((item) => item.neighbor?.label).sort(),
      ["3", "5"],
    ) &&
    isDeepStrictEqual(call.result.items.map((item) => item.id).sort(), [
      "e3",
      "e4",
    ]),
);
const checks = {
  expectedFinalGraph:
    scenario === "add_path"
      ? Boolean(pathIsValid)
      : isDeepStrictEqual(actual, expected),
  successfulWrites: writes.length === expectedWrites,
  ...(scenario === "add_path"
    ? {
        noOverlappingNodes: Boolean(pathHasNoOverlap),
        usedAtomicCreate: writes[0]?.name === "add_graph_elements",
      }
    : {}),
  ...(scenario === "move_nodes"
    ? { usedAtomicUpdate: writes[0]?.name === "update_graph_elements" }
    : {}),
  ...(scenario === "reverse"
    ? { usedAtomicReverse: writes[0]?.name === "reverse_edges" }
    : {}),
  ...(scenario === "incident"
    ? { incidentResponse: Boolean(incidentCall) }
    : {}),
  ...(scenario === "unsaved_edit"
    ? {
        unavailableStorageReported:
          start.initialStorage?.status === "unavailable" &&
          writes[0]?.result?.storage?.status === "unavailable",
      }
    : {}),
  ...(large
    ? {
        noFullGraphExport: !calls.some(
          (call) =>
            call.name === "get_graph" &&
            call.result?.ok === true &&
            typeof call.result.graph === "string",
        ),
        boundedResponses: maxResponseBytes <= 32_768,
        boundedTotalTraffic: totalResponseBytes <= 65_536,
      }
    : {}),
  ...(scenario === "undo_batch"
    ? {
        batchAndUndo:
          writes[0]?.name === "update_graph_elements" &&
          writes[1]?.name === "edit_history" &&
          writes[1]?.input?.action === "undo",
      }
    : {}),
};
const errors = events.filter((event) =>
  ["error", "page-error", "bridge-error", "finish-error"].includes(event.event),
);
process.stdout.write(
  `${JSON.stringify({ scenario, fixture: start.fixture, chromium: start.chromium, checks, calls: calls.map(({ name, result, resultBytes }) => ({ name, ok: result?.ok, code: result?.code, storage: result?.storage, resultBytes })), errors, successfulWriteCount: writes.length, totalResponseBytes, maxResponseBytes, passed: Object.values(checks).every(Boolean) }, null, 2)}\n`,
);
if (!Object.values(checks).every(Boolean)) process.exitCode = 1;
