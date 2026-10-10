import assert from "node:assert/strict";
import { createStore } from "jotai";

import { GRAPH_MAX_TEXT_CODE_POINTS } from "../../features/graph-editor/core/graph/graph-limits";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import { replaceModelCommand } from "../../features/graph-editor/core/graph/graph-intents";
import { formatImportWarning } from "../../features/graph-editor/i18n/import-warning-messages";
import { SUPPORTED_LOCALES } from "../../features/graph-editor/i18n/locale";
import { tryImportAdjacencyList } from "../../features/graph-editor/io/import-adjacency";
import { importStructuredEdgeList } from "../../features/graph-editor/io/import-edge-list";
import { evaluateGraphInput } from "../../features/graph-editor/io/import-graph";
import { tryImportLooseEdgeList } from "../../features/graph-editor/io/import-loose-edge-list";
import { createImportSource } from "../../features/graph-editor/io/import-source";
import { tryImportWeightedParentList } from "../../features/graph-editor/io/import-tree";
import type {
  ImportFormatKind,
  ImportResult,
} from "../../features/graph-editor/io/import-types";
import {
  readLines,
  type ImportOptions,
} from "../../features/graph-editor/io/import-utils";
import { executeCommandAtom } from "../../features/graph-editor/shell/state/history-atoms";
import {
  canApplyStarterInput,
  getStarterInputStatus,
} from "../../features/graph-editor/workflows/starter/starter-input-status";

const fixtures: {
  name: string;
  format: ImportFormatKind;
  field: "node-label" | "edge-weight";
  line: number;
  input: (text: string) => string;
  direct: (input: string, options: ImportOptions) => ImportResult | null;
}[] = [
  {
    name: "contest weight",
    format: "contest-edge-list",
    field: "edge-weight",
    line: 4,
    input: (text) => `# comment\n\n2 1\n0 1 ${text}`,
    direct: importStructuredEdgeList,
  },
  {
    name: "edge-pair source",
    format: "edge-pairs",
    field: "node-label",
    line: 3,
    input: (text) => `# comment\n\n${text} b`,
    direct: (input, options) =>
      tryImportLooseEdgeList(readLines(input), options),
  },
  {
    name: "edge-pair target",
    format: "edge-pairs",
    field: "node-label",
    line: 3,
    input: (text) => `# comment\n\na ${text}`,
    direct: (input, options) =>
      tryImportLooseEdgeList(readLines(input), options),
  },
  {
    name: "edge-pair weight",
    format: "edge-pairs",
    field: "edge-weight",
    line: 3,
    input: (text) => `# comment\n\na b ${text}`,
    direct: (input, options) =>
      tryImportLooseEdgeList(readLines(input), options),
  },
  {
    name: "adjacency source",
    format: "adjacency-list",
    field: "node-label",
    line: 3,
    input: (text) => `# comment\n\n${text}: b`,
    direct: (input, options) =>
      tryImportAdjacencyList(readLines(input), options),
  },
  {
    name: "adjacency target",
    format: "adjacency-list",
    field: "node-label",
    line: 3,
    input: (text) => `# comment\n\na: ${text}`,
    direct: (input, options) =>
      tryImportAdjacencyList(readLines(input), options),
  },
  {
    name: "adjacency weight",
    format: "adjacency-list",
    field: "edge-weight",
    line: 3,
    input: (text) => `# comment\n\na: b(${text})`,
    direct: (input, options) =>
      tryImportAdjacencyList(readLines(input), options),
  },
  {
    name: "weighted parent weight",
    format: "weighted-parent-list",
    field: "edge-weight",
    line: 4,
    input: (text) => `# comment\n\n2\n0 ${text}`,
    direct: (input, options) =>
      tryImportWeightedParentList(readLines(input), options),
  },
];

let evaluations = 0;
for (const unit of ["x", "界", "😀", "e\u0301", "\ud800"]) {
  const valid = unit.repeat(GRAPH_MAX_TEXT_CODE_POINTS / [...unit].length);
  const rejected = valid + "x";
  for (const fixture of fixtures) {
    const formats =
      fixture.format === "weighted-parent-list"
        ? [fixture.format]
        : ([fixture.format, "auto"] as const);
    for (const format of formats) {
      const options: ImportOptions = {
        format,
        weighted: true,
        weightKind: "string",
        indexBase: 0,
      };
      for (const text of [valid, rejected]) {
        const input = fixture.input(text);
        const evaluation = evaluateGraphInput(input, options);
        evaluations++;
        const status = getStarterInputStatus({
          inputText: input,
          fileReadState: { status: "idle" },
          previewPending: false,
          analysis: evaluation.analysis,
          preview: evaluation.result,
          visibleIssues: evaluation.result.warnings,
        });
        if (text === valid) {
          assert.equal(evaluation.result.status, "success", fixture.name);
          assert.equal(status, "ready");
          assert.doesNotThrow(() =>
            serializeGraphModel(evaluation.result.model),
          );
          const store = createStore();
          assert.equal(
            store.set(
              executeCommandAtom,
              replaceModelCommand(evaluation.result.model),
            ).status,
            "applied",
          );
          assert(
            evaluation.result.model.nodes.some(
              (node) => node.label === valid,
            ) ||
              evaluation.result.model.edges.some(
                (edge) => edge.weight === valid,
              ),
            "full text is retained",
          );
        } else {
          assert.equal(evaluation.result.status, "failure", fixture.name);
          assert.equal(status, "review");
          assert.equal(canApplyStarterInput(status), false);
          assert.deepEqual(
            evaluation.result.model.nodes,
            [],
            "reject whole input rather than silently dropping a field/edge",
          );
          assert.deepEqual(evaluation.result.model.edges, []);
          const expected = {
            code: "text-too-long",
            field: fixture.field,
            line: fixture.line,
            count: 257,
            limit: 256,
          };
          assert.deepEqual(evaluation.result.warnings[0], expected);
          for (const locale of SUPPORTED_LOCALES) {
            const message = formatImportWarning(
              evaluation.result.warnings[0]!,
              locale,
            );
            assert(
              message.includes(String(fixture.line)) &&
                message.includes("257") &&
                message.includes("256"),
              "localized warning identifies line and text limit",
            );
          }
        }
        const direct = fixture.direct(input, {
          ...options,
          format: fixture.format,
        });
        assert(direct);
        assert.deepEqual(
          direct.model,
          evaluation.result.model,
          "direct parser shares the same contract",
        );
        assert.deepEqual(direct.warnings, evaluation.result.warnings);
      }
    }
  }
}

// Valid adjacency syntax includes parentheses and separators beyond the field
// budget. Validate the decoded field, including reused rows, without truncation.
for (const length of [256, 257]) {
  const text = "😀".repeat(length);
  const input = `a: b(${text})\na: b(${text})`;
  const lines = readLines(input);
  const source = createImportSource(lines);
  const options: ImportOptions = {
    format: "adjacency-list",
    weightKind: "string",
    directed: true,
  };
  const first = tryImportAdjacencyList(lines, options, source);
  const second = tryImportAdjacencyList(lines, options, source);
  assert.deepEqual(
    first,
    second,
    "reusing parsed rows cannot bypass text validation",
  );
  assert.equal(first?.warnings.length, length === 256 ? 0 : 1);
  if (length === 256) assert.equal(first?.model.edges.length, 2);
}

// A malformed later field rejects an otherwise valid prefix atomically.
const partial = evaluateGraphInput(`a b valid\nb c ${"x".repeat(257)}`, {
  format: "edge-pairs",
});
assert.equal(partial.result.status, "failure");
assert.deepEqual(partial.result.model.edges, []);
assert.equal(partial.result.warnings[0]?.code, "text-too-long");

// Partial-import warnings must not mask a weight limit in an ignored row.
for (const input of [
  `2 2\n0 1 good\n0 9 ${"x".repeat(257)}`,
  `2 1\n0 1 good\n0 1 ${"x".repeat(257)}`,
  `2 2\n0 1 good\n0 1 ${"x".repeat(257)} extra`,
]) {
  const options: ImportOptions = {
    format: "contest-edge-list",
    weighted: true,
    weightKind: "string",
  };
  const evaluation = evaluateGraphInput(input, options);
  assert.equal(evaluation.result.status, "failure");
  assert.deepEqual(evaluation.result.model.nodes, []);
  assert.deepEqual(evaluation.result.model.edges, []);
  assert.deepEqual(evaluation.result.warnings[0], {
    code: "text-too-long",
    field: "edge-weight",
    line: 3,
    count: 257,
    limit: 256,
  });
  assert.deepEqual(
    importStructuredEdgeList(input, options).warnings,
    evaluation.result.warnings,
  );
  const validPartial = evaluateGraphInput(
    input.replace("x".repeat(257), "short"),
    options,
  );
  assert.equal(
    validPartial.result.status,
    "partial",
    "ordinary partial-import guidance is retained",
  );
  assert.equal(validPartial.result.model.edges.length, 1);
}
console.log(
  `Import text contract verification passed (${evaluations} evaluations, Unicode boundaries, direct parsers and localized guidance)`,
);
