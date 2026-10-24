import {
  parseGraphModelJson,
  serializeGraphModel,
} from "../../core/graph/graph-json";
import {
  GRAPH_MAX_JSON_CHARS,
  GRAPH_MAX_NODES,
  GRAPH_MAX_EDGES,
} from "../../core/graph/graph-limits";
import type { GraphModel } from "../../core/graph/model";
import { createArticleExampleGraph } from "@/lib/article-examples";
import {
  getGraphStorageContext,
  type GraphStorageContext,
} from "./graph-storage-context";

export { GRAPH_STORAGE_KEY } from "./graph-storage-context";
export const MAX_STORED_GRAPH_CHARS = GRAPH_MAX_JSON_CHARS;
export const MAX_STORED_GRAPH_NODES = GRAPH_MAX_NODES;
export const MAX_STORED_GRAPH_EDGES = GRAPH_MAX_EDGES;
export const STORAGE_SKIPPED_EVENT = "graph-editor:storage-skipped";
export const STORAGE_STATE_EVENT = "graph-editor:storage-state";
export type SaveStatus =
  "saved" | "pending" | "failed" | "conflict" | "unavailable" | "invalid";
export type StorageSnapshot = { status: SaveStatus; raw: string | null };
let snapshot: StorageSnapshot = { status: "saved", raw: null };
let baseline: string | null = null;
let initialized = false;
let pendingRaw: string | null = null;
let generation = 0;
let timer: number | null = null;
let installed = false;
let activeContext: GraphStorageContext | null = null;

function contextIsCurrent(context: GraphStorageContext) {
  return (
    activeContext?.key === context.key &&
    getGraphStorageContext().key === context.key
  );
}

function contextStorage(context: GraphStorageContext) {
  return context.kind === "example"
    ? window.sessionStorage
    : window.localStorage;
}

function notify(status: SaveStatus, raw = snapshot.raw) {
  if (snapshot.status === status && snapshot.raw === raw) return;
  snapshot = { status, raw };
  if (
    typeof window !== "undefined" &&
    typeof window.dispatchEvent === "function"
  ) {
    window.dispatchEvent(new Event(STORAGE_STATE_EVENT));
  }
}
export function getStorageSnapshot() {
  return snapshot;
}
export function readStoredGraph() {
  if (typeof window === "undefined") return null;
  cancelScheduledStoredGraphWrite();
  const context = getGraphStorageContext();
  activeContext = context;
  initialized = true;
  try {
    baseline = contextStorage(context).getItem(context.key);
    const graph = parseStoredGraph(baseline);
    notify(
      baseline !== null && !graph
        ? "invalid"
        : context.kind === "original" &&
            (typeof navigator === "undefined" || !navigator.locks)
          ? "unavailable"
          : "saved",
      baseline,
    );
    if (graph) return graph;
    return baseline === null && context.kind === "example"
      ? createArticleExampleGraph(context.slug)
      : null;
  } catch {
    baseline = null;
    notify("unavailable", null);
    return context.kind === "example"
      ? createArticleExampleGraph(context.slug)
      : null;
  }
}

export function scheduleStoredGraphWrite(
  graph: GraphModel,
  serialized?: string,
) {
  if (typeof window === "undefined") return;
  if (!initialized) readStoredGraph();

  if (activeContext?.key !== getGraphStorageContext().key) {
    cancelScheduledStoredGraphWrite();
    return;
  }
  installStorageFlushListeners();
  pendingRaw = serialized ?? serializeStoredGraphForWrite(graph);
  generation += 1;
  if (!pendingRaw) {
    notify("failed");
    return;
  }
  if (["invalid", "conflict", "unavailable"].includes(snapshot.status)) return;
  notify("pending");
  installStorageFlushListeners();
  if (timer !== null) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void flushStoredGraphWrite();
  }, 250);
}

export function cancelScheduledStoredGraphWrite() {
  generation += 1;
  pendingRaw = null;
  if (timer !== null && typeof window !== "undefined")
    window.clearTimeout(timer);
  timer = null;
}

export async function flushStoredGraphWrite() {
  if (typeof window === "undefined" || pendingRaw === null) return;
  const context = activeContext;

  if (!context || !contextIsCurrent(context)) {
    cancelScheduledStoredGraphWrite();
    return;
  }
  if (["invalid", "conflict", "unavailable"].includes(snapshot.status)) return;
  if (timer !== null) window.clearTimeout(timer);
  timer = null;
  if (
    context.kind === "original" &&
    (typeof navigator === "undefined" || !navigator.locks)
  ) {
    notify("unavailable");
    return;
  }
  const request = generation;
  const raw = pendingRaw;
  try {
    const write = () => {
      if (
        request !== generation ||
        pendingRaw !== raw ||
        !contextIsCurrent(context)
      )
        return;
      const storage = contextStorage(context);
      const current = storage.getItem(context.key);
      if (current !== baseline) {
        notify("conflict", current);
        return;
      }
      storage.setItem(context.key, raw);
      baseline = raw;
      if (request === generation) {
        pendingRaw = null;
        notify("saved", raw);
      }
    };
    if (context.kind === "example") write();
    else await navigator.locks.request(context.key, write);
  } catch {
    if (request === generation && pendingRaw === raw) notify("failed");
  }
}

export function observeExternalStorage(raw: string | null) {
  if (getGraphStorageContext().kind === "example") return;
  if (raw !== baseline) {
    generation += 1;
    notify("conflict", raw);
  }
}

export function acceptStorageBaseline(raw: string | null) {
  cancelScheduledStoredGraphWrite();
  activeContext = getGraphStorageContext();
  baseline = raw;
  initialized = true;
  notify("saved", raw);
}

export function serializeStoredGraphForWrite(graph: GraphModel) {
  try {
    return serializeGraphModel(graph);
  } catch {
    return null;
  }
}
export function parseStoredGraph(raw: string | null): GraphModel | null {
  return raw === null ? null : parseGraphModelJson(raw);
}
function flushWhenHidden() {
  if (document.visibilityState === "hidden") void flushStoredGraphWrite();
}
function flushOnPageHide() {
  void flushStoredGraphWrite();
}
function installStorageFlushListeners() {
  if (installed) return;
  installed = true;
  window.addEventListener("pagehide", flushOnPageHide);
  window.addEventListener("beforeunload", warnUnsavedChanges);
  document.addEventListener("visibilitychange", flushWhenHidden);
}
export function uninstallStorageFlushListeners() {
  if (!installed || typeof window === "undefined") return;
  installed = false;
  window.removeEventListener("pagehide", flushOnPageHide);
  window.removeEventListener("beforeunload", warnUnsavedChanges);
  document.removeEventListener("visibilitychange", flushWhenHidden);
}

function warnUnsavedChanges(event: BeforeUnloadEvent) {
  if (pendingRaw === null || !activeContext || !contextIsCurrent(activeContext))
    return;
  event.preventDefault();
  event.returnValue = "";
}
