import { createEdge, createEmptyGraphModel } from "../core/graph/graph-factory";
import {
  arrangeNodes,
  createIndexedNodes,
  importLimitFailure,
  importFailure,
  MAX_IMPORT_NODES,
  readImportSettings,
  splitTokens,
  type ImportOptions,
  type ParsedLine,
} from "./import-utils";
import type { ImportResult } from "./import-types";
import { importTextLimitWarning } from "./import-text-limits";
import {
  inferTreeIndexBase,
  isRootedParentTreeLabels,
  isUndirectedTreeLabels,
} from "./import-tree-validation";

export function tryImportTreeEdgeList(
  lines: ParsedLine[],
  options: ImportOptions,
): ImportResult | null {
  const header = splitTokens(lines[0]?.text ?? "");
  const nodeCount = Number(header[0]);

  if (
    header.length !== 1 ||
    !Number.isInteger(nodeCount) ||
    nodeCount < 1 ||
    lines.length !== nodeCount
  ) {
    return null;
  }

  const edgeRows = lines.slice(1).map((line) => splitTokens(line.text));
  if (edgeRows.some((row) => row.length !== 2)) {
    return null;
  }

  if (nodeCount > MAX_IMPORT_NODES) {
    return importLimitFailure(
      "nodes",
      nodeCount,
      MAX_IMPORT_NODES,
      options,
      "Tree edge list",
      "tree-edge-list",
    );
  }

  const edges = edgeRows.map(
    ([sourceText, targetText]) =>
      [Number(sourceText), Number(targetText)] as const,
  );
  const endpoints = edges.flat();
  if (endpoints.some((value) => !Number.isInteger(value))) {
    return null;
  }

  const indexBase = inferTreeIndexBase(endpoints, nodeCount, options.indexBase);
  if (!isUndirectedTreeLabels(edges, nodeCount, options.indexBase)) {
    return null;
  }
  const model = createEmptyGraphModel(
    readImportSettings({ ...options, indexBase }),
  );

  model.nodes = createIndexedNodes(nodeCount, indexBase);
  edges.forEach(([source, target]) => {
    const sourceIndex = source - indexBase;
    const targetIndex = target - indexBase;

    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: model.nodes[sourceIndex]!.id,
        target: model.nodes[targetIndex]!.id,
      }),
    );
  });

  arrangeNodes(model);
  return {
    model,
    warnings: [],
    format: "Tree edge list",
    formatKind: "tree-edge-list",
  };
}

export function tryImportParentList(
  lines: ParsedLine[],
  options: ImportOptions,
): ImportResult | null {
  const header = splitTokens(lines[0]?.text ?? "");
  const nodeCount = Number(header[0]);

  if (
    header.length !== 1 ||
    !Number.isInteger(nodeCount) ||
    nodeCount < 2 ||
    lines.length !== 2
  ) {
    return null;
  }

  const parents = splitTokens(lines[1]?.text ?? "").map(Number);
  if (
    parents.length !== nodeCount - 1 ||
    parents.some((value) => !Number.isInteger(value))
  ) {
    return null;
  }

  if (nodeCount > MAX_IMPORT_NODES) {
    return importLimitFailure(
      "nodes",
      nodeCount,
      MAX_IMPORT_NODES,
      options,
      "Parent list",
      "parent-list",
    );
  }

  const indexBase = inferTreeIndexBase(parents, nodeCount, options.indexBase);
  if (!isRootedParentTreeLabels(parents, nodeCount, options.indexBase)) {
    return null;
  }

  const model = createEmptyGraphModel(
    readImportSettings({ ...options, indexBase, directed: true }),
  );

  model.nodes = createIndexedNodes(nodeCount, indexBase);
  parents.forEach((parentLabel, index) => {
    const parentIndex = parentLabel - indexBase;
    const childIndex = index + 1;
    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: model.nodes[parentIndex]!.id,
        target: model.nodes[childIndex]!.id,
      }),
    );
  });

  arrangeNodes(model);
  return {
    model,
    warnings: [],
    format: "Parent list",
    formatKind: "parent-list",
  };
}

export function tryImportWeightedParentList(
  lines: ParsedLine[],
  options: ImportOptions,
): ImportResult | null {
  const header = splitTokens(lines[0]?.text ?? "");
  const nodeCount = Number(header[0]);

  if (
    header.length !== 1 ||
    !Number.isInteger(nodeCount) ||
    nodeCount < 1 ||
    lines.length !== nodeCount
  ) {
    return null;
  }

  const rows = lines.slice(1).map((line) => splitTokens(line.text));
  if (rows.some((row) => row.length !== 2)) {
    return null;
  }

  if (nodeCount > MAX_IMPORT_NODES) {
    return importLimitFailure(
      "nodes",
      nodeCount,
      MAX_IMPORT_NODES,
      options,
      "Weighted parent list",
      "weighted-parent-list",
    );
  }

  const parents = rows.map(([parent]) => Number(parent));
  if (parents.some((value) => !Number.isInteger(value))) {
    return null;
  }

  const indexBase = inferTreeIndexBase(parents, nodeCount, options.indexBase);
  if (!isRootedParentTreeLabels(parents, nodeCount, options.indexBase)) {
    return null;
  }

  const model = createEmptyGraphModel(
    readImportSettings({
      ...options,
      indexBase,
      weightKind: "number",
      directed: true,
      weighted: true,
    }),
  );

  for (const [index, row] of rows.entries()) {
    const warning = importTextLimitWarning(
      row[1]!,
      "edge-weight",
      lines[index + 1]!.number,
    );
    if (warning)
      return importFailure(
        warning,
        options,
        "Weighted parent list",
        "weighted-parent-list",
      );
  }

  model.nodes = createIndexedNodes(nodeCount, indexBase);
  rows.forEach(([, weight], index) => {
    const parentIndex = parents[index]! - indexBase;
    const childIndex = index + 1;
    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: model.nodes[parentIndex]!.id,
        target: model.nodes[childIndex]!.id,
        weight,
      }),
    );
  });

  arrangeNodes(model);
  return {
    model,
    warnings: [],
    format: "Weighted parent list",
    formatKind: "weighted-parent-list",
  };
}
