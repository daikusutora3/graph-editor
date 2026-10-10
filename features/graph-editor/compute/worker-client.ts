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
import { isComputeResult } from "./worker-result";
import { hasComputeJobCoordinates } from "./worker-input";

type WorkerLane = "interactive" | "heavy";
type Pending = {
  complete: (result: ComputeValue | null) => void;
  cleanup: () => void;
  kind: ComputeJob["kind"];
  job: ComputeJob;
  owner: Worker;
  restoreRouting?: (delta: RoutingDelta) => Map<string, EdgeRoutingMeta>;
};
// Heavy synchronous Rust calls cannot receive an abort message until they
// finish. Isolate them so interactive routing retains a warm, responsive lane.
// Keep at most two warm Workers; abort and pagehide release their ownership.
const workers: Record<WorkerLane, Worker | null> = {
  interactive: null,
  heavy: null,
};
let unavailable = false;
let consecutiveFailures = 0;
let retryAfter = 0;
const MAX_CONSECUTIVE_FAILURES = 3;
const RETRY_COOLDOWN_MS = 1000;
let nextId = 0;
const pending = new Map<number, Pending>();
const markedKernels = new Map<ComputeJob["kind"], string[]>();

function completeRequest(
  id: number,
  request: Pending,
  result: ComputeValue | null,
) {
  pending.delete(id);
  try {
    request.cleanup();
  } catch {
    // Host cleanup must not leave this or concurrent requests unresolved.
  }
  request.complete(result);
}

function recordCompletion(
  kind: ComputeJob["kind"],
  kernels: [string, number][],
) {
  // Performance diagnostics are optional. A browser instrumentation failure
  // must not discard a completed result or consume the Worker retry budget.
  try {
    const prefix = `graph-compute:${kind}`;
    const completed = `${prefix}:worker`;
    const wasm = `${prefix}:wasm`;
    performance.clearMarks(completed);
    performance.clearMarks(wasm);
    for (const name of markedKernels.get(kind) ?? [])
      performance.clearMarks(`${wasm}:${name}`);
    markedKernels.set(
      kind,
      kernels.map(([name]) => name),
    );
    performance.mark(completed);
    if (kernels.length) {
      performance.mark(wasm, { detail: Object.fromEntries(kernels) });
      for (const [name, calls] of kernels)
        performance.mark(`${wasm}:${name}`, { detail: { calls } });
    }
  } catch {
    // The request has already completed; diagnostics do not own its lifetime.
  }
}

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
  for (const lane of ["interactive", "heavy"] as const) releaseWorker(lane);
  for (const [id, request] of pending) completeRequest(id, request, null);
}

function releaseWorker(lane: WorkerLane) {
  const active = workers[lane];
  workers[lane] = null;
  try {
    active?.terminate();
  } catch {
    // Host disposal must not strand pending work or retain stale ownership.
  }
}

function getWorker(lane: WorkerLane) {
  if (
    unavailable ||
    performance.now() < retryAfter ||
    typeof window === "undefined" ||
    typeof Worker === "undefined"
  )
    return null;
  if (!workers[lane]) {
    try {
      const created = new Worker(
        new URL("./graph-compute.worker.ts", import.meta.url),
        {
          type: "module",
          name: lane === "heavy" ? "graph-compute-heavy" : "graph-compute",
        },
      );
      workers[lane] = created;
      created.onmessage = (event: MessageEvent<ComputeResponse>) => {
        if (workers[lane] !== created) return;
        try {
          const response = event.data;
          if (
            !response ||
            typeof response !== "object" ||
            !Number.isSafeInteger(response.id)
          )
            throw new Error("Invalid Worker response");
          const request = pending.get(response.id);
          if (!request || request.owner !== created) return;
          if ("error" in response) {
            completeRequest(response.id, request, null);
            failWorker(response.failure === "permanent");
            return;
          }
          let result: ComputeValue;
          if ("routingDelta" in response) {
            if (
              !request.restoreRouting ||
              !(response.routingDelta instanceof Map)
            )
              throw new Error("Unexpected routing delta");
            result = request.restoreRouting(response.routingDelta);
          } else {
            if (!("result" in response) || !response.result)
              throw new Error("Missing Worker result");
            result = response.result;
          }
          if (!isComputeResult(request.kind, result))
            throw new Error("Invalid Worker result");
          if (
            !response.kernels ||
            typeof response.kernels !== "object" ||
            Array.isArray(response.kernels)
          )
            throw new Error("Invalid Worker diagnostics");
          const kernels = Object.entries(response.kernels).filter(
            ([, calls]) => Number.isInteger(calls) && calls > 0,
          );
          // Keep the timeout and abort listener until all response processing
          // that can invalidate the result has succeeded.
          completeRequest(response.id, request, result);
          consecutiveFailures = 0;
          retryAfter = 0;
          recordCompletion(request.kind, kernels);
        } catch {
          failWorker(true);
        }
      };
      created.onerror = () => {
        if (workers[lane] !== created) return;
        failWorker();
      };
      created.onmessageerror = () => {
        if (workers[lane] !== created) return;
        failWorker();
      };
      window.addEventListener("pagehide", stopWorker);
    } catch (error) {
      failWorker(permanentTransportError(error));
      return null;
    }
  }
  return workers[lane];
}

function jobLane(job: ComputeJob): WorkerLane {
  return job.kind === "overlap" ||
    (job.kind === "layout" && job.layout === "force")
    ? "heavy"
    : "interactive";
}

function sendRequest(id: number, request: Pending, active: Worker) {
  request.owner = active;
  try {
    // eslint-disable-next-line unicorn/require-post-message-target-origin
    active.postMessage({ id, job: request.job });
  } catch (error) {
    failWorker(permanentTransportError(error));
  }
}

function cancelHeavyWorker(active: Worker) {
  if (workers.heavy !== active) return;
  const retained = [...pending].filter(
    ([, request]) => request.owner === active,
  );
  releaseWorker("heavy");
  if (retained.length === 0) return;
  const replacement = getWorker("heavy");
  if (!replacement) {
    for (const [id, request] of retained)
      if (pending.get(id) === request) completeRequest(id, request, null);
    return;
  }
  for (const [id, request] of retained) {
    // A send failure can have settled the whole batch. Keep each request's
    // original ID, timeout and abort listener when replaying concurrent work.
    if (pending.get(id) === request) sendRequest(id, request, replacement);
  }
}

function run(
  job: ComputeJob,
  signal?: AbortSignal,
): Promise<ComputeValue | null> {
  if (signal?.aborted || !hasComputeJobCoordinates(job))
    return Promise.resolve(null);
  const lane = jobLane(job);
  const active = getWorker(lane);
  if (!active) return Promise.resolve(null);
  // A cancelled heavy owner can replay concurrent jobs. Match the initial
  // postMessage snapshot even if a caller later mutates the supplied model.
  let snapshot = job;
  if (lane === "heavy") {
    try {
      snapshot = structuredClone(job);
    } catch (error) {
      failWorker(permanentTransportError(error));
      return Promise.resolve(null);
    }
  }
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
      completeRequest(id, request, null);
      if (lane === "heavy") {
        cancelHeavyWorker(request.owner);
        return;
      }
      try {
        // Web Worker messages do not accept a window targetOrigin.
        // eslint-disable-next-line unicorn/require-post-message-target-origin
        request.owner.postMessage({ cancel: id });
      } catch (error) {
        failWorker(permanentTransportError(error));
      }
    };
    const timer = setTimeout(() => {
      if (pending.has(id)) failWorker();
    }, 120_000);
    pending.set(id, {
      complete,
      kind: job.kind,
      job: snapshot,
      owner: active,
      restoreRouting: previous
        ? (delta) => restoreRoutingDelta(delta, previous)
        : undefined,
      cleanup: () => {
        clearTimeout(timer);
        signal?.removeEventListener("abort", cancel);
      },
    });
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    else sendRequest(id, pending.get(id)!, active);
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
