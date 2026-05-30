import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../core/graph/graph-factory";
import {
  importLimitFailure,
  MAX_IMPORT_EDGES,
  MAX_IMPORT_NODES,
  readImportSettings,
  readLines,
  splitTokens,
  type ImportOptions,
} from "./import-utils";
import type { ImportResult } from "./import-types";

type EdgeListImportOptions = ImportOptions;

export function importStructuredEdgeList(
  input: string,
  options: EdgeListImportOptions = {},
): ImportResult {
  const warnings: string[] = [];
  const settings = readImportSettings(options);
  const lines = readLines(input);
  const header = lines[0]?.text.split(/\s+/) ?? [];
  const nodeCount = Number(header[0]);
  const edgeCount = Number(header[1]);

  if (header.length !== 2) {
    return {
      model: createEmptyGraphModel(settings),
      warnings: [
        `line ${lines[0]?.number ?? 1}: expected "N M", got "${lines[0]?.text ?? ""}"`,
      ],
    };
  }
  if (!Number.isInteger(nodeCount) || nodeCount < 0) {
    return {
      model: createEmptyGraphModel(settings),
      warnings: [`line ${lines[0]?.number ?? 1}: invalid node count.`],
    };
  }
  if (!Number.isInteger(edgeCount) || edgeCount < 0) {
    return {
      model: createEmptyGraphModel(settings),
      warnings: [`line ${lines[0]?.number ?? 1}: invalid edge count.`],
    };
  }
  if (nodeCount > MAX_IMPORT_NODES) {
    return importLimitFailure(
      "nodes",
      nodeCount,
      MAX_IMPORT_NODES,
      options,
      "辺リスト",
    );
  }
  if (edgeCount > MAX_IMPORT_EDGES) {
    return importLimitFailure(
      "edges",
      edgeCount,
      MAX_IMPORT_EDGES,
      options,
      "辺リスト",
    );
  }

  const inputIndexBase = inferStructuredEdgeListIndexBase(
    lines.slice(1, edgeCount + 1),
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

  const dataLines = lines.slice(1);
  if (dataLines.length < edgeCount) {
    warnings.push(`Expected ${edgeCount} edges, found ${dataLines.length}.`);
  }
  if (dataLines.length > edgeCount) {
    warnings.push(
      `Ignored ${dataLines.length - edgeCount} extra edge line(s).`,
    );
  }

  for (
    let index = 0;
    index < Math.min(edgeCount, dataLines.length);
    index += 1
  ) {
    const line = dataLines[index];
    const parts = line.text.split(/\s+/);
    const expectedColumns = settings.weighted ? 3 : 2;

    if (parts.length !== expectedColumns) {
      warnings.push(
        `line ${line.number}: expected ${expectedColumns} integers (${settings.weighted ? "u v w" : "u v"}), got ${parts.length}`,
      );
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
      warnings.push(
        `line ${line.number}: node id ${parts[0]} or ${parts[1]} out of range [${inputIndexBase}, ${nodeCount - 1 + inputIndexBase}]`,
      );
      continue;
    }

    if (settings.weighted && !Number.isFinite(Number(parts[2]))) {
      warnings.push(`line ${line.number}: weight must be numeric.`);
      continue;
    }

    model.edges.push(
      createEdge({
        id: `e${index}`,
        source: model.nodes[sourceIndex].id,
        target: model.nodes[targetIndex].id,
        weight: settings.weighted ? parts[2] : undefined,
      }),
    );
  }

  return { model, warnings, format: "辺リスト" };
}

function inferStructuredEdgeListIndexBase(
  edgeLines: ReturnType<typeof readLines>,
  nodeCount: number,
  fallback: 0 | 1,
) {
  const endpoints = edgeLines
    .flatMap((line) => splitTokens(line.text).slice(0, 2))
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
