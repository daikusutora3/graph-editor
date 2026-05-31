import {
  tryImportAdjacencyList,
  tryImportAdjacencyMatrix,
} from "./import-adjacency";
import { importStructuredEdgeList } from "./import-edge-list";
import { tryImportLooseEdgeList } from "./import-loose-edge-list";
import {
  importFailure,
  importLimitFailure,
  MAX_IMPORT_INPUT_CHARS,
  type ImportOptions,
  type ParsedLine,
  readLines,
  splitTokens,
} from "./import-utils";
import type { ImportResult } from "./import-types";

type ImportParser = {
  parse: () => ImportResult | null;
};

export function importGraphInput(
  input: string,
  options: ImportOptions = {},
): ImportResult {
  if (input.length > MAX_IMPORT_INPUT_CHARS) {
    return importLimitFailure(
      "input",
      input.length,
      MAX_IMPORT_INPUT_CHARS,
      options,
    );
  }

  const lines = readLines(input);

  if (lines.length === 0) {
    return importFailure("Empty input.", options);
  }

  const requestedFormat = options.format ?? "auto";

  if (requestedFormat === "adjacency-matrix") {
    return (
      tryImportAdjacencyMatrix(lines, options) ??
      importFailure("Input is not a valid adjacency matrix.", options)
    );
  }

  if (requestedFormat === "adjacency-list") {
    return (
      tryImportAdjacencyList(lines, options) ??
      importFailure("Input is not a valid adjacency list.", options)
    );
  }

  if (requestedFormat === "contest-edge-list") {
    return importStructuredEdgeList(
      input,
      detectStructuredEdgeListOptions(lines, options),
    );
  }

  if (requestedFormat === "edge-pairs") {
    return (
      tryImportLooseEdgeList(lines, options) ??
      importFailure("Input is not a valid edge pair list.", options)
    );
  }

  const detectedResult = parseFirst([
    { parse: () => tryImportAdjacencyMatrix(lines, options) },
    { parse: () => tryImportAdjacencyList(lines, options) },
  ]);

  if (detectedResult) return detectedResult;

  const structuredEdgeListResult = importStructuredEdgeList(
    input,
    detectStructuredEdgeListOptions(lines, options),
  );
  if (shouldKeepStructuredEdgeList(structuredEdgeListResult, lines)) {
    return structuredEdgeListResult;
  }

  const edgeListResult = tryImportLooseEdgeList(lines, options);
  if (edgeListResult) {
    return edgeListResult;
  }

  return {
    ...structuredEdgeListResult,
    format: undefined,
  };
}

function parseFirst(parsers: ImportParser[]) {
  for (const parser of parsers) {
    const result = parser.parse();

    if (result) {
      return result;
    }
  }

  return null;
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

function shouldKeepStructuredEdgeList(
  result: ImportResult,
  lines: ParsedLine[],
) {
  if (hasImportLimitWarning(result)) {
    return true;
  }

  const header = readStructuredHeader(lines);
  if (!header) {
    return false;
  }

  const hasContent =
    result.model.nodes.length > 0 || result.model.edges.length > 0;

  if (
    result.warnings.length === 0 &&
    header.nodeCount > 0 &&
    header.edgeCount === 0
  ) {
    return true;
  }

  if (
    result.warnings.length === 0 &&
    header.nodeCount === 0 &&
    header.edgeCount === 0 &&
    lines.length === 1
  ) {
    return false;
  }

  if (result.warnings.length === 0) {
    return hasContent;
  }

  if (lines.length === 1 && header.edgeCount > 0) {
    return false;
  }

  return hasContent && structuredHeaderEndpointsLookPlausible(lines, header);
}

function hasImportLimitWarning(result: ImportResult) {
  return result.warnings.some((warning) =>
    warning.startsWith("Import is too large"),
  );
}

function readStructuredHeader(lines: ParsedLine[]) {
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
    return null;
  }

  return { nodeCount, edgeCount };
}

function structuredHeaderEndpointsLookPlausible(
  lines: ParsedLine[],
  header: { nodeCount: number; edgeCount: number },
) {
  const endpoints = lines
    .slice(1, header.edgeCount + 1)
    .flatMap((line) => splitTokens(line.text).slice(0, 2).map(Number))
    .filter((value) => Number.isInteger(value));

  if (endpoints.length === 0) {
    return header.edgeCount === 0;
  }

  return (
    endpoints.every((value) => value >= 0 && value < header.nodeCount) ||
    endpoints.every((value) => value >= 1 && value <= header.nodeCount)
  );
}
