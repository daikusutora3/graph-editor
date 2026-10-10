/* eslint-disable unicorn/require-post-message-target-origin -- Web Worker messages do not accept targetOrigin. */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createStore } from "jotai";

import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  computeLayoutInWorker,
  computeOverlapsInWorker,
  computeRoutingInWorker,
} from "../../features/graph-editor/compute/worker-client";
import type {
  ComputeRequest,
  ComputeResponse,
  ComputeValue,
} from "../../features/graph-editor/compute/worker-protocol";
import type { RustKernelCalls } from "../../features/graph-editor/compute/rust-kernel";
import { uninstallStorageFlushListeners } from "../../features/graph-editor/adapters/browser/stored-graph";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { createMoveNodesCommand } from "../../features/graph-editor/core/graph/graph-intents";
import type {
  GraphModel,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";
import {
  createEdgeRoutingTask,
  type EdgeRoutingMeta,
} from "../../features/graph-editor/core/layout/edge-routing";
import {
  createRoutingDelta,
  restoreRoutingDelta,
  type RoutingDelta,
} from "../../features/graph-editor/compute/routing-result";
import { interactiveRerouteEdgeIdsTask } from "../../features/graph-editor/core/layout/interactive-routing";
import { restoreRoutingInteractionNodes } from "../../features/graph-editor/compute/routing-interaction";
import { createManualLayoutCommand } from "../../features/graph-editor/layouts/manual-layouts";
import { resolveNodeOverlaps } from "../../features/graph-editor/layouts/resolve-node-overlaps";
import {
  applyManualLayoutAtom,
  layoutPendingAtom,
  resetEditorSessionAtom,
} from "../../features/graph-editor/shell/state/editor-actions";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  historyAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Wasm worker");
const childCase = process.argv[2];
const model: Omit<GraphModel, "nodes"> & {
  nodes: Array<GraphNode & { measuredWidth?: number }>;
} = {
  ...createEmptyGraphModel(),
  nodes: [
    {
      id: "a",
      label: "wide measured label",
      order: 0,
      x: 0,
      y: 0,
      measuredWidth: 240,
    },
    { id: "b", label: "B", order: 1, x: 24, y: 0 },
    { id: "c", label: "C", order: 2, x: 0, y: 24 },
  ],
  edges: [
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
  ],
};

if (childCase) {
  await verifyClient(childCase);
} else {
  verifyRoutingDelta();
  verifyRoutingInteraction();
  expect(
    (await computeLayoutInWorker(model, "force")) === null,
    "server rendering uses the fallback without a browser Worker",
  );
  await verifyRealWorker(false);
  await verifyRealWorker(true);
  await verifyRealWorker("abi");
  for (const scenario of [
    "normal",
    "constructor",
    "response-error",
    "event-error",
    "transient-response",
    "transient-send",
    "retry-limit",
    "send-error",
    "abort-error",
    "timeout",
    "routing-delta",
    "routing-delta-error",
    "routing-delta-wrong-job",
  ]) {
    const result = spawnSync(
      "bun",
      [fileURLToPath(import.meta.url), scenario],
      { encoding: "utf8", timeout: 10_000 },
    );
    expect(
      result.status === 0,
      `${scenario}: ${result.stdout.trim()} ${result.stderr.trim()}`,
    );
  }
}
finish();

function routeMeta(bowPx: number): EdgeRoutingMeta {
  return {
    bowPx,
    duplicate: false,
    loopDirectionDeg: -45,
    loopSweepDeg: 70,
    controlPointDistancesPx: [bowPx],
    controlPointWeights: [0.5],
  };
}

function verifyRoutingInteraction() {
  const current = [
    { id: "a", label: "first", order: 0, x: 0, y: 0, color: "blue" as const },
    { id: "b", label: "B", order: 1, x: 100, y: 0 },
    { id: "a", label: "duplicate", order: 2, x: 200, y: 0 },
  ];
  const previous = [
    { ...current[0]!, x: -100 },
    { ...current[2]!, x: -200 },
  ];
  const measuredModel = {
    ...model,
    nodes: current.map((node) => ({ ...node, measuredWidth: 999 })),
  };
  const legacy = [...current, ...previous];
  const compact = restoreRoutingInteractionNodes(measuredModel, {
    previousNodes: previous,
    movedNodeIds: new Set(["a"]),
  });
  expect(
    JSON.stringify(compact) === JSON.stringify(legacy) &&
      new Map(compact.map((node) => [node.id, node])).get("a") ===
        previous[1] &&
      !compact.some((node) => "measuredWidth" in node),
    "compact interactions retain obstacle order, both positions, colors, estimated widths and duplicate-id last-wins lookup",
  );
  expect(
    measuredModel.nodes.every((node) => node.measuredWidth === 999) &&
      compact !== current &&
      restoreRoutingInteractionNodes(measuredModel, {
        nodes: legacy,
        movedNodeIds: new Set(["a"]),
      }) === legacy,
    "interaction restoration preserves the measured route model and the legacy full-node contract",
  );
}

function verifyRoutingDelta() {
  const previous = new Map([
    ["removed", routeMeta(10)],
    ["ab", routeMeta(20)],
    ["bc", routeMeta(30)],
    ["de", routeMeta(40)],
  ]);
  const result = new Map([
    ["de", previous.get("de")!],
    ["added", routeMeta(50)],
    ["bc", previous.get("bc")!],
    ["ab", previous.get("ab")!],
  ]);
  const delta = createRoutingDelta(result, previous);
  expect(
    delta instanceof Map &&
      delta.get("de") === null &&
      delta.get("bc") === null &&
      delta.get("ab") === null &&
      delta.get("added")?.bowPx === 50,
    "responses use null markers when more than half of the routes are retained",
  );
  if (delta) {
    const restored = restoreRoutingDelta(structuredClone(delta), previous);
    expect(
      JSON.stringify([...restored]) === JSON.stringify([...result]) &&
        !restored.has("removed") &&
        restored.get("ab") === previous.get("ab"),
      "structured-cloned deltas preserve result order, additions, deletions and retained identity",
    );
  }
  const allRetained = createRoutingDelta(previous, previous);
  expect(
    allRetained instanceof Map &&
      [...allRetained.values()].every((value) => value === null),
    "an entirely retained result still carries its complete key order",
  );
  expect(
    createRoutingDelta(
      new Map([
        ["ab", previous.get("ab")!],
        ["bc", routeMeta(99)],
      ]),
      previous,
    ) === null &&
      createRoutingDelta(structuredClone(previous), previous) === null &&
      createRoutingDelta(new Map(), previous) === null,
    "half-retained, all-replaced and empty results keep the full response contract",
  );
  let rejected = false;
  try {
    restoreRoutingDelta(new Map([["missing", null]]), previous);
  } catch {
    rejected = true;
  }
  expect(
    rejected,
    "a null marker without its baseline must reject restoration",
  );
}

async function verifyRealWorker(failFirst: boolean | "abi") {
  const moduleUrl = new URL(
    "../../features/graph-editor/compute/graph-compute.worker.ts",
    import.meta.url,
  ).href;
  const bytesUrl = new URL(`../../public${RUST_KERNEL_URL}`, import.meta.url)
    .href;
  const source = `
    import { readFile } from "node:fs/promises";
    let calls = 0;
    globalThis.fetch = async (url) => {
      if (url !== ${JSON.stringify(RUST_KERNEL_URL)}) throw new Error("Unexpected kernel URL");
      calls++;
      await new Promise(resolve => setTimeout(resolve, 30));
      if (${failFirst === true} && calls === 1) return new Response(null, {status: 404});
      if (${failFirst === "abi"}) return new Response(new Uint8Array([0,97,115,109,1,0,0,0]));
      return new Response(await readFile(new URL(${JSON.stringify(bytesUrl)})));
    };
    await import(${JSON.stringify(moduleUrl)});
    postMessage({ready: true});
  `;
  const worker = new Worker(
    `data:application/javascript,${encodeURIComponent(source)}`,
  );
  const responses = new Map<number, ComputeResponse>();
  const waiters = new Map<number, (value: ComputeResponse) => void>();
  let ready: (() => void) | undefined;
  const readyPromise = new Promise<void>((resolve) => {
    ready = resolve;
  });
  worker.onmessage = (
    event: MessageEvent<ComputeResponse | { ready: true }>,
  ) => {
    if ("ready" in event.data) {
      ready!();
      return;
    }
    const response = event.data;
    responses.set(response.id, response);
    waiters.get(response.id)?.(response);
  };
  try {
    await bounded(readyPromise, "real worker starts");
    if (failFirst === "abi") {
      worker.postMessage({
        id: 1,
        job: { kind: "layout", model, layout: "force" },
      } satisfies ComputeRequest);
      const incompatible = await responseFor(1);
      expect(
        "error" in incompatible && incompatible.failure === "permanent",
        "the real Worker classifies incompatible modules as permanent failures",
      );
      return;
    }
    if (failFirst) {
      worker.postMessage({
        id: 1,
        job: { kind: "layout", model, layout: "force" },
      } satisfies ComputeRequest);
      const failed = await responseFor(1);
      expect(
        "error" in failed &&
          failed.failure === "transient" &&
          failed.error.includes("download failed"),
        "real Worker reports Wasm initialization failure",
      );
    } else {
      worker.postMessage({
        id: 1,
        job: { kind: "layout", model, layout: "force" },
      } satisfies ComputeRequest);
      worker.postMessage({ cancel: 1 } satisfies ComputeRequest);
    }
    worker.postMessage({
      id: 2,
      job: { kind: "layout", model, layout: "force", rootNodeId: "b" },
    } satisfies ComputeRequest);
    const layout = await responseFor(2);
    expect(
      "result" in layout &&
        (layout.kernels.force_layout ?? 0) > 0 &&
        !layout.kernels.resolve_overlaps &&
        JSON.stringify(layout.result) ===
          JSON.stringify(createManualLayoutCommand(model, "force", "b")),
      "real Worker produces the same force intent as the reference",
    );
    if (!failFirst)
      expect(
        !responses.has(1),
        "cancellation while Wasm initializes suppresses the cancelled result",
      );
    worker.postMessage({
      id: 3,
      job: { kind: "overlap", model },
    } satisfies ComputeRequest);
    const overlaps = await responseFor(3);
    expect(
      "result" in overlaps &&
        (overlaps.kernels.resolve_overlaps ?? 0) > 0 &&
        !overlaps.kernels.force_layout &&
        JSON.stringify(overlaps.result) ===
          JSON.stringify(resolveNodeOverlaps(model)),
      "real Worker keeps measured capsule geometry and overlap metadata",
    );
    const routingOptions = {
      mode: "quality" as const,
      previousMeta: new Map(),
      rerouteEdgeIds: new Set(["ab", "bc"]),
    };
    worker.postMessage({
      id: 4,
      job: { kind: "routing", model, options: routingOptions },
    } satisfies ComputeRequest);
    const routing = await responseFor(4);
    const task = createEdgeRoutingTask(model, routingOptions);
    let step = task.next();
    while (!step.done) step = task.next();
    expect(
      "result" in routing &&
        routing.result instanceof Map &&
        JSON.stringify([...routing.result]) === JSON.stringify([...step.value]),
      "real Worker round trips routing Maps and Sets through structured clone",
    );
    const dragGraph: GraphModel = {
      ...createEmptyGraphModel(),
      nodes: [
        { id: "a", label: "A", order: 0, x: -200, y: 0 },
        { id: "b", label: "B", order: 1, x: 200, y: 0 },
        { id: "c", label: "C", order: 2, x: 0, y: 400 },
        { id: "d", label: "D", order: 3, x: -200, y: 800 },
        { id: "e", label: "E", order: 4, x: 200, y: 800 },
        { id: "f", label: "F", order: 5, x: -200, y: 1600 },
        { id: "g", label: "G", order: 6, x: 200, y: 1600 },
      ],
      edges: [
        { id: "ab", source: "a", target: "b" },
        { id: "de", source: "d", target: "e" },
        { id: "fg", source: "f", target: "g" },
      ],
    };
    const baseline = complete(
      createEdgeRoutingTask(dragGraph, { mode: "simple" }),
    );
    const interaction = {
      previousNodes: [{ ...dragGraph.nodes[2]!, y: 0 }],
      movedNodeIds: new Set(["c"]),
    };
    const reroute = complete(
      interactiveRerouteEdgeIdsTask(
        {
          ...dragGraph,
          nodes: [...dragGraph.nodes, ...interaction.previousNodes],
        },
        baseline,
        interaction.movedNodeIds,
      ),
    );
    const currentOnly = complete(
      interactiveRerouteEdgeIdsTask(
        dragGraph,
        baseline,
        interaction.movedNodeIds,
      ),
    );
    expect(
      reroute?.has("ab") === true &&
        !reroute.has("de") &&
        currentOnly?.size === 0,
      "drag rerouting checks the obstacle's original and current positions",
    );
    worker.postMessage({
      id: 5,
      job: {
        kind: "routing",
        model: dragGraph,
        options: { mode: "quality", previousMeta: baseline },
        interaction,
      },
    } satisfies ComputeRequest);
    const dragged = await responseFor(5);
    const expectedDrag = complete(
      createEdgeRoutingTask(dragGraph, {
        mode: "quality",
        previousMeta: baseline,
        rerouteEdgeIds: reroute,
      }),
    );
    expect(
      "routingDelta" in dragged &&
        dragged.routingDelta.get("de") === null &&
        dragged.routingDelta.get("fg") === null,
      "real interactive Worker sends a delta when multiple remote routes are retained",
    );
    if ("routingDelta" in dragged) {
      const restored = restoreRoutingDelta(dragged.routingDelta, baseline);
      expect(
        JSON.stringify([...restored]) === JSON.stringify([...expectedDrag]),
        "real Worker delta restores the same reroute result and order as the complete task",
      );
    }
    worker.postMessage({
      id: 6,
      job: { kind: "routing", model, options: { mode: "simple" } },
    } satisfies ComputeRequest);
    const simple = await responseFor(6);
    expect(
      "result" in simple && Object.keys(simple.kernels).length === 0,
      "a real JS-only Worker route does not claim Rust kernel execution",
    );
    const measuredDrag = {
      ...dragGraph,
      nodes: dragGraph.nodes.map((node) =>
        node.id === "c"
          ? { ...node, x: 1000, y: 0, measuredWidth: 2400 }
          : node,
      ),
    };
    const previousNodes = [{ ...dragGraph.nodes[2]!, x: 1000 }];
    worker.postMessage({
      id: 7,
      job: {
        kind: "routing",
        model: measuredDrag,
        options: { mode: "quality", previousMeta: baseline },
        interaction: {
          previousNodes,
          movedNodeIds: new Set(["c"]),
        },
      },
    } satisfies ComputeRequest);
    const retainedMeasured = await responseFor(7);
    expect(
      "routingDelta" in retainedMeasured &&
        [...retainedMeasured.routingDelta.values()].every(
          (value) => value === null,
        ),
      "compact Worker selection keeps historical estimated widths while the routing model retains measured widths",
    );
  } finally {
    worker.terminate();
  }

  function responseFor(id: number): Promise<ComputeResponse> {
    const existing = responses.get(id);
    if (existing) return Promise.resolve(existing);
    return bounded(
      new Promise<ComputeResponse>((resolve) => {
        waiters.set(id, resolve);
      }),
      `real worker response ${id}`,
    );
  }
}

async function verifyClient(scenario: string) {
  let now = 0;
  Object.defineProperty(performance, "now", {
    configurable: true,
    value: () => now,
  });
  const events = new EventTarget();
  const pagehideListeners = new Set<EventListenerOrEventListenerObject>();
  const fakeWindow = {
    addEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      if (type === "pagehide") pagehideListeners.add(listener);
      events.addEventListener(type, listener);
    },
    removeEventListener(
      type: string,
      listener: EventListenerOrEventListenerObject,
    ) {
      if (type === "pagehide") pagehideListeners.delete(listener);
      events.removeEventListener(type, listener);
    },
    dispatchEvent: events.dispatchEvent.bind(events),
    localStorage: { getItem: () => null, setItem: () => {} },
    setTimeout,
    clearTimeout,
  };
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: fakeWindow,
  });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: Object.assign(new EventTarget(), {
      documentElement: {},
      createElement: () => ({ getContext: () => null }),
    }),
  });
  Object.defineProperty(globalThis, "getComputedStyle", {
    configurable: true,
    value: () => ({ getPropertyValue: () => "" }),
  });
  const workers: FakeWorker[] = [];
  class FakeWorker {
    messages: ComputeRequest[] = [];
    onmessage: ((event: MessageEvent<ComputeResponse>) => void) | null = null;
    onerror: (() => void) | null = null;
    terminated = false;
    throwOnCancel = false;
    constructor(url: URL, options: WorkerOptions) {
      if (scenario === "constructor")
        throw new DOMException("worker construction denied", "SecurityError");
      expect(
        url.pathname.endsWith("graph-compute.worker.ts") &&
          options.type === "module",
        "client creates the bundled module Worker",
      );
      workers.push(this);
    }
    postMessage(request: ComputeRequest) {
      if (scenario === "send-error")
        throw new DOMException("message not cloneable", "DataCloneError");
      if (
        (scenario === "transient-send" && workers.length === 1) ||
        (this.throwOnCancel && "cancel" in request)
      )
        throw new Error("transport failure");
      this.messages.push(structuredClone(request));
    }
    terminate() {
      this.terminated = true;
    }
    emit(
      response:
        | { id: number; result: ComputeValue; kernels?: RustKernelCalls }
        | { id: number; routingDelta: RoutingDelta; kernels?: RustKernelCalls }
        | Extract<ComputeResponse, { error: string }>,
    ) {
      this.onmessage?.({
        data: structuredClone(
          "error" in response ? response : { kernels: {}, ...response },
        ),
      } as MessageEvent<ComputeResponse>);
    }
  }
  Object.defineProperty(globalThis, "Worker", {
    configurable: true,
    value: FakeWorker,
  });

  if (scenario.startsWith("routing-delta")) {
    const firstBaseline = new Map([
      ["ab", routeMeta(10)],
      ["bc", routeMeta(20)],
      ["removed", routeMeta(30)],
    ]);
    const secondBaseline = new Map([
      ["ab", routeMeta(110)],
      ["bc", routeMeta(120)],
      ["ac", routeMeta(130)],
    ]);
    const firstSnapshot = new Map(firstBaseline);
    const secondSnapshot = new Map(secondBaseline);
    const interaction = {
      previousNodes: [model.nodes[0]!],
      movedNodeIds: new Set(["a"]),
    };
    const routingModel = {
      ...model,
      edges: [...model.edges, { id: "ac", source: "a", target: "c" }],
    };
    const submit = (
      baseline: ReadonlyMap<string, EdgeRoutingMeta>,
      signal?: AbortSignal,
    ) =>
      computeRoutingInWorker(
        routingModel,
        { mode: "quality", previousMeta: baseline },
        signal,
        interaction,
      );
    const requestFor = (transport: FakeWorker) =>
      transport.messages.at(-1)! as Extract<ComputeRequest, { id: number }>;
    if (scenario !== "routing-delta") {
      const malformed =
        scenario === "routing-delta-error"
          ? submit(firstBaseline)
          : computeLayoutInWorker(model, "force");
      const active = workers[0]!;
      const malformedRequest = requestFor(active);
      const other = computeOverlapsInWorker(model);
      active.emit({
        id: malformedRequest.id,
        routingDelta: new Map([["missing", null]]),
        kernels: { routing_node_collisions: 1 },
      });
      expect(
        (await malformed) === null &&
          (await other) === null &&
          active.terminated,
        "missing baselines and unexpected delta jobs fall back and settle concurrent work",
      );
      expect(
        !performance
          .getEntriesByType("mark")
          .some((entry) => entry.name.startsWith("graph-compute:")),
        "a failed restoration must not mark Worker or Rust computation as successful",
      );
      now = 100_000;
      expect(
        (await computeRoutingInWorker(model, {}, undefined, interaction)) ===
          null &&
          workers.length === 1 &&
          pagehideListeners.size === 0,
        "malformed delta responses disable their transport and release listeners",
      );
      return;
    }

    const first = submit(firstBaseline);
    const active = workers[0]!;
    const firstRequest = requestFor(active);
    const second = submit(secondBaseline);
    const secondRequest = requestFor(active);
    firstBaseline.clear();
    firstBaseline.set("ab", routeMeta(999));
    secondBaseline.set("bc", routeMeta(999));
    const firstDelta: RoutingDelta = new Map([
      ["bc", null],
      ["ac", routeMeta(50)],
      ["ab", null],
    ]);
    const secondDelta: RoutingDelta = new Map([
      ["ac", null],
      ["ab", null],
      ["bc", routeMeta(150)],
    ]);
    active.emit({ id: secondRequest.id, routingDelta: secondDelta });
    active.emit({ id: firstRequest.id, routingDelta: firstDelta });
    const [firstResult, secondResult] = await Promise.all([first, second]);
    expect(
      firstResult instanceof Map &&
        secondResult instanceof Map &&
        JSON.stringify([...firstResult]) ===
          JSON.stringify([...restoreRoutingDelta(firstDelta, firstSnapshot)]) &&
        JSON.stringify([...secondResult]) ===
          JSON.stringify([...restoreRoutingDelta(secondDelta, secondSnapshot)]),
      "out-of-order deltas restore against each request's submitted baseline despite later Map replacement",
    );
    expect(
      firstResult?.get("ab") === firstSnapshot.get("ab") &&
        secondResult?.get("ab") === secondSnapshot.get("ab") &&
        !firstResult?.has("removed"),
      "request baselines retain their own route identity and never resurrect deleted keys",
    );

    const controller = new AbortController();
    const cancelled = submit(firstSnapshot, controller.signal);
    const cancelledRequest = requestFor(active);
    controller.abort();
    performance.clearMarks();
    const replacement = submit(secondSnapshot);
    const replacementRequest = requestFor(active);
    active.emit({
      id: cancelledRequest.id,
      routingDelta: new Map([["missing", null]]),
      kernels: { routing_node_collisions: 99 },
    });
    expect(
      (await cancelled) === null &&
        !active.terminated &&
        performance.getEntriesByType("mark").length === 0,
      "late cancelled deltas are ignored without decoding or creating success marks",
    );
    active.emit({ id: replacementRequest.id, routingDelta: secondDelta });
    const replacementResult = await replacement;
    expect(
      replacementResult instanceof Map &&
        JSON.stringify([...replacementResult]) ===
          JSON.stringify([...restoreRoutingDelta(secondDelta, secondSnapshot)]),
      "late cancelled replies cannot alter the newer routing result",
    );
    events.dispatchEvent(new Event("pagehide"));
    expect(
      pagehideListeners.size === 0,
      "delta requests leave no pagehide listeners after shutdown",
    );
    return;
  }

  if (scenario === "constructor" || scenario === "send-error") {
    expect(
      (await computeLayoutInWorker(model, "force")) === null,
      "construction and send failure resolve to fallback",
    );
    expect(
      (await computeLayoutInWorker(model, "force")) === null,
      "a failed transport remains unavailable",
    );
    expect(
      workers.length === (scenario === "constructor" ? 0 : 1),
      "unavailable transport is not repeatedly created",
    );
    return;
  }
  if (scenario === "timeout") {
    const originalSetTimeout = globalThis.setTimeout;
    let timeout: (() => void) | undefined;
    globalThis.setTimeout = ((handler: () => void) => {
      timeout = handler;
      return 1;
    }) as unknown as typeof setTimeout;
    try {
      const promise = computeLayoutInWorker(model, "force");
      const other = computeOverlapsInWorker(model);
      timeout!();
      expect(
        (await promise) === null &&
          (await other) === null &&
          workers[0]!.terminated,
        "timed-out work terminates and resolves every pending request",
      );
      expect(
        (await computeLayoutInWorker(model, "force")) === null,
        "timed-out transport selects fallback for later calls",
      );
    } finally {
      globalThis.setTimeout = originalSetTimeout;
    }
    now = 1000;
    const retried = computeOverlapsInWorker(model);
    const replacement = workers.at(-1)!;
    const request = replacement.messages.at(-1)! as Extract<
      ComputeRequest,
      { id: number }
    >;
    replacement.emit({ id: request.id, result: resolveNodeOverlaps(model) });
    expect(
      (await retried) !== null && workers.length === 2,
      "a timed-out Worker can recover after its cooldown",
    );
    events.dispatchEvent(new Event("pagehide"));
    return;
  }
  if (
    scenario === "transient-response" ||
    scenario === "transient-send" ||
    scenario === "retry-limit"
  ) {
    const failures = scenario === "retry-limit" ? 3 : 1;
    for (let attempt = 0; attempt < failures; attempt++) {
      const failed = computeLayoutInWorker(model, "force");
      const active = workers.at(-1)!;
      if (scenario !== "transient-send") {
        const request = active.messages.at(-1)! as Extract<
          ComputeRequest,
          { id: number }
        >;
        active.emit({
          id: request.id,
          error: "temporary download failure",
          failure: "transient",
        });
      }
      expect(
        // Retry attempts must finish before advancing the fake cooldown clock.
        // eslint-disable-next-line no-await-in-loop
        (await failed) === null && active.terminated,
        "transient failures resolve pending work and stop the failed Worker",
      );
      expect(
        // eslint-disable-next-line no-await-in-loop
        (await computeOverlapsInWorker(model)) === null &&
          workers.length === attempt + 1 &&
          pagehideListeners.size === 0,
        "cooldown avoids repeated construction and releases pagehide listeners",
      );
      now += (attempt + 1) * 1000;
    }
    if (scenario === "retry-limit") {
      now += 100_000;
      expect(
        (await computeLayoutInWorker(model, "force")) === null &&
          workers.length === 3,
        "three consecutive failures stop retries for this page",
      );
      return;
    }
    const retried = computeOverlapsInWorker(model);
    const replacement = workers.at(-1)!;
    const request = replacement.messages.at(-1)! as Extract<
      ComputeRequest,
      { id: number }
    >;
    replacement.emit({ id: request.id, result: resolveNodeOverlaps(model) });
    expect(
      (await retried) !== null && workers.length === 2,
      "a later request restores a successful Worker after the cooldown",
    );
    // Success resets the failure budget, so a new fault waits one second.
    const fault = computeOverlapsInWorker(model);
    replacement.onerror!();
    expect((await fault) === null, "a later transport fault also settles work");
    now += 1000;
    const recovered = computeOverlapsInWorker(model);
    const third = workers.at(-1)!;
    const thirdRequest = third.messages.at(-1)! as Extract<
      ComputeRequest,
      { id: number }
    >;
    third.emit({ id: thirdRequest.id, result: resolveNodeOverlaps(model) });
    expect(
      (await recovered) !== null && workers.length === 3,
      "successful recovery resets the cooldown and consecutive-failure count",
    );
    events.dispatchEvent(new Event("pagehide"));
    return;
  }
  if (scenario === "abort-error") {
    let cancel: (() => void) | undefined;
    let removed = false;
    const signal = {
      aborted: false,
      addEventListener: (_type: string, listener: () => void) => {
        cancel = listener;
      },
      removeEventListener: () => {
        removed = true;
      },
    } as unknown as AbortSignal;
    const promise = computeLayoutInWorker(model, "force", undefined, signal);
    workers[0]!.throwOnCancel = true;
    try {
      cancel!();
    } catch {
      expect(false, "abort transport errors must not escape cancellation");
    }
    const result = await Promise.race([
      promise,
      new Promise<string>((resolve) =>
        setTimeout(() => resolve("unresolved"), 25),
      ),
    ]);
    expect(
      result === null && removed,
      "transport failure during abort still resolves and removes the listener",
    );
    return;
  }
  const first = computeLayoutInWorker(model, "force");
  const second = computeOverlapsInWorker(model);
  const active = workers[0]!;
  const firstRequest = active.messages[0]! as Extract<
    ComputeRequest,
    { id: number }
  >;
  if (scenario === "response-error" || scenario === "event-error") {
    if (scenario === "response-error")
      active.emit({
        id: firstRequest.id,
        error: "unsupported kernel ABI",
        failure: "permanent",
      });
    else active.onerror!();
    expect(
      (await first) === null && (await second) === null && active.terminated,
      "Worker errors settle all pending requests and terminate the Worker",
    );
    expect(
      (await computeLayoutInWorker(model, "force")) === null &&
        workers.length === 1,
      "failed Workers are not repeatedly created before recovery is allowed",
    );
    now = 1000;
    if (scenario === "response-error") {
      expect(
        (await computeLayoutInWorker(model, "force")) === null &&
          workers.length === 1,
        "permanent ABI failures are not retried after the cooldown",
      );
    } else {
      const retry = computeOverlapsInWorker(model);
      const replacement = workers.at(-1)!;
      const request = replacement.messages.at(-1)! as Extract<
        ComputeRequest,
        { id: number }
      >;
      replacement.emit({ id: request.id, result: resolveNodeOverlaps(model) });
      expect(
        (await retry) !== null && workers.length === 2,
        "Worker event errors recover after the cooldown",
      );
      events.dispatchEvent(new Event("pagehide"));
    }
    return;
  }
  const secondRequest = active.messages[1]! as Extract<
    ComputeRequest,
    { id: number }
  >;
  const expectedOverlap = resolveNodeOverlaps(model);
  active.emit({ id: secondRequest.id, result: expectedOverlap });
  active.emit({
    id: firstRequest.id,
    result: createManualLayoutCommand(model, "force"),
    kernels: { force_layout: 2 },
  });
  expect(
    JSON.stringify(await second) === JSON.stringify(expectedOverlap) &&
      (await first) !== null &&
      workers.length === 1,
    "out-of-order responses settle the matching IDs in a shared Worker",
  );
  expect(
    performance.getEntriesByName("graph-compute:layout:worker").length === 1 &&
      performance.getEntriesByName("graph-compute:layout:wasm").length === 1 &&
      (
        performance.getEntriesByName(
          "graph-compute:layout:wasm:force_layout",
        )[0] as PerformanceMark
      ).detail.calls === 2 &&
      performance.getEntriesByName("graph-compute:overlap:wasm").length === 0,
    "only actual kernel calls create Wasm marks, with their exact counts",
  );
  const jsOnly = computeLayoutInWorker(model, "line");
  const jsOnlyRequest = active.messages.at(-1)! as Extract<
    ComputeRequest,
    { id: number }
  >;
  active.emit({
    id: jsOnlyRequest.id,
    result: createManualLayoutCommand(model, "line"),
  });
  await jsOnly;
  expect(
    performance.getEntriesByName("graph-compute:layout:worker").length === 1 &&
      performance.getEntriesByName("graph-compute:layout:wasm").length === 0 &&
      performance.getEntriesByName("graph-compute:layout:wasm:force_layout")
        .length === 0,
    "a newer JS-only job clears older Rust evidence while marking Worker completion",
  );
  const aborted = new AbortController();
  aborted.abort();
  const messageCount = active.messages.length;
  expect(
    (await computeLayoutInWorker(model, "force", undefined, aborted.signal)) ===
      null && active.messages.length === messageCount,
    "already-aborted calls never submit work",
  );
  const controller = new AbortController();
  const cancelled = computeLayoutInWorker(
    model,
    "force",
    undefined,
    controller.signal,
  );
  const cancelledRequest = active.messages.at(-1)! as Extract<
    ComputeRequest,
    { id: number }
  >;
  controller.abort();
  expect(
    (await cancelled) === null && "cancel" in active.messages.at(-1)!,
    "aborting submitted work resolves immediately and forwards cancellation",
  );
  const routes = new Map([
    [
      "ab",
      {
        bowPx: 16,
        duplicate: false,
        loopDirectionDeg: -45,
        loopSweepDeg: 70,
        controlPointDistancesPx: [16],
        controlPointWeights: [0.5],
      },
    ],
  ]);
  const routed = computeRoutingInWorker(
    model,
    {
      mode: "quality",
      previousMeta: routes,
      rerouteEdgeIds: new Set(["ab"]),
    },
    undefined,
    { previousNodes: [model.nodes[0]!], movedNodeIds: new Set(["a"]) },
  );
  const routedRequest = active.messages.at(-1)! as Extract<
    ComputeRequest,
    { id: number }
  >;
  active.emit({
    id: cancelledRequest.id,
    result: createManualLayoutCommand(model, "force"),
  });
  active.emit({ id: routedRequest.id, result: routes });
  const result = await routed;
  expect(
    result instanceof Map &&
      JSON.stringify([...result]) === JSON.stringify([...routes]),
    "late cancelled responses cannot replace newer routing results",
  );
  expect(
    routedRequest.job.kind === "routing" &&
      routedRequest.job.options.rerouteEdgeIds instanceof Set,
    "routing options retain Maps and Sets across the transport",
  );
  expect(
    routedRequest.job.kind === "routing" &&
      routedRequest.job.interaction?.movedNodeIds.has("a") === true &&
      "previousNodes" in routedRequest.job.interaction &&
      routedRequest.job.interaction.previousNodes.length === 1 &&
      !Object.hasOwn(routedRequest.job.interaction, "nodes"),
    "client sends only the old moved nodes alongside the moved-node Set",
  );

  await verifyEditor(active);
  const hidden = computeLayoutInWorker(model, "force");
  events.dispatchEvent(new Event("pagehide"));
  expect(
    (await hidden) === null && active.terminated,
    "pagehide terminates the Worker and settles pending requests",
  );
  const resumed = computeOverlapsInWorker(model);
  const replacement = workers.at(-1)!;
  const replacementRequest = replacement.messages.at(-1)! as Extract<
    ComputeRequest,
    { id: number }
  >;
  // Owner-side events already queued before terminate must remain confined to
  // their original Worker even when another Worker has since been created.
  active.emit({
    id: replacementRequest.id,
    error: "late transport error",
    failure: "permanent",
  });
  active.onerror!();
  expect(
    !replacement.terminated,
    "events from a terminated Worker cannot stop its replacement",
  );
  replacement.emit({ id: replacementRequest.id, result: expectedOverlap });
  expect(
    JSON.stringify(await resumed) === JSON.stringify(expectedOverlap) &&
      workers.length === 2,
    "returning to the page can recreate a usable Worker",
  );
  const afterStaleEvent = computeOverlapsInWorker(model);
  const afterStaleRequest = replacement.messages.at(-1)! as Extract<
    ComputeRequest,
    { id: number }
  >;
  replacement.emit({ id: afterStaleRequest.id, result: expectedOverlap });
  expect(
    JSON.stringify(await afterStaleEvent) === JSON.stringify(expectedOverlap) &&
      workers.length === 2,
    "stale Worker errors do not disable future computation or trigger recreation",
  );
  expect(
    pagehideListeners.size === 1,
    "Worker recreation does not accumulate pagehide listeners",
  );
  events.dispatchEvent(new Event("pagehide"));

  async function verifyEditor(transport: FakeWorker) {
    const store = createStore();
    const input = {
      ...model,
      nodes: model.nodes.map(({ measuredWidth: _width, ...node }) => node),
    };
    store.set(syncExternalGraphAtom, input);
    const force = store.set(applyManualLayoutAtom, "force");
    const request = latestJob();
    expect(
      store.get(layoutPendingAtom) && request.job.kind === "layout",
      "editor displays pending state while the Worker computes force layout",
    );
    transport.emit({
      id: request.id,
      result: createManualLayoutCommand(request.job.model, "force"),
    });
    expect(
      (await force).status === "applied" &&
        !store.get(layoutPendingAtom) &&
        store.get(historyAtom).length === 1,
      "Worker force results commit once and clear pending state",
    );
    expect(
      !JSON.stringify(store.get(graphAtom)).includes("measuredWidth"),
      "transient measured geometry does not enter the persisted editor model",
    );
    store.set(undoAtom);
    expect(
      JSON.stringify(store.get(graphAtom)) === JSON.stringify(input),
      "Worker layout remains undoable",
    );
    const spread = store.set(applyManualLayoutAtom, "spread");
    const overlapRequest = latestJob();
    const overlap = resolveNodeOverlaps(overlapRequest.job.model);
    transport.emit({ id: overlapRequest.id, result: overlap });
    const spreadResult = await spread;
    expect(
      spreadResult.status === "applied" &&
        "overlap" in spreadResult &&
        spreadResult.overlap?.remainingPairs === 0,
      "Worker overlap results retain status metadata for the editor",
    );
    const stale = store.set(applyManualLayoutAtom, "force");
    const staleRequest = latestJob();
    store.set(syncExternalGraphAtom, store.get(graphAtom));
    const unchanged = store.get(graphAtom);
    const history = store.get(historyAtom);
    transport.emit({
      id: staleRequest.id,
      result: createMoveNodesCommand("stale", { a: { x: 999, y: 999 } }),
    });
    expect(
      (await stale).status === "rejected" &&
        store.get(graphAtom) === unchanged &&
        store.get(historyAtom) === history,
      "external revision changes reject stale Worker results without history changes",
    );
    const superseded = store.set(applyManualLayoutAtom, "force");
    store.set(applyManualLayoutAtom, "line");
    expect(
      (await superseded).status === "rejected" && !store.get(layoutPendingAtom),
      "new synchronous layouts cancel old Worker requests",
    );
    const older = store.set(applyManualLayoutAtom, "force");
    const newer = store.set(applyManualLayoutAtom, "force");
    const newerRequest = latestJob();
    expect(
      (await older).status === "rejected" && store.get(layoutPendingAtom),
      "older cancellation cannot clear newer pending state",
    );
    transport.emit({
      id: newerRequest.id,
      result: createManualLayoutCommand(newerRequest.job.model, "force"),
    });
    await newer;
    expect(
      !store.get(layoutPendingAtom),
      "latest Worker completion clears pending state",
    );
    const reset = store.set(applyManualLayoutAtom, "force");
    store.set(resetEditorSessionAtom);
    expect(
      (await reset).status === "rejected" &&
        store.get(historyAtom).length === 0 &&
        !store.get(layoutPendingAtom),
      "session reset cancels Worker computation without a later commit",
    );
    store.set(syncExternalGraphAtom, input);
    uninstallStorageFlushListeners();
    function latestJob() {
      return transport.messages.at(-1)! as Extract<
        ComputeRequest,
        { id: number }
      >;
    }
  }
}

async function bounded<T>(
  promise: Promise<T>,
  description: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(description)), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function complete<T>(task: Generator<void, T>): T {
  let step = task.next();
  while (!step.done) step = task.next();
  return step.value;
}
