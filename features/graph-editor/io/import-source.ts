import { readRustNumericMatrix } from "../compute/wasm-import";
import type { NumericImportMatrix } from "./import-types";
import {
  MAX_IMPORT_NODES,
  type ImportOptions,
  type ParsedLine,
  splitTokens,
} from "./import-utils";

type AdjacencyRow = {
  separator: string;
  sourceLabel: string;
  targetTokens: string[];

  lastScan: object | undefined;
};

export function createImportSource(lines: ParsedLine[]) {
  let firstRow: string[] | undefined;
  let rows: string[][] | undefined;
  let matrix: NumericImportMatrix | null | undefined;
  const adjacencyRows = new Map<string, AdjacencyRow | null>();
  let previousAdjacencyText: string | undefined;
  let previousAdjacencyRow: AdjacencyRow | null = null;
  const readFirstRow = () => (firstRow ??= splitTokens(lines[0]?.text ?? ""));
  const readRows = () =>
    (rows ??= lines.map((line, index) =>
      index === 0 ? readFirstRow() : splitTokens(line.text),
    ));
  return {
    lines,
    readAdjacencyRow(text: string) {
      if (text === previousAdjacencyText) return previousAdjacencyRow;
      let row = adjacencyRows.get(text);
      if (row === undefined) {
        row = readAdjacencyRow(text);

        if (adjacencyRows.size < MAX_IMPORT_NODES) adjacencyRows.set(text, row);
      }
      previousAdjacencyText = text;
      previousAdjacencyRow = row;
      return row;
    },
    get firstRow() {
      return readFirstRow();
    },
    get rows() {
      return readRows();
    },
    get matrix() {
      if (matrix === undefined)
        matrix = readRustNumericMatrix(lines) ?? readNumericMatrix(readRows());
      return matrix;
    },
  };
}

export type ImportSource = ReturnType<typeof createImportSource>;

export function isStructuredEdgeListHeader(
  header: string[],
  dataRows: string[][],
) {
  if (header.length === 2) return true;
  return (
    header.length === 3 &&
    header.every((token) => /^\d+$/.test(token)) &&
    dataRows.length === Number(header[1]) &&
    dataRows.length > 0 &&
    dataRows.every((row) => row.length === 3) &&
    dataRows.some((row) => !Number.isFinite(Number(row[2])))
  );
}

export function inferEdgeListWeightKind(
  rows: string[][],
  fallback: ImportOptions["weightKind"],
) {
  return rows.some(
    (row) => row[2] !== undefined && !Number.isFinite(Number(row[2])),
  )
    ? "string"
    : fallback;
}

function readAdjacencyRow(text: string): AdjacencyRow | null {
  const separator = text.match(/->|:/)?.[0];
  if (separator === undefined) return null;
  const separatorIndex = text.indexOf(separator);
  const targetTokens = splitTokens(
    text.slice(separatorIndex + separator.length),
  );

  if (
    targetTokens.some(
      (token) =>
        /->|:/.test(token) && /->|:/.test(parseAdjacencyTarget(token).label),
    )
  )
    return null;
  return {
    separator,
    sourceLabel: text.slice(0, separatorIndex).trim(),
    targetTokens,
    lastScan: undefined,
  };
}

export function parseAdjacencyTarget(token: string) {
  const weightedMatch = token.match(/^(.+)\(([^()]*)\)$/);
  if (!weightedMatch) return { label: token, weight: undefined };
  const [, label = "", weight = ""] = weightedMatch;
  return { label: label.trim(), weight: weight.trim() || "1" };
}

function readNumericMatrix(rows: string[][]): NumericImportMatrix | null {
  const size = rows.length;
  if (size < 1 || rows.some((row) => row.length !== size)) return null;
  const values: number[][] = [];
  let isSymmetric = true;
  let hasZeroValue = false;
  let hasWeightedValue = false;
  let directedEdgeCount = 0;
  let undirectedEdgeCount = 0;
  for (let source = 0; source < size; source += 1) {
    const row = rows[source]!;
    const numericRow: number[] = [];
    for (let target = 0; target < size; target += 1) {
      const value = Number(row[target]);
      if (!Number.isFinite(value)) return null;
      numericRow.push(value);
      if (target < source && value !== values[target]?.[source])
        isSymmetric = false;
      if (value === 0) {
        hasZeroValue = true;
      } else {
        directedEdgeCount += 1;
        if (target >= source) undirectedEdgeCount += 1;
        if (value !== 1) hasWeightedValue = true;
      }
    }
    values.push(numericRow);
  }
  return {
    size,
    values,
    isBinary: !hasWeightedValue,
    isSymmetric,
    hasZeroValue,
    hasWeightedValue,
    directedEdgeCount,
    undirectedEdgeCount,
  };
}
