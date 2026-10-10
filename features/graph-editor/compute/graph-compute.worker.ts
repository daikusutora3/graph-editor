import { createEdgeRoutingTask } from "../core/layout/edge-routing";
import { interactiveRerouteEdgeIdsTask } from "../core/layout/interactive-routing";
import { createManualLayoutTask } from "../layouts/manual-layouts";
import { createOverlapTask } from "../layouts/resolve-node-overlaps";
import {
  initializeRustKernel,
  RustKernelCompatibilityError,
  withRustKernelDiagnostics,
  type RustKernelCalls,
} from "./rust-kernel";
import type {
  ComputeRequest,
  ComputeResponse,
  ComputeValue,
} from "./worker-protocol";
import { createRoutingDelta } from "./routing-result";
import { restoreRoutingInteractionNodes } from "./routing-interaction";
import { hasComputeJobCoordinates } from "./worker-input";

// No DOM or browser measurement APIs enter this worker. Measured widths are
// part of the immutable model supplied by the editor.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ComputeRequest>) => void) | null;
  postMessage: (message: ComputeResponse) => void;
};
const active = new Set<number>();
const cancelled = new Set<number>();
class UnsupportedComputeInputError extends Error {}

scope.onmessage = (event) => {
  const request = event.data;
  if ("cancel" in request) {
    if (active.has(request.cancel)) cancelled.add(request.cancel);
    return;
  }
  const { id, job } = request;
  active.add(id);
  void (async () => {
    let initialized = false;
    try {
      if (!hasComputeJobCoordinates(job))
        throw new UnsupportedComputeInputError("Unsupported graph coordinates");
      await initializeRustKernel();
      initialized = true;
      if (cancelled.has(id)) return;
      const task: Generator<void, ComputeValue> =
        job.kind === "routing"
          ? (function* () {
              const rerouteEdgeIds = job.interaction
                ? yield* interactiveRerouteEdgeIdsTask(
                    {
                      ...job.model,
                      nodes: restoreRoutingInteractionNodes(
                        job.model,
                        job.interaction,
                      ),
                    },
                    job.options.previousMeta ?? new Map(),
                    job.interaction.movedNodeIds,
                  )
                : job.options.rerouteEdgeIds;
              return yield* createEdgeRoutingTask(job.model, {
                ...job.options,
                rerouteEdgeIds,
              });
            })()
          : job.kind === "overlap"
            ? createOverlapTask(job.model)
            : createManualLayoutTask(job.model, job.layout, job.rootNodeId);
      const kernels: RustKernelCalls = {};
      while (!cancelled.has(id)) {
        const step = withRustKernelDiagnostics(kernels, () => {
          const deadline = performance.now() + 4;
          let current = task.next();
          while (!current.done && performance.now() < deadline)
            current = task.next();
          return current;
        });
        if (step.done) {
          const delta =
            job.kind === "routing" &&
            job.interaction &&
            job.options.previousMeta &&
            step.value instanceof Map
              ? createRoutingDelta(step.value, job.options.previousMeta)
              : null;
          const response: ComputeResponse = delta
            ? { id, routingDelta: delta, kernels }
            : { id, result: step.value, kernels };
          // A dedicated Worker posts to its owner, without a window targetOrigin.
          // eslint-disable-next-line unicorn/require-post-message-target-origin
          scope.postMessage(response);
          return;
        }
        // Also lets the Worker receive cancellation and replacement requests.
        // eslint-disable-next-line no-await-in-loop
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    } catch (error) {
      if (!cancelled.has(id)) {
        const response: ComputeResponse = {
          id,
          error:
            error instanceof Error ? error.message : "Graph computation failed",
          failure:
            !initialized &&
            !(error instanceof RustKernelCompatibilityError) &&
            !(error instanceof UnsupportedComputeInputError)
              ? "transient"
              : "permanent",
        };
        // eslint-disable-next-line unicorn/require-post-message-target-origin
        scope.postMessage(response);
      }
    } finally {
      active.delete(id);
      cancelled.delete(id);
    }
  })();
};
