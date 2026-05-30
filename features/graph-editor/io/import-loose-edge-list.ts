import { createEdge, createEmptyGraphModel } from "../core/graph/graph-factory";
import {
  arrangeNodes,
  detectIndexBase,
  ensureNodeByLabel,
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

  const hasWeights = rows.some((row) => row.length === 3);
  const labels = rows.flatMap((row) => row.slice(0, 2));
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
