import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import cytoscape from "cytoscape";

let currentHarness;
mock.module("react", () => ({
  ...React,
  useState: (initial) => currentHarness.state(initial),
  useRef: (initial) => currentHarness.ref(initial),
  useMemo: (create, deps) => currentHarness.memo(create, deps),
  useCallback: (callback, deps) => currentHarness.memo(() => callback, deps),
  useEffect: (effect, deps) => currentHarness.effect(effect, deps),
  useLayoutEffect: (effect, deps) => currentHarness.effect(effect, deps),
}));

const feature = (path) =>
  new URL(`../../features/graph-editor/${path}`, import.meta.url).pathname;
let exports = [];
let downloads = [];
let downloadThrows = false;
let clipboardMode = "hold";
let clipboardWrites = [];
const timers = new Map();
let nextTimer = 0;
mock.module(feature("canvas/GraphCanvasProvider.tsx"), () => ({
  useGraphCanvasApi: () => ({
    exportPng: (detail) =>
      new Promise((resolve, reject) =>
        exports.push({ detail, resolve, reject }),
      ),
  }),
  useGraphCanvasExportScaleSignature: () => "",
  useGraphCanvasViewportSignature: () => "",
}));
mock.module(feature("i18n/I18nProvider.tsx"), () => ({
  useI18n: () => ({
    messages: {
      screenshot: {
        canvasTooSmall: "canvas-too-small",
        copyFailed: "copy-failed",
        copyFallbackSaved: "fallback-saved",
        downloadFailed: "download-failed",
      },
    },
  }),
}));
mock.module(feature("ui/hooks/use-debounced-value.ts"), () => ({
  useDebouncedValue: (value) => value,
}));
mock.module(feature("adapters/browser/file-actions.ts"), () => ({
  ensurePngBlob: (blob) => blob,
  downloadBlob: (blob) => {
    if (downloadThrows) throw new Error("download blocked");
    downloads.push(blob);
  },
  formatTimestamp: () => "test",
}));

let urls = new Set();
let nextUrl = 0;
let imageMode = "auto";
let bitmapCount = 0;
let bitmapCloses = 0;
URL.createObjectURL = () => {
  const url = `blob:lifecycle-${++nextUrl}`;
  urls.add(url);
  return url;
};
URL.revokeObjectURL = (url) => urls.delete(url);
Object.assign(globalThis, {
  window: {
    clearTimeout: (id) => timers.delete(id),
    setTimeout: (callback) => {
      const id = ++nextTimer;
      timers.set(id, callback);
      return id;
    },
  },
  navigator: {
    clipboard: {
      write: (items) => {
        if (clipboardMode === "blocked")
          return Promise.reject(new Error("clipboard blocked"));
        let resolve;
        let reject;
        const completed = new Promise((accept, fail) => {
          resolve = accept;
          reject = fail;
        });
        const write = { items, resolve, reject };
        clipboardWrites.push(write);
        if (clipboardMode === "auto") resolve();

        return Promise.all(
          items.flatMap((item) => Object.values(item.data)),
        ).then(() => completed);
      },
    },
  },
  ClipboardItem: class {
    constructor(data) {
      this.data = data;
    }
    static supports() {
      return false;
    }
  },
  createImageBitmap: async () => {
    bitmapCount++;
    return { width: 40, height: 40, close: () => bitmapCloses++ };
  },
  document: {
    createElement: () => ({
      getContext: () => ({
        fillRect() {},
        drawImage() {},
        measureText: (text) => ({ width: text.length * 7 }),
      }),
      toBlob: (callback) =>
        callback(new Blob(["padded"], { type: "image/png" })),
    }),
  },
  Image: class {
    naturalWidth = 88;
    naturalHeight = 88;
    set src(value) {
      if (!value || imageMode === "hold") return;
      queueMicrotask(() => {
        if (imageMode === "error") this.onerror?.();
        else this.onload?.();
      });
    }
  },
});

const { useGraphIOScreenshot } = await import(
  feature("ui/io/graph-io-screenshot.ts")
);
const { SelectEdgeHitboxes } = await import(
  feature("canvas/GraphCanvasHitboxOverlays.tsx")
);

function sameDeps(previous, next) {
  return (
    previous &&
    next &&
    previous.length === next.length &&
    next.every((value, index) => Object.is(value, previous[index]))
  );
}
function harness(renderHook) {
  const slots = [];
  const effects = new Map();
  let cursor = 0;
  let pendingEffects = [];
  let mounted = true;
  let dirty = false;
  let value;
  let lateUpdates = 0;
  const api = {
    state(initial) {
      const index = cursor++;
      if (!(index in slots))
        slots[index] = typeof initial === "function" ? initial() : initial;
      return [
        slots[index],
        (next) => {
          if (!mounted) {
            lateUpdates++;
            return;
          }
          const resolved =
            typeof next === "function" ? next(slots[index]) : next;
          if (!Object.is(resolved, slots[index])) {
            slots[index] = resolved;
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
        slots[index] = { deps, value: create() };
      return slots[index].value;
    },
    effect(effect, deps) {
      const index = cursor++;
      const previous = effects.get(index);
      if (!sameDeps(previous?.deps, deps))
        pendingEffects.push(() => {
          previous?.cleanup?.();
          effects.set(index, { effect, deps, cleanup: effect() });
        });
    },
    render() {
      currentHarness = api;
      cursor = 0;
      dirty = false;
      pendingEffects = [];
      value = renderHook();
      pendingEffects.forEach((effect) => effect());
      return value;
    },
    async flush() {
      for (let turn = 0; turn < 20; turn++) {
        // eslint-disable-next-line no-await-in-loop
        await Promise.resolve();
        if (mounted && dirty) api.render();
      }
      return value;
    },
    unmount() {
      mounted = false;
      effects.forEach(({ cleanup }) => cleanup?.());
    },
    replayEffects() {
      effects.forEach(({ cleanup }) => cleanup?.());
      effects.forEach((entry) => {
        entry.cleanup = entry.effect();
      });
    },
    get value() {
      return value;
    },
    get lateUpdates() {
      return lateUpdates;
    },
  };
  return api;
}
function screenshotFixture(extraOptions = {}) {
  exports = [];
  downloads = [];
  downloadThrows = false;
  clipboardMode = "hold";
  clipboardWrites = [];
  imageMode = "auto";
  bitmapCount = 0;
  bitmapCloses = 0;
  assert.equal(urls.size, 0, "previous fixture releases all URLs");
  assert.equal(timers.size, 0, "previous fixture releases all action timers");
  const options = {
    graphRevision: 1,
    isGraphEmpty: false,
    previewEnabled: true,
    theme: "light",
    ...extraOptions,
  };
  const hook = harness(() => useGraphIOScreenshot(options));
  hook.render();
  return { options, hook };
}
const png = () => new Blob(["original"], { type: "image/png" });

{
  const { hook } = screenshotFixture();
  await hook.flush();
  assert.equal(exports.length, 1);
  assert.equal(
    exports[0].detail.signal.aborted,
    false,
    "loading rerender retains its request",
  );
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(hook.value.preview.state, "ready");
  assert.equal(urls.size, 1);
  assert.equal(bitmapCloses, bitmapCount);
  hook.unmount();
  assert.equal(urls.size, 0, "ready preview URL is released on unmount");
}
{
  const { hook } = screenshotFixture();
  hook.unmount();
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(exports[0].detail.signal.aborted, true);
  assert.equal(
    bitmapCount,
    0,
    "unmounted export never starts padding or decoding",
  );
  assert.equal(urls.size, 0);
  assert.equal(hook.lateUpdates, 0);
}
{
  const { hook } = screenshotFixture();
  imageMode = "hold";
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(urls.size, 1, "dimension decode temporarily owns a URL");
  hook.unmount();
  await hook.flush();
  assert.equal(
    urls.size,
    0,
    "cancellation during decode releases the temporary URL",
  );
  assert.equal(hook.lateUpdates, 0);
}
{
  const { hook } = screenshotFixture();
  imageMode = "error";
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(hook.value.preview.state, "failed");
  assert.equal(urls.size, 0, "failed decode releases its temporary URL");
  hook.unmount();
}
{
  const { options, hook } = screenshotFixture();
  await hook.flush();
  options.previewEnabled = false;
  hook.render();
  assert.equal(exports[0].detail.signal.aborted, true);
  options.previewEnabled = true;
  hook.render();
  assert.equal(
    exports.length,
    2,
    "reopening restarts a canceled loading preview",
  );
  exports[1].resolve(png());
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(hook.value.preview.state, "ready");
  hook.unmount();
}
{
  const { options, hook } = screenshotFixture();
  options.graphRevision = 2;
  hook.render();
  options.graphRevision = 3;
  hook.render();
  assert.equal(exports.length, 3);
  assert.equal(exports[0].detail.signal.aborted, true);
  assert.equal(exports[1].detail.signal.aborted, true);
  exports[2].resolve(png());
  await hook.flush();
  const latestUrl = hook.value.preview.url;
  exports[0].resolve(png());
  exports[1].resolve(png());
  await hook.flush();
  assert.equal(bitmapCount, 1, "obsolete revisions skip padding and decoding");
  assert.equal(hook.value.preview.url, latestUrl);
  hook.unmount();
}
{
  const { options, hook } = screenshotFixture();
  hook.value.download();
  options.previewEnabled = false;
  hook.render();
  assert.equal(exports[0].detail.signal.aborted, true);
  assert.equal(
    exports[1].detail.signal,
    undefined,
    "explicit save is independent of preview lifetime",
  );
  exports[1].resolve(png());
  await hook.flush();
  assert.equal(downloads.length, 1);
  exports[0].resolve(png());
  await hook.flush();
  hook.unmount();
}
{
  const { hook } = screenshotFixture();
  hook.value.download();
  hook.unmount();
  exports[1].resolve(png());
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(downloads.length, 1, "explicit save completes after unmount");
  assert.equal(
    hook.lateUpdates,
    0,
    "completed action does not update an unmounted hook",
  );
  assert.equal(urls.size, 0);
}
{
  const { hook } = screenshotFixture();
  hook.replayEffects();
  assert.equal(exports.length, 2);
  assert.equal(exports[0].detail.signal.aborted, true);
  assert.equal(
    exports[1].detail.signal.aborted,
    false,
    "Strict Mode setup gets a fresh request",
  );
  exports[1].resolve(png());
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(hook.value.preview.state, "ready");
  hook.unmount();
  assert.equal(urls.size, 0);
}

/* eslint-disable no-await-in-loop -- The fixtures share a hook host and explicitly order each completion/timer. */
const originalWarn = console.warn;
console.warn = () => {};
for (const copyFirst of [true, false]) {
  const { hook } = screenshotFixture({ previewEnabled: false });
  hook.value.copy();
  hook.value.copy();
  hook.value.download();
  hook.value.download();
  assert.equal(
    exports.length,
    2,
    "same-render re-entry cannot enqueue another action",
  );
  assert.equal(clipboardWrites.length, 1);
  await hook.flush();
  hook.value.setPaddingPreset(48);
  hook.value.setBackground("transparent");
  hook.value.setScope("natural");
  await hook.flush();
  assert.equal(hook.value.copyState, "copying");
  assert.equal(hook.value.downloadState, "saving");
  hook.value.copy();
  hook.value.download();
  assert.equal(
    exports.length,
    2,
    "settings edits do not release action ownership",
  );
  const finishCopy = async () => {
    exports[0].resolve(png());
    clipboardWrites[0].resolve();
    await hook.flush();
    assert.equal(
      hook.value.copyState,
      "idle",
      "old-setting copy completes without current-setting feedback",
    );
  };
  const finishSave = async () => {
    exports[1].resolve(png());
    await hook.flush();
    assert.equal(downloads.length, 1, "old-setting Save still downloads");
    assert.equal(hook.value.downloadState, "idle");
  };
  if (copyFirst) {
    await finishCopy();
    assert.equal(hook.value.downloadState, "saving");
    await finishSave();
  } else {
    await finishSave();
    assert.equal(hook.value.copyState, "copying");
    await finishCopy();
  }
  assert.equal(
    timers.size,
    0,
    "obsolete settings create no feedback-reset timers",
  );
  hook.unmount();
}

for (const kind of ["copy", "download"]) {
  const { hook } = screenshotFixture({ previewEnabled: false });
  clipboardMode = "auto";
  hook.value[kind]();
  exports[0].resolve(png());
  await hook.flush();
  const finishedState = kind === "copy" ? "copied" : "saved";
  const pendingState = kind === "copy" ? "copying" : "saving";
  const property = `${kind}State`;
  assert.equal(hook.value[property], finishedState);
  const obsoleteTimer = [...timers.values()][0];
  hook.value[kind]();
  obsoleteTimer();
  await hook.flush();
  assert.equal(hook.value[property], pendingState);
  exports[1].resolve(png());
  await hook.flush();
  obsoleteTimer();
  await hook.flush();
  assert.equal(
    hook.value[property],
    finishedState,
    "old timer cannot clear a newer completion",
  );
  const currentTimer = [...timers.values()][0];
  currentTimer();
  await hook.flush();
  assert.equal(
    hook.value[property],
    "idle",
    "the owning timer resets its own feedback",
  );
  assert.equal(timers.size, 0);
  hook.unmount();
  currentTimer();
  await hook.flush();
  assert.equal(
    hook.lateUpdates,
    0,
    "queued feedback timer cannot update an unmounted hook",
  );
}

{
  const { options, hook } = screenshotFixture({ previewEnabled: false });
  hook.value.download();
  options.theme = "dark";
  options.graphRevision++;
  hook.render();
  assert.equal(hook.value.downloadState, "saving");
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(downloads.length, 1);
  assert.equal(
    hook.value.downloadState,
    "idle",
    "feedback also follows external graph/theme input keys",
  );
  hook.value.download();
  hook.value.setPaddingPreset(48);
  hook.value.setPaddingPreset(24);
  await hook.flush();
  exports[1].resolve(png());
  await hook.flush();
  assert.equal(
    hook.value.downloadState,
    "idle",
    "returning to earlier settings does not resurrect an earlier action revision",
  );
  hook.value.download();
  options.theme = "light";
  hook.render();
  options.theme = "dark";
  hook.render();
  exports[2].resolve(png());
  await hook.flush();
  assert.equal(
    hook.value.downloadState,
    "idle",
    "external settings ABA also invalidates the earlier action revision",
  );
  hook.unmount();
}

{
  const { hook } = screenshotFixture({ previewEnabled: false });
  hook.value.download();
  hook.value.setPaddingPreset(48);
  await hook.flush();
  exports[0].reject(new Error("image-export:canvas-too-small"));
  await hook.flush();
  assert.equal(hook.value.downloadState, "idle");
  assert.equal(
    hook.value.downloadMessage,
    "",
    "obsolete failures do not describe current settings",
  );
  hook.value.download();
  exports[1].reject(new Error("image-export:canvas-too-small"));
  await hook.flush();
  assert.equal(hook.value.downloadState, "failed");
  assert.equal(hook.value.downloadMessage, "canvas-too-small");
  const failedTimer = [...timers.values()][0];
  hook.value.download();
  downloadThrows = true;
  exports[2].resolve(png());
  await hook.flush();
  assert.equal(hook.value.downloadState, "failed");
  assert.equal(hook.value.downloadMessage, "download-failed");
  failedTimer();
  await hook.flush();
  assert.equal(
    hook.value.downloadState,
    "failed",
    "old failure timer cannot clear the new failure",
  );
  hook.unmount();
}

{
  const { hook } = screenshotFixture({ previewEnabled: false });
  clipboardMode = "blocked";
  hook.value.copy();
  await hook.flush();
  assert.equal(
    hook.value.copyState,
    "copying",
    "clipboard fallback owns its pending PNG until download completes",
  );
  hook.value.setPaddingPreset(48);
  await hook.flush();
  hook.value.copy();
  assert.equal(exports.length, 1);
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(downloads.length, 1);
  assert.equal(hook.value.copyState, "idle");
  hook.value.copy();
  exports[1].resolve(png());
  await hook.flush();
  assert.equal(hook.value.copyState, "saved");
  assert.equal(hook.value.copyMessage, "fallback-saved");
  hook.value.copy();
  downloadThrows = true;
  exports[2].resolve(png());
  await hook.flush();
  assert.equal(hook.value.copyState, "blocked");
  assert.equal(hook.value.copyMessage, "copy-failed");
  hook.unmount();
}

for (const blocked of [true, false]) {
  const { hook } = screenshotFixture({ previewEnabled: false });
  clipboardMode = blocked ? "blocked" : "hold";
  hook.value.copy();
  hook.value.download();
  await hook.flush();
  hook.replayEffects();
  await hook.flush();
  assert.equal(hook.value.copyState, "copying");
  assert.equal(hook.value.downloadState, "saving");
  hook.value.copy();
  hook.value.download();
  assert.equal(
    exports.length,
    2,
    "Strict effect replay retains explicit pending owners",
  );
  hook.unmount();
  hook.value.copy();
  hook.value.download();
  assert.equal(
    exports.length,
    2,
    "stale handlers cannot start actions after unmount",
  );
  exports[0].resolve(png());
  exports[1].resolve(png());
  if (!blocked) clipboardWrites[0].resolve();
  await hook.flush();
  assert.equal(
    downloads.length,
    blocked ? 2 : 1,
    "explicit Save and clipboard action/fallback finish after unmount",
  );
  assert.equal(hook.lateUpdates, 0);
  assert.equal(timers.size, 0);
}

{
  const { hook } = screenshotFixture({ previewEnabled: false });
  clipboardMode = "auto";
  hook.value.copy();
  exports[0].reject(new Error("image-export:canvas-too-small"));
  await hook.flush();
  assert.equal(hook.value.copyState, "blocked");
  assert.equal(hook.value.copyMessage, "canvas-too-small");
  hook.value.copy();
  exports[1].resolve(png());
  await hook.flush();
  assert.equal(
    hook.value.copyState,
    "copied",
    "PNG failure releases the Copy owner for a successful retry",
  );
  hook.unmount();
}

{
  const { hook } = screenshotFixture();
  hook.value.download();
  exports[1].reject(new Error("image-export:canvas-too-small"));
  await hook.flush();
  assert.equal(hook.value.downloadMessage, "canvas-too-small");
  exports[0].resolve(png());
  await hook.flush();
  assert.equal(hook.value.preview.state, "ready");
  assert.equal(
    hook.value.downloadMessage,
    "canvas-too-small",
    "preview success cannot erase an explicit action failure",
  );
  hook.replayEffects();
  await hook.flush();
  assert.equal(
    timers.size,
    1,
    "Strict effect replay restores the completed feedback's timer",
  );
  hook.unmount();
}

console.warn = originalWarn;
/* eslint-enable no-await-in-loop */

{
  const cy = cytoscape({ headless: true });
  let zoomReads = 0;
  const previews = [];
  const commits = [];
  const edge = { id: "e", sourceX: 0, sourceY: 0, targetX: 44.9, targetY: 0 };
  const hook = harness(() =>
    SelectEdgeHitboxes({
      edges: [edge],
      selectedEdgeIds: new Set(),
      rangeSelectionActive: false,
      weighted: false,
      getZoom: () => {
        zoomReads++;
        return cy.zoom();
      },
      onSelect() {},
      onContextMenu() {},
      onEdit() {},
      onRangeSelectionPointerDown: () => false,
      onBendPreview: (_id, bend) => previews.push(bend),
      onBendCommit: (_id, bend) => commits.push(bend),
      onBendCancel() {},
    }),
  );
  const overlay = hook.render();
  const handlers = overlay.props.children.props.handlers;
  assert.equal(
    zoomReads,
    0,
    "zoom is read at the gesture boundary rather than during render",
  );
  cy.zoom(0.0449);
  const currentTarget = {
    setPointerCapture() {},
    releasePointerCapture() {},
    closest: () => null,
    parentElement: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
  };
  const event = {
    button: 0,
    pointerId: 1,
    currentTarget,
    clientX: 18,
    clientY: 0,
  };
  handlers.onPointerDown(edge, event);
  handlers.onPointerMove(edge, { ...event, clientX: 22.45, clientY: 2.245 });
  handlers.onPointerUp(edge, event);
  assert.equal(zoomReads, 1);
  assert.deepEqual(previews, [{ bowPx: 100, bowT: 0.5 }]);
  assert.deepEqual(
    commits,
    previews,
    "fractional zoom bend is committed without rounding error",
  );
  hook.unmount();
  cy.destroy();
}
assert.equal(urls.size, 0);

{
  const { useHtmlNodeDrag } = await import(
    feature("canvas/graph-canvas-html-node-drag.ts")
  );
  const { useCytoscapeInteractionEvents } = await import(
    feature("canvas/graph-canvas-interaction-events.ts")
  );
  const { syncCytoscapeElements } = await import(
    feature("adapters/cytoscape/graph-canvas-elements-sync.ts")
  );
  const { graphModelToCytoscapeElements } = await import(
    feature("adapters/cytoscape/cytoscape-adapter.ts")
  );
  const { toGraphPosition, toCytoscapePosition } = await import(
    feature("adapters/cytoscape/cytoscape-coordinates.ts")
  );
  const { getCytoscapeElement } = await import(
    feature("adapters/cytoscape/cytoscape-ids.ts")
  );
  const { createEmptyGraphModel } = await import(
    feature("core/graph/graph-factory.ts")
  );
  const { graphAtom, syncExternalGraphAtom } = await import(
    feature("shell/state/graph-atoms.ts")
  );
  const { cancelScheduledStoredGraphWrite, uninstallStorageFlushListeners } =
    await import(feature("adapters/browser/stored-graph.ts"));
  const { executeCommandAtom, undoAtom, redoAtom } = await import(
    feature("shell/state/history-atoms.ts")
  );
  const { createStore } = await import("jotai/vanilla");
  const frames = new Map();
  let nextFrame = 0;
  const listeners = new Map();
  globalThis.getComputedStyle = () => ({
    getPropertyValue: () => "",
    fontSize: "16px",
  });
  Object.assign(window, {
    requestAnimationFrame: (callback) => {
      const id = ++nextFrame;
      frames.set(id, callback);
      return id;
    },
    cancelAnimationFrame: (id) => frames.delete(id),
    addEventListener: (type, callback) => listeners.set(type, callback),
    removeEventListener: (type, callback) => {
      if (listeners.get(type) === callback) listeners.delete(type);
    },
  });
  document.addEventListener = () => {};
  document.removeEventListener = () => {};
  for (const snapToGrid of [false, true]) {
    const store = createStore();
    const graph = {
      ...createEmptyGraphModel({ autoEdgeRouting: false, snapToGrid }),
      nodes: [
        { id: "__proto__", label: "A", order: 0, x: 999999720, y: 999999720 },
        { id: "constructor", label: "B", order: 1, x: 999999840, y: 999999840 },
      ],
    };
    store.set(syncExternalGraphAtom, graph);
    const cy = cytoscape({
      headless: true,
      layout: { name: "preset", fit: false },
    });
    cy.zoom(1.5);
    const sync = () =>
      syncCytoscapeElements(
        cy,
        graphModelToCytoscapeElements(store.get(graphAtom)),
      );
    sync();
    const selectionRef = {
      current: { nodeIds: graph.nodes.map((node) => node.id), edgeIds: [] },
    };
    const hook = harness(() =>
      useHtmlNodeDrag({
        cyRef: { current: cy },
        draggingNodeIdsRef: { current: new Set() },
        edgeRoutingMeta: new Map(),
        edgeRoutingOptions: { mode: "simple" },
        executeCommand: (command) => store.set(executeCommandAtom, command),
        acceptRoutingMeta() {},
        graph,
        selectionRef,
        setSelection: (selection) => {
          selectionRef.current = selection;
        },
        updateRenderedHitboxes() {},
      }),
    );
    hook.render();
    const event = {
      button: 0,
      pointerId: 9,
      clientX: 10,
      clientY: 20,
      currentTarget: {
        setPointerCapture() {},
        releasePointerCapture() {},
        hasPointerCapture: () => true,
      },
      preventDefault() {},
    };
    hook.value.start(event, "__proto__");
    hook.value.update({ ...event, clientX: 46, clientY: 44 });
    hook.value.cancel();
    graph.nodes.forEach((node) =>
      assert.deepEqual(
        toGraphPosition(cy, getCytoscapeElement(cy, node.id).position()),
        { x: node.x, y: node.y },
        "cancel restores domain snapshot",
      ),
    );
    hook.value.start(event, "__proto__");
    hook.value.update({ ...event, clientX: 46, clientY: 44 });
    hook.value.finish(event);
    const moved = store.get(graphAtom);
    for (const [index, node] of moved.nodes.entries()) {
      const original = graph.nodes[index];
      const x = original.x + 24,
        y = original.y + 16;
      assert.deepEqual(
        { x: node.x, y: node.y },
        snapToGrid
          ? { x: Math.round(x / 24) * 24, y: Math.round(y / 24) * 24 }
          : { x, y },
      );
    }
    store.set(undoAtom);
    sync();
    assert.deepEqual(
      store.get(graphAtom),
      graph,
      "Undo preserves original domain coordinates",
    );
    store.set(redoAtom);
    sync();
    assert.deepEqual(
      store.get(graphAtom),
      moved,
      "Redo preserves moved domain coordinates",
    );
    hook.unmount();
    cancelScheduledStoredGraphWrite();
    uninstallStorageFlushListeners();
    assert.equal(frames.size, 0);
    assert.equal(listeners.size, 0);

    const taps = [];
    const interactions = harness(() =>
      useCytoscapeInteractionEvents({
        cyRef: { current: cy },
        mode: "node",
        onPlaceNode: (position) => taps.push(position),
        rangeSelectionFilterRef: { current: "all" },
        setContextMenuTarget() {},
        setEdgeDraft() {},
        setSelection() {},
      }),
    );
    interactions.render();
    const placed = { x: 999999900, y: 999999880 };
    cy.emit({ type: "tap", position: toCytoscapePosition(cy, placed) });
    assert.deepEqual(taps, [placed], "background taps become domain positions");
    interactions.unmount();
    cy.destroy();
    cancelScheduledStoredGraphWrite();
  }
}

{
  const { useRenderedHitboxes } = await import(
    feature("canvas/graph-canvas-rendered-hitboxes.ts")
  );
  const { syncCytoscapeElements } = await import(
    feature("adapters/cytoscape/graph-canvas-elements-sync.ts")
  );
  const { graphModelToCytoscapeElements } = await import(
    feature("adapters/cytoscape/cytoscape-adapter.ts")
  );
  const { createEmptyGraphModel } = await import(
    feature("core/graph/graph-factory.ts")
  );
  const { createCalculationCanvas } =
    await import("../fixtures/calculation-canvas");
  const graph = {
    ...createEmptyGraphModel(),
    nodes: [
      { id: "a", label: "A", order: 0, x: 999880, y: 0 },
      { id: "b", label: "B", order: 1, x: 1000000, y: 0 },
    ],
  };
  const { cy } = createCalculationCanvas(graph);
  cy.zoom(1.5);
  cy.pan({ x: -1499550, y: 400 });
  const hook = harness(() =>
    useRenderedHitboxes({
      graph,
      mode: "select",
      chrome: { layout: "desktop" },
    }),
  );
  hook.render();
  hook.value.hitboxLayerRef.current = { style: { transform: "" } };
  hook.value.flushRenderedHitboxes(cy);
  await hook.flush();
  cy.on("pan", () => hook.value.panRenderedHitboxes(cy));
  const moved = {
    ...graph,
    nodes: graph.nodes.map((node) => ({ ...node, x: node.x + 1 })),
  };
  cy.batch(() =>
    syncCytoscapeElements(
      cy,
      graphModelToCytoscapeElements(moved, { edgeRoutingMeta: new Map() }),
    ),
  );
  assert.equal(
    hook.value.hitboxLayerRef.current.style.transform,
    "",
    "origin compensation does not transiently translate the overlay",
  );
  cy.panBy({ x: 15, y: -10 });
  assert.equal(
    hook.value.hitboxLayerRef.current.style.transform,
    "translate(15px, -10px)",
    "ordinary camera pan still translates the overlay",
  );
  hook.value.flushRenderedHitboxes(cy);
  await hook.flush();
  const basePan = { ...cy.pan() };
  cy.zoom({ level: 1, renderedPosition: { x: 300, y: 400 } });
  const dx = cy.pan().x - basePan.x,
    dy = cy.pan().y - basePan.y;
  assert.equal(
    hook.value.hitboxLayerRef.current.style.transform,
    dx === 0 && dy === 0 ? "" : `translate(${dx}px, ${dy}px)`,
    "zoom at a stable distant origin retains the renderer-local pan delta",
  );
  hook.unmount();
  cy.destroy();
}
assert.equal(timers.size, 0);
assert.equal(bitmapCloses, bitmapCount);
console.log("Canvas lifecycle verification passed");
