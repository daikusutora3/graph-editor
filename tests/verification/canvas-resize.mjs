import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import cytoscape from "cytoscape";
import { createCalculationCanvas } from "../fixtures/calculation-canvas";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { graphModelToCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { defaultEdgeRoutingMeta } from "../../features/graph-editor/core/layout/edge-routing";
import { resizeCytoscapeCanvas } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-resize";

// Run the installed canvas-sizing implementation: assigning a canvas size
// clears its pixel backing store. Browser review covers the final raster.
const Canvas = cytoscape("renderer", "canvas");
const graph = {
  ...createEmptyGraphModel(),
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 240, y: 100 },
  ],
  edges: [{ id: "ab", source: "a", target: "b", label: "curved" }],
};
const routing = new Map([
  [
    "ab",
    { ...defaultEdgeRoutingMeta, bowPx: 48, controlPointDistancesPx: [48] },
  ],
]);
const elements = graphModelToCytoscapeElements(graph, {
  edgeRoutingMeta: routing,
});
const mediaQueries = [];
const listeners = new Map();
let nextFrame = 0;
const frames = new Map();
let nextTimeout = 0;
const timeouts = new Map();
const canvasWindow = {
  devicePixelRatio: 1,
  addEventListener: (type, listener) => listeners.set(type, listener),
  removeEventListener: (type, listener) => {
    if (listeners.get(type) === listener) listeners.delete(type);
  },
  matchMedia: () => {
    const query = { addEventListener() {}, removeEventListener() {} };
    mediaQueries.push(query);
    return query;
  },
  setTimeout: (callback) => {
    const id = ++nextTimeout;
    timeouts.set(id, callback);
    return id;
  },
  clearTimeout: (id) => timeouts.delete(id),
};
Object.assign(globalThis, {
  window: canvasWindow,
  document: {
    hidden: false,
    documentElement: {},
    createElement: () => ({ getContext: () => null }),
    addEventListener() {},
    removeEventListener() {},
    fonts: { addEventListener() {}, removeEventListener() {} },
  },
  getComputedStyle: () => ({ getPropertyValue: () => "", fontSize: "16px" }),
  requestAnimationFrame: (callback) => {
    const id = ++nextFrame;
    frames.set(id, callback);
    return id;
  },
  cancelAnimationFrame: (id) => frames.delete(id),
});
const resizeObservers = [];
globalThis.ResizeObserver = class {
  constructor(callback) {
    this.callback = callback;
    this.disconnected = false;
    resizeObservers.push(this);
  }
  observe() {}
  disconnect() {
    this.disconnected = true;
  }
};
globalThis.MutationObserver = class {
  observe() {}
  disconnect() {}
};

function fixture() {
  const { cy, renderer } = createCalculationCanvas(graph, routing);
  const size = { width: 1280, height: 800 };
  const container = {
    childNodes: [],
    ownerDocument: { defaultView: canvasWindow },
    getBoundingClientRect: () => ({ ...size }),
  };
  const createCanvas = () => ({
    style: {},
    painted: true,
    set width(value) {
      this.currentWidth = value;
      this.painted = false;
    },
    get width() {
      return this.currentWidth;
    },
    set height(value) {
      this.currentHeight = value;
      this.painted = false;
    },
    get height() {
      return this.currentHeight;
    },
  });
  let paints = 0;
  let resizes = 0;
  let pendingPaint = false;
  let layerLabel = graph.nodes[0].label;
  let paintedLabel = layerLabel;
  renderer.onUpdateEleCalcs((_willDraw, changed) => {
    if (changed.some((element) => element.id() === "a"))
      layerLabel = cy.getElementById("a").data("label");
  });
  Object.assign(renderer, {
    container,
    CANVAS_LAYERS: 3,
    BUFFER_COUNT: 3,
    MOTIONBLUR_BUFFER_NODE: 0,
    MOTIONBLUR_BUFFER_DRAG: 1,
    TEXTURE_BUFFER: 2,
    motionBlurPxRatio: 1,
    canvasWidth: size.width,
    canvasHeight: size.height,
    data: {
      canvasContainer: { style: {} },
      canvases: Array.from({ length: 3 }, createCanvas),
      bufferCanvases: Array.from({ length: 3 }, createCanvas),
    },
    findContainerClientCoords: () => [0, 0, size.width, size.height],
    getPixelRatio: () => canvasWindow.devicePixelRatio,
    notify: (event) => {
      if (event === "resize") {
        resizes++;
        Canvas.prototype.matchCanvasSize.call(renderer, container);
      }
      pendingPaint = true;
    },
    render: () => {
      paints++;
      paintedLabel = layerLabel;
      renderer.data.canvases.forEach((canvas) => {
        canvas.painted = true;
      });
      pendingPaint = false;
      cy.emit("render");
    },
  });
  cy.container = () => container;
  cy.width = () => size.width;
  cy.height = () => size.height;
  return {
    cy,
    renderer,
    size,
    container,
    get paints() {
      return paints;
    },
    get resizes() {
      return resizes;
    },
    get pendingPaint() {
      return pendingPaint;
    },
    get paintedLabel() {
      return paintedLabel;
    },
    get painted() {
      return renderer.data.canvases.every((canvas) => canvas.painted);
    },
  };
}
// Prepare actual cores before replacing the constructor used by the hook.
const baseline = fixture();
const main = fixture();
const strictFirst = fixture();
const strictSecond = fixture();
const dirtyCanvas = fixture();
const batchedCanvas = fixture();
baseline.size.width = 468;
baseline.cy.resize();
assert.equal(
  baseline.painted,
  false,
  "old resize clears the visible backing stores",
);
assert.equal(
  baseline.pendingPaint,
  true,
  "old resize only queues a later paint",
);
baseline.renderer.render();
baseline.size.width = 320;
resizeCytoscapeCanvas(baseline.cy);
assert.equal(
  baseline.painted,
  true,
  "changed canvas is repainted before resize returns",
);
const paintedCount = baseline.paints;
resizeCytoscapeCanvas(baseline.cy);
assert.equal(
  baseline.paints,
  paintedCount,
  "unchanged dimensions do not repaint",
);
canvasWindow.devicePixelRatio = 2;
resizeCytoscapeCanvas(baseline.cy);
assert.equal(baseline.renderer.canvasWidth, 640);
assert.equal(
  baseline.painted,
  true,
  "density-only resize repaints the reset backing stores",
);
baseline.cy.destroy();
resizeCytoscapeCanvas(baseline.cy);
assert.equal(baseline.paints, paintedCount + 1, "destroyed cores cannot paint");
canvasWindow.devicePixelRatio = 1;
dirtyCanvas.cy.getElementById("a").data("label", "Changed before resize");
dirtyCanvas.size.width = 468;
resizeCytoscapeCanvas(dirtyCanvas.cy);
assert.equal(
  dirtyCanvas.paintedLabel,
  "Changed before resize",
  "same-frame style edits invalidate cached layers before synchronous paint",
);
dirtyCanvas.cy.destroy();
batchedCanvas.cy.startBatch();
batchedCanvas.size.width = 468;
resizeCytoscapeCanvas(batchedCanvas.cy);
assert.equal(
  batchedCanvas.paints,
  0,
  "an open batch does not paint partial edits",
);
assert.equal(
  batchedCanvas.painted,
  true,
  "batched resize retains pixels until renderer notification",
);
batchedCanvas.cy.endBatch();
assert.equal(
  batchedCanvas.pendingPaint,
  true,
  "batch completion retains its normal deferred paint",
);
batchedCanvas.cy.destroy();

let currentHarness;
mock.module("react", () => ({
  ...React,
  useState: (initial) => currentHarness.state(initial),
  useRef: (initial) => currentHarness.ref(initial),
  useEffect: (effect, deps) => currentHarness.effect(effect, deps),
}));
let creations = 0;
const cores = [main, strictFirst, strictSecond];
mock.module("cytoscape", () => ({
  default: () => {
    creations++;
    return cores.shift().cy;
  },
}));
const { useGraphCanvasLifecycle } =
  await import("../../features/graph-editor/adapters/cytoscape/graph-canvas-lifecycle");

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
  let dirty = false;
  let pending = [];
  let value;
  const api = {
    state(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = initial;
      return [
        slots[index],
        (next) => {
          const resolved =
            typeof next === "function" ? next(slots[index]) : next;
          if (!Object.is(slots[index], resolved)) {
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
    effect(effect, deps) {
      const index = cursor++;
      const previous = effects.get(index);
      if (!sameDeps(previous?.deps, deps))
        pending.push(() => {
          previous?.cleanup?.();
          effects.set(index, { deps, effect, cleanup: effect() });
        });
    },
    render() {
      currentHarness = api;
      cursor = 0;
      dirty = false;
      pending = [];
      value = renderHook();
      pending.forEach((effect) => effect());
      return value;
    },
    flush() {
      for (let step = 0; step < 10; step++) {
        const callbacks = [...frames.values()];
        frames.clear();
        callbacks.forEach((callback) => callback(step));
        if (dirty) api.render();
        if (!dirty && frames.size === 0) break;
      }
      return value;
    },
    replayEffects() {
      effects.forEach(({ cleanup }) => cleanup?.());
      effects.forEach((entry) => {
        entry.cleanup = entry.effect();
      });
    },
    unmount() {
      effects.forEach(({ cleanup }) => cleanup?.());
    },
    get value() {
      return value;
    },
  };
  return api;
}
function lifecycleFixture(canvas) {
  const viewportSignatures = [];
  const exportScaleSignatures = [];
  const completedFits = [];
  let hitboxRefreshes = 0;
  const options = {
    routingReady: true,
    containerRef: { current: canvas.container },
    cyRef: { current: null },
    elements,
    chrome: { layout: "desktop" },
    graph,
    mode: "select",
    selection: { nodeIds: ["a"], edgeIds: ["ab"] },
    selectionRef: { current: { nodeIds: ["a"], edgeIds: ["ab"] } },
    draggingNodeIdsRef: { current: new Set() },
    fitRequest: null,
    completeFit: (id) => completedFits.push(id),
    flushRenderedHitboxes: () => hitboxRefreshes++,
    updateRenderedHitboxes: () => hitboxRefreshes++,
    panRenderedHitboxes: () => {},
    setZoomPercent: () => {},
    notifyViewportSignature: (signature) => viewportSignatures.push(signature),
    notifyExportScaleSignature: (signature) =>
      exportScaleSignatures.push(signature),
    suppressSelectionSyncRef: { current: false },
  };
  const hook = harness(() => useGraphCanvasLifecycle(options));
  hook.render();
  // The first graph fit is still completed through its render acknowledgement.
  canvas.renderer.render();
  hook.flush();
  assert.equal(hook.value.displayReady, true);
  assert.equal(hook.value.renderReady, true);
  return {
    hook,
    options,
    viewportSignatures,
    exportScaleSignatures,
    completedFits,
    get hitboxRefreshes() {
      return hitboxRefreshes;
    },
  };
}

{
  const test = lifecycleFixture(main);
  main.cy.zoom(0.73);
  main.cy.pan({ x: 17, y: -29 });
  const before = {
    elements: main.cy.elements().map((element) => ({
      id: element.id(),
      data: { ...element.data() },
      position: { ...element.position() },
    })),
    zoom: main.cy.zoom(),
    pan: { ...main.cy.pan() },
    selection: main.cy.$(":selected").map((element) => element.id()),
  };
  const observer = resizeObservers.find((entry) => !entry.disconnected);
  const initialPaints = main.paints;
  for (const width of [800, 468, 320, 468, 1280]) {
    main.size.width = width;
    observer.callback();
    assert.equal(
      main.painted,
      true,
      "each observer delivery completes pixels before paint",
    );
    test.options.chrome = {
      layout: width < 640 ? "mobile" : width < 1024 ? "compact" : "desktop",
    };
    test.hook.render();
    test.hook.flush();
    assert.equal(
      test.hook.value.displayReady,
      true,
      "resize never hides the graph",
    );
    assert.equal(
      test.hook.value.renderReady,
      true,
      "resize retains the acknowledged element set",
    );
    assert.equal(test.options.cyRef.current, main.cy);
    assert.equal(
      creations,
      1,
      "layout breakpoints retain the original Cytoscape core",
    );
    assert.equal(main.cy.zoom(), before.zoom, "resize preserves user zoom");
    assert.deepEqual(main.cy.pan(), before.pan, "resize preserves user pan");
  }
  assert.equal(
    main.paints - initialPaints,
    5,
    "one paint per changed size, none for same-size layout effects",
  );
  assert.deepEqual(
    main.cy.elements().map((element) => ({
      id: element.id(),
      data: { ...element.data() },
      position: { ...element.position() },
    })),
    before.elements,
  );
  assert.deepEqual(
    main.cy.$(":selected").map((element) => element.id()),
    before.selection,
  );
  assert.equal(
    test.completedFits.length,
    0,
    "resize never issues a new fit request",
  );
  assert.equal(
    JSON.parse(test.viewportSignatures.at(-1))[3],
    1280,
    "PNG viewport signature follows size",
  );
  assert.equal(
    JSON.parse(test.exportScaleSignatures.at(-1))[0],
    0.73,
    "PNG graph scale retains exact zoom",
  );
  assert.ok(
    test.hitboxRefreshes >= 5,
    "resizes still refresh pointer hitboxes",
  );
  test.options.fitRequest = { id: 7, graph };
  test.hook.render();
  main.renderer.render();
  test.hook.flush();
  assert.deepEqual(
    test.completedFits,
    [7],
    "explicit fit still waits for and acknowledges its paint",
  );
  assert.equal(test.hook.value.displayReady, true);
  test.hook.unmount();
  assert.equal(observer.disconnected, true);
}
{
  const test = lifecycleFixture(strictFirst);
  test.hook.replayEffects();
  strictSecond.renderer.render();
  test.hook.flush();
  assert.equal(strictFirst.cy.destroyed(), true);
  assert.equal(test.options.cyRef.current, strictSecond.cy);
  assert.equal(
    test.hook.value.displayReady,
    true,
    "StrictMode replay reveals the replacement core normally",
  );
  assert.equal(test.hook.value.renderReady, true);
  test.hook.unmount();
  assert.equal(strictSecond.cy.destroyed(), true);
}
assert.equal(
  frames.size,
  0,
  "all render acknowledgement frames are canceled or completed",
);
assert.equal(timeouts.size, 0, "all initial display deadlines are released");
assert.ok(
  resizeObservers.every((entry) => entry.disconnected),
  "all resize observers disconnect",
);
console.log(
  "Canvas resize verification passed (old blank backing stores reproduced; resize keeps pan, zoom, selection, readiness and core identity)",
);
