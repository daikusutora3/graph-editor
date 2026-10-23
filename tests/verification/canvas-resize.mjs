import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import cytoscape from "cytoscape";
import { createCalculationCanvas } from "../fixtures/calculation-canvas";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { graphModelToCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { defaultEdgeRoutingMeta } from "../../features/graph-editor/core/layout/edge-routing";
import { resizeCytoscapeCanvas } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-resize";
import {
  fitGraphToAvailableViewport,
  centerGraphOrigin,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-viewport";

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
  matchMedia: (text) => {
    const callbacks = new Set();
    const query = {
      text,
      callbacks,
      addEventListener(type, callback) {
        if (type === "change") callbacks.add(callback);
      },
      removeEventListener(type, callback) {
        if (type === "change") callbacks.delete(callback);
      },
      notify() {
        [...callbacks].forEach((callback) => callback());
      },
    };
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
let rootFontSize = 16;
const typographyProbes = new Set();
Object.assign(globalThis, {
  window: canvasWindow,
  document: {
    hidden: false,
    documentElement: {},
    body: { append: (probe) => typographyProbes.add(probe) },
    createElement: () => {
      const element = {
        style: {},
        setAttribute() {},
        getContext: () => null,
        remove: () => typographyProbes.delete(element),
      };
      return element;
    },
    addEventListener() {},
    removeEventListener() {},
    fonts: { addEventListener() {}, removeEventListener() {} },
  },
  getComputedStyle: () => ({
    getPropertyValue: (name) =>
      name === "--canvas-node-size"
        ? "3rem"
        : name === "--canvas-node-font"
          ? "1rem"
          : "",
    fontSize: `${rootFontSize}px`,
    fontFamily: "system-ui",
  }),
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
    this.targets = [];
    resizeObservers.push(this);
  }
  observe(target) {
    this.targets.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
};
const mutationObservers = [];
globalThis.MutationObserver = class {
  constructor(callback) {
    this.callback = callback;
    mutationObservers.push(this);
  }
  observe(_target, options) {
    this.options = options;
  }
  disconnect() {
    this.disconnected = true;
  }
};

function fixture() {
  const { cy, renderer } = createCalculationCanvas(graph, routing);
  const size = { width: 1280, height: 800 };
  const container = {
    childNodes: [],
    closest: () => null,
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

// Real Cytoscape bounds at enlarged text must fit between wrapped controls.
{
  const tall = {
    ...createEmptyGraphModel(),
    nodes: [0, 300, 600].map((y, order) => ({
      id: `tall-${order}`,
      label: String(order),
      order,
      x: 0,
      y,
    })),
    edges: [],
  };
  const { cy, renderer } = createCalculationCanvas(tall);
  cy.nodes().style({ width: 72, height: 72 });
  renderer.flushRenderedStyleQueue();
  cy.container = () => ({
    childNodes: [],
    getBoundingClientRect: () => ({ width: 320, height: 900 }),
  });
  const positions = cy.nodes().map((node) => ({ ...node.position() }));
  for (const bottom of [176, 269]) {
    fitGraphToAvailableViewport(cy, { layout: "mobile" }, { top: 196, bottom });
    const bounds = cy.elements().renderedBoundingBox({ includeLabels: true });
    assert(bounds.y1 >= 196 + 48 - 1e-5, "fit clears actual top rows");
    assert(
      bounds.y2 <= 900 - bottom - 48 + 1e-5,
      "fit clears actual bottom toolbar and visible action",
    );
    assert(bounds.x1 >= 12 + 48 - 1e-5 && bounds.x2 <= 320 - 12 - 48 + 1e-5);
  }
  assert.deepEqual(
    cy.nodes().map((node) => ({ ...node.position() })),
    positions,
    "fit preserves graph coordinates",
  );
  const camera = { zoom: cy.zoom(), pan: { ...cy.pan() } };
  fitGraphToAvailableViewport(
    cy,
    { layout: "mobile" },
    { top: 700, bottom: 300 },
  );
  assert.deepEqual(
    { zoom: cy.zoom(), pan: { ...cy.pan() } },
    camera,
    "unavailable measured space preserves the camera",
  );
  cy.elements().remove();
  centerGraphOrigin(cy, { layout: "mobile" }, { top: 196, bottom: 176 });
  assert.deepEqual(
    cy.pan(),
    { x: 160, y: 460 },
    "empty origin uses measured viewport center",
  );
  cy.destroy();
}

{
  const spread = {
    ...createEmptyGraphModel(),
    nodes: [
      [0, 0],
      [2000, 0],
      [0, 900],
      [2000, 900],
    ].map(([x, y], order) => ({
      id: `corner-${order}`,
      label: String(order),
      order,
      x,
      y,
    })),
    edges: [],
  };
  const { cy, renderer } = createCalculationCanvas(spread);
  cy.nodes().style({ width: 72, height: 72 });
  renderer.flushRenderedStyleQueue();
  cy.container = () => ({
    childNodes: [],
    getBoundingClientRect: () => ({ width: 1920, height: 1080 }),
  });
  fitGraphToAvailableViewport(
    cy,
    { layout: "desktop" },
    { top: 104, bottom: 0 },
  );
  assert(
    cy.elements().renderedBoundingBox().y2 > 963,
    "default bottom clearance can overlap the enlarged zoom surface",
  );
  fitGraphToAvailableViewport(
    cy,
    { layout: "desktop" },
    { top: 104, bottom: 117 },
  );
  const fitted = cy.elements().renderedBoundingBox();
  assert(
    fitted.y2 <= 963 - 48 + 1e-5,
    "measured desktop zoom surface keeps48px fit padding",
  );
  assert(fitted.y1 >= 104 + 48 - 1e-5);
  cy.destroy();
}

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
  const densityPaints = main.paints;
  const densityHitboxes = test.hitboxRefreshes;
  // CSS dimensions stay constant: only the resolution media query fires.
  for (const density of [2, 1, 3, 1]) {
    canvasWindow.devicePixelRatio = density;
    const previousQuery = mediaQueries.at(-1);
    previousQuery.notify();
    assert.equal(
      previousQuery.callbacks.size,
      0,
      "previous density listener is replaced",
    );
    assert.equal(main.renderer.canvasWidth, main.size.width * density);
    assert.equal(main.renderer.canvasHeight, main.size.height * density);
    assert.equal(
      main.painted,
      true,
      "DPR-only changes repaint before the media event returns",
    );
    assert.equal(
      main.cy.zoom(),
      before.zoom,
      "DPR-only changes preserve user zoom",
    );
    assert.deepEqual(
      main.cy.pan(),
      before.pan,
      "DPR-only changes preserve user pan",
    );
    assert.equal(test.hook.value.displayReady, true);
    assert.equal(test.hook.value.renderReady, true);
    assert.equal(test.options.cyRef.current, main.cy);
    assert.equal(JSON.parse(test.exportScaleSignatures.at(-1))[1], density);
    assert.equal(mediaQueries.at(-1).text, `(resolution: ${density}dppx)`);
    assert.equal(
      mediaQueries.filter((query) => query.callbacks.size).length,
      1,
      "exactly one current density listener remains active",
    );
  }
  assert.equal(
    main.paints - densityPaints,
    4,
    "one paint per changed DPR without any ResizeObserver delivery",
  );
  assert.ok(
    test.hitboxRefreshes - densityHitboxes >= 4,
    "DPR events retain pointer overlay refreshes",
  );
  const sameDensityPaints = main.paints;
  mediaQueries.at(-1).notify();
  assert.equal(
    main.paints,
    sameDensityPaints,
    "duplicate same-DPR events do not clear or repaint pixels",
  );
  const initialPaints = main.paints;
  const fontHitboxes = test.hitboxRefreshes;
  rootFontSize = 24;
  mutationObservers
    .filter(
      (entry) =>
        !entry.disconnected && entry.options.attributeFilter.includes("style"),
    )
    .forEach((entry) => entry.callback());
  assert.equal(
    main.cy.getElementById("a").height(),
    72,
    "runtime root style enlargement refreshes native Cytoscape node height",
  );
  assert.equal(
    main.cy.getElementById("a").width(),
    72,
    "native short-label pill width follows the fresh font palette",
  );
  assert(
    test.hitboxRefreshes > fontHitboxes,
    "font style refresh also updates pointer overlays",
  );
  assert.equal(main.cy.zoom(), before.zoom);
  assert.deepEqual(main.cy.pan(), before.pan);
  rootFontSize = 16;
  resizeObservers
    .filter(
      (entry) =>
        !entry.disconnected &&
        entry.targets.some((target) => typographyProbes.has(target)),
    )
    .forEach((entry) => entry.callback());
  assert.equal(
    main.cy.getElementById("a").height(),
    48,
    "computed rem changes restore native node size without a theme toggle",
  );
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
  const destroyedDensityCallback = [...mediaQueries.at(-1).callbacks][0];
  test.hook.unmount();
  assert.equal(observer.disconnected, true);
  assert.equal(
    mediaQueries.filter((query) => query.callbacks.size).length,
    0,
    "unmount releases every resolution listener",
  );
  const destroyedPaints = main.paints;
  const destroyedQueries = mediaQueries.length;
  canvasWindow.devicePixelRatio = 2;
  destroyedDensityCallback();
  assert.equal(
    main.paints,
    destroyedPaints,
    "late density delivery cannot repaint a destroyed core",
  );
  assert.equal(
    mediaQueries.length,
    destroyedQueries,
    "late density delivery cannot resubscribe after unmount",
  );
  canvasWindow.devicePixelRatio = 1;
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
assert.equal(typographyProbes.size, 0, "all font metric probes are removed");
assert(mutationObservers.every((entry) => entry.disconnected));
assert.ok(
  resizeObservers.every((entry) => entry.disconnected),
  "all resize observers disconnect",
);
assert.equal(
  mediaQueries.filter((query) => query.callbacks.size).length,
  0,
  "StrictMode replay also releases all density listeners",
);
console.log(
  "Canvas resize verification passed (CSS-size and DPR-only changes repaint and keep pan, zoom, selection, readiness and core identity)",
);
