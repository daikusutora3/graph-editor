import {
  tryImportAdjacencyList,
  tryImportAdjacencyMatrix,
} from "./import-adjacency";
import { importStructuredEdgeList } from "./import-edge-list";
import { tryImportJson } from "./import-json";
import { tryImportLooseEdgeList } from "./import-loose-edge-list";
import {
  importFailure,
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
  const lines = readLines(input);

  if (lines.length === 0) {
    return importFailure("Empty input.", options);
  }

  const detectedResult = parseFirst([
    { parse: () => tryImportJson(input, options) },
    { parse: () => tryImportAdjacencyMatrix(lines, options) },
    { parse: () => tryImportAdjacencyList(lines, options) },
  ]);

  if (detectedResult) return detectedResult;

  const structuredEdgeListResult = importStructuredEdgeList(
    input,
    detectStructuredEdgeListOptions(lines, options),
  );
  if (
    structuredEdgeListResult.model.nodes.length > 0 ||
    structuredEdgeListResult.model.edges.length > 0 ||
    structuredEdgeListResult.warnings.length === 0
  ) {
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
  const hasThreeColumnEdges =
    edgeRows.length > 0 && edgeRows.every((row) => row.length === 3);

  return {
    ...options,
    weighted: hasThreeColumnEdges,
  };
}
