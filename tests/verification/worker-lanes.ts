/* eslint-disable unicorn/require-post-message-target-origin -- Dedicated Workers have no targetOrigin. */
/* eslint-disable no-await-in-loop -- Each invalid-input case verifies that no host state was allocated. */
import {
  computeLayoutInWorker,
  computeOverlapsInWorker,
  computeRoutingInWorker,
} from "../../features/graph-editor/compute/worker-client";
import { hasComputeJobCoordinates } from "../../features/graph-editor/compute/worker-input";
import type {
  ComputeRequest,
  ComputeResponse,
  ComputeValue,
} from "../../features/graph-editor/compute/worker-protocol";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { GRAPH_MAX_ABS_COORDINATE } from "../../features/graph-editor/core/graph/graph-coordinates";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Worker lanes");
const model = {
  ...createEmptyGraphModel(),
  nodes: [{ id: "a", label: "A", order: 0, x: 0, y: 0 }],
};
let now = 0;
Object.defineProperty(performance, "now", {
  configurable: true,
  value: () => now,
});
const events = new EventTarget();
const listeners = new Set<EventListenerOrEventListenerObject>();
globalThis.window = {
  addEventListener(type: string, listener: EventListenerOrEventListenerObject) {
    if (type === "pagehide") listeners.add(listener);
    events.addEventListener(type, listener);
  },
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) {
    if (type === "pagehide") listeners.delete(listener);
    events.removeEventListener(type, listener);
  },
} as unknown as Window & typeof globalThis;
const timers = new Map<number, () => void>();
let timerId = 0;
const nativeSetTimeout = globalThis.setTimeout;
const nativeClearTimeout = globalThis.clearTimeout;
Object.defineProperty(globalThis, "setTimeout", {
  configurable: true,
  value: (callback: () => void) => {
    const id = ++timerId;
    timers.set(id, callback);
    return id;
  },
});
Object.defineProperty(globalThis, "clearTimeout", {
  configurable: true,
  value: (id: number) => timers.delete(id),
});
const workers: FakeWorker[] = [];
let constructorFailure = false;
let sendFailure = false;
let maxLive = 0;
class FakeWorker {
  name: string | undefined;
  messages: ComputeRequest[] = [];
  onmessage: ((event: MessageEvent<ComputeResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminated = false;
  throwOnTerminate = false;
  constructor(_url: URL, options: WorkerOptions) {
    if (constructorFailure) throw new Error("temporary construction failure");
    this.name = options.name;
    workers.push(this);
    maxLive = Math.max(
      maxLive,
      workers.filter((worker) => !worker.terminated).length,
    );
  }
  postMessage(request: ComputeRequest) {
    if (sendFailure) throw new Error("temporary send failure");
    this.messages.push(structuredClone(request));
  }
  terminate() {
    this.terminated = true;
    if (this.throwOnTerminate) throw new Error("host disposal failure");
  }
  reply(id: number, result: ComputeValue) {
    this.onmessage?.({
      data: structuredClone({ id, result, kernels: {} }),
    } as MessageEvent<ComputeResponse>);
  }
  request(index = this.messages.length - 1) {
    const request = this.messages[index];
    if (!request || !("id" in request))
      throw new Error("Missing submitted job");
    return request;
  }
}
globalThis.Worker = FakeWorker as unknown as typeof Worker;

function trackedAbort() {
  const controller = new AbortController();
  const attached = new Set<EventListenerOrEventListenerObject>();
  let removed = 0;
  const add = controller.signal.addEventListener.bind(controller.signal);
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions,
  ) => {
    attached.add(listener);
    add(type, listener, options);
  }) as typeof add;
  controller.signal.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
  ) => {
    attached.delete(listener);
    removed++;
    remove(type, listener);
  }) as typeof remove;
  return {
    controller,
    attached,
    get removed() {
      return removed;
    },
  };
}
const layout = {
  type: "move-nodes" as const,
  label: "Layout",
  after: { a: { x: 10, y: 20 } },
};
const overlap = {
  status: "resolved" as const,
  remainingPairs: 0,
  positions: { a: { x: 30, y: 40 } },
};
function dispose() {
  events.dispatchEvent(new Event("pagehide"));
}
function heavy() {
  return workers.findLast(
    (worker) => worker.name === "graph-compute-heavy" && !worker.terminated,
  )!;
}
function interactive() {
  return workers.findLast(
    (worker) => worker.name === "graph-compute" && !worker.terminated,
  )!;
}

try {
  for (const x of [
    NaN,
    Infinity,
    -Infinity,
    1e308,
    GRAPH_MAX_ABS_COORDINATE + 1,
  ]) {
    const invalid = { ...model, nodes: [{ ...model.nodes[0], x }] };
    expect(
      (await computeLayoutInWorker(invalid, "force")) === null &&
        (await computeOverlapsInWorker(invalid)) === null &&
        (await computeRoutingInWorker(invalid, {})) === null,
      "all client jobs reject unsupported coordinates before starting a Worker",
    );
    expect(
      (await computeRoutingInWorker(model, {}, undefined, {
        previousNodes: invalid.nodes,
        movedNodeIds: new Set(["a"]),
      })) === null &&
        (await computeRoutingInWorker(model, {}, undefined, {
          nodes: invalid.nodes,
          movedNodeIds: new Set(["a"]),
        })) === null,
      "compact and legacy interaction snapshots have the same coordinate boundary",
    );
  }
  expect(
    workers.length === 0 && timers.size === 0,
    "invalid input allocates no Worker or timeout",
  );
  expect(
    hasComputeJobCoordinates({
      kind: "overlap",
      model: {
        ...model,
        nodes: [
          {
            ...model.nodes[0],
            x: GRAPH_MAX_ABS_COORDINATE,
            y: -GRAPH_MAX_ABS_COORDINATE,
          },
        ],
      },
    }),
    "the shared coordinate boundary remains inclusive",
  );
  const sparse = Array.from(model.nodes);
  sparse.length = 2;
  expect(
    !hasComputeJobCoordinates({
      kind: "overlap",
      model: { ...model, nodes: sparse },
    }),
    "sparse position arrays cannot bypass validation",
  );
  const aborted = new AbortController();
  aborted.abort();
  expect(
    (await computeLayoutInWorker(model, "force", undefined, aborted.signal)) ===
      null && workers.length === 0,
    "pre-aborted requests allocate nothing",
  );

  const a = trackedAbort();
  const b = trackedAbort();
  const first = computeLayoutInWorker(
    model,
    "force",
    undefined,
    a.controller.signal,
  );
  const retainedModel = structuredClone(model);
  const retained = computeOverlapsInWorker(retainedModel, b.controller.signal);
  const routing = computeRoutingInWorker(model, {});
  const original = heavy();
  const light = interactive();
  const retainedId = original.request().id;
  const originalTimers = new Set(timers.keys());
  retainedModel.nodes[0].x = 123;
  expect(
    workers.length === 2 &&
      original.messages.length === 2 &&
      light.messages.length === 1,
    "force and overlap share the heavy lane; routing owns a separate lane",
  );
  a.controller.abort();
  expect(
    (await first) === null && original.terminated && a.attached.size === 0,
    "aborting an in-flight heavy job releases its owner and listeners immediately",
  );
  const replacement = heavy();
  expect(
    replacement !== original &&
      replacement.request().id === retainedId &&
      replacement.request().job.model.nodes[0].x === 0 &&
      timers.size === 2 &&
      [...timers.keys()].every((id) => originalTimers.has(id)) &&
      b.attached.size === 1,
    "parallel heavy jobs replay with their original input snapshot, IDs, deadlines and abort listener",
  );
  original.reply(retainedId, overlap);
  original.onerror?.();
  original.onmessageerror?.();
  light.reply(retainedId, overlap);
  expect(
    !replacement.terminated && timers.size === 2,
    "late old-owner replies/errors and cross-lane replies cannot settle or fail replacement work",
  );
  light.reply(light.request().id, new Map());
  expect(
    (await routing) instanceof Map && !replacement.terminated,
    "interactive completion does not wait for replayed heavy work",
  );
  replacement.reply(retainedId, overlap);
  expect(
    JSON.stringify(await retained) === JSON.stringify(overlap) &&
      b.attached.size === 0 &&
      timers.size === 0,
    "only the replacement owns the retained result and cleanup",
  );
  const beforeWarm = workers.length;
  const warm = computeLayoutInWorker(model, "force");
  replacement.reply(replacement.request().id, layout);
  expect(
    JSON.stringify(await warm) === JSON.stringify(layout) &&
      workers.length === beforeWarm,
    "completed heavy Workers stay warm for subsequent operations",
  );

  const c = trackedAbort();
  const d = trackedAbort();
  const third = computeLayoutInWorker(
    model,
    "force",
    undefined,
    c.controller.signal,
  );
  const fourth = computeOverlapsInWorker(model, d.controller.signal);
  c.controller.abort();
  expect((await third) === null, "an initializing heavy job can be cancelled");
  const replayed = heavy();
  d.controller.abort();
  expect(
    (await fourth) === null &&
      replayed.terminated &&
      !light.terminated &&
      timers.size === 0 &&
      d.attached.size === 0,
    "a retained request aborts its replacement owner rather than its original Worker",
  );
  const lightAbort = trackedAbort();
  const cancelledRouting = computeRoutingInWorker(
    model,
    {},
    lightAbort.controller.signal,
  );
  const cancelledRoutingId = light.request().id;
  lightAbort.controller.abort();
  expect(
    (await cancelledRouting) === null &&
      !light.terminated &&
      "cancel" in light.messages.at(-1)! &&
      lightAbort.attached.size === 0,
    "light abort preserves the warm lane and sends cooperative cancellation",
  );
  light.reply(cancelledRoutingId, new Map());
  const newHeavy = computeLayoutInWorker(model, "force");
  const newLight = computeRoutingInWorker(model, {});
  const disposingHeavy = heavy();
  disposingHeavy.throwOnTerminate = true;
  dispose();
  expect(
    (await newHeavy) === null &&
      (await newLight) === null &&
      timers.size === 0 &&
      listeners.size === 0 &&
      workers.every((worker) => worker.terminated),
    "pagehide settles both lanes even when host termination throws",
  );
  expect(
    maxLive === 2,
    "cancellation replacement never retains more than two Workers",
  );

  const failA = trackedAbort();
  const failedReplayAbort = trackedAbort();
  const interrupted = computeLayoutInWorker(
    model,
    "force",
    undefined,
    failA.controller.signal,
  );
  const failedReplay = computeOverlapsInWorker(
    model,
    failedReplayAbort.controller.signal,
  );
  const failedLight = computeRoutingInWorker(model, {});
  constructorFailure = true;
  failA.controller.abort();
  constructorFailure = false;
  expect(
    (await interrupted) === null &&
      (await failedReplay) === null &&
      (await failedLight) === null &&
      timers.size === 0 &&
      listeners.size === 0 &&
      failedReplayAbort.removed === 1,
    "replacement construction failure settles every pending fallback and releases both lanes",
  );
  expect(
    (await computeLayoutInWorker(model, "force")) === null,
    "transport failure retains the retry cooldown",
  );
  now += 1000;
  const recovery = computeLayoutInWorker(model, "force");
  heavy().reply(heavy().request().id, layout);
  expect(
    (await recovery) !== null,
    "a cancellation replacement failure can recover without permanently disabling Workers",
  );

  const timeoutAbort = trackedAbort();
  const timeoutFirst = computeLayoutInWorker(
    model,
    "force",
    undefined,
    timeoutAbort.controller.signal,
  );
  const expired = computeOverlapsInWorker(model);
  const lastDeadline = [...timers.values()].at(-1)!;
  timeoutAbort.controller.abort();
  expect(
    (await timeoutFirst) === null,
    "timeout fixture replaces the original owner",
  );
  lastDeadline();
  expect(
    (await expired) === null &&
      timers.size === 0 &&
      workers.every((worker) => worker.terminated),
    "replay keeps the original timeout and expires the replacement safely",
  );
  now += 1000;
  const finalA = trackedAbort();
  const finalCancelled = computeLayoutInWorker(
    model,
    "force",
    undefined,
    finalA.controller.signal,
  );
  const finalRetained = computeOverlapsInWorker(model);
  const finalLight = computeRoutingInWorker(model, {});
  sendFailure = true;
  finalA.controller.abort();
  sendFailure = false;
  expect(
    (await finalCancelled) === null &&
      (await finalRetained) === null &&
      (await finalLight) === null &&
      timers.size === 0 &&
      listeners.size === 0,
    "replacement send failure drains pending requests and original timers",
  );
} finally {
  dispose();
  globalThis.setTimeout = nativeSetTimeout;
  globalThis.clearTimeout = nativeClearTimeout;
}
finish();
