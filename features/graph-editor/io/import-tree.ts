import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../core/graph/graph-factory";
import {
  arrangeNodes,
  importLimitFailure,
  MAX_IMPORT_NODES,
  readImportSettings,
  splitTokens,
  type ImportOptions,
  type ParsedLine,
} from "./import-utils";
import type { ImportResult } from "./import-types";
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

  const endpoints = edgeRows.flat().map(Number);
  if (endpoints.some((value) => !Number.isInteger(value))) {
    return null;
  }

  const indexBase = inferTreeIndexBase(endpoints, nodeCount, options.indexBase);
  const edges = edgeRows.map(
    ([sourceText, targetText]) =>
      [Number(sourceText), Number(targetText)] as const,
  );
  if (!isUndirectedTreeLabels(edges, nodeCount, options.indexBase)) {
    return null;
  }
  const model = createEmptyGraphModel({
    ...readImportSettings({ ...options, indexBase }),
    directed: options.directed ?? false,
  });

  model.nodes = createIndexedNodes(nodeCount, indexBase);
  edgeRows.forEach(([sourceText, targetText]) => {
    const sourceIndex = Number(sourceText) - indexBase;
    const targetIndex = Number(targetText) - indexBase;

    if (
      sourceIndex < 0 ||
      sourceIndex >= nodeCount ||
      targetIndex < 0 ||
      targetIndex >= nodeCount
    ) {
      return;
    }

    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: model.nodes[sourceIndex].id,
        target: model.nodes[targetIndex].id,
      }),
    );
  });

  if (model.edges.length !== nodeCount - 1) {
    return null;
  }

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

  const parents = splitTokens(lines[1].text).map(Number);
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
  const parentIndices = parents.map((parentLabel) => parentLabel - indexBase);
  if (!isRootedParentTreeLabels(parents, nodeCount, options.indexBase)) {
    return null;
  }

  const model = createEmptyGraphModel({
    ...readImportSettings({ ...options, indexBase }, { directed: true }),
    directed: true,
  });

  model.nodes = createIndexedNodes(nodeCount, indexBase);
  parents.forEach((parentLabel, index) => {
    const parentIndex = parentIndices[index];
    const childIndex = index + 1;

    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: model.nodes[parentIndex].id,
        target: model.nodes[childIndex].id,
      }),
    );
  });

  if (model.edges.length !== nodeCount - 1) {
    return null;
  }

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
  const weights = rows.map(([, weight]) => Number(weight));
  if (
    parents.some((value) => !Number.isInteger(value)) ||
    weights.some((value) => !Number.isFinite(value))
  ) {
    return null;
  }

  const indexBase = inferTreeIndexBase(parents, nodeCount, options.indexBase);
  const parentIndices = parents.map((parentLabel) => parentLabel - indexBase);
  if (!isRootedParentTreeLabels(parents, nodeCount, options.indexBase)) {
    return null;
  }

  const model = createEmptyGraphModel({
    ...readImportSettings(
      { ...options, indexBase, weightKind: "number" },
      { directed: true, weighted: true },
    ),
    directed: true,
    weighted: true,
    weightKind: "number",
  });

  model.nodes = createIndexedNodes(nodeCount, indexBase);
  rows.forEach(([, weight], index) => {
    const parentIndex = parentIndices[index];
    const childIndex = index + 1;

    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: model.nodes[parentIndex].id,
        target: model.nodes[childIndex].id,
        weight,
      }),
    );
  });

  if (model.edges.length !== nodeCount - 1) {
    return null;
  }

  arrangeNodes(model);
  return {
    model,
    warnings: [],
    format: "Weighted parent list",
    formatKind: "weighted-parent-list",
  };
}

function createIndexedNodes(nodeCount: number, indexBase: 0 | 1) {
  return Array.from({ length: nodeCount }, (_, index) =>
    createNode({
      id: `n${index}`,
      label: String(index + indexBase),
      order: index,
    }),
  );
}
