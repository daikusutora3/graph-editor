import { normalizeGraphColor } from "./colors";
import { normalizeEdgeRoutingOverride } from "./edge-routing-overrides";
import { createEmptyGraphModel } from "./graph-factory";
import { stripUndefinedProperties } from "./graph-utils";
import type {
  EdgeId,
  GraphEdge,
  GraphModel,
  GraphNode,
  GraphSettings,
} from "./model";

/**
 * The graph's JSON document: the same shape as the in-memory model, used for
 * local storage and for lossless export/import (positions, colours, bends).
 */
export const GRAPH_JSON_MAX_NODES = 1_000;
export const GRAPH_JSON_MAX_EDGES = 5_000;

const fallbackGraph = createEmptyGraphModel();

export function serializeGraphModel(model: GraphModel) {
  return JSON.stringify(model, null, 2);
}

/** Parses a JSON document produced by serializeGraphModel; null if invalid. */
export function parseGraphModelJson(text: string): GraphModel | null {
  try {
    return normalizeGraphModel(JSON.parse(text));
  } catch {
    return null;
  }
}

/** Cheap check so plain text formats never go through the JSON parser. */
export function looksLikeGraphJson(text: string) {
  return text.trimStart().startsWith("{");
}

export function normalizeGraphModel(value: unknown): GraphModel | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return null;
  }

  if (
    value.nodes.length > GRAPH_JSON_MAX_NODES ||
    value.edges.length > GRAPH_JSON_MAX_EDGES
  ) {
    return null;
  }

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  for (const nodeValue of value.nodes) {
    const node = normalizeNode(nodeValue);

    if (!node) {
      return null;
    }

    nodes.push(node);
  }

  if (hasDuplicates(nodes.map((node) => node.id))) {
    return null;
  }

  if (hasDuplicates(nodes.map((node) => node.order))) {
    return null;
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edgeIds = new Set<EdgeId>();

  for (const edgeValue of value.edges) {
    const edge = normalizeEdge(edgeValue);

    if (
      !edge ||
      edgeIds.has(edge.id) ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    ) {
      return null;
    }

    edgeIds.add(edge.id);
    edges.push(edge);
  }

  return {
    version: 1,
    nodes,
    edges,
    settings: normalizeSettings(value.settings),
  };
}

function normalizeNode(value: unknown): GraphNode | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.label !== "string" ||
    typeof value.order !== "number" ||
    typeof value.x !== "number" ||
    typeof value.y !== "number" ||
    !Number.isFinite(value.order) ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y)
  ) {
    return null;
  }

  return stripUndefinedProperties({
    id: value.id,
    label: value.label,
    order: value.order,
    x: value.x,
    y: value.y,
    color: normalizeGraphColor(value.color),
  });
}

function normalizeEdge(value: unknown): GraphEdge | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    typeof value.id !== "string" ||
    typeof value.source !== "string" ||
    typeof value.target !== "string"
  ) {
    return null;
  }

  return stripUndefinedProperties({
    id: value.id,
    source: value.source,
    target: value.target,
    weight: typeof value.weight === "string" ? value.weight : undefined,
    label: typeof value.label === "string" ? value.label : undefined,
    color: normalizeGraphColor(value.color),
    routing: normalizeEdgeRoutingOverride(value.routing),
  });
}

function normalizeSettings(value: unknown): GraphSettings {
  const defaults = fallbackGraph.settings;

  if (!isRecord(value)) {
    return defaults;
  }

  return {
    directed:
      typeof value.directed === "boolean" ? value.directed : defaults.directed,
    weighted:
      typeof value.weighted === "boolean" ? value.weighted : defaults.weighted,
    indexBase: value.indexBase === 1 ? 1 : 0,
    allowSelfLoops:
      typeof value.allowSelfLoops === "boolean"
        ? value.allowSelfLoops
        : defaults.allowSelfLoops,
    allowMultiEdges:
      typeof value.allowMultiEdges === "boolean"
        ? value.allowMultiEdges
        : defaults.allowMultiEdges,
    autoEdgeRouting:
      typeof value.autoEdgeRouting === "boolean"
        ? value.autoEdgeRouting
        : defaults.autoEdgeRouting,
    snapToGrid:
      typeof value.snapToGrid === "boolean"
        ? value.snapToGrid
        : defaults.snapToGrid,
    showNodeLabels:
      typeof value.showNodeLabels === "boolean"
        ? value.showNodeLabels
        : defaults.showNodeLabels,
    arrowScale:
      typeof value.arrowScale === "number" &&
      Number.isFinite(value.arrowScale) &&
      value.arrowScale > 0
        ? Math.min(2, Math.max(0.6, value.arrowScale))
        : defaults.arrowScale,
    weightKind:
      value.weightKind === "none" ||
      value.weightKind === "number" ||
      value.weightKind === "string"
        ? value.weightKind
        : defaults.weightKind,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function hasDuplicates(values: Array<string | number>) {
  return new Set(values).size !== values.length;
}
