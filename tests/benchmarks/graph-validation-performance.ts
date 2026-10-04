import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  parseGraphModelJson,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import { updateNodeCommand } from "../../features/graph-editor/core/graph/graph-intents";
import { isGraphText } from "../../features/graph-editor/core/graph/graph-limits";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { prepareGraphTransaction } from "../../features/graph-editor/core/graph/graph-transaction";

// Run before/after sequentially, without concurrent builds or benchmarks.
const ITERATIONS = 15;
type Metric = {
  name: string;
  medianMs: number;
  maxMs: number;
  signature: string;
};
type Report = { iterations: number; metrics: Metric[] };
const report: Report = { iterations: ITERATIONS, metrics: [] };

for (const [name, text, count] of [
  ["short labels", "123", 10_000],
  ["256 BMP code points", "長".repeat(256), 10_000],
  ["256 astral code points", "🧭".repeat(256), 10_000],
  ["oversized label", "長".repeat(1_000_000), 1],
] as const) {
  measure(name, () => {
    let accepted = 0;
    for (let i = 0; i < count; i += 1) accepted += Number(isGraphText(text));
    return accepted;
  });
}

for (const [name, label] of [
  ["limits short labels", "node"],
  ["limits long labels", "長".repeat(256)],
] as const) {
  const graph: GraphModel = {
    ...createEmptyGraphModel({ allowMultiEdges: true }),
    nodes: Array.from({ length: 1000 }, (_, order) => ({
      id: `n${order}`,
      order,
      label,
      x: order * 80,
      y: 0,
    })),
    edges: Array.from({ length: 5000 }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % 1000}`,
      target: `n${(index + 1) % 1000}`,
      label,
    })),
  };
  const raw = serializeGraphModel(graph);
  measure(`${name} import`, () => parseGraphModelJson(raw));
  measure(`${name} transaction`, () =>
    prepareGraphTransaction(graph, updateNodeCommand("n0", { x: 17 }), 0),
  );
}

const baselinePath = argument("--baseline");
const baseline = baselinePath
  ? (JSON.parse(readFileSync(baselinePath, "utf8")) as Report)
  : undefined;
const baselineByName = new Map(
  baseline?.metrics.map((metric) => [metric.name, metric]),
);
for (const metric of report.metrics) {
  const before = baselineByName.get(metric.name);
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
const outputPath = argument("--output");
if (outputPath) writeFileSync(outputPath, JSON.stringify(report, null, 2));

function measure(name: string, run: () => unknown) {
  for (let i = 0; i < 5; i += 1) run();
  const times: number[] = [];
  let result: unknown;
  for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
    const start = performance.now();
    result = run();
    times.push(performance.now() - start);
  }
  times.sort((a, b) => a - b);
  report.metrics.push({
    name,
    medianMs: times[Math.floor(times.length / 2)]!,
    maxMs: Math.max(...times),
    signature: createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
  });
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
