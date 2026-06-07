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
  shouldRequireNumericWeights,
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
      "edge-pairs",
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
      "edge-pairs",
    );
  }

  const settings = readImportSettings(
    { ...options, indexBase: detectIndexBase(labels, options.indexBase) },
    { weighted: hasWeights || options.weighted ? true : false },
  );
  const model = createEmptyGraphModel(settings);
  const idByLabel = new Map<string, NodeId>();
  const warnings: string[] = [];

  rows.forEach(([sourceLabel, targetLabel, weight], index) => {
    const edgeWeight = weight ?? "1";
    if (
      shouldRequireNumericWeights(settings) &&
      !Number.isFinite(Number(edgeWeight))
    ) {
      warnings.push(
        `line ${lines[index]?.number ?? index + 1}: weight must be numeric.`,
      );
      return;
    }

    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: ensureNodeByLabel(model, idByLabel, sourceLabel),
        target: ensureNodeByLabel(model, idByLabel, targetLabel),
        weight: settings.weighted ? edgeWeight : undefined,
      }),
    );
  });

  arrangeNodes(model);

  return { model, warnings, format: "Edge list", formatKind: "edge-pairs" };
}
