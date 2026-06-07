import { exportEdgeList } from "./export-edge-list";
import type { GraphModel } from "../core/graph/model";
import { getExportNodeEntries } from "./export-node-labels";

export type GraphExportFormat =
  | "edge-list"
  | "adjacency-list"
  | "adjacency-matrix";

export const GRAPH_EXPORT_FORMATS: Array<{
  value: GraphExportFormat;
  label: string;
  extension: "txt";
}> = [
  { value: "edge-list", label: "辺リスト", extension: "txt" },
  { value: "adjacency-list", label: "隣接リスト", extension: "txt" },
  { value: "adjacency-matrix", label: "隣接行列", extension: "txt" },
];

export function exportGraph(
  model: GraphModel,
  format: GraphExportFormat,
): string {
  switch (format) {
    case "adjacency-list":
      return exportAdjacencyList(model);
    case "adjacency-matrix":
      return exportAdjacencyMatrix(model);
    default:
      return exportEdgeList(model);
  }
}

export function hasLossyAdjacencyExport(
  model: GraphModel,
  format: GraphExportFormat,
) {
  if (format === "edge-list") {
    return false;
  }

  const seen = new Set<string>();

  for (const edge of model.edges) {
    const key = model.settings.directed
      ? `${edge.source}\0${edge.target}`
      : [edge.source, edge.target].sort().join("\0");

    if (seen.has(key)) {
      return true;
    }

    seen.add(key);
  }

  return false;
}

export function getGraphExportFormat(format: GraphExportFormat) {
  return (
    GRAPH_EXPORT_FORMATS.find((item) => item.value === format) ??
    GRAPH_EXPORT_FORMATS[0]
  );
}

function exportAdjacencyList(model: GraphModel): string {
  const entries = getExportNodeEntries(model);
  const nodeIndex = createNodeIndex(model);
  const adjacency = new Map(
    entries.map((entry) => [
      entry.node.id,
      [] as Array<{ label: number; value: string }>,
    ]),
  );

  for (const edge of model.edges) {
    const source = nodeIndex.get(edge.source);
    const target = nodeIndex.get(edge.target);
    if (source == null || target == null) continue;

    adjacency.get(edge.source)?.push({
      label: target,
      value: formatAdjacencyTarget(
        target,
        edge.weight,
        model.settings.weighted,
      ),
    });

    if (!model.settings.directed && edge.source !== edge.target) {
      adjacency.get(edge.target)?.push({
        label: source,
        value: formatAdjacencyTarget(
          source,
          edge.weight,
          model.settings.weighted,
        ),
      });
    }
  }

  return entries
    .map((entry) => {
      const label = nodeIndex.get(entry.node.id);
      const targets = (adjacency.get(entry.node.id) ?? [])
        .toSorted((a, b) => a.label - b.label)
        .map((target) => target.value);
      return `${label}: ${targets.join(" ")}`;
    })
    .join("\n");
}

function exportAdjacencyMatrix(model: GraphModel): string {
  const entries = getExportNodeEntries(model);
  const orderIndex = new Map(
    entries.map((entry, index) => [entry.node.id, index]),
  );
  const matrix = Array.from({ length: entries.length }, () =>
    Array.from({ length: entries.length }, () => "0"),
  );

  for (const edge of model.edges) {
    const source = orderIndex.get(edge.source);
    const target = orderIndex.get(edge.target);
    if (source == null || target == null) continue;

    const value = model.settings.weighted ? (edge.weight ?? "1") : "1";
    matrix[source][target] = value;

    if (!model.settings.directed) {
      matrix[target][source] = value;
    }
  }

  return matrix.map((row) => row.join(" ")).join("\n");
}

function createNodeIndex(model: GraphModel) {
  return new Map(
    getExportNodeEntries(model).map((entry) => [entry.node.id, entry.label]),
  );
}

function formatAdjacencyTarget(
  target: number,
  weight: string | undefined,
  weighted: boolean,
) {
  return weighted ? `${target}(${weight ?? "1"})` : String(target);
}
