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
  shouldRequireNumericWeights,
  splitTokens,
} from "./import-utils";
import type { NodeId } from "../core/graph/model";
import type { ImportResult } from "./import-types";

export function tryImportAdjacencyMatrix(
  lines: ParsedLine[],
  options: ImportOptions,
): ImportResult | null {
  const rows = lines.map((line) => splitTokens(line.text));

  if (rows.length < 2 || rows.some((row) => row.length !== rows.length)) {
    return null;
  }

  if (lines.length > MAX_IMPORT_NODES) {
    return importLimitFailure(
      "nodes",
      lines.length,
      MAX_IMPORT_NODES,
      options,
      "Adjacency matrix",
      "adjacency-matrix",
    );
  }

  const values = rows.map((row) => row.map(Number));
  if (values.some((row) => row.some((value) => !Number.isFinite(value)))) {
    return null;
  }

  if (values.length < 2) {
    return null;
  }

  const isSymmetric = isSymmetricMatrix(values);
  const hasZeroValue = values.some((row) => row.includes(0));

  if (!hasZeroValue && options.format !== "adjacency-matrix") {
    const isBinaryMatrix = values.every((row) =>
      row.every((value) => value === 0 || value === 1),
    );

    if (!isBinaryMatrix || !isSymmetric) {
      return null;
    }
  }

  const directed = options.directed || !isSymmetric;

  if (!isSafeAdjacencyMatrixSize(values, directed)) {
    return null;
  }

  const hasWeightedValue = values.some((row) =>
    row.some((value) => value !== 0 && value !== 1),
  );

  if (
    hasWeightedValue &&
    options.format !== "adjacency-matrix" &&
    looksLikeWeightedEdgePairs(rows, values.length)
  ) {
    return null;
  }

  const edgeCount = values.reduce(
    (count, row, sourceIndex) =>
      count +
      row.filter(
        (value, targetIndex) =>
          value !== 0 && (directed || targetIndex >= sourceIndex),
      ).length,
    0,
  );

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
    weighted: hasWeightedValue || options.weighted ? true : false,
  });
  const model = createEmptyGraphModel(settings);

  model.nodes = Array.from({ length: values.length }, (_, index) =>
    createNode({
      id: `n${index}`,
      label: String(index + settings.indexBase),
      order: index,
    }),
  );
  arrangeNodes(model);

  values.forEach((row, sourceIndex) => {
    row.forEach((value, targetIndex) => {
      if (value === 0) {
        return;
      }

      if (!settings.directed && targetIndex < sourceIndex) {
        return;
      }

      model.edges.push(
        createEdge({
          id: `e${model.edges.length}`,
          source: model.nodes[sourceIndex].id,
          target: model.nodes[targetIndex].id,
          weight: settings.weighted ? String(value) : undefined,
        }),
      );
    });
  });

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

function isSymmetricMatrix(values: number[][]) {
  return values.every((row, sourceIndex) =>
    row.every(
      (value, targetIndex) => value === values[targetIndex]?.[sourceIndex],
    ),
  );
}

function isSafeAdjacencyMatrixSize(
  values: number[][],
  directed: boolean | undefined,
) {
  if (values.length !== 2) {
    return true;
  }

  const isBinary = values.every((row) =>
    row.every((value) => value === 0 || value === 1),
  );

  if (!isBinary) {
    return false;
  }

  if (!directed && values[0]?.[1] !== values[1]?.[0]) {
    return false;
  }

  return true;
}

export function tryImportAdjacencyList(
  lines: ParsedLine[],
  options: ImportOptions,
): ImportResult | null {
  const separators = lines.map(
    (line) => line.text.match(/->|:/g)?.map(String) ?? [],
  );
  if (
    separators.some((matches) => matches.length !== 1) ||
    new Set(separators.map((matches) => matches[0])).size !== 1
  ) {
    return null;
  }

  const hasArrowSyntax = lines.some((line) => line.text.includes("->"));
  const labels = lines.flatMap((line) => {
    const separator = line.text.includes("->") ? "->" : ":";
    const [sourceText, targetText = ""] = line.text.split(separator);
    return [
      sourceText.trim(),
      ...splitTokens(targetText).map(
        (token) => parseAdjacencyTarget(token).label,
      ),
    ];
  });
  const edgeCount = labels.length - lines.length;
  const nodeCount = new Set(labels).size;

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

  const hasWeightedTargets = lines.some((line) => {
    const separator = line.text.includes("->") ? "->" : ":";
    const [, targetText = ""] = line.text.split(separator);
    return splitTokens(targetText).some(
      (token) => parseAdjacencyTarget(token).weight != null,
    );
  });
  const settings = readImportSettings(
    {
      ...options,
      indexBase: detectIndexBase(labels, options.indexBase),
    },
    {
      directed: options.directed || hasArrowSyntax,
      weighted: hasWeightedTargets || options.weighted ? true : false,
    },
  );
  const model = createEmptyGraphModel(settings);
  const idByLabel = new Map<string, NodeId>();
  const seenUndirected = new Set<string>();
  const warnings: string[] = [];

  lines.forEach((line) => {
    const separator = line.text.includes("->") ? "->" : ":";
    const [sourceText, targetText = ""] = line.text.split(separator);
    const sourceLabel = sourceText.trim();

    if (!sourceLabel) {
      warnings.push(`line ${line.number}: missing source node.`);
      return;
    }

    const source = ensureNodeByLabel(model, idByLabel, sourceLabel);
    const targets = splitTokens(targetText);

    if (targets.length === 0) {
      return;
    }

    targets.forEach((targetToken) => {
      const parsedTarget = parseAdjacencyTarget(targetToken);
      const { label: targetLabel } = parsedTarget;

      if (!targetLabel) {
        warnings.push(`line ${line.number}: missing target node.`);
        return;
      }

      const weight = parsedTarget.weight ?? "1";
      if (
        shouldRequireNumericWeights(settings) &&
        !Number.isFinite(Number(weight))
      ) {
        warnings.push(`line ${line.number}: weight must be numeric.`);
        return;
      }

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

  const [, label, weight] = weightedMatch;
  return {
    label: label.trim(),
    weight: weight.trim() || "1",
  };
}
