import type {
  ImportAnalysis,
  ImportCandidate,
  ImportFormatKind,
  ImportMatchStrength,
} from "./import-types";
import {
  MAX_IMPORT_INPUT_CHARS,
  type ImportOptions,
  type ParsedLine,
  readLines,
  splitTokens,
} from "./import-utils";
import {
  isRootedParentTreeLabels,
  isUndirectedTreeLabels,
} from "./import-tree-validation";

type ImportSource = {
  lines: ParsedLine[];
  rows: string[][];
};

const strengthRank: Record<ImportMatchStrength, number> = {
  exact: 3,
  strong: 2,
  fallback: 1,
};

const compatibilityOrder: ImportFormatKind[] = [
  "adjacency-matrix",
  "adjacency-list",
  "parent-list",
  "tree-edge-list",
  "contest-edge-list",
  "edge-pairs",
  "weighted-parent-list",
];

export function analyzeGraphInput(
  input: string,
  options: ImportOptions = {},
): ImportAnalysis {
  if (input.length > MAX_IMPORT_INPUT_CHARS) {
    return {
      status: "limit",
      candidates: [],
      diagnostics: [
        {
          code: "input-limit",
          severity: "error",
          message: `Import is too large: ${input.length.toLocaleString()} input characters, maximum is ${MAX_IMPORT_INPUT_CHARS.toLocaleString()}.`,
        },
      ],
    };
  }

  const lines = readLines(input);
  if (lines.length === 0) {
    return {
      status: "invalid",
      candidates: [],
      diagnostics: [
        {
          code: "empty-input",
          severity: "error",
          message: "Empty input.",
        },
      ],
    };
  }

  const source: ImportSource = {
    lines,
    rows: lines.map((line) => splitTokens(line.text)),
  };
  const candidates = collectCandidates(source, options).sort(
    (left, right) =>
      strengthRank[right.strength] - strengthRank[left.strength] ||
      compatibilityOrder.indexOf(left.formatKind) -
        compatibilityOrder.indexOf(right.formatKind),
  );

  if (candidates.length === 0) {
    return {
      status: "invalid",
      candidates: [],
      diagnostics: [
        {
          code: "invalid-format",
          severity: "error",
          message: "Input does not match a supported graph format.",
        },
      ],
    };
  }

  const strongestRank = strengthRank[candidates[0].strength];
  const strongest = candidates.filter(
    (candidate) => strengthRank[candidate.strength] === strongestRank,
  );
  const ambiguous = strongest.length > 1;

  return {
    status: ambiguous ? "ambiguous" : "detected",
    recommendedFormat: candidates[0].formatKind,
    candidates,
    diagnostics: ambiguous
      ? [
          {
            code: "ambiguous-format",
            severity: "warning",
            message: `Input matches multiple formats: ${strongest
              .map((candidate) => candidate.formatKind)
              .join(", ")}.`,
          },
        ]
      : [],
  };
}

function collectCandidates(
  source: ImportSource,
  options: ImportOptions,
): ImportCandidate[] {
  const candidates: ImportCandidate[] = [];

  pushCandidate(candidates, probeAdjacencyList(source));
  pushCandidate(candidates, probeAdjacencyMatrix(source, options));
  pushCandidate(candidates, probeParentList(source, options));
  pushCandidate(candidates, probeTreeEdgeList(source, options));
  pushCandidate(candidates, probeWeightedParentList(source, options));
  pushCandidate(candidates, probeStructuredEdgeList(source));
  pushCandidate(candidates, probeLooseEdgeList(source, options));

  return candidates;
}

function pushCandidate(
  candidates: ImportCandidate[],
  candidate: ImportCandidate | null,
) {
  if (candidate) {
    candidates.push(candidate);
  }
}

function probeAdjacencyList(source: ImportSource): ImportCandidate | null {
  const separators = source.lines.map((line) =>
    line.text.match(/->|:/g)?.map(String),
  );

  if (
    separators.some((matches) => matches?.length !== 1) ||
    new Set(separators.map((matches) => matches?.[0])).size !== 1
  ) {
    return null;
  }

  const labels = new Set<string>();
  let edgeCount = 0;

  for (const line of source.lines) {
    const separator = line.text.includes("->") ? "->" : ":";
    const separatorIndex = line.text.indexOf(separator);
    const sourceLabel = line.text.slice(0, separatorIndex).trim();
    const targetText = line.text.slice(separatorIndex + separator.length);
    if (!sourceLabel) {
      return null;
    }

    labels.add(sourceLabel);
    for (const token of splitTokens(targetText)) {
      const match = token.match(/^(.+?)(?:\(([^()]*)\))?$/);
      const targetLabel = match?.[1]?.trim();
      if (!targetLabel) {
        return null;
      }
      labels.add(targetLabel);
      edgeCount += 1;
    }
  }

  return {
    formatKind: "adjacency-list",
    strength: "exact",
    evidence: ["adjacency-syntax"],
    nodeCount: labels.size,
    edgeCount,
  };
}

function probeAdjacencyMatrix(
  source: ImportSource,
  options: ImportOptions,
): ImportCandidate | null {
  const size = source.rows.length;
  if (
    size < 2 ||
    source.rows.some((row) => row.length !== size) ||
    source.rows.some((row) =>
      row.some((token) => !Number.isFinite(Number(token))),
    )
  ) {
    return null;
  }

  const values = source.rows.map((row) => row.map(Number));
  const isBinary = values.every((row) =>
    row.every((value) => value === 0 || value === 1),
  );
  const isSymmetric = values.every((row, sourceIndex) =>
    row.every(
      (value, targetIndex) => value === values[targetIndex]?.[sourceIndex],
    ),
  );

  if (size === 2 && (!isBinary || (!options.directed && !isSymmetric))) {
    return null;
  }

  const hasWeightedValue = values.some((row) =>
    row.some((value) => value !== 0 && value !== 1),
  );
  if (
    hasWeightedValue &&
    source.rows.every((row) => row.length === 3) &&
    looksLikeOutOfRangeWeightedEdgeRows(source.rows, size)
  ) {
    return null;
  }

  const directed = !isSymmetric;
  const edgeCount = values.reduce(
    (count, row, sourceIndex) =>
      count +
      row.filter(
        (value, targetIndex) =>
          value !== 0 && (directed || targetIndex >= sourceIndex),
      ).length,
    0,
  );

  return {
    formatKind: "adjacency-matrix",
    strength: "strong",
    evidence: ["square-numeric-matrix"],
    nodeCount: size,
    edgeCount,
  };
}

function probeParentList(
  source: ImportSource,
  options: ImportOptions,
): ImportCandidate | null {
  const nodeCount = readSingleCountHeader(source);
  if (
    nodeCount == null ||
    nodeCount < 2 ||
    source.lines.length !== 2 ||
    source.rows[1]?.length !== nodeCount - 1
  ) {
    return null;
  }

  const parents = source.rows[1].map(Number);
  if (
    parents.some((value) => !Number.isInteger(value)) ||
    !isRootedParentTreeLabels(parents, nodeCount, options.indexBase)
  ) {
    return null;
  }

  return {
    formatKind: "parent-list",
    strength: "exact",
    evidence: ["parent-row"],
    nodeCount,
    edgeCount: nodeCount - 1,
  };
}

function probeTreeEdgeList(
  source: ImportSource,
  options: ImportOptions,
): ImportCandidate | null {
  const nodeCount = readSingleCountHeader(source);
  if (
    nodeCount == null ||
    nodeCount < 1 ||
    source.lines.length !== nodeCount ||
    source.rows.slice(1).some((row) => row.length !== 2)
  ) {
    return null;
  }

  const endpoints = source.rows
    .slice(1)
    .map(([left, right]) => [Number(left), Number(right)] as const);
  if (
    endpoints.some(
      ([left, right]) => !Number.isInteger(left) || !Number.isInteger(right),
    ) ||
    !isUndirectedTreeLabels(endpoints, nodeCount, options.indexBase)
  ) {
    return null;
  }

  return {
    formatKind: "tree-edge-list",
    strength: "strong",
    evidence: ["tree-edge-rows"],
    nodeCount,
    edgeCount: nodeCount - 1,
  };
}

function probeWeightedParentList(
  source: ImportSource,
  options: ImportOptions,
): ImportCandidate | null {
  const nodeCount = readSingleCountHeader(source);
  if (
    nodeCount == null ||
    nodeCount < 1 ||
    source.lines.length !== nodeCount ||
    source.rows.slice(1).some((row) => row.length !== 2)
  ) {
    return null;
  }

  const parents = source.rows.slice(1).map((row) => Number(row[0]));
  const weights = source.rows.slice(1).map((row) => Number(row[1]));
  if (
    parents.some((value) => !Number.isInteger(value)) ||
    weights.some((value) => !Number.isFinite(value)) ||
    !isRootedParentTreeLabels(parents, nodeCount, options.indexBase)
  ) {
    return null;
  }

  return {
    formatKind: "weighted-parent-list",
    strength: "strong",
    evidence: ["weighted-parent-rows"],
    nodeCount,
    edgeCount: nodeCount - 1,
  };
}

function probeStructuredEdgeList(source: ImportSource): ImportCandidate | null {
  const header = source.rows[0];
  const nodeCount = Number(header?.[0]);
  const edgeCount = Number(header?.[1]);
  if (
    header?.length !== 2 ||
    !Number.isInteger(nodeCount) ||
    !Number.isInteger(edgeCount) ||
    nodeCount < 0 ||
    edgeCount < 0 ||
    source.rows.slice(1).some((row) => row.length < 2 || row.length > 3)
  ) {
    return null;
  }

  const dataRows = source.rows.slice(1, edgeCount + 1);
  if (edgeCount > 0 && dataRows.length === 0) {
    return null;
  }
  const endpoints = dataRows.flatMap((row) => row.slice(0, 2)).map(Number);
  if (
    endpoints.some((value) => !Number.isInteger(value)) ||
    (endpoints.length > 0 &&
      !endpoints.every((value) => value >= 0 && value < nodeCount) &&
      !endpoints.every((value) => value >= 1 && value <= nodeCount))
  ) {
    return null;
  }

  const complete = source.lines.length - 1 === edgeCount;
  return {
    formatKind: "contest-edge-list",
    strength: complete ? "exact" : "strong",
    evidence: ["structured-header"],
    nodeCount,
    edgeCount: Math.min(edgeCount, source.lines.length - 1),
  };
}

function probeLooseEdgeList(
  source: ImportSource,
  options: ImportOptions,
): ImportCandidate | null {
  if (
    source.rows.length === 0 ||
    source.rows.some((row) => row.length < 2 || row.length > 3)
  ) {
    return null;
  }

  const hasWeights = source.rows.some((row) => row.length === 3);
  if (
    hasWeights &&
    options.weighted &&
    source.rows.some(
      (row) => row[2] != null && !Number.isFinite(Number(row[2])),
    )
  ) {
    return null;
  }

  const labels = new Set(source.rows.flatMap((row) => row.slice(0, 2)));
  const couldBeWeightedSquareRows =
    source.rows.length === 3 &&
    source.rows.every((row) => row.length === 3) &&
    source.rows.some((row) =>
      row.some((token) => Number(token) !== 0 && Number(token) !== 1),
    ) &&
    source.rows.every((row) =>
      row
        .slice(0, 2)
        .every(
          (token) =>
            Number.isInteger(Number(token)) &&
            Number(token) >= 0 &&
            Number(token) < source.rows.length,
        ),
    );

  return {
    formatKind: "edge-pairs",
    strength: couldBeWeightedSquareRows ? "strong" : "fallback",
    evidence: ["edge-rows"],
    nodeCount: labels.size,
    edgeCount: source.rows.length,
  };
}

function looksLikeOutOfRangeWeightedEdgeRows(
  rows: string[][],
  matrixSize: number,
) {
  const endpoints = rows.flatMap((row) => row.slice(0, 2)).map(Number);
  if (endpoints.some((value) => !Number.isInteger(value))) {
    return false;
  }

  const weights = rows.map((row) => Number(row[2]));
  if (weights.some((value) => value === 0)) {
    return false;
  }

  const zeroBased = endpoints.every(
    (value) => value >= 0 && value < matrixSize,
  );
  const oneBased = endpoints.every(
    (value) => value >= 1 && value <= matrixSize,
  );
  return !zeroBased && !oneBased;
}

function readSingleCountHeader(source: ImportSource) {
  const header = source.rows[0];
  const nodeCount = Number(header?.[0]);
  return header?.length === 1 && Number.isInteger(nodeCount) ? nodeCount : null;
}
