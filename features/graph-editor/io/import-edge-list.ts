import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../core/graph/graph-factory";
import {
  importLimitFailure,
  importFailure,
  MAX_IMPORT_EDGES,
  MAX_IMPORT_NODES,
  readImportSettings,
  readLines,
  splitTokens,
  type ImportOptions,
} from "./import-utils";
import type { ImportResult, ImportWarning } from "./import-types";
import { importTextLimitWarning } from "./import-text-limits";

type EdgeListImportOptions = ImportOptions;

export function importStructuredEdgeList(
  input: string,
  options: EdgeListImportOptions = {},
): ImportResult {
  const warnings: ImportWarning[] = [];
  const settings = readImportSettings(options);
  const lines = readLines(input);
  const header = lines[0]?.text.split(/\s+/) ?? [];
  const nodeCount = Number(header[0]);
  const edgeCount = Number(header[1]);

  if (header.length !== 2) {
    return {
      model: createEmptyGraphModel(settings),
      warnings: [
        {
          code: "expected-header",
          line: lines[0]?.number ?? 1,
          got: lines[0]?.text ?? "",
        },
      ],
    };
  }
  if (!Number.isInteger(nodeCount) || nodeCount < 0) {
    return {
      model: createEmptyGraphModel(settings),
      warnings: [{ code: "invalid-node-count", line: lines[0]?.number ?? 1 }],
    };
  }
  if (!Number.isInteger(edgeCount) || edgeCount < 0) {
    return {
      model: createEmptyGraphModel(settings),
      warnings: [{ code: "invalid-edge-count", line: lines[0]?.number ?? 1 }],
    };
  }
  if (nodeCount > MAX_IMPORT_NODES) {
    return importLimitFailure(
      "nodes",
      nodeCount,
      MAX_IMPORT_NODES,
      options,
      "Contest edge list",
      "contest-edge-list",
    );
  }
  if (edgeCount > MAX_IMPORT_EDGES) {
    return importLimitFailure(
      "edges",
      edgeCount,
      MAX_IMPORT_EDGES,
      options,
      "Contest edge list",
      "contest-edge-list",
    );
  }

  const dataLines = lines.slice(1);
  const dataRows = dataLines.map((line) => splitTokens(line.text));
  // Check all supplied weight fields before accepting a partial import. An
  // invalid endpoint, extra column or extra row must not hide a text limit.
  if (settings.weighted) {
    for (const [index, parts] of dataRows.entries()) {
      if (parts[2] === undefined) continue;
      const warning = importTextLimitWarning(
        parts[2],
        "edge-weight",
        dataLines[index]!.number,
      );
      if (warning)
        return importFailure(
          warning,
          options,
          "Contest edge list",
          "contest-edge-list",
        );
    }
  }
  const inputIndexBase = inferStructuredEdgeListIndexBase(
    dataRows.slice(0, edgeCount),
    nodeCount,
    settings.indexBase,
  );
  const model = createEmptyGraphModel({
    ...settings,
    indexBase: inputIndexBase,
  });
  const radius = Math.max(170, nodeCount * 26);
  model.nodes = Array.from({ length: nodeCount }, (_, index) => {
    const angle = nodeCount === 0 ? 0 : (Math.PI * 2 * index) / nodeCount;
    return createNode({
      id: `n${index}`,
      label: String(index + inputIndexBase),
      order: index,
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
    });
  });

  if (dataLines.length < edgeCount) {
    warnings.push({
      code: "missing-edges",
      expected: edgeCount,
      found: dataLines.length,
    });
  }
  if (dataLines.length > edgeCount) {
    warnings.push({
      code: "extra-edge-lines",
      count: dataLines.length - edgeCount,
    });
  }

  for (
    let index = 0;
    index < Math.min(edgeCount, dataLines.length);
    index += 1
  ) {
    const line = dataLines[index];

    if (!line) continue;

    const parts = dataRows[index]!;
    const expectedColumns = settings.weighted ? 3 : 2;

    if (parts.length !== expectedColumns) {
      warnings.push({
        code: "expected-integers",
        line: line.number,
        expected: expectedColumns,
        shape: settings.weighted ? "u v w" : "u v",
        got: parts.length,
      });
      continue;
    }

    const sourceIndex = Number(parts[0]) - inputIndexBase;
    const targetIndex = Number(parts[1]) - inputIndexBase;
    if (
      !Number.isInteger(sourceIndex) ||
      !Number.isInteger(targetIndex) ||
      sourceIndex < 0 ||
      sourceIndex >= nodeCount ||
      targetIndex < 0 ||
      targetIndex >= nodeCount
    ) {
      warnings.push({
        code: "node-out-of-range",
        line: line.number,
        source: parts[0] ?? "",
        target: parts[1] ?? "",
        min: inputIndexBase,
        max: nodeCount - 1 + inputIndexBase,
      });
      continue;
    }

    const sourceNode = model.nodes[sourceIndex];
    const targetNode = model.nodes[targetIndex];

    if (!sourceNode || !targetNode) continue;

    model.edges.push(
      createEdge({
        id: `e${index}`,
        source: sourceNode.id,
        target: targetNode.id,
        weight: settings.weighted ? parts[2] : undefined,
      }),
    );
  }

  return {
    model,
    warnings,
    format: "Contest edge list",
    formatKind: "contest-edge-list",
  };
}

function inferStructuredEdgeListIndexBase(
  edgeRows: string[][],
  nodeCount: number,
  fallback: 0 | 1,
) {
  const endpoints = edgeRows
    .flatMap((row) => row.slice(0, 2))
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value));

  if (endpoints.length === 0) {
    return fallback;
  }

  const allZeroBased = endpoints.every(
    (value) => value >= 0 && value < nodeCount,
  );
  const allOneBased = endpoints.every(
    (value) => value >= 1 && value <= nodeCount,
  );

  if (allOneBased && !allZeroBased) {
    return 1;
  }

  if (allZeroBased && !allOneBased) {
    return 0;
  }

  if (endpoints.includes(0)) {
    return 0;
  }

  if (endpoints.includes(nodeCount)) {
    return 1;
  }

  return fallback;
}
