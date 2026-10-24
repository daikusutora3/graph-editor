import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import * as routing from "../../features/graph-editor/core/layout/edge-routing";
import * as kernel from "../../features/graph-editor/compute/rust-kernel";

// Execute the real hook with deterministic effect, Worker and frame owners.
// Browser metrics and actual Worker transport have independent coverage.
let currentHarness;
mock.module("react", () => ({
  ...React,
  useState: (initial) => currentHarness.state(initial),
  useRef: (initial) => currentHarness.ref(initial),
  useMemo: (create, deps) => currentHarness.memo(create, deps),
  useCallback: (callback, deps) => currentHarness.memo(() => callback, deps),
  useEffect: (effect, deps) => currentHarness.effect(effect, deps),
  useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
}));
const feature = (path) =>
  new URL(`../../features/graph-editor/${path}`, import.meta.url).pathname;
let kernelReady = false;
mock.module(feature("compute/rust-kernel.ts"), () => ({
  ...kernel,
  getRustKernelReady: () => kernelReady,
  subscribeRustKernel: () => () => {},
  initializeRustKernel: async () => {},
}));
let measurements = [],
  clearedMeasurements = 0,
  fontVersion = 0;
let rootFontSize = 16;
const measuredModel = (model) => ({
  ...model,
  nodes: model.nodes.map((node) => ({
    ...node,
    measuredWidth: 60 + node.label.length * 8 + fontVersion,
    measuredHeight: rootFontSize * 3,
  })),
});
mock.module(feature("adapters/browser/node-geometry.ts"), () => ({
  clearNodeMeasurements: () => clearedMeasurements++,
  withMeasuredNodeGeometry: (model) => {
    const measured = measuredModel(model);
    measurements.push({ source: model, measured });
    return measured;
  },
}));
const realCompute = routing.computeEdgeRouting;
const realCreateTask = routing.createEdgeRoutingTask;
let computeDepth = 0;
const originalCompute = (...args) => {
  computeDepth++;
  try {
    return realCompute(...args);
  } finally {
    computeDepth--;
  }
};
const originalCacheKey = routing.createEdgeRoutingCacheKey;
let cacheKeyCalls = 0,
  provisional = [],
  fallbackTasks = [];
mock.module(feature("core/layout/edge-routing.ts"), () => ({
  ...routing,
  createEdgeRoutingCacheKey: (...args) => {
    cacheKeyCalls++;
    return originalCacheKey(...args);
  },
  computeEdgeRouting: (model, options) => {
    const result = originalCompute(model, options);
    provisional.push({ model, options, result });
    return result;
  },
  createEdgeRoutingTask: (model, options) => {
    if (computeDepth > 0) return realCreateTask(model, options);
    const record = { model, options, advances: 0 };
    fallbackTasks.push(record);
    return (function* () {
      record.advances++;
      yield;
      record.advances++;
      yield;
      record.advances++;
      return originalCompute(model, { mode: "simple" });
    })();
  },
}));
let requests = [];
mock.module(feature("compute/worker-client.ts"), () => ({
  computeRoutingInWorker: (model, options, signal) =>
    new Promise((resolve) =>
      requests.push({ model, options, signal, resolve }),
    ),
}));
const fonts = new Set(),
  frames = new Map(),
  probes = new Set(),
  typographyMutations = [],
  typographyResizes = [];
let nextFrame = 0;
Object.assign(globalThis, {
  document: {
    documentElement: {},
    body: { append: (probe) => probes.add(probe) },
    createElement: () => {
      const probe = {
        style: {},
        setAttribute() {},
        remove: () => probes.delete(probe),
      };
      return probe;
    },
    fonts: {
      addEventListener: (_event, callback) => fonts.add(callback),
      removeEventListener: (_event, callback) => fonts.delete(callback),
    },
  },
  window: { addEventListener() {}, removeEventListener() {} },
  getComputedStyle: () => ({
    fontSize: `${rootFontSize}px`,
    fontFamily: "system-ui",
    getPropertyValue: () => "",
  }),
  MutationObserver: class {
    constructor(callback) {
      this.callback = callback;
      typographyMutations.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  },
  ResizeObserver: class {
    constructor(callback) {
      this.callback = callback;
      typographyResizes.push(this);
    }
    observe() {}
    disconnect() {
      this.disconnected = true;
    }
  },
  requestAnimationFrame: (callback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  },
  cancelAnimationFrame: (id) => frames.delete(id),
});
const { useEdgeRoutingMeta } = await import(
  feature("canvas/use-edge-routing-meta.ts")
);

const sameDeps = (a, b) =>
  a &&
  b &&
  a.length === b.length &&
  a.every((value, index) => Object.is(value, b[index]));
function harness(renderHook) {
  const slots = [],
    effects = new Map();
  let cursor = 0,
    queued = [],
    dirty = false,
    mounted = true,
    value;
  const api = {
    lateUpdates: 0,
    state(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (update) => {
          if (!mounted) {
            api.lateUpdates++;
            return;
          }
          const next =
            typeof update === "function" ? update(slots[index]) : update;
          if (!Object.is(slots[index], next)) {
            slots[index] = next;
            dirty = true;
          }
        },
      ];
    },
    ref(initial) {
      const index = cursor++;
      return (slots[index] ??= { current: initial });
    },
    memo(create, deps) {
      const index = cursor++;
      if (!sameDeps(slots[index]?.deps, deps))
        slots[index] = { value: create(), deps };
      return slots[index].value;
    },
    effect(effect, deps) {
      const index = cursor++,
        previous = effects.get(index);
      if (!sameDeps(previous?.deps, deps))
        queued.push(() => {
          previous?.cleanup?.();
          effects.set(index, { effect, deps, cleanup: effect() });
        });
    },
    render() {
      currentHarness = api;
      cursor = 0;
      dirty = false;
      queued = [];
      value = renderHook();
      queued.forEach((effect) => effect());
      return value;
    },
    async flush() {
      for (let turn = 0; turn < 8; turn++) {
        // oxlint-disable-next-line no-await-in-loop
        await Promise.resolve();
        if (mounted && dirty) api.render();
      }
      return value;
    },
    unmount() {
      mounted = false;
      effects.forEach(({ cleanup }) => cleanup?.());
    },
    get value() {
      return value;
    },
  };
  return api;
}
function fixture(nodeCount = 3, settings = {}) {
  assert.equal(frames.size, 0);
  assert.equal(fonts.size, 0);
  assert.equal(probes.size, 0);
  kernelReady = false;
  fontVersion = 0;
  rootFontSize = 16;
  measurements = [];
  clearedMeasurements = 0;
  cacheKeyCalls = 0;
  provisional = [];
  fallbackTasks = [];
  requests = [];
  const state = {
    graph: {
      ...createEmptyGraphModel({ autoEdgeRouting: true, ...settings }),
      nodes: Array.from({ length: nodeCount }, (_, index) => ({
        id: `n${index}`,
        label: `${index}日本語`,
        order: index,
        x: index * 100,
        y: (index % 2) * 100,
      })),
      edges: Array.from({ length: nodeCount * 5 }, (_, index) => ({
        id: `e${index}`,
        source: `n${index % nodeCount}`,
        target: `n${(index + Math.floor(index / nodeCount) + 1) % nodeCount}`,
      })),
    },
  };
  const hook = harness(() => useEdgeRoutingMeta(state.graph));
  hook.render();
  return { state, hook };
}
const complete = (request) =>
  request.resolve(originalCompute(request.model, { mode: "simple" }));
function runFrame() {
  const [id, callback] = frames.entries().next().value;
  frames.delete(id);
  callback();
}

{
  const { state, hook } = fixture(1000);
  assert.equal(
    measurements.length,
    1,
    "Startup prepares one measured snapshot",
  );
  assert.equal(measurements[0].measured, provisional[0].model);
  assert.equal(measurements[0].measured, requests[0].model);
  assert(state.graph.nodes.every((node) => !("measuredWidth" in node)));
  assert.deepEqual(
    provisional[0].result,
    originalCompute(measuredModel(state.graph), { mode: "parallel" }),
  );
  const accept = hook.value.acceptRoutingMeta,
    keyCalls = cacheKeyCalls;
  kernelReady = true;
  hook.render();
  assert.equal(hook.value.acceptRoutingMeta, accept);
  assert.equal(
    requests.length,
    1,
    "Main kernel readiness retains pending Worker ownership",
  );
  assert.equal(requests[0].signal.aborted, false);
  assert.equal(measurements.length, 1);
  complete(requests[0]);
  await hook.flush();
  assert.equal(hook.value.routingReady, true);
  assert.equal(
    cacheKeyCalls,
    keyCalls,
    "Same-model completion reuses its cache key",
  );
  assert.equal(measurements.length, 1);
  hook.unmount();
}
{
  const { state, hook } = fixture(),
    stale = requests[0];
  state.graph = {
    ...state.graph,
    nodes: state.graph.nodes.map((node, index) =>
      index === 0 ? { ...node, x: 10 } : node,
    ),
  };
  hook.render();
  assert(stale.signal.aborted, "Actual graph edits cancel obsolete work");
  assert.equal(requests.length, 2);
  assert.equal(measurements.length, 2);
  complete(stale);
  await hook.flush();
  assert.equal(
    hook.value.routingReady,
    false,
    "Obsolete responses are ignored",
  );
  complete(requests[1]);
  await hook.flush();
  assert.equal(hook.value.routingReady, true);
  state.graph = {
    ...state.graph,
    settings: { ...state.graph.settings, autoEdgeRouting: false },
  };
  hook.render();
  assert.equal(requests.length, 3);
  assert.equal(requests[2].options.mode, "simple");
  hook.unmount();
  assert(requests[2].signal.aborted);
  complete(requests[2]);
  await hook.flush();
  assert.equal(hook.lateUpdates, 0);
}
{
  const { hook } = fixture(),
    previous = requests[0];
  fontVersion = 100;
  fonts.forEach((notify) => notify());
  await hook.flush();
  assert.equal(clearedMeasurements, 1);
  assert(previous.signal.aborted, "New font geometry cancels obsolete work");
  assert.equal(requests.length, 2);
  assert.equal(measurements.length, 2);
  assert.equal(
    requests[1].model.nodes[0].measuredWidth,
    previous.model.nodes[0].measuredWidth + 100,
  );
  hook.unmount();
}
{
  const { state, hook } = fixture();
  const dragged = {
    ...state.graph,
    nodes: state.graph.nodes.map((node) => ({ ...node, x: node.x + 50 })),
  };
  const meta = originalCompute(measuredModel(dragged), { mode: "simple" });
  hook.value.acceptRoutingMeta(dragged, meta);
  assert.equal(
    measurements.length,
    2,
    "A separate drag model is independently measured",
  );
  state.graph = dragged;
  hook.render();
  assert.equal(hook.value.edgeRoutingMeta, meta);
  assert.equal(hook.value.routingReady, true);
  assert.equal(requests.length, 1, "Accepted drag routes are not recomputed");
  hook.unmount();
}
{
  const { hook } = fixture();
  const original = requests[0];
  rootFontSize = 24;
  typographyMutations
    .filter((observer) => !observer.disconnected)
    .forEach((observer) => observer.callback());
  typographyResizes
    .filter((observer) => !observer.disconnected)
    .forEach((observer) => observer.callback());
  await hook.flush();
  assert(
    original.signal.aborted,
    "runtime root font styles cancel the stale routing owner",
  );
  assert.equal(
    requests.length,
    2,
    "attribute and rem resize deliveries share one font revision",
  );
  assert.equal(clearedMeasurements, 1);
  assert.equal(
    requests[1].model.nodes[0].measuredWidth,
    original.model.nodes[0].measuredWidth,
  );
  assert.equal(requests[1].model.nodes[0].measuredHeight, 72);
  assert.equal(original.model.nodes[0].measuredHeight, 48);
  const previous = requests[1];
  rootFontSize = 20;
  fontVersion = 80;
  typographyResizes
    .filter((observer) => !observer.disconnected)
    .forEach((observer) => observer.callback());
  await hook.flush();
  assert(
    previous.signal.aborted,
    "computed preferred-font changes also replace stale routing work",
  );
  assert.equal(requests.length, 3);
  assert.equal(clearedMeasurements, 2);
  assert.equal(
    requests[2].model.nodes[0].measuredWidth,
    original.model.nodes[0].measuredWidth + 80,
  );
  hook.unmount();
  const cleared = clearedMeasurements;
  typographyResizes.forEach((observer) => observer.callback());
  assert.equal(
    clearedMeasurements,
    cleared,
    "late font deliveries cannot invalidate an unmounted hook",
  );
}
{
  const { hook } = fixture();
  requests[0].resolve(null);
  await hook.flush();
  // Advance exactly one generator yield per fake frame.
  const originalNow = performance.now;
  let time = 0;
  performance.now = () => (time += 5);
  try {
    runFrame();
    assert.equal(fallbackTasks.length, 1);
    assert.equal(fallbackTasks[0].advances, 1);
    const frame = [...frames.keys()][0];
    kernelReady = true;
    hook.render();
    assert(
      frames.has(frame),
      "Kernel readiness preserves the scheduled fallback frame",
    );
    assert.equal(
      requests.length,
      1,
      "A fallback upgrade does not resubmit Worker work",
    );
    runFrame();
    assert.equal(
      fallbackTasks.length,
      2,
      "Main readiness restarts an active JS generator",
    );
    runFrame();
    runFrame();
    await hook.flush();
    assert.equal(hook.value.routingReady, true);
    assert.equal(frames.size, 0);
    assert.equal(measurements.length, 1);
  } finally {
    performance.now = originalNow;
    hook.unmount();
  }
}
{
  const { hook } = fixture(3, { autoEdgeRouting: false });
  assert.equal(hook.value.routingReady, true);
  assert.equal(provisional[0].options.mode, "simple");
  assert.equal(
    requests.length,
    0,
    "Simple startup does not create Worker work",
  );
  kernelReady = true;
  hook.render();
  assert.equal(requests.length, 0);
  assert.equal(measurements.length, 1);
  hook.unmount();
}
{
  const { hook } = fixture();
  complete(requests[0]);
  await hook.flush();
  assert.equal(hook.value.routingReady, true);
  kernelReady = true;
  hook.render();
  assert.equal(
    requests.length,
    1,
    "Completed routes are not resubmitted on main readiness",
  );
  assert.equal(hook.value.routingReady, true);
  hook.unmount();
}
assert.equal(fonts.size, 0);
assert.equal(probes.size, 0);
assert(typographyMutations.every((observer) => observer.disconnected));
assert(typographyResizes.every((observer) => observer.disconnected));
assert.equal(frames.size, 0);
console.log(
  "Routing hook lifecycle passed (shared geometry, stable Worker owner, font/drag invalidation and fallback upgrade)",
);
