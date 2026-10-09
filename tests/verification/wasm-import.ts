import { readFileSync } from "node:fs";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  withRustKernelSuppressed,
} from "../../features/graph-editor/compute/rust-kernel";
import {
  readRustNumericMatrix,
  type NumericImportMatrix,
} from "../../features/graph-editor/compute/wasm-import";
import { evaluateGraphInput } from "../../features/graph-editor/io/import-graph";
import { createImportSource } from "../../features/graph-editor/io/import-source";
import {
  MAX_IMPORT_EDGES,
  type ImportOptions,
  readLines,
  splitTokens,
} from "../../features/graph-editor/io/import-utils";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Rust matrix import");
expect(
  readRustNumericMatrix(readLines(matrix(128, () => "0"))) === null,
  "unloaded Wasm retains the synchronous JS fallback",
);
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));

// Frozen dense reader before the Rust change. This independently checks
// Number parsing, lower-triangle comparisons, exact counts and row-major order.
function reference(input: string): NumericImportMatrix | null {
  const rows = readLines(input).map((line) => splitTokens(line.text));
  const size = rows.length;
  if (!size || rows.some((row) => row.length !== size)) return null;
  const values: number[][] = [];
  const entries: NonNullable<NumericImportMatrix["entries"]> = [];
  let isSymmetric = true;
  let hasZeroValue = false;
  let hasWeightedValue = false;
  let directedEdgeCount = 0;
  let undirectedEdgeCount = 0;
  for (let source = 0; source < size; source++) {
    const row: number[] = [];
    for (let target = 0; target < size; target++) {
      const value = Number(rows[source]![target]);
      if (!Number.isFinite(value)) return null;
      row.push(value);
      if (target < source && value !== values[target]![source])
        isSymmetric = false;
      if (value === 0) hasZeroValue = true;
      else {
        directedEdgeCount++;
        if (target >= source) undirectedEdgeCount++;
        if (value !== 1) hasWeightedValue = true;
        if (entries.length < MAX_IMPORT_EDGES * 2)
          entries.push({ source, target, value });
      }
    }
    values.push(row);
  }
  return {
    size,
    entries,
    isBinary: !hasWeightedValue,
    isSymmetric,
    hasZeroValue,
    hasWeightedValue,
    directedEdgeCount,
    undirectedEdgeCount,
  };
}

function signature(result: NumericImportMatrix | null) {
  if (!result) return "null";
  let entries = result.entries;
  if (!entries) {
    entries = [];
    outer: for (let source = 0; source < result.size; source++) {
      for (let target = 0; target < result.size; target++) {
        const value = result.values![source]![target]!;
        if (value !== 0) entries.push({ source, target, value });
        if (entries.length === MAX_IMPORT_EDGES * 2) break outer;
      }
    }
  }
  return JSON.stringify([
    result.size,
    result.isBinary,
    result.isSymmetric,
    result.hasZeroValue,
    result.hasWeightedValue,
    result.directedEdgeCount,
    result.undirectedEdgeCount,
    entries,
  ]);
}

function matrix(
  size: number,
  cell: (source: number, target: number) => string,
  separator = " ",
) {
  return Array.from({ length: size }, (_, source) =>
    Array.from({ length: size }, (_cell, target) => cell(source, target)).join(
      separator,
    ),
  ).join("\n");
}

let fixtures = 0;
let fastPaths = 0;
function check(name: string, input: string, fast: boolean) {
  fixtures++;
  const lines = readLines(input);
  const direct = readRustNumericMatrix(lines);
  if (direct) fastPaths++;
  expect(Boolean(direct) === fast, `${name}: intended Rust/fallback selection`);
  const expected = signature(reference(input));
  const actual = signature(createImportSource(lines).matrix);
  const js = signature(
    withRustKernelSuppressed(() => createImportSource(lines).matrix),
  );
  expect(actual === expected, `${name}: actual matches frozen matrix reader`);
  expect(js === expected, `${name}: JS fallback matches frozen matrix reader`);
  if (direct)
    expect(
      signature(direct) === expected,
      `${name}: Rust matches frozen reader`,
    );
  for (const options of [
    {},
    { directed: true, weighted: true, indexBase: 0 },
    { format: "adjacency-matrix" },
    { format: "adjacency-matrix", weighted: true },
  ] as ImportOptions[]) {
    const before = withRustKernelSuppressed(() =>
      evaluateGraphInput(input, options),
    );
    expect(
      JSON.stringify(evaluateGraphInput(input, options)) ===
        JSON.stringify(before),
      `${name}: complete evaluation ${JSON.stringify(options)} agrees`,
    );
  }
}

for (const size of [2, 3, 127, 128, 200, 700]) {
  check(
    `symmetric sparse ${size}`,
    matrix(size, (source, target) =>
      Math.abs(source - target) === 1 ? "1" : "0",
    ),
    size >= 128,
  );
}
check(
  "all-zero",
  matrix(128, () => "0"),
  true,
);
check(
  "all-one over edge limit",
  matrix(128, () => "1"),
  true,
);
check(
  "all-negative over edge limit",
  matrix(128, () => "-2"),
  true,
);
check(
  "signed safe integers and separators",
  matrix(
    128,
    (source, target) =>
      source === target
        ? "-0"
        : target === source + 1
          ? source % 2
            ? "-9007199254740991"
            : "+000001"
          : "0",
    ",\t\v\f",
  ),
  true,
);
check(
  "comments and CRLF",
  matrix(128, (source, target) => (source === target ? "2" : "0"))
    .split("\n")
    .map((row, index) => `${row} ${index % 2 ? "# comment" : "// comment"}\r`)
    .join("\n"),
  true,
);
for (const token of [
  "1.5",
  "1.0",
  "1e0",
  "1e-300",
  "0x10",
  "0b10",
  "0o10",
  "9007199254740992",
  "NaN",
  "Infinity",
  "-Infinity",
  "--1",
  "+",
  "1_000",
  "日本語",
]) {
  check(
    `unsupported token ${token}`,
    matrix(128, (source, target) =>
      source === 0 && target === 127 ? token : "0",
    ),
    false,
  );
}
for (const separator of ["\u00a0", "\u2003", "\ufeff"]) {
  check(
    `Unicode separator ${separator.charCodeAt(0).toString(16)}`,
    matrix(128, (source, target) => (source === target ? "1" : "0"), separator),
    false,
  );
}
check(
  "unsupported decimal after full integer prefix",
  matrix(128, (source, target) =>
    source === 127 && target === 127 ? "1.25" : "0",
  ),
  false,
);
check(
  "last row too short",
  `${matrix(127, () => "0")}\n${"0 ".repeat(126)}0`,
  false,
);
check("last row too long", `${matrix(128, () => "0")} 0`, false);
check(
  "weighted three-by-three ambiguous edge pairs",
  "10 11 2\n12 13 3\n14 15 4",
  false,
);
expect(
  readRustNumericMatrix([
    ...readLines(matrix(128, () => "0")).slice(0, 127),
    { number: 128, text: "0\n".repeat(128) },
  ]) === null,
  "embedded row newline retains the JS ParsedLine contract",
);

// Symmetric 10,000 nonzero cells still represent exactly 5,000 allowed edges.
const allowed = matrix(128, (source, target) => {
  if (source === target) return "0";
  let rank = 0;
  const low = Math.min(source, target);
  const high = Math.max(source, target);
  for (let row = 0; row < low; row++) rank += 127 - row;
  rank += high - low - 1;
  return rank < MAX_IMPORT_EDGES ? "1" : "0";
});
check("exact symmetric edge storage cap", allowed, true);
expect(
  evaluateGraphInput(allowed, { format: "adjacency-matrix" }).result.model.edges
    .length === MAX_IMPORT_EDGES,
  "all allowed upper-triangle edges survive the stored-entry capacity",
);

expect(
  performance.getEntriesByName("graph-compute:import:wasm").length === 1,
  "successful imports retain at most one input-free runtime marker",
);
finish(`Rust matrix import passed (${fixtures} fixtures; ${fastPaths} Rust)`);
