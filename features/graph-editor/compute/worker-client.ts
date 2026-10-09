import type { GraphIntent, GraphModel, NodeId } from "../core/graph/model";
import type {
  EdgeRoutingMeta,
  EdgeRoutingOptions,
} from "../core/layout/edge-routing";
import type { LayoutKind } from "../layouts/manual-layouts";
import type { OverlapResult } from "../layouts/resolve-node-overlaps";
import type {
  ComputeJob,
  ComputeResponse,
  ComputeValue,
  RoutingInteraction,
} from "./worker-protocol";

type Pending = {
  complete: (result: ComputeValue | null) => void;
  cleanup: () => void;
  kind: ComputeJob["kind"];
};
let worker: Worker | null = null;
let unavailable = false;
let nextId = 0;
const pending = new Map<number, Pending>();

function stopWorker() {
  if (typeof window !== "undefined")
    window.removeEventListener("pagehide", stopWorker);
  worker?.terminate();
  worker = null;
  for (const request of pending.values()) {
    request.cleanup();
    request.complete(null);
  }
  pending.clear();
}

function getWorker() {
  if (
    unavailable ||
    typeof window === "undefined" ||
    typeof Worker === "undefined"
  )
    return null;
  if (!worker) {
    try {
      const created = new Worker(
        new URL("./graph-compute.worker.ts", import.meta.url),
        { type: "module", name: "graph-compute" },
      );
      worker = created;
      created.onmessage = (event: MessageEvent<ComputeResponse>) => {
        if (worker !== created) return;
        const response = event.data;
        const request = pending.get(response.id);
        if (!request) return;
        pending.delete(response.id);
        request.cleanup();
        if ("error" in response) {
          unavailable = true;
          request.complete(null);
          stopWorker();
          return;
        }
        const mark = `graph-compute:${request.kind}:wasm`;
        performance.clearMarks(mark);
        performance.mark(mark);
        request.complete(response.result);
      };
      created.onerror = () => {
        if (worker !== created) return;
        unavailable = true;
        stopWorker();
      };
      window.addEventListener("pagehide", stopWorker);
    } catch {
      unavailable = true;
      return null;
    }
  }
  return worker;
}

function run(
  job: ComputeJob,
  signal?: AbortSignal,
): Promise<ComputeValue | null> {
  if (signal?.aborted) return Promise.resolve(null);
  const active = getWorker();
  if (!active) return Promise.resolve(null);
  const id = ++nextId;
  return new Promise((complete) => {
    const cancel = () => {
      const request = pending.get(id);
      if (!request) return;
      pending.delete(id);
      request.cleanup();
      try {
        // Web Worker messages do not accept a window targetOrigin.
        // eslint-disable-next-line unicorn/require-post-message-target-origin
        active.postMessage({ cancel: id });
      } catch {
        unavailable = true;
        stopWorker();
      } finally {
        complete(null);
      }
    };
    const timer = setTimeout(() => {
      unavailable = true;
      stopWorker();
    }, 120_000);
    pending.set(id, {
      complete,
      kind: job.kind,
      cleanup: () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
      },
    });
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      // eslint-disable-next-line unicorn/require-post-message-target-origin
      active.postMessage({ id, job });
    } catch {
      unavailable = true;
      stopWorker();
    }
  });
}

export async function computeLayoutInWorker(
  model: GraphModel,
  layout: LayoutKind,
  rootNodeId?: NodeId,
  signal?: AbortSignal,
) {
  return (await run(
    { kind: "layout", model, layout, rootNodeId },
    signal,
  )) as GraphIntent | null;
}

export async function computeOverlapsInWorker(
  model: GraphModel,
  signal?: AbortSignal,
) {
  return (await run(
    { kind: "overlap", model },
    signal,
  )) as OverlapResult | null;
}

export async function computeRoutingInWorker(
  model: GraphModel,
  options: EdgeRoutingOptions,
  signal?: AbortSignal,
  interaction?: RoutingInteraction,
) {
  return (await run(
    { kind: "routing", model, options, interaction },
    signal,
  )) as Map<string, EdgeRoutingMeta> | null;
}
