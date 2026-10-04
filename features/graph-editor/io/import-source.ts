import { MAX_IMPORT_NODES, type ParsedLine, splitTokens } from "./import-utils";

type AdjacencyRow = {
  separator: string;
  sourceLabel: string;
  targetTokens: string[];
};

type NumericMatrix = {
  values: number[][];
  isBinary: boolean;
  isSymmetric: boolean;
  hasZeroValue: boolean;
  hasWeightedValue: boolean;
  directedEdgeCount: number;
  undirectedEdgeCount: number;
};

/** One evaluation owns these parsed rows; analysis and import share its matrix. */
export function createImportSource(lines: ParsedLine[]) {
  let firstRow: string[] | undefined;
  let rows: string[][] | undefined;
  let matrix: NumericMatrix | null | undefined;
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
        // Keep repeated rows cheap while bounding per-evaluation cache entries.
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
      if (matrix === undefined) matrix = readNumericMatrix(readRows());
      return matrix;
    },
  };
}

export type ImportSource = ReturnType<typeof createImportSource>;

function readAdjacencyRow(text: string): AdjacencyRow | null {
  const separators = text.match(/->|:/g);
  const separator = separators?.[0];
  if (separators?.length !== 1 || separator === undefined) return null;
  const separatorIndex = text.indexOf(separator);
  return {
    separator,
    sourceLabel: text.slice(0, separatorIndex).trim(),
    targetTokens: splitTokens(text.slice(separatorIndex + separator.length)),
  };
}

function readNumericMatrix(rows: string[][]): NumericMatrix | null {
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
    values,
    isBinary: !hasWeightedValue,
    isSymmetric,
    hasZeroValue,
    hasWeightedValue,
    directedEdgeCount,
    undirectedEdgeCount,
  };
}
