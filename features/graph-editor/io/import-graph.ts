import { GRAPH_MAX_JSON_CHARS } from "../core/graph/graph-limits";
import { describeImportWarning } from "./import-warning-text";
import {
  tryImportAdjacencyList,
  tryImportAdjacencyMatrix,
} from "./import-adjacency";
import { importStructuredEdgeList } from "./import-edge-list";
import { tryImportLooseEdgeList } from "./import-loose-edge-list";
import {
  tryImportParentList,
  tryImportTreeEdgeList,
  tryImportWeightedParentList,
} from "./import-tree";
import {
  importFailure,
  importLimitFailure,
  MAX_IMPORT_INPUT_CHARS,
  type ImportOptions,
  type ParsedLine,
  readLines,
  splitTokens,
} from "./import-utils";
import { analyzeGraphInput } from "./import-analysis";
import {
  looksLikeGraphJson,
  parseGraphModelJson,
} from "../core/graph/graph-json";
import type {
  ImportAnalysis,
  ImportCandidate,
  ImportEvaluation,
  ImportFormatKind,
  ImportResult,
  ImportWarning,
} from "./import-types";

export const WEIGHTED_PARENT_LIST_AMBIGUITY_WARNING: ImportWarning = {
  code: "maybe-weighted-parent-list",
};
export const MULTIPLE_FORMATS_AMBIGUITY_WARNING: ImportWarning = {
  code: "ambiguous-formats",
};

export function importGraphInput(
  input: string,
  options: ImportOptions = {},
): ImportResult {
  return evaluateGraphInput(input, options).result;
}

function evaluateGraphInputInternal(
  input: string,
  options: ImportOptions = {},
): ImportEvaluation {
  const jsonInput =
    options.format === "json" ||
    ((options.format ?? "auto") === "auto" && looksLikeGraphJson(input));
  const inputLimit = jsonInput ? GRAPH_MAX_JSON_CHARS : MAX_IMPORT_INPUT_CHARS;
  if (input.length > inputLimit) {
    const result = importLimitFailure(
      "input",
      input.length,
      inputLimit,
      options,
    );
    return {
      analysis: analyzeGraphInput(input, options),
      result,
    };
  }

  if (jsonInput) {
    const result = importGraphJson(input, options);
    return { analysis: analyzeGraphInput(input, options), result };
  }

  const lines = readLines(input);

  if (lines.length === 0) {
    const result = importFailure({ code: "empty-input" }, options);
    return {
      analysis: analyzeGraphInput(input, options),
      result,
    };
  }

  const requestedFormat = options.format ?? "auto";
  if (requestedFormat !== "auto") {
    const result = parseRequestedFormat(input, lines, requestedFormat, options);
    return {
      analysis: analysisForRequestedFormat(requestedFormat, result),
      result,
    };
  }

  const analysis = analyzeGraphInput(input, options);
  const recommendedFormat = analysis.recommendedFormat;
  if (!recommendedFormat) {
    const warning: ImportWarning =
      analysis.diagnostics[0]?.code === "empty-input"
        ? { code: "empty-input" }
        : { code: "unsupported-format" };
    return {
      analysis,
      result: importFailure(warning, options),
    };
  }

  const detectedResult = parseRequestedFormat(
    input,
    lines,
    recommendedFormat,
    options,
  );
  const result =
    analysis.status === "ambiguous"
      ? withAmbiguityWarning(detectedResult, analysis)
      : detectedResult;

  return { analysis, result };
}

function parseRequestedFormat(
  input: string,
  lines: ParsedLine[],
  requestedFormat: ImportFormatKind,
  options: ImportOptions,
): ImportResult {
  const formatOptions = { ...options, format: requestedFormat };

  if (requestedFormat === "json") {
    return importGraphJson(input, formatOptions);
  }

  if (requestedFormat === "adjacency-matrix") {
    return (
      tryImportAdjacencyMatrix(lines, formatOptions) ??
      importFailure(
        { code: "invalid-format", formatKind: "adjacency-matrix" },
        formatOptions,
      )
    );
  }

  if (requestedFormat === "adjacency-list") {
    return (
      tryImportAdjacencyList(lines, formatOptions) ??
      importFailure(
        { code: "invalid-format", formatKind: "adjacency-list" },
        formatOptions,
      )
    );
  }

  if (requestedFormat === "contest-edge-list") {
    return importStructuredEdgeList(
      input,
      detectStructuredEdgeListOptions(lines, formatOptions),
    );
  }

  if (requestedFormat === "edge-pairs") {
    return (
      tryImportLooseEdgeList(lines, formatOptions) ??
      importFailure(
        { code: "invalid-format", formatKind: "edge-pairs" },
        formatOptions,
      )
    );
  }

  if (requestedFormat === "tree-edge-list") {
    return (
      tryImportTreeEdgeList(lines, formatOptions) ??
      importFailure(
        { code: "invalid-format", formatKind: "tree-edge-list" },
        formatOptions,
      )
    );
  }

  if (requestedFormat === "parent-list") {
    return (
      tryImportParentList(lines, formatOptions) ??
      importFailure(
        { code: "invalid-format", formatKind: "parent-list" },
        formatOptions,
      )
    );
  }

  if (requestedFormat === "weighted-parent-list") {
    return (
      tryImportWeightedParentList(lines, formatOptions) ??
      importFailure(
        { code: "invalid-format", formatKind: "weighted-parent-list" },
        formatOptions,
      )
    );
  }
  return importFailure({ code: "unsupported-format" }, formatOptions);
}

function analysisForRequestedFormat(
  requestedFormat: ImportFormatKind,
  result: ImportResult,
): ImportAnalysis {
  const hasContent =
    result.warnings.length === 0 ||
    result.model.nodes.length > 0 ||
    result.model.edges.length > 0;
  const candidate: ImportCandidate = {
    formatKind: requestedFormat,
    strength: "exact",
    evidence: evidenceForFormat(requestedFormat),
    nodeCount: result.model.nodes.length,
    edgeCount: result.model.edges.length,
  };

  return {
    status: hasContent ? "detected" : "invalid",
    recommendedFormat: hasContent ? requestedFormat : undefined,
    candidates: hasContent ? [candidate] : [],
    diagnostics: result.warnings.map((warning) => ({
      code: hasContent ? "partial-import" : "invalid-format",
      severity: hasContent ? "warning" : "error",
      message: describeImportWarning(warning),
    })),
  };
}

function withAmbiguityWarning(
  detectedResult: ImportResult,
  analysis: ImportAnalysis,
) {
  const strongest = analysis.candidates.filter(
    (candidate) => candidate.strength === analysis.candidates[0]?.strength,
  );
  const weightedParentAmbiguity =
    strongest.some(
      (candidate) => candidate.formatKind === "weighted-parent-list",
    ) &&
    strongest.some((candidate) => candidate.formatKind === "tree-edge-list");
  const warning = weightedParentAmbiguity
    ? WEIGHTED_PARENT_LIST_AMBIGUITY_WARNING
    : MULTIPLE_FORMATS_AMBIGUITY_WARNING;

  return {
    ...detectedResult,
    warnings: detectedResult.warnings.includes(warning)
      ? detectedResult.warnings
      : [...detectedResult.warnings, warning],
  };
}

function evidenceForFormat(format: ImportFormatKind) {
  return [
    {
      "adjacency-list": "adjacency-syntax",
      "adjacency-matrix": "square-numeric-matrix",
      "contest-edge-list": "structured-header",
      "parent-list": "parent-row",
      "weighted-parent-list": "weighted-parent-rows",
      "tree-edge-list": "tree-edge-rows",
      "edge-pairs": "edge-rows",
      json: "json-document",
    }[format],
  ] as ImportCandidate["evidence"];
}

function detectStructuredEdgeListOptions(
  lines: ParsedLine[],
  options: ImportOptions,
): ImportOptions {
  const header = splitTokens(lines[0]?.text ?? "");
  const nodeCount = Number(header[0]);
  const edgeCount = Number(header[1]);

  if (
    header.length !== 2 ||
    !Number.isInteger(nodeCount) ||
    !Number.isInteger(edgeCount) ||
    nodeCount < 0 ||
    edgeCount < 0
  ) {
    return options;
  }

  const edgeRows = lines
    .slice(1, edgeCount + 1)
    .map((line) => splitTokens(line.text));
  const hasWeightedEdgeRow = edgeRows.some((row) => row.length === 3);

  return {
    ...options,
    weighted: hasWeightedEdgeRow,
  };
}

function importGraphJson(input: string, options: ImportOptions): ImportResult {
  const model = parseGraphModelJson(input);

  if (!model) {
    return importFailure(
      { code: "invalid-format", formatKind: "json" },
      { ...options, format: "json" },
    );
  }

  return { model, warnings: [], formatKind: "json", format: "JSON" };
}

export function evaluateGraphInput(
  input: string,
  options: ImportOptions = {},
): ImportEvaluation {
  const evaluation = evaluateGraphInputInternal(input, options);
  const { result, analysis } = evaluation;
  const empty =
    result.model.nodes.length === 0 && result.model.edges.length === 0;
  const status =
    analysis.status === "invalid" ||
    analysis.status === "limit" ||
    (empty && result.warnings.length > 0)
      ? "failure"
      : result.warnings.length > 0
        ? "partial"
        : empty
          ? "empty"
          : "success";
  return { ...evaluation, result: { ...result, status } };
}
