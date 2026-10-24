import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { updateNodeCommand } from "../../features/graph-editor/core/graph/graph-intents";
import * as currentJson from "../../features/graph-editor/core/graph/graph-json";
import * as currentTransaction from "../../features/graph-editor/core/graph/graph-transaction";
import * as currentPatch from "../../features/graph-editor/core/graph/graph-patch";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

const root = argument("--reference-root");
if (!root) throw new Error("Pass --reference-root <unchanged source tree>");
const loadReference = (file: string) =>
  import(
    pathToFileURL(resolve(root, "features/graph-editor/core/graph", file)).href
  );
const referenceJson = (await loadReference(
  "graph-json.ts",
)) as typeof currentJson;
const referenceTransaction = (await loadReference(
  "graph-transaction.ts",
)) as typeof currentTransaction;
const referencePatch = (await loadReference(
  "graph-patch.ts",
)) as typeof currentPatch;
const report = [];
for (const [name, count, edgeCount, label, styled] of [
  ["small", 20, 30, "node", false],
  ["limits", 1000, 5000, "node", false],
  ["limits long labels", 1000, 5000, "長".repeat(256), false],
  ["limits manual routing", 1000, 5000, "node", true],
] as const) {
  const graph: GraphModel = {
    ...createEmptyGraphModel({
      directed: true,
      allowMultiEdges: true,
      weighted: styled,
    }),
    nodes: Array.from({ length: count }, (_, order) => ({
      id: `n${order}`,
      order,
      label,
      x: order * 80,
      y: 0,
      ...(styled ? { color: "blue" as const } : {}),
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % count}`,
      target: `n${(index + 1) % count}`,
      label,
      ...(styled
        ? {
            weight: "3",
            color: "red" as const,
            routing: { bowPx: (index % 360) - 180, bowT: 0.5 },
          }
        : {}),
    })),
  };
  const raw = referenceJson.serializeGraphModel(graph);
  assert.equal(currentJson.serializeGraphModel(graph), raw);
  const command = updateNodeCommand("n0", { x: 17 });
  const patch = { nodes: { put: [{ ...graph.nodes[0]!, x: 17 }] } };
  for (const [operation, reference, candidate] of [
    [
      "serialize",
      () => referenceJson.serializeGraphModel(graph),
      () => currentJson.serializeGraphModel(graph),
    ],
    [
      "transaction",
      () => referenceTransaction.prepareGraphTransaction(graph, command, 0),
      () => currentTransaction.prepareGraphTransaction(graph, command, 0),
    ],
    [
      "history patch",
      () => referencePatch.prepareGraphPatch(graph, patch),
      () => currentPatch.prepareGraphPatch(graph, patch),
    ],
  ] as const) {
    const before: number[] = [],
      after: number[] = [];
    const expected = JSON.stringify(reference());
    assert.equal(JSON.stringify(candidate()), expected, `${name} ${operation}`);
    for (let pass = 0; pass < 45; pass++) {
      const run = (callback: () => unknown, times: number[]) => {
        const start = performance.now();
        const value = callback();
        const elapsed = performance.now() - start;
        if (pass >= 10) times.push(elapsed);
        return value;
      };
      if (pass % 2 === 0) {
        run(reference, before);
        run(candidate, after);
      } else {
        run(candidate, after);
        run(reference, before);
      }
    }
    const baselineMedianMs = median(before),
      candidateMedianMs = median(after);
    report.push({
      name,
      operation,
      baselineMedianMs,
      candidateMedianMs,
      speedup: baselineMedianMs / candidateMedianMs,
      baselineP95Ms: percentile(before, 0.95),
      candidateP95Ms: percentile(after, 0.95),
      samples: after.length,
      signature: createHash("sha256").update(expected).digest("hex"),
      sameOutput: true,
    });
  }
}
console.log(JSON.stringify(report, null, 2));
const output = argument("--output");
if (output) writeFileSync(output, JSON.stringify(report, null, 2));
function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
function median(values: number[]) {
  return percentile(values, 0.5);
}
function percentile(values: number[], fraction: number) {
  const sorted = values.toSorted((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))
  ]!;
}
