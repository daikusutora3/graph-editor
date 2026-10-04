import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createStore } from "jotai/vanilla";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { updateNodeCommand } from "../../features/graph-editor/core/graph/graph-intents";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  cancelScheduledStoredGraphWrite,
  uninstallStorageFlushListeners,
} from "../../features/graph-editor/adapters/browser/stored-graph";

// Compare each version sequentially without concurrent builds or benchmarks.
// --original-dir accepts saved modules with their dependency imports resolved.
const originalDir = argument("--original-dir");
const history = (await import(
  originalDir
    ? pathToFileURL(resolve(originalDir, "history-atoms.ts")).href
    : "../../features/graph-editor/shell/state/history-atoms"
)) as typeof import("../../features/graph-editor/shell/state/history-atoms");
const clipboard = (await import(
  originalDir
    ? pathToFileURL(resolve(originalDir, "clipboard.ts")).href
    : "../../features/graph-editor/io/clipboard"
)) as typeof import("../../features/graph-editor/io/clipboard");
const iterations = 15;
type Metric = {
  name: string;
  medianMs: number;
  maxMs: number;
  signature: string;
};
const metrics: Metric[] = [];
const originals = Object.fromEntries(
  ["window", "document", "navigator"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: { getItem: () => null },
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {},
    setTimeout: () => 1,
    clearTimeout() {},
  },
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: { addEventListener() {}, removeEventListener() {} },
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: { locks: { request: async () => {} } },
});
try {
  for (const [name, label] of [
    ["limits short labels", "node"],
    ["limits long labels", "長".repeat(256)],
  ] as const) {
    const graph = fixture(1000, 5000, label);
    const store = createStore();
    store.set(syncExternalGraphAtom, graph);
    store.set(history.executeCommandAtom, updateNodeCommand("n0", { x: 17 }));
    measure(
      `${name} undo with pending save`,
      () => {
        store.set(history.undoAtom);
        return store.get(graphAtom);
      },
      () => store.set(history.redoAtom),
      (restored) => verifyRestoredGraph(restored, 0),
    );
    store.set(history.undoAtom);
    measure(
      `${name} redo with pending save`,
      () => {
        store.set(history.redoAtom);
        return store.get(graphAtom);
      },
      () => store.set(history.undoAtom),
      (restored) => verifyRestoredGraph(restored, 17),
    );
  }
  const dense = fixture(500, 2500, "node");
  const sparse = {
    ...dense,
    nodes: dense.nodes.map((node, index) => ({ ...node, order: index * 2 })),
  };
  for (const [name, graph] of [
    ["dense", dense],
    ["sparse", sparse],
  ] as const) {
    measure(
      `${name} paste 500 nodes / 2500 edges`,
      () => {
        const pasted = clipboard.createPasteGraphCommand(
          graph,
          { nodes: dense.nodes, edges: dense.edges, indexBase: 0 },
          2,
        );
        return pasted;
      },
      undefined,
      (result) => {
        if (!result || result.command.type !== "put-graph-elements")
          throw new Error("Paste did not produce a command");
        const command = result.command;
        if (
          result.command.nodes.length !== 500 ||
          result.command.edges.length !== 2500 ||
          result.selection.nodeIds.length !== 500 ||
          result.selection.edgeIds.length !== 2500 ||
          result.selection.nodeIds.some(
            (id, index) => id !== command.nodes[index]?.id,
          ) ||
          result.selection.edgeIds.some(
            (id, index) => id !== command.edges[index]?.id,
          )
        )
          throw new Error("Paste changed element counts or selected IDs");
        const ids = new Map(
          result.command.nodes.map((node, index) => [node.id, `p${index}`]),
        );
        return {
          ...result.command,
          nodes: result.command.nodes.map((node) => ({
            ...node,
            id: ids.get(node.id),
          })),
          edges: result.command.edges.map((edge, index) => ({
            ...edge,
            id: `pe${index}`,
            source: ids.get(edge.source) ?? edge.source,
            target: ids.get(edge.target) ?? edge.target,
          })),
          selection: {
            nodeIds: result.selection.nodeIds.map((id) => ids.get(id)),
            edgeCount: result.selection.edgeIds.length,
          },
        };
      },
    );
  }
} finally {
  cancelScheduledStoredGraphWrite();
  uninstallStorageFlushListeners();
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
const baselinePath = argument("--baseline");
const baseline = baselinePath
  ? (JSON.parse(readFileSync(baselinePath, "utf8")) as Metric[])
  : [];
for (const metric of metrics) {
  const before = baseline.find((candidate) => candidate.name === metric.name);
  console.log(
    JSON.stringify({
      ...metric,
      ...(before
        ? {
            previousMedianMs: before.medianMs,
            speedup: before.medianMs / metric.medianMs,
            sameOutput: before.signature === metric.signature,
          }
        : {}),
    }),
  );
}
const output = argument("--output");
if (output) writeFileSync(output, JSON.stringify(metrics, null, 2));
if (
  baselinePath &&
  (baseline.length !== metrics.length ||
    metrics.some(
      (metric) =>
        !baseline.some(
          (before) =>
            before.name === metric.name &&
            before.signature === metric.signature,
        ),
    ))
)
  throw new Error("History or clipboard output differs from the baseline");

function fixture(
  nodeCount: number,
  edgeCount: number,
  label: string,
): GraphModel {
  return {
    ...createEmptyGraphModel({ allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, order) => ({
      id: `n${order}`,
      label,
      order,
      x: order * 80,
      y: 0,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % nodeCount}`,
      target: `n${(index + 1) % nodeCount}`,
      label,
    })),
  };
}
function verifyRestoredGraph(graph: GraphModel, x: number) {
  if (
    graph.nodes.length !== 1000 ||
    graph.edges.length !== 5000 ||
    graph.nodes[0]?.x !== x
  )
    throw new Error(
      "History changed element counts or failed to restore the edit",
    );
  return graph;
}
function measure<T>(
  name: string,
  run: () => T,
  cleanup?: () => void,
  canonicalize: (value: T) => unknown = (value) => value,
) {
  for (let warmup = 0; warmup < 5; warmup += 1) {
    run();
    cleanup?.();
  }
  const times: number[] = [];
  let result!: T;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const started = performance.now();
    result = run();
    times.push(performance.now() - started);
    cleanup?.();
  }
  times.sort((a, b) => a - b);
  metrics.push({
    name,
    medianMs: times[Math.floor(iterations / 2)]!,
    maxMs: Math.max(...times),
    signature: createHash("sha256")
      .update(JSON.stringify(canonicalize(result)))
      .digest("hex"),
  });
}
function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
