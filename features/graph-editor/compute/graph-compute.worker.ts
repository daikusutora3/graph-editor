import { createEdgeRoutingTask } from "../core/layout/edge-routing";
import { interactiveRerouteEdgeIdsTask } from "../core/layout/interactive-routing";
import { createManualLayoutTask } from "../layouts/manual-layouts";
import { createOverlapTask } from "../layouts/resolve-node-overlaps";
import { initializeRustKernel } from "./rust-kernel";
import type {
  ComputeRequest,
  ComputeResponse,
  ComputeValue,
} from "./worker-protocol";

// No DOM or browser measurement APIs enter this worker. Measured widths are
// part of the immutable model supplied by the editor.
const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<ComputeRequest>) => void) | null;
  postMessage: (message: ComputeResponse) => void;
};
const active = new Set<number>();
const cancelled = new Set<number>();

scope.onmessage = (event) => {
  const request = event.data;
  if ("cancel" in request) {
    if (active.has(request.cancel)) cancelled.add(request.cancel);
    return;
  }
  const { id, job } = request;
  active.add(id);
  void (async () => {
    try {
      await initializeRustKernel();
      if (cancelled.has(id)) return;
      const task: Generator<void, ComputeValue> =
        job.kind === "routing"
          ? (function* () {
              const rerouteEdgeIds = job.interaction
                ? yield* interactiveRerouteEdgeIdsTask(
                    { ...job.model, nodes: job.interaction.nodes },
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
      while (!cancelled.has(id)) {
        const deadline = performance.now() + 4;
        let step = task.next();
        while (!step.done && performance.now() < deadline) step = task.next();
        if (step.done) {
          // A dedicated Worker posts to its owner, without a window targetOrigin.
          // eslint-disable-next-line unicorn/require-post-message-target-origin
          scope.postMessage({ id, result: step.value });
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
