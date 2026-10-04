import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { evaluateGraphInput } from "../../features/graph-editor/io/import-graph";

// Run each version separately on the same machine, without other benchmarks.
// bun tests/benchmarks/import-performance.ts --output /tmp/import-before.json
// bun tests/benchmarks/import-performance.ts --baseline /tmp/import-before.json
const baselinePath = argument("--baseline");
type Metric = { name: string; medianMs: number; signature: string };
const baseline = baselinePath
  ? (JSON.parse(readFileSync(baselinePath, "utf8")) as Metric[])
  : [];
const metrics: Metric[] = [];
for (const [name, nodeCount, edgeCount] of [
  ["small JSON", 20, 30],
  ["limits JSON", 1000, 5000],
] as const) {
  const model = {
    ...createEmptyGraphModel({ allowMultiEdges: true }),
    nodes: Array.from({ length: nodeCount }, (_, index) => ({
      id: `n${index}`,
      label: "頂点".repeat(40),
      order: index,
      x: index * 20,
      y: 0,
    })),
    edges: Array.from({ length: edgeCount }, (_, index) => ({
      id: `e${index}`,
      source: `n${index % nodeCount}`,
      target: `n${(index + 1) % nodeCount}`,
      label: "辺".repeat(80),
    })),
  };
  const input = JSON.stringify(model);
  evaluateGraphInput(input);
  const times: number[] = [];
  let result;
  for (let iteration = 0; iteration < 9; iteration++) {
    const start = performance.now();
    result = evaluateGraphInput(input);
    times.push(performance.now() - start);
  }
  const metric = {
    name,
    medianMs: times.toSorted((a, b) => a - b)[4]!,
    signature: createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
  };
  metrics.push(metric);
  const previous = baseline.find((value) => value.name === name);
  console.log(
    JSON.stringify({
      ...metric,
      ...(previous
        ? {
            previousMedianMs: previous.medianMs,
            speedup: previous.medianMs / metric.medianMs,
            sameOutput: previous.signature === metric.signature,
          }
        : {}),
    }),
  );
}
const outputPath = argument("--output");
if (outputPath) writeFileSync(outputPath, JSON.stringify(metrics, null, 2));

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
