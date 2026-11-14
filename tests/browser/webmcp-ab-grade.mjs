import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";

// Compare the same synthetic case before and after a tool redesign. Keep
// graph correctness, preserving selection and tool usage as separate measures.
const [scenario, tracePath] = process.argv.slice(2);
if (
  ![
    "blue_move",
    "heavy_delete",
    "single_node",
    "single_edge",
    "weight_update",
  ].includes(scenario) ||
  !tracePath
)
  throw new Error(
    "Usage: node tests/browser/webmcp-ab-grade.mjs <blue_move|heavy_delete|single_node|single_edge|weight_update> <trace.jsonl>",
  );

const events = readFileSync(tracePath, "utf8")
  .split("\n")
  .filter(Boolean)
  .map((line) => JSON.parse(line));
const start = events.find((event) => event.event === "start");
if (!start || start.fixture !== "case-g" || !start.initialGraph)
  throw new Error("The trace must start with a case-g graph fixture.");
if (!isDeepStrictEqual(start.selectedNodeIds, ["n200"]))
  throw new Error("The expected initial node selection is n200.");

const finish = events.findLast((event) => event.event === "finish");
// A final snapshot may be written even if the acting agent was interrupted.
// The bridge does not record whether the user-facing task was completed.
const snapshotAvailable = Boolean(finish?.final?.ok && finish.finalSummary?.ok);
const calls = events.filter((event) => event.event === "call");
const tools = events.find((event) => event.event === "list")?.tools;
const successful = calls.filter((call) => call.result?.ok === true);
// Selection changes are not graph edits or undoable graph history entries.
const selectionWrites = successful.filter(
  (call) =>
    ["select_graph_elements_by_filter", "select_graph_elements"].includes(
      call.name,
    ) && call.result.status === "selected",
);
const graphWrites = successful.filter(
  (call) =>
    !["select_graph_elements_by_filter", "select_graph_elements"].includes(
      call.name,
    ) && call.result.status === "applied",
);
const bytes = calls.map(
  (call) =>
    call.resultBytes ?? Buffer.byteLength(JSON.stringify(call.result), "utf8"),
);
const fullExports = successful.filter(
  (call) => call.name === "get_graph" && typeof call.result.graph === "string",
);
const errors = events
  .filter((event) =>
    ["error", "page-error", "bridge-error", "finish-error"].includes(
      event.event,
    ),
  )
  .map(({ event, message }) => ({ event, message }));

let expectedGraph;
let selectionPreserved;
if (snapshotAvailable) {
  const expected = structuredClone(start.initialGraph);
  if (scenario === "blue_move") {
    for (const node of expected.nodes) if (node.color === "blue") node.x += 50;
  } else if (scenario === "heavy_delete") {
    expected.edges = expected.edges.filter((edge) => Number(edge.weight) < 10);
  } else if (scenario === "weight_update") {
    for (const edge of expected.edges)
      if (Number(edge.weight) >= 10) edge.weight = "2";
  } else if (scenario === "single_node") {
    expected.nodes.find((node) => node.id === "n1").color = "red";
  } else {
    expected.edges.find((edge) => edge.id === "e1").weight = "12";
  }
  expectedGraph = isDeepStrictEqual(JSON.parse(finish.final.graph), expected);
  const selection = finish.finalSummary.selection;
  selectionPreserved = Boolean(
    selection &&
    selection.nodeCount === 1 &&
    selection.edgeCount === 0 &&
    selection.nodeIdsTruncated === false &&
    selection.edgeIdsTruncated === false &&
    isDeepStrictEqual(selection.nodeIds, ["n200"]) &&
    isDeepStrictEqual(selection.edgeIds, []),
  );
}
const output = {
  scenario,
  fixture: start.fixture,
  chromium: start.chromium,
  snapshotAvailable,
  expectedGraphAtSnapshot: expectedGraph ?? null,
  selectionPreservedAtSnapshot: selectionPreserved ?? null,
  toolCalls: calls.map(({ name, result, resultBytes }) => ({
    name,
    ok: result?.ok,
    status: result?.status,
    code: result?.code,
    resultBytes,
  })),
  successfulSelectionWrites: selectionWrites.length,
  successfulGraphWrites: graphWrites.length,
  successfulFullExports: fullExports.length,
  totalResponseBytes: bytes.reduce((sum, count) => sum + count, 0),
  maxResponseBytes: Math.max(0, ...bytes),
  toolMetadataChars: tools ? JSON.stringify(tools).length : null,
  errors,
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
