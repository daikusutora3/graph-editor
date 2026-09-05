import {
  GRAPH_MAX_NODES,
  GRAPH_MAX_EDGES,
  GRAPH_MAX_TEXT_CODE_POINTS,
  GRAPH_MAX_JSON_CHARS,
  isGraphText,
} from "./graph-limits";
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
export const GRAPH_JSON_VERSION = 1;
export const GRAPH_JSON_MAX_NODES = GRAPH_MAX_NODES;
export const GRAPH_JSON_MAX_EDGES = GRAPH_MAX_EDGES;
export const GRAPH_JSON_MAX_TEXT_CHARS = GRAPH_MAX_TEXT_CODE_POINTS;

/**
 * Upgrades older documents in place before normalization. Each future schema
 * bump adds one step here; documents newer than this build are rejected.
 */
export function migrateGraphDocument(value: unknown): unknown | null {
  if (!isRecord(value) || typeof value.version !== "number") {
    return null;
  }

  if (value.version > GRAPH_JSON_VERSION) {
    return null;
  }

  // version 1 is the current schema; nothing to migrate yet.
  return value;
}

const fallbackGraph = createEmptyGraphModel();

export function serializeGraphModel(model: GraphModel) {
  const raw = JSON.stringify(model);
  const normalized = normalizeGraphModel(model);
  if (
    raw.length > GRAPH_MAX_JSON_CHARS ||
    !normalized ||
    !sameDocument(model, normalized)
  ) {
    throw new Error("Graph exceeds the JSON contract");
  }
  return raw;
}

/** Parses a JSON document produced by serializeGraphModel; null if invalid. */
export function parseGraphModelJson(text: string): GraphModel | null {
  if (text.length > GRAPH_MAX_JSON_CHARS) return null;
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

export function normalizeGraphModel(input: unknown): GraphModel | null {
  const value = migrateGraphDocument(input);

  if (!isRecord(value) || value.version !== GRAPH_JSON_VERSION) {
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
      nodeIds.has(edge.id) ||
      !nodeIds.has(edge.source) ||
      !nodeIds.has(edge.target)
    ) {
      return null;
    }

    edgeIds.add(edge.id);
    edges.push(edge);
  }

  if (!validSettings(value.settings)) return null;

  return {
    version: GRAPH_JSON_VERSION,
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
    !value.id.trim() ||
    !isGraphText(value.label) ||
    (value.color !== undefined &&
      normalizeGraphColor(value.color) === undefined) ||
    typeof value.order !== "number" ||
    typeof value.x !== "number" ||
    typeof value.y !== "number" ||
    !Number.isSafeInteger(value.order) ||
    value.order < 0 ||
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
    typeof value.target !== "string" ||
    !value.id.trim() ||
    (value.weight !== undefined && !isGraphText(value.weight)) ||
    (value.label !== undefined && !isGraphText(value.label)) ||
    (value.color !== undefined &&
      normalizeGraphColor(value.color) === undefined) ||
    !validRouting(value.routing)
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
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validRouting(value: unknown) {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  const normalized = normalizeEdgeRoutingOverride(value);
  return Object.entries(value).every(
    ([key, item]) =>
      typeof item === "number" &&
      Number.isFinite(item) &&
      normalized?.[key as keyof typeof normalized] === item,
  );
}

function validSettings(value: unknown) {
  if (!isRecord(value)) return false;
  const defaults = fallbackGraph.settings;
  return Object.entries(value).every(([key, item]) => {
    if (!(key in defaults)) return false;
    if (key === "indexBase") return item === 0 || item === 1;
    if (key === "arrowScale")
      return (
        typeof item === "number" &&
        Number.isFinite(item) &&
        item >= 0.6 &&
        item <= 2
      );
    if (key === "weightKind")
      return item === "none" || item === "number" || item === "string";
    return typeof item === "boolean";
  });
}

function hasDuplicates(values: Array<string | number>) {
  return new Set(values).size !== values.length;
}

function sameDocument(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return (
      a.length === b.length &&
      a.every((value, index) => sameDocument(value, b[index]))
    );
  if (!isRecord(a) || !isRecord(b)) return false;
  const keys = Object.keys(a).filter((key) => a[key] !== undefined);
  return (
    keys.length ===
      Object.keys(b).filter((key) => b[key] !== undefined).length &&
    keys.every((key) => sameDocument(a[key], b[key]))
  );
}
