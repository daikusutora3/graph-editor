import { createEdge, createEmptyGraphModel } from "../core/graph/graph-factory";
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
  splitTokens,
} from "./import-utils";
import type { NodeId } from "../core/graph/model";
import type { ImportResult } from "./import-types";

export function tryImportLooseEdgeList(
  lines: ParsedLine[],
  options: ImportOptions,
): ImportResult | null {
  const rows = lines.map((line) => splitTokens(line.text));

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
    );
  }

  const hasWeights = rows.some((row) => row.length === 3);
  const labels = rows.flatMap((row) => row.slice(0, 2));
  const nodeCount = new Set(labels).size;

  if (nodeCount > MAX_IMPORT_NODES) {
    return importLimitFailure(
      "nodes",
      nodeCount,
      MAX_IMPORT_NODES,
      options,
      "Edge list",
    );
  }

  const settings = readImportSettings(
    { ...options, indexBase: detectIndexBase(labels, options.indexBase) },
    { weighted: hasWeights },
  );
  const model = createEmptyGraphModel(settings);
  const idByLabel = new Map<string, NodeId>();

  rows.forEach(([sourceLabel, targetLabel, weight]) => {
    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: ensureNodeByLabel(model, idByLabel, sourceLabel),
        target: ensureNodeByLabel(model, idByLabel, targetLabel),
        weight: settings.weighted ? (weight ?? "1") : undefined,
      }),
    );
  });

  arrangeNodes(model);

  return { model, warnings: [], format: "Edge list" };
}
