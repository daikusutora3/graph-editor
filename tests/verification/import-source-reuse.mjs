import { mock } from "bun:test";
import * as importUtils from "../../features/graph-editor/io/import-utils";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Structured import source reuse");
const readOriginalLines = importUtils.readLines;
const readOriginalTokens = importUtils.splitTokens;
let lineReads = 0;
let tokenReads = 0;
mock.module("../../features/graph-editor/io/import-utils", () => ({
  ...importUtils,
  readLines(input) {
    lineReads += 1;
    return readOriginalLines(input);
  },
  splitTokens(input) {
    tokenReads += 1;
    return readOriginalTokens(input);
  },
}));
const { evaluateGraphInput } =
  await import("../../features/graph-editor/io/import-graph");
const { createImportSource } =
  await import("../../features/graph-editor/io/import-source");
const { importStructuredEdgeList } =
  await import("../../features/graph-editor/io/import-edge-list");
const largeInput = `1000 5000\n${Array.from(
  { length: 5000 },
  (_, index) =>
    `${index % 1000} ${(index * 71 + 1) % 1000} ${(index % 17) + 1}`,
).join("\n")}`;

for (const format of ["auto", "contest-edge-list"]) {
  lineReads = 0;
  tokenReads = 0;
  const { result, analysis } = evaluateGraphInput(largeInput, {
    format,
    indexBase: 0,
  });
  expect(
    result.status === "success" &&
      analysis.recommendedFormat === "contest-edge-list" &&
      result.model.nodes.length === 1000 &&
      result.model.edges.length === 5000 &&
      result.model.settings.weighted &&
      result.model.edges[4999]?.weight === String((4999 % 17) + 1),
    `${format}: shared parsing preserves the complete near-limit weighted graph`,
  );
  expect(
    lineReads === 1 && tokenReads === 5001,
    `${format}: one evaluation reads input lines once and tokenizes each row once (actual ${lineReads}/${tokenReads})`,
  );
}

const partialInput = "3 3\n# skipped comment\n0 1 8\n1 2\n0 4 5\n2 0 9\n";
const partialOptions = { weighted: true, indexBase: 0 };
const source = createImportSource(readOriginalLines(partialInput));

void source.rows;
lineReads = 0;
tokenReads = 0;
const prepared = importStructuredEdgeList(partialInput, partialOptions, source);
expect(
  lineReads === 0 && tokenReads === 0,
  "a prepared source requires no second line/token scan",
);
expect(
  JSON.stringify(prepared) ===
    JSON.stringify(importStructuredEdgeList(partialInput, partialOptions)) &&
    JSON.stringify(prepared.warnings) ===
      JSON.stringify([
        { code: "extra-edge-lines", count: 1 },
        {
          code: "expected-integers",
          line: 4,
          expected: 3,
          shape: "u v w",
          got: 2,
        },
        {
          code: "node-out-of-range",
          line: 5,
          source: "0",
          target: "4",
          min: 0,
          max: 2,
        },
      ]) &&
    prepared.model.edges.length === 1,
  "prepared parsing retains partial-import diagnostics and physical line numbers",
);

const invalidWeightInput = `2 1\n0 1 3\n0 1 ${"界".repeat(257)}`;
const invalidSource = createImportSource(readOriginalLines(invalidWeightInput));
const rejected = importStructuredEdgeList(
  invalidWeightInput,
  partialOptions,
  invalidSource,
);
expect(
  rejected.model.nodes.length === 0 &&
    rejected.warnings[0]?.code === "text-too-long" &&
    rejected.warnings[0]?.line === 3,
  "an extra supplied row still rejects overlong weight text before partial import",
);
expect(
  importStructuredEdgeList("3,1\n0 1", { indexBase: 0 }).warnings[0]?.code ===
    "expected-header",
  "reusing general token rows does not change the structured header syntax",
);
finish();
