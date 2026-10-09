import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import { evaluateGraphInput } from "../../features/graph-editor/io/import-graph";
import type { ImportOptions } from "../../features/graph-editor/io/import-utils";

// Run without other CPU benchmarks/builds. All three paths include readLines,
// format detection, matrix parsing, graph creation and settings/warnings.
const flag = process.argv.indexOf("--baseline-root");
const root = flag < 0 ? undefined : process.argv[flag + 1];
if (!root) throw new Error("Provide the saved pre-change --baseline-root");
const baseline: typeof evaluateGraphInput = (
  await import(
    pathToFileURL(resolve(root, "features/graph-editor/io/import-graph.ts"))
      .href
  )
).evaluateGraphInput;
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));

const fixtures: { name: string; input: string; options?: ImportOptions }[] = [];
for (const size of [32, 127, 128, 300, 700]) {
  const input = matrix(size, (source, target) =>
    Math.abs(source - target) === 1 ? "1" : "0",
  );
  fixtures.push({ name: `sparse ${size} auto`, input });
  fixtures.push({
    name: `sparse ${size} explicit`,
    input,
    options: { format: "adjacency-matrix" },
  });
}
for (const [name, input] of [
  [
    "weighted directed 700",
    matrix(700, (source, target) =>
      target > source && target <= source + 5 ? "2" : "0",
    ),
  ],
  ["empty 700", matrix(700, () => "0")],
  ["over edge limit 128", matrix(128, () => "1")],
  [
    "decimal fallback 300",
    matrix(300, (source, target) =>
      Math.abs(source - target) === 1 ? "1.25" : "0",
    ),
  ],
  [
    "late decimal fallback 700",
    matrix(700, (source, target) =>
      source === 699 && target === 699 ? "1.25" : "0",
    ),
  ],
] as const) {
  fixtures.push({ name: `${name} auto`, input });
  fixtures.push({
    name: `${name} explicit`,
    input,
    options: { format: "adjacency-matrix" },
  });
}
fixtures.push({
  name: "edge list 1000/5000 auto",
  input: `1000 5000\n${Array.from(
    { length: 5000 },
    (_, index) => `${index % 1000} ${(index * 71 + 1) % 1000}`,
  ).join("\n")}`,
});

for (const { name, input, options = {} } of fixtures) {
  const paths = [
    () => baseline(input, options),
    () => withRustKernelSuppressed(() => evaluateGraphInput(input, options)),
    () => evaluateGraphInput(input, options),
  ];
  const times: number[][] = [[], [], []];
  let expected: string | undefined;
  for (let pass = 0; pass < 12; pass++) {
    const order = pass % 2 ? [2, 1, 0] : [0, 1, 2];
    for (const index of order) {
      const started = performance.now();
      const result = paths[index]!();
      const elapsed = performance.now() - started;
      const signature = createHash("sha256")
        .update(JSON.stringify(result))
        .digest("hex");
      expected ??= signature;
      if (signature !== expected)
        throw new Error(`${name}: output differs for path ${index}`);
      if (pass >= 5) times[index]!.push(elapsed);
    }
  }
  const [baselineMs, jsFallbackMs, rustMs] = times.map(
    (values) => values.toSorted((a, b) => a - b)[3]!,
  );
  console.log(
    JSON.stringify({
      name,
      baselineMs,
      jsFallbackMs,
      rustMs,
      totalSpeedup: baselineMs! / rustMs!,
      rustOverJsFallback: jsFallbackMs! / rustMs!,
      sameOutput: true,
      signature: expected,
    }),
  );
}

function matrix(
  size: number,
  cell: (source: number, target: number) => string,
) {
  return Array.from({ length: size }, (_, source) =>
    Array.from({ length: size }, (_cell, target) => cell(source, target)).join(
      " ",
    ),
  ).join("\n");
}
