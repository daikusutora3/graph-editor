import { createEdge, createEmptyGraphModel } from "../core/graph/graph-factory";
import {
  arrangeNodes,
  createIndexedNodes,
  detectIndexBase,
  ensureNodeByLabel,
  importLimitFailure,
  importFailure,
  MAX_IMPORT_ADJACENCY_ENTRIES,
  MAX_IMPORT_EDGES,
  MAX_IMPORT_NODES,
  type ImportOptions,
  readImportSettings,
} from "./import-utils";
import type { NodeId } from "../core/graph/model";
import { importTextLimitWarning } from "./import-text-limits";
import type { ImportResult, ImportWarning } from "./import-types";
import { parseAdjacencyTarget, type ImportSource } from "./import-source";

export function tryImportAdjacencyMatrix(
  source: ImportSource,
  options: ImportOptions,
): ImportResult | null {
  const { lines } = source;
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
  const { size, isSymmetric, hasWeightedValue } = matrix;

  const directed = options.directed || !isSymmetric;

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

  const settings = readImportSettings({
    ...options,
    directed,
    weighted: Boolean(hasWeightedValue || options.weighted),
  });
  const model = createEmptyGraphModel(settings);

  model.nodes = createIndexedNodes(size, settings.indexBase);
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

export function tryImportAdjacencyList(
  importSource: ImportSource,
  options: ImportOptions,
): ImportResult | null {
  const { lines } = importSource;
  let separator: string | undefined;
  let entryCount = 0;
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
    entryCount += targets.length;
    if (row.lastScan === rowScan) continue;
    row.lastScan = rowScan;
    const sourceWarning = importTextLimitWarning(
      row.sourceLabel,
      "node-label",
      line.number,
    );
    if (sourceWarning)
      return importFailure(
        sourceWarning,
        options,
        "Adjacency list",
        "adjacency-list",
      );
    uniqueLabels.add(row.sourceLabel);
    for (const token of targets) {
      const target = parseAdjacencyTarget(token);
      const targetWarning =
        importTextLimitWarning(target.label, "node-label", line.number) ??
        (target.weight === undefined
          ? undefined
          : importTextLimitWarning(target.weight, "edge-weight", line.number));
      if (targetWarning)
        return importFailure(
          targetWarning,
          options,
          "Adjacency list",
          "adjacency-list",
        );
      uniqueLabels.add(target.label);
      if (target.weight != null) hasWeightedTargets = true;
    }
  }
  if (separator === undefined) return null;
  const adjacencySeparator = separator;
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
  if (entryCount > MAX_IMPORT_ADJACENCY_ENTRIES) {
    return importLimitFailure(
      "adjacency-entries",
      entryCount,
      MAX_IMPORT_ADJACENCY_ENTRIES,
      options,
      "Adjacency list",
      "adjacency-list",
    );
  }

  const settings = readImportSettings({
    ...options,
    indexBase: detectIndexBase(uniqueLabels, options.indexBase),
    directed: options.directed || adjacencySeparator === "->",
    weighted: Boolean(hasWeightedTargets || options.weighted),
  });
  const model = createEmptyGraphModel(settings);
  const idByLabel = new Map<string, NodeId>();
  const seenUndirected = new Set<string>();
  const warnings: ImportWarning[] = [];

  lines.forEach((line) => {
    const row = importSource.readAdjacencyRow(line.text)!;
    const { sourceLabel } = row;

    if (!sourceLabel) {
      warnings.push({ code: "missing-source", line: line.number });
      return;
    }

    const source = ensureNodeByLabel(model, idByLabel, sourceLabel);
    const targets = row.targetTokens;

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

  if (model.edges.length > MAX_IMPORT_EDGES) {
    return importLimitFailure(
      "edges",
      model.edges.length,
      MAX_IMPORT_EDGES,
      options,
      "Adjacency list",
      "adjacency-list",
    );
  }
  arrangeNodes(model);

  return {
    model,
    warnings,
    format: "Adjacency list",
    formatKind: "adjacency-list",
  };
}
