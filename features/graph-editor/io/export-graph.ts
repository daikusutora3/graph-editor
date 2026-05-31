import { exportEdgeList } from "./export-edge-list";
import { getNodeByOrder } from "../core/graph/selectors";
import type { GraphModel } from "../core/graph/model";

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
  const nodes = getNodeByOrder(model);
  const nodeIndex = createNodeIndex(model);
  const adjacency = new Map(nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of model.edges) {
    const source = nodeIndex.get(edge.source);
    const target = nodeIndex.get(edge.target);
    if (source == null || target == null) continue;

    adjacency
      .get(edge.source)
      ?.push(
        formatAdjacencyTarget(target, edge.weight, model.settings.weighted),
      );

    if (!model.settings.directed && edge.source !== edge.target) {
      adjacency
        .get(edge.target)
        ?.push(
          formatAdjacencyTarget(source, edge.weight, model.settings.weighted),
        );
    }
  }

  return nodes
    .map((node) => {
      const label = nodeIndex.get(node.id);
      return `${label}: ${(adjacency.get(node.id) ?? []).join(" ")}`;
    })
    .join("\n");
}

function exportAdjacencyMatrix(model: GraphModel): string {
  const nodes = getNodeByOrder(model);
  const orderIndex = new Map(nodes.map((node, index) => [node.id, index]));
  const matrix = Array.from({ length: nodes.length }, () =>
    Array.from({ length: nodes.length }, () => "0"),
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
    getNodeByOrder(model).map((node, index) => [
      node.id,
      index + model.settings.indexBase,
    ]),
  );
}

function formatAdjacencyTarget(
  target: number,
  weight: string | undefined,
  weighted: boolean,
) {
  return weighted ? `${target}(${weight ?? "1"})` : String(target);
}
