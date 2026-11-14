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
  readLines,
} from "./import-utils";
import {
  analyzeGraphInput,
  analyzeGraphJsonModel,
  analyzeGraphSource,
} from "./import-analysis";
import {
  createImportSource,
  inferEdgeListWeightKind,
  isStructuredEdgeListHeader,
  type ImportSource,
} from "./import-source";
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
import type { GraphModel } from "../core/graph/model";

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
  options: ImportOptions,
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
    const model = parseGraphModelJson(input);
    const result = importGraphJson(model, options);
    return {
      analysis: analyzeGraphJsonModel(model),
      result,
    };
  }

  const source = createImportSource(readLines(input));

  if (source.lines.length === 0) {
    const result = importFailure({ code: "empty-input" }, options);
    return {
      analysis: analyzeGraphSource(source, options),
      result,
    };
  }

  const requestedFormat = options.format ?? "auto";
  if (requestedFormat !== "auto") {
    const result = parseRequestedFormat(source, requestedFormat, options);
    return {
      analysis: analysisForRequestedFormat(requestedFormat, result),
      result,
    };
  }

  const analysis = analyzeGraphSource(source, options);
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
    source,
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
  source: ImportSource,
  requestedFormat: ImportFormatKind,
  options: ImportOptions,
): ImportResult {
  const formatOptions = { ...options, format: requestedFormat };
  const { lines } = source;

  if (requestedFormat === "contest-edge-list") {
    return importStructuredEdgeList(
      source,
      detectStructuredEdgeListOptions(source, formatOptions),
    );
  }

  let result: ImportResult | null;
  switch (requestedFormat) {
    case "adjacency-matrix":
      result = tryImportAdjacencyMatrix(source, formatOptions);
      break;
    case "adjacency-list":
      result = tryImportAdjacencyList(source, formatOptions);
      break;
    case "edge-pairs":
      result = tryImportLooseEdgeList(source, formatOptions);
      break;
    case "tree-edge-list":
      result = tryImportTreeEdgeList(lines, formatOptions);
      break;
    case "parent-list":
      result = tryImportParentList(lines, formatOptions);
      break;
    case "weighted-parent-list":
      result = tryImportWeightedParentList(lines, formatOptions);
      break;
    default:
      return importFailure({ code: "unsupported-format" }, formatOptions);
  }
  return (
    result ??
    importFailure(
      { code: "invalid-format", formatKind: requestedFormat },
      formatOptions,
    )
  );
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
    warnings: [...detectedResult.warnings, warning],
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
  source: ImportSource,
  options: ImportOptions,
): ImportOptions {
  const header = source.firstRow;
  const nodeCount = Number(header[0]);
  const edgeCount = Number(header[1]);

  if (
    !isStructuredEdgeListHeader(header, source.rows.slice(1)) ||
    !Number.isInteger(nodeCount) ||
    !Number.isInteger(edgeCount) ||
    nodeCount < 0 ||
    edgeCount < 0
  ) {
    return options;
  }

  const edgeRows = source.rows.slice(1, edgeCount + 1);
  const hasWeightedEdgeRow = edgeRows.some((row) => row.length === 3);

  return {
    ...options,
    weighted: hasWeightedEdgeRow,
    weightKind: inferEdgeListWeightKind(edgeRows, options.weightKind),
  };
}

function importGraphJson(
  model: GraphModel | null,
  options: ImportOptions,
): ImportResult {
  if (!model) {
    return importFailure(
      { code: "invalid-format", formatKind: "json" },
      { ...options, format: "json" },
      "JSON",
      "json",
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
