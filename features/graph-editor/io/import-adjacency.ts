import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../core/graph/graph-factory";
import {
  arrangeNodes,
  detectIndexBase,
  ensureNodeByLabel,
  importLimitFailure,
  MAX_IMPORT_EDGES,
  MAX_IMPORT_NODES,
  type ImportOptions,
  type ParsedLine,
  readImportSettings,
} from "./import-utils";
import type { NodeId } from "../core/graph/model";
import type { ImportResult, ImportWarning } from "./import-types";
import { createImportSource, type ImportSource } from "./import-source";

export function tryImportAdjacencyMatrix(
  lines: ParsedLine[],
  options: ImportOptions,
  preparedSource?: ImportSource,
): ImportResult | null {
  const source = preparedSource ?? createImportSource(lines);
  if (lines.length < 1 || source.firstRow.length !== lines.length) {
    return null;
  }
  if (lines.length > MAX_IMPORT_NODES) {
    if (source.rows.some((row) => row.length !== lines.length)) return null;
    return importLimitFailure(
      "nodes",
      lines.length,
      MAX_IMPORT_NODES,
      options,
      "Adjacency matrix",
      "adjacency-matrix",
    );
  }

  const matrix = source.matrix;
  if (!matrix) return null;
  const { size, isSymmetric, hasZeroValue, isBinary, hasWeightedValue } =
    matrix;

  if (!hasZeroValue && options.format !== "adjacency-matrix") {
    if (!isBinary || !isSymmetric) {
      return null;
    }
  }

  const directed = options.directed || !isSymmetric;

  if (
    options.format !== "adjacency-matrix" &&
    size === 2 &&
    (!isBinary || (!directed && !isSymmetric))
  ) {
    return null;
  }

  if (
    hasWeightedValue &&
    options.format !== "adjacency-matrix" &&
    size === 3 &&
    looksLikeWeightedEdgePairs(source.rows, size)
  ) {
    return null;
  }

  const edgeCount = directed
    ? matrix.directedEdgeCount
    : matrix.undirectedEdgeCount;

  if (edgeCount > MAX_IMPORT_EDGES) {
    return importLimitFailure(
      "edges",
      edgeCount,
      MAX_IMPORT_EDGES,
      options,
      "Adjacency matrix",
      "adjacency-matrix",
    );
  }

  const settings = readImportSettings(options, {
    directed,
    weighted: Boolean(hasWeightedValue || options.weighted),
  });
  const model = createEmptyGraphModel(settings);

  model.nodes = Array.from({ length: size }, (_, index) =>
    createNode({
      id: `n${index}`,
      label: String(index + settings.indexBase),
      order: index,
    }),
  );
  arrangeNodes(model);

  const addMatrixEdge = (
    sourceIndex: number,
    targetIndex: number,
    value: number,
  ) => {
    if (!settings.directed && targetIndex < sourceIndex) return;
    const sourceNode = model.nodes[sourceIndex];
    const targetNode = model.nodes[targetIndex];
    if (!sourceNode || !targetNode) return;
    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: sourceNode.id,
        target: targetNode.id,
        weight: settings.weighted ? String(value) : undefined,
      }),
    );
  };
  if (matrix.values) {
    matrix.values.forEach((row, sourceIndex) => {
      row.forEach((value, targetIndex) => {
        if (value !== 0) addMatrixEdge(sourceIndex, targetIndex, value);
      });
    });
  } else {
    for (const {
      source: sourceIndex,
      target: targetIndex,
      value,
    } of matrix.entries)
      addMatrixEdge(sourceIndex, targetIndex, value);
  }

  return {
    model,
    warnings: [],
    format: "Adjacency matrix",
    formatKind: "adjacency-matrix",
  };
}

function looksLikeWeightedEdgePairs(rows: string[][], matrixSize: number) {
  if (rows.some((row) => row.length !== 3)) {
    return false;
  }

  const endpoints = rows
    .flatMap((row) => row.slice(0, 2))
    .map((value) => Number(value));

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

export function tryImportAdjacencyList(
  lines: ParsedLine[],
  options: ImportOptions,
  preparedSource?: ImportSource,
): ImportResult | null {
  const importSource = preparedSource ?? createImportSource(lines);
  let separator: string | undefined;
  let edgeCount = 0;
  let hasWeightedTargets = false;
  const uniqueLabels = new Set<string>();
  const rowScan = {};
  for (const line of lines) {
    const row = importSource.readAdjacencyRow(line.text);
    if (!row || (separator !== undefined && separator !== row.separator)) {
      return null;
    }
    separator = row.separator;
    const targets = row.targetTokens;
    edgeCount += targets.length;
    if (row.lastScan === rowScan) continue;
    row.lastScan = rowScan;
    uniqueLabels.add(row.sourceLabel);
    for (const token of targets) {
      const target = parseAdjacencyTarget(token);
      uniqueLabels.add(target.label);
      if (target.weight != null) hasWeightedTargets = true;
    }
  }
  if (separator === undefined) return null;
  const adjacencySeparator = separator;
  const labels = [...uniqueLabels];
  const nodeCount = uniqueLabels.size;

  if (nodeCount > MAX_IMPORT_NODES) {
    return importLimitFailure(
      "nodes",
      nodeCount,
      MAX_IMPORT_NODES,
      options,
      "Adjacency list",
      "adjacency-list",
    );
  }
  if (edgeCount > MAX_IMPORT_EDGES) {
    return importLimitFailure(
      "edges",
      edgeCount,
      MAX_IMPORT_EDGES,
      options,
      "Adjacency list",
      "adjacency-list",
    );
  }

  const settings = readImportSettings(
    {
      ...options,
      indexBase: detectIndexBase(labels, options.indexBase),
    },
    {
      directed: options.directed || adjacencySeparator === "->",
      weighted: Boolean(hasWeightedTargets || options.weighted),
    },
  );
  const model = createEmptyGraphModel(settings);
  const idByLabel = new Map<string, NodeId>();
  const seenUndirected = new Set<string>();
  const warnings: ImportWarning[] = [];

  lines.forEach((line) => {
    const row = importSource.readAdjacencyRow(line.text);
    if (!row) return;
    const { sourceLabel } = row;

    if (!sourceLabel) {
      warnings.push({ code: "missing-source", line: line.number });
      return;
    }

    const source = ensureNodeByLabel(model, idByLabel, sourceLabel);
    const targets = row.targetTokens;

    if (targets.length === 0) {
      return;
    }

    targets.forEach((targetToken) => {
      const parsedTarget = parseAdjacencyTarget(targetToken);
      const { label: targetLabel } = parsedTarget;

      if (!targetLabel) {
        warnings.push({ code: "missing-target", line: line.number });
        return;
      }

      const weight = parsedTarget.weight ?? "1";
      const target = ensureNodeByLabel(model, idByLabel, targetLabel);

      if (!settings.directed) {
        const key = [source, target].sort().join("\0");
        if (seenUndirected.has(key)) {
          return;
        }
        seenUndirected.add(key);
      }

      model.edges.push(
        createEdge({
          id: `e${model.edges.length}`,
          source,
          target,
          weight: settings.weighted ? weight : undefined,
        }),
      );
    });
  });

  arrangeNodes(model);

  return {
    model,
    warnings,
    format: "Adjacency list",
    formatKind: "adjacency-list",
  };
}

function parseAdjacencyTarget(token: string) {
  const weightedMatch = token.match(/^(.+)\(([^()]*)\)$/);

  if (!weightedMatch) {
    return { label: token, weight: undefined };
  }

  const [, label = "", weight = ""] = weightedMatch;
  return {
    label: label.trim(),
    weight: weight.trim() || "1",
  };
}
