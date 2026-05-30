import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../core/graph/graph-factory";
import { normalizeGraphColor } from "../core/graph/colors";
import { normalizeEdgeRoutingOverride } from "../core/graph/edge-routing-overrides";
import {
  arrangeNodes,
  ensureNodeByLabel,
  finiteNumberOrUndefined,
  importFailure,
  type ImportOptions,
  readImportSettings,
} from "./import-utils";
import type { GraphEdge, GraphNode, NodeId } from "../core/graph/model";
import type { ImportResult } from "./import-types";

type JsonGraph = {
  nodes?: Array<string | number | Partial<GraphNode>>;
  edges?: Array<
    | [string | number, string | number]
    | [string | number, string | number, string | number]
    | Partial<GraphEdge>
  >;
  directed?: boolean;
  weighted?: boolean;
};

export function tryImportJson(
  input: string,
  options: ImportOptions,
): ImportResult | null {
  const trimmed = input.trim();

  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed) as
      | JsonGraph
      | NonNullable<JsonGraph["edges"]>;
    const graph = Array.isArray(parsed) ? { edges: parsed } : parsed;

    if (!Array.isArray(graph.edges) && !Array.isArray(graph.nodes)) {
      return importFailure(
        'JSON must contain "nodes" or "edges" arrays.',
        options,
        "JSON graph",
      );
    }

    return buildJsonGraph(graph, options);
  } catch (error) {
    return importFailure(
      `Invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
      options,
      "JSON graph",
    );
  }
}

function buildJsonGraph(
  graph: JsonGraph,
  options: ImportOptions,
): ImportResult {
  const settings = readImportSettings(options, {
    directed: graph.directed,
    weighted: graph.weighted,
  });
  const model = createEmptyGraphModel(settings);
  const idByLabel = new Map<string, NodeId>();
  const warnings: string[] = [];

  const ensureNode = (value: string | number, position?: Partial<GraphNode>) =>
    ensureNodeByLabel(model, idByLabel, String(value), position);

  graph.nodes?.forEach((node, index) => {
    if (typeof node === "string" || typeof node === "number") {
      ensureNode(node);
      return;
    }

    const label = String(node.label ?? node.id ?? index + settings.indexBase);
    const id = String(node.id ?? `n${model.nodes.length}`);
    if (idByLabel.has(label) || idByLabel.has(id)) {
      return;
    }

    model.nodes.push(
      createNode({
        id,
        label,
        order: model.nodes.length,
        x: finiteNumberOrUndefined(node.x),
        y: finiteNumberOrUndefined(node.y),
        color: normalizeGraphColor(node.color),
      }),
    );
    idByLabel.set(label, id);
    idByLabel.set(id, id);
  });

  graph.edges?.forEach((edge, index) => {
    const tuple = Array.isArray(edge);
    const sourceValue = tuple ? edge[0] : edge.source;
    const targetValue = tuple ? edge[1] : edge.target;
    const weight = tuple ? edge[2] : edge.weight;
    const label = tuple ? undefined : edge.label;
    const color = tuple ? undefined : normalizeGraphColor(edge.color);
    const routing = tuple
      ? undefined
      : normalizeEdgeRoutingOverride(edge.routing);

    if (sourceValue == null || targetValue == null) {
      warnings.push(`edge ${index + 1}: source and target are required.`);
      return;
    }

    model.edges.push(
      createEdge({
        id: `e${model.edges.length}`,
        source: ensureNode(String(sourceValue)),
        target: ensureNode(String(targetValue)),
        weight: weight == null ? undefined : String(weight),
        label: label == null ? undefined : String(label),
        color,
        routing,
      }),
    );
  });

  arrangeNodes(model);

  return { model, warnings, format: "JSON graph" };
}
