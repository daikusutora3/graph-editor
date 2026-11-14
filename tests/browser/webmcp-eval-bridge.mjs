import { createInterface } from "node:readline";
import { appendFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright";

// Isolated, local-only bridge for interactive Codex evaluations. Each run
// starts a fresh browser context and initializes a synthetic graph through
// WebMCP itself. The agent gets only tool metadata and its requested fixture.
const fixtureName = process.argv[2] ?? "basic";
const expectedToolCount = 16;
if (
  ![
    "basic",
    "ambiguous",
    "large-1",
    "large-2",
    "large-3",
    "directed-1",
    "case-b",
    "case-c",
    "case-d",
    "case-e",
    "case-f",
    "case-g",
  ].includes(fixtureName)
) {
  throw new Error("Unknown evaluation fixture.");
}

const browser = await chromium.launch({
  headless: true,
  args: ["--enable-features=WebMCP,WebMCPTesting"],
});
const page = await browser.newPage(
  fixtureName === "large-3" || fixtureName === "case-g"
    ? { viewport: { width: 1440, height: 900 } }
    : {},
);
const lines = createInterface({ input: process.stdin });
const tracePath = join(
  mkdtempSync(join(tmpdir(), "graph-webmcp-eval-")),
  "trace.jsonl",
);
const trace = (entry) =>
  appendFileSync(tracePath, `${JSON.stringify(entry)}\n`);
page.on("pageerror", (error) =>
  trace({ event: "page-error", message: String(error) }),
);
try {
  if (fixtureName === "case-b") {
    // Only this fresh isolated page loses Web Locks. No user browser settings
    // or storage are changed, and the app's real unavailable path is exercised.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "locks", {
        value: undefined,
        configurable: true,
      });
    });
  }
  await page.goto("http://127.0.0.1:3323/en");
  let available = [];
  for (let attempt = 0; attempt < 100; attempt++) {
    // Registration is asynchronous; polling must be sequential.
    // oxlint-disable-next-line no-await-in-loop
    available = await page.webmcp.tools();
    if (
      available.length >= expectedToolCount &&
      [
        "get_graph",
        "get_graph_summary",
        "replace_graph",
        "update_graph_elements",
        "get_incident_edges",
        "reverse_edges",
        "add_graph_elements",
        "select_graph_elements",
        "arrange_graph_nodes",
      ].every((name) => available.some((tool) => tool.name === name))
    )
      break;
    // oxlint-disable-next-line no-await-in-loop
    await page.waitForTimeout(100);
  }
  if (
    available.length < expectedToolCount ||
    ![
      "get_graph",
      "get_graph_summary",
      "replace_graph",
      "update_graph_elements",
      "get_incident_edges",
      "reverse_edges",
      "add_graph_elements",
      "select_graph_elements",
      "arrange_graph_nodes",
    ].every((name) => available.some((tool) => tool.name === name))
  )
    throw new Error(
      `Expected ${expectedToolCount} WebMCP tools, got ${available.length}.`,
    );

  const before = await page.webmcp.callTool("get_graph", {});
  const graph = JSON.parse(before.graph);
  graph.settings = {
    ...graph.settings,
    indexBase: 1,
    weighted: true,
    directed: fixtureName === "directed-1",
  };
  const large =
    fixtureName.startsWith("large-") ||
    ["case-c", "case-g"].includes(fixtureName);
  const nodeCount = large ? 1000 : 6;
  graph.nodes = Array.from({ length: nodeCount }, (_, index) => ({
    id: `n${index + 1}`,
    label:
      fixtureName === "ambiguous" && index === 1
        ? "1"
        : fixtureName === "large-2" && index === 996
          ? "998"
          : String(index + 1),
    order: index,
    x: large ? (index % 40) * 90 : index * 100,
    y:
      fixtureName === "case-d"
        ? (index % 3) * 75
        : large
          ? Math.floor(index / 40) * 90
          : 0,
    ...(["case-c", "case-g"].includes(fixtureName)
      ? index % 7 === 0
        ? { color: "blue" }
        : {}
      : index === 4 || (large && index === 499)
        ? { color: "blue" }
        : {}),
  }));
  graph.edges = large
    ? [1, 7, 37, 123].flatMap((stride, group) =>
        Array.from({ length: nodeCount }, (_, index) => ({
          id: `e${group * nodeCount + index + 1}`,
          source: `n${index + 1}`,
          target: `n${((index + stride) % nodeCount) + 1}`,
          weight: String((index % 17) + 1),
          ...(index === 499 && group === 0 ? { color: "green" } : {}),
        })),
      )
    : Array.from({ length: 5 }, (_, index) => ({
        id: `e${index + 1}`,
        source: `n${index + 1}`,
        target: `n${index + 2}`,
        weight: String(index + 1),
        ...(index === 4 ? { color: "green" } : {}),
      }));
  if (fixtureName === "ambiguous")
    graph.edges.push({ id: "e6", source: "n3", target: "n4", weight: "9" });
  if (fixtureName === "case-e") {
    graph.edges[0].weight = "unknown";
    graph.edges[1].weight = "12";
    graph.edges[2].weight = "13";
  }
  if (fixtureName === "case-f") {
    graph.edges[0].weight = "9007199254740993";
    graph.edges[1].weight = "9007199254740992";
    graph.edges[2].weight = "0x10";
  }
  if (fixtureName === "large-2")
    graph.edges.push({
      id: "e4001",
      source: "n999",
      target: "n1000",
      weight: "19",
    });
  const prepared = await page.webmcp.callTool("replace_graph", {
    input: JSON.stringify(graph),
    format: "json",
    expectedRevision: before.revision,
  });
  if (!prepared.ok) throw new Error(`Fixture failed: ${prepared.code}`);
  const initialSummary = await page.webmcp.callTool("get_graph_summary", {});
  if (
    fixtureName === "case-b" &&
    initialSummary.storage?.status !== "unavailable"
  )
    throw new Error(
      `Expected unavailable storage, got ${initialSummary.storage?.status}.`,
    );
  let selectedNodeIds;
  if (fixtureName === "case-g") {
    const selected = page.getByRole("button", {
      name: "Select node 200",
      exact: true,
    });
    await selected.waitFor({ timeout: 30000 });
    await selected.focus();
    await page.keyboard.press("Enter");
    const summary = await page.webmcp.callTool("get_graph_summary", {});
    if (
      summary.selection.nodeCount !== 1 ||
      summary.selection.edgeCount !== 0 ||
      summary.selection.nodeIds[0] !== "n200"
    )
      throw new Error(
        "Expected the original UI selection to be node 200 only.",
      );
    selectedNodeIds = ["n200"];
  }
  if (fixtureName === "large-3") {
    // Select a proper subset using the actual editor's Shift-drag interaction.
    // Read selected labels from accessible UI buttons; do not inject app state.
    const first = page.getByRole("button", {
      name: "Select node 203",
      exact: true,
    });
    const last = page.getByRole("button", {
      name: "Select node 410",
      exact: true,
    });
    await first.waitFor({ timeout: 30000 });
    await last.waitFor({ timeout: 30000 });
    await page.waitForTimeout(2000);
    const a = await first.boundingBox();
    const b = await last.boundingBox();
    if (!a || !b) throw new Error("The selection targets are not visible.");
    await page.keyboard.down("Shift");
    await page.mouse.move(a.x - 6, a.y - 6);
    await page.mouse.down();
    await page.mouse.move(b.x + b.width + 6, b.y + b.height + 6, { steps: 8 });
    await page.mouse.up();
    await page.keyboard.up("Shift");
    const selected = await page
      .getByRole("button", { name: /^Select node /, pressed: true })
      .all();
    const labels = await Promise.all(
      selected.map((button) => button.getAttribute("aria-label")),
    );
    if (labels.some((label) => !/^Select node \d+$/.test(label ?? "")))
      throw new Error(
        "Could not identify selected nodes from their accessible labels.",
      );
    selectedNodeIds = labels.map(
      (label) => `n${label.slice("Select node ".length)}`,
    );
    const summary = await page.webmcp.callTool("get_graph_summary", {});
    if (
      selectedNodeIds.length <= 10 ||
      selectedNodeIds.length >= nodeCount ||
      summary.selection.nodeCount !== selectedNodeIds.length
    )
      throw new Error(
        `Expected a selected proper subset with more than 10 nodes, got ${selectedNodeIds.length}.`,
      );
  }
  trace({
    event: "start",
    fixture: fixtureName,
    chromium: browser.version(),
    initialGraph: graph,
    initialStorage: initialSummary.storage,
    ...(selectedNodeIds ? { selectedNodeIds } : {}),
  });
  process.stdout.write(
    `${JSON.stringify({ ready: true, fixture: fixtureName, chromium: browser.version(), tracePath })}\n`,
  );

  for await (const line of lines) {
    try {
      const command = JSON.parse(line);
      if (command.action === "list") {
        const tools = await page.webmcp.tools();
        trace({ event: "list", tools });
        process.stdout.write(`${JSON.stringify({ tools })}\n`);
      } else if (
        command.action === "call" &&
        typeof command.name === "string"
      ) {
        const result = await page.webmcp.callTool(
          command.name,
          command.input ?? {},
        );
        trace({
          event: "call",
          name: command.name,
          input: command.input ?? {},
          result,
          resultBytes: Buffer.byteLength(JSON.stringify(result), "utf8"),
        });
        process.stdout.write(`${JSON.stringify({ result })}\n`);
      } else if (command.action === "close") {
        process.stdout.write(`${JSON.stringify({ closed: true })}\n`);
        break;
      } else {
        process.stdout.write(
          `${JSON.stringify({ error: "Expected list, call, or close." })}\n`,
        );
      }
    } catch (error) {
      trace({ event: "error", message: String(error) });
      process.stdout.write(`${JSON.stringify({ error: String(error) })}\n`);
    }
  }
} catch (error) {
  trace({ event: "bridge-error", message: String(error) });
  process.stderr.write(
    `${JSON.stringify({ error: String(error), tracePath })}\n`,
  );
  throw error;
} finally {
  try {
    const final = await page.webmcp.callTool("get_graph", {
      format: "json",
      allowLargeOutput: true,
    });
    const finalSummary = await page.webmcp.callTool("get_graph_summary", {});
    trace({ event: "finish", final, finalSummary });
  } catch (error) {
    trace({ event: "finish-error", message: String(error) });
  }
  lines.close();
  await browser.close();
}
