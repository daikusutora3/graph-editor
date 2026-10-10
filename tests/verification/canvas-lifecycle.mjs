import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import cytoscape from "cytoscape";

// Execute the real hook/gesture closures with deterministic lifecycle and
// browser resources. PNG pixels are covered by the in-app browser review.
let currentHarness;
mock.module("react", () => ({
  ...React,
  useState: (initial) => currentHarness.state(initial),
  useRef: (initial) => currentHarness.ref(initial),
  useMemo: (create, deps) => currentHarness.memo(create, deps),
  useEffect: (effect, deps) => currentHarness.effect(effect, deps),
  useLayoutEffect: (effect, deps) => currentHarness.effect(effect, deps),
}));

const feature = (path) =>
  new URL(`../../features/graph-editor/${path}`, import.meta.url).pathname;
let exports = [];
let downloads = [];
mock.module(feature("canvas/GraphCanvasProvider.tsx"), () => ({
  useGraphCanvasApi: () => ({
    exportPng: (detail) =>
      new Promise((resolve) => exports.push({ detail, resolve })),
  }),
  useGraphCanvasExportScaleSignature: () => "",
  useGraphCanvasViewportSignature: () => "",
}));
mock.module(feature("i18n/I18nProvider.tsx"), () => ({
  useI18n: () => ({ messages: { screenshot: {} } }),
}));
mock.module(feature("ui/hooks/use-debounced-value.ts"), () => ({
  useDebouncedValue: (value) => value,
}));
mock.module(feature("adapters/browser/file-actions.ts"), () => ({
  ensurePngBlob: (blob) => blob,
  downloadBlob: (blob) => downloads.push(blob),
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
  window: { clearTimeout, setTimeout },
  createImageBitmap: async () => {
    bitmapCount++;
    return { width: 40, height: 40, close: () => bitmapCloses++ };
  },
  document: {
    createElement: () => ({
      getContext: () => ({ fillRect() {}, drawImage() {} }),
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
function screenshotFixture() {
  exports = [];
  downloads = [];
  imageMode = "auto";
  bitmapCount = 0;
  bitmapCloses = 0;
  assert.equal(urls.size, 0, "previous fixture releases all URLs");
  const options = {
    graphRevision: 1,
    isGraphEmpty: false,
    previewEnabled: true,
    theme: "light",
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

// Exercise the actual pointer handlers with a fractional live Cytoscape zoom.
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
console.log("Canvas lifecycle verification passed");
