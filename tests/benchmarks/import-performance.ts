import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { evaluateGraphInput as currentEvaluate } from "../../features/graph-editor/io/import-graph";
import type { ImportOptions } from "../../features/graph-editor/io/import-utils";

// Run sequentially without other benchmarks/builds. --reference accepts the
// original import-graph module with imports rebased to saved dependency modules.
const reference = argument("--reference");
const evaluate: typeof currentEvaluate = reference
  ? (await import(pathToFileURL(resolve(reference)).href)).evaluateGraphInput
  : currentEvaluate;
const iterations = 9;
type Metric = {
  name: string;
  medianMs: number;
  maxMs: number;
  signature: string;
};
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
  measure(name, JSON.stringify(model));
}

for (const size of [100, 300, 700]) {
  const input = matrix(size, (source, target) =>
    Math.abs(source - target) === 1 ? "1" : "0",
  );
  measure(`sparse matrix ${size} automatic`, input);
  measure(`sparse matrix ${size} explicit`, input, {
    format: "adjacency-matrix",
  });
}
const weighted = matrix(700, (source, target) =>
  target > source && target <= source + 5 ? "2" : "0",
);
measure("weighted directed matrix 700 automatic", weighted);
measure("weighted directed matrix 700 explicit", weighted, {
  format: "adjacency-matrix",
});
measure(
  "empty matrix 700 automatic",
  matrix(700, () => "0"),
);
measure(
  "over-edge-limit matrix 100 automatic",
  matrix(100, () => "1"),
);
measure(
  "edge list 1000/5000 automatic",
  `1000 5000\n${Array.from(
    { length: 5000 },
    (_, index) => `${index % 1000} ${(index * 71 + 1) % 1000}`,
  ).join("\n")}`,
);
measure(
  "adjacency list 1000/5000 automatic",
  Array.from(
    { length: 1000 },
    (_, source) =>
      `${source} -> ${Array.from(
        { length: 5 },
        (_entry, target) => `${(source + target + 1) % 1000}(1234567890)`,
      ).join(" ")}`,
  ).join("\n"),
);
measure("near-limit blank lines automatic", "\n".repeat(999_999));
measure("near-limit comment lines automatic", "#\n".repeat(499_999));
measure("near-limit repeated source rows automatic", "a:\n".repeat(333_333));
measure(
  "near-limit repeated adjacency targets automatic",
  "a: b c d\n".repeat(111_111),
);
measure(
  "near-limit repeated weighted adjacency targets automatic",
  "a -> b(2) c(3)\n".repeat(66_666),
);
measure(
  "near-limit repeated adjacency targets explicit",
  "a: b c d\n".repeat(111_111),
  { format: "adjacency-list" },
);
measure(
  "near-limit distinct adjacency rows automatic",
  Array.from({ length: 60_000 }, (_, index) => `n${index}: target`).join("\n"),
);
measure(
  "near-limit distinct adjacency rows explicit",
  Array.from({ length: 60_000 }, (_, index) => `n${index}: target`).join("\n"),
  { format: "adjacency-list" },
);
measure(
  "near-limit invalid single-token rows automatic",
  "a\n".repeat(499_999),
);
measure(
  "near-limit over-edge-limit short rows automatic",
  "a b\n".repeat(249_999),
);

const baselinePath = argument("--baseline");
const baseline: Metric[] = baselinePath
  ? JSON.parse(readFileSync(baselinePath, "utf8"))
  : [];
for (const metric of metrics) {
  const previous = baseline.find((candidate) => candidate.name === metric.name);
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
const output = argument("--output");
if (output) writeFileSync(output, JSON.stringify(metrics, null, 2));
if (
  baselinePath &&
  (baseline.length !== metrics.length ||
    metrics.some(
      (metric) =>
        !baseline.some(
          (previous) =>
            previous.name === metric.name &&
            previous.signature === metric.signature,
        ),
    ))
)
  throw new Error("Import output differs from the baseline");

function measure(name: string, input: string, options: ImportOptions = {}) {
  for (let warmup = 0; warmup < 3; warmup += 1) evaluate(input, options);
  const times: number[] = [];
  let result: ReturnType<typeof evaluate> | undefined;
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const started = performance.now();
    result = evaluate(input, options);
    times.push(performance.now() - started);
  }
  metrics.push({
    name,
    medianMs: times.toSorted((a, b) => a - b)[Math.floor(iterations / 2)]!,
    maxMs: Math.max(...times),
    signature: createHash("sha256")
      .update(JSON.stringify(result))
      .digest("hex"),
  });
}

function matrix(
  size: number,
  cell: (source: number, target: number) => string,
) {
  return Array.from({ length: size }, (_, source) =>
    Array.from({ length: size }, (_unusedTarget, target) =>
      cell(source, target),
    ).join(" "),
  ).join("\n");
}

function argument(flag: string) {
  const index = process.argv.indexOf(flag);
  return index < 0 ? undefined : process.argv[index + 1];
}
