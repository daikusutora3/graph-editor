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
import { restoreRoutingDelta } from "./routing-result";
import type { RoutingDelta } from "./routing-result";

type Pending = {
  complete: (result: ComputeValue | null) => void;
  cleanup: () => void;
  kind: ComputeJob["kind"];
  restoreRouting?: (delta: RoutingDelta) => Map<string, EdgeRoutingMeta>;
};
let worker: Worker | null = null;
let unavailable = false;
let consecutiveFailures = 0;
let retryAfter = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const RETRY_COOLDOWN_MS = 1000;
let nextId = 0;
const pending = new Map<number, Pending>();
const markedKernels = new Map<ComputeJob["kind"], string[]>();

function failWorker(permanent = false) {
  consecutiveFailures++;
  unavailable = permanent || consecutiveFailures >= MAX_CONSECUTIVE_FAILURES;
  retryAfter = performance.now() + RETRY_COOLDOWN_MS * consecutiveFailures;
  stopWorker();
}

function permanentTransportError(error: unknown) {
  return (
    error instanceof DOMException &&
    ["SecurityError", "NotSupportedError", "DataCloneError"].includes(
      error.name,
    )
  );
}

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
    performance.now() < retryAfter ||
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
          request.complete(null);
          failWorker(response.failure === "permanent");
          return;
        }
        let result: ComputeValue;
        try {
          if ("routingDelta" in response) {
            if (!request.restoreRouting)
              throw new Error("Unexpected routing delta");
            result = request.restoreRouting(response.routingDelta);
          } else result = response.result;
        } catch {
          request.complete(null);
          failWorker(true);
          return;
        }
        consecutiveFailures = 0;
        retryAfter = 0;
        const prefix = `graph-compute:${request.kind}`;
        const completed = `${prefix}:worker`;
        performance.clearMarks(completed);
        performance.mark(completed);
        const wasm = `${prefix}:wasm`;
        // Retain only this job's evidence; a JS-only result removes older Wasm
        // marks rather than accidentally certifying an earlier computation.
        performance.clearMarks(wasm);
        for (const name of markedKernels.get(request.kind) ?? [])
          performance.clearMarks(`${wasm}:${name}`);
        const kernels = Object.entries(response.kernels).filter(
          ([, calls]) => Number.isInteger(calls) && calls > 0,
        );
        markedKernels.set(
          request.kind,
          kernels.map(([name]) => name),
        );
        if (kernels.length) {
          performance.mark(wasm, { detail: response.kernels });
          for (const [name, calls] of kernels)
            performance.mark(`${wasm}:${name}`, { detail: { calls } });
        }
        request.complete(result);
      };
      created.onerror = () => {
        if (worker !== created) return;
        failWorker();
      };
      window.addEventListener("pagehide", stopWorker);
    } catch (error) {
      failWorker(permanentTransportError(error));
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
  // Each reply restores against its own immutable request snapshot. Cancellation
  // and Worker restart require no retained remote graph or routing state.
  const previous =
    job.kind === "routing" && job.interaction && job.options.previousMeta
      ? new Map(job.options.previousMeta)
      : null;
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
      } catch (error) {
        failWorker(permanentTransportError(error));
      } finally {
        complete(null);
      }
    };
    const timer = setTimeout(() => {
      failWorker();
    }, 120_000);
    pending.set(id, {
      complete,
      kind: job.kind,
      restoreRouting: previous
        ? (delta) => restoreRoutingDelta(delta, previous)
        : undefined,
      cleanup: () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
      },
    });
    signal?.addEventListener("abort", cancel, { once: true });
    try {
      // eslint-disable-next-line unicorn/require-post-message-target-origin
      active.postMessage({ id, job });
    } catch (error) {
      failWorker(permanentTransportError(error));
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
