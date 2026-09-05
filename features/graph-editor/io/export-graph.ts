import { GRAPH_MAX_INPUT_CHARS } from "../core/graph/graph-limits";
import { exportEdgeList } from "./export-edge-list";
import type { GraphModel } from "../core/graph/model";
import { getExportNodeEntries } from "./export-node-labels";
import { serializeGraphModel } from "../core/graph/graph-json";

export type GraphExportFormat =
  | "edge-list"
  | "adjacency-list"
  | "adjacency-matrix"
  | "json";

export const GRAPH_EXPORT_FORMATS: Array<{
  value: GraphExportFormat;
  extension: "txt" | "json";
  mimeType: string;
}> = [
  {
    value: "edge-list",

    extension: "txt",
    mimeType: "text/plain;charset=utf-8",
  },
  {
    value: "adjacency-list",

    extension: "txt",
    mimeType: "text/plain;charset=utf-8",
  },
  {
    value: "adjacency-matrix",

    extension: "txt",
    mimeType: "text/plain;charset=utf-8",
  },
  // Lossless: keeps positions, colours and manual bends.
  {
    value: "json",

    extension: "json",
    mimeType: "application/json",
  },
];

export function exportGraph(
  model: GraphModel,
  format: GraphExportFormat,
): string {
  const problem = graphExportProblem(model, format);
  if (problem) throw new Error(problem);
  const text = exportUnchecked(model, format);
  if (format !== "json" && text.length > GRAPH_MAX_INPUT_CHARS)
    throw new Error("input-limit");
  return text;
}

function exportUnchecked(model: GraphModel, format: GraphExportFormat): string {
  switch (format) {
    case "json":
      return serializeGraphModel(model);
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
  if (format === "edge-list" || format === "json") {
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
    const sourceRow = matrix[source];
    const targetRow = matrix[target];

    if (!sourceRow || !targetRow) continue;

    sourceRow[target] = value;

    if (!model.settings.directed) {
      targetRow[source] = value;
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

export function graphExportProblem(
  model: GraphModel,
  format: GraphExportFormat,
): string | null {
  if (format === "json") return null;
  if (format === "adjacency-matrix") {
    if (hasLossyAdjacencyExport(model, format)) return "parallel-edges";
    if (
      model.settings.weighted &&
      model.edges.some(
        (edge) =>
          !Number.isFinite(Number(edge.weight ?? "1")) ||
          Number(edge.weight ?? "1") === 0,
      )
    )
      return "matrix-weight";
    // Includes delimiters before allocating a quadratic matrix.
    let size = Math.max(0, 2 * model.nodes.length ** 2 - 1);
    if (model.settings.weighted)
      for (const edge of model.edges)
        size +=
          Math.max(0, (edge.weight ?? "1").length - 1) *
          (!model.settings.directed && edge.source !== edge.target ? 2 : 1);
    if (size > GRAPH_MAX_INPUT_CHARS) return "input-limit";
  }
  if (format === "adjacency-list" && hasLossyAdjacencyExport(model, format))
    return "parallel-edges";
  if (
    model.settings.weighted &&
    model.edges.some((edge) => {
      const weight = edge.weight ?? "1";
      return (
        !weight ||
        /[\s,]/.test(weight) ||
        (format === "adjacency-list" && /[()]/.test(weight))
      );
    })
  )
    return "weight-token";
  return null;
}
