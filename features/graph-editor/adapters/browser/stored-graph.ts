import { createEmptyGraphModel } from "../../core/graph/graph-factory";
import { normalizeGraphColor } from "../../core/graph/colors";
import { normalizeEdgeRoutingOverride } from "../../core/graph/edge-routing-overrides";
import { stripUndefinedProperties } from "../../core/graph/graph-utils";
import type {
  EdgeId,
  GraphEdge,
  GraphModel,
  GraphNode,
  GraphSettings,
} from "../../core/graph/model";

export const GRAPH_STORAGE_KEY = "graph-editor-graph";
export const MAX_STORED_GRAPH_CHARS = 2_000_000;
export const MAX_STORED_GRAPH_NODES = 1_000;
export const MAX_STORED_GRAPH_EDGES = 5_000;

const fallbackGraph = createEmptyGraphModel();
const GRAPH_STORAGE_WRITE_DELAY_MS = 250;

let pendingGraph: GraphModel | null = null;
let pendingWriteTimeoutId: number | null = null;
let flushListenersInstalled = false;

export function readStoredGraph() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return parseStoredGraph(window.localStorage.getItem(GRAPH_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function scheduleStoredGraphWrite(graph: GraphModel) {
  if (typeof window === "undefined") {
    return;
  }

  pendingGraph = graph;
  installStorageFlushListeners();

  if (pendingWriteTimeoutId !== null) {
    return;
  }

  pendingWriteTimeoutId = window.setTimeout(() => {
    pendingWriteTimeoutId = null;
    flushStoredGraphWrite();
  }, GRAPH_STORAGE_WRITE_DELAY_MS);
}

export function cancelScheduledStoredGraphWrite() {
  if (typeof window === "undefined") {
    pendingGraph = null;
    pendingWriteTimeoutId = null;
    return;
  }

  if (pendingWriteTimeoutId !== null) {
    window.clearTimeout(pendingWriteTimeoutId);
    pendingWriteTimeoutId = null;
  }

  pendingGraph = null;
}

export function flushStoredGraphWrite() {
  if (typeof window === "undefined" || !pendingGraph) {
    return;
  }

  if (pendingWriteTimeoutId !== null) {
    window.clearTimeout(pendingWriteTimeoutId);
    pendingWriteTimeoutId = null;
  }

  const graph = pendingGraph;
  pendingGraph = null;

  writeStoredGraphNow(graph);
}

function writeStoredGraphNow(graph: GraphModel) {
  try {
    if (!shouldStoreGraphShape(graph)) {
      window.localStorage.removeItem(GRAPH_STORAGE_KEY);
      return;
    }

    const rawGraph = JSON.stringify(graph);

    if (!shouldStoreRawGraph(rawGraph)) {
      window.localStorage.removeItem(GRAPH_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(GRAPH_STORAGE_KEY, rawGraph);
  } catch {
    // Ignore storage failures so editing still works in restricted browsers.
  }
}

export function serializeStoredGraphForWrite(graph: GraphModel) {
  if (!shouldStoreGraphShape(graph)) {
    return null;
  }

  const rawGraph = JSON.stringify(graph);

  return shouldStoreRawGraph(rawGraph) ? rawGraph : null;
}

function shouldStoreRawGraph(rawGraph: string) {
  return rawGraph.length <= MAX_STORED_GRAPH_CHARS;
}

function shouldStoreGraphShape(graph: GraphModel) {
  return (
    graph.nodes.length <= MAX_STORED_GRAPH_NODES &&
    graph.edges.length <= MAX_STORED_GRAPH_EDGES
  );
}

function installStorageFlushListeners() {
  if (flushListenersInstalled) {
    return;
  }

  flushListenersInstalled = true;

  window.addEventListener("pagehide", flushStoredGraphWrite);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushStoredGraphWrite();
    }
  });
}

export function parseStoredGraph(rawValue: string | null): GraphModel | null {
  if (!rawValue) {
    return null;
  }

  if (!shouldStoreRawGraph(rawValue)) {
    return null;
  }

  try {
    return normalizeGraphModel(JSON.parse(rawValue));
  } catch {
    return null;
  }
}

function normalizeGraphModel(value: unknown): GraphModel | null {
  if (!isRecord(value) || value.version !== 1) {
    return null;
  }

  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return null;
  }

  if (
    value.nodes.length > MAX_STORED_GRAPH_NODES ||
    value.edges.length > MAX_STORED_GRAPH_EDGES
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
