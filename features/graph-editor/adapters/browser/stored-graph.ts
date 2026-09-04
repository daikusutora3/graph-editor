import {
  GRAPH_JSON_MAX_EDGES,
  GRAPH_JSON_MAX_NODES,
  normalizeGraphModel,
} from "../../core/graph/graph-json";
import type { GraphModel } from "../../core/graph/model";

export const GRAPH_STORAGE_KEY = "graph-editor-graph";
export const MAX_STORED_GRAPH_CHARS = 2_000_000;
export const MAX_STORED_GRAPH_NODES = GRAPH_JSON_MAX_NODES;
export const MAX_STORED_GRAPH_EDGES = GRAPH_JSON_MAX_EDGES;

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
    // Over the cap: keep the last stored graph rather than deleting it, so
    // other tabs never observe a removal and reload as empty.
    if (!shouldStoreGraphShape(graph)) {
      return;
    }

    const rawGraph = JSON.stringify(graph);

    if (!shouldStoreRawGraph(rawGraph)) {
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

function flushWhenHidden() {
  if (document.visibilityState === "hidden") {
    flushStoredGraphWrite();
  }
}

function installStorageFlushListeners() {
  if (flushListenersInstalled) {
    return;
  }

  flushListenersInstalled = true;

  window.addEventListener("pagehide", flushStoredGraphWrite);
  document.addEventListener("visibilitychange", flushWhenHidden);
}

/** Removes the flush listeners; used by tests and hot reloads. */
export function uninstallStorageFlushListeners() {
  if (!flushListenersInstalled || typeof window === "undefined") {
    return;
  }

  flushListenersInstalled = false;
  window.removeEventListener("pagehide", flushStoredGraphWrite);
  document.removeEventListener("visibilitychange", flushWhenHidden);
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
