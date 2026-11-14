import { createEdge, createEmptyGraphModel } from "../core/graph/graph-factory";
import {
  arrangeNodes,
  detectIndexBase,
  ensureNodeByLabel,
  importLimitFailure,
  importFailure,
  MAX_IMPORT_EDGES,
  MAX_IMPORT_NODES,
  type ImportOptions,
  readImportSettings,
} from "./import-utils";
import { inferEdgeListWeightKind, type ImportSource } from "./import-source";
import type { NodeId } from "../core/graph/model";
import type { ImportResult } from "./import-types";
import { importTextLimitWarning } from "./import-text-limits";

export function tryImportLooseEdgeList(
  source: ImportSource,
  options: ImportOptions,
): ImportResult | null {
  const { lines, rows } = source;

  if (
    rows.length === 0 ||
    rows.some((row) => row.length < 2 || row.length > 3)
  ) {
    return null;
  }

  if (rows.length > MAX_IMPORT_EDGES) {
    return importLimitFailure(
      "edges",
      rows.length,
      MAX_IMPORT_EDGES,
      options,
      "Edge list",
      "edge-pairs",
    );
  }

  const hasWeights = rows.some((row) => row.length === 3);
  const uniqueLabels = new Set<string>();
  for (const [index, row] of rows.entries()) {
    const line = lines[index]!.number;
    const warning =
      importTextLimitWarning(row[0]!, "node-label", line) ??
      importTextLimitWarning(row[1]!, "node-label", line) ??
      (row[2] === undefined
        ? undefined
        : importTextLimitWarning(row[2], "edge-weight", line));
    if (warning)
      return importFailure(warning, options, "Edge list", "edge-pairs");
    uniqueLabels.add(row[0]!);
    uniqueLabels.add(row[1]!);
  }
  const nodeCount = uniqueLabels.size;

  if (nodeCount > MAX_IMPORT_NODES) {
    return importLimitFailure(
      "nodes",
      nodeCount,
      MAX_IMPORT_NODES,
      options,
      "Edge list",
      "edge-pairs",
    );
  }

  const settings = readImportSettings({
    ...options,
    indexBase: detectIndexBase(uniqueLabels, options.indexBase),
    weightKind: inferEdgeListWeightKind(rows, options.weightKind),
    weighted: Boolean(hasWeights || options.weighted),
  });
  const model = createEmptyGraphModel(settings);
  const idByLabel = new Map<string, NodeId>();
  rows.forEach((row) => {
    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: ensureNodeByLabel(model, idByLabel, row[0]!),
        target: ensureNodeByLabel(model, idByLabel, row[1]!),
        weight: settings.weighted ? (row[2] ?? "1") : undefined,
      }),
    );
  });

  arrangeNodes(model);

  return { model, warnings: [], format: "Edge list", formatKind: "edge-pairs" };
}
