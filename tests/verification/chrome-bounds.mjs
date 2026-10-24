import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";

let element;
const effects = [];
const states = [];
let cursor = 0;
mock.module("react", () => ({
  ...React,
  useRef: () => ({ current: element }),
  useLayoutEffect: (effect) => effects.push(effect),
  useId: () => "creation-description",
  useState: (initial) => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [
      states[index],
      (value) => {
        states[index] = value;
      },
    ];
  },
}));
const feature = (path) =>
  new URL(`../../features/graph-editor/${path}`, import.meta.url).pathname;
mock.module(feature("i18n/I18nProvider.tsx"), () => ({
  useI18n: () => ({ locale: "en" }),
}));
const {
  measureEditorChromeInsets,
  readEditorChromeInsets,
  useEditorChromeBounds,
} = await import(feature("ui/chrome/editor-chrome-bounds.ts"));
const { NodeCreationAction } = await import(
  feature("ui/chrome/NodeCreationAction.tsx")
);
const { findNodeCreationPosition } = await import(
  feature("canvas/graph-canvas-node-creation.ts")
);
const { createEmptyGraphModel } = await import(
  feature("core/graph/graph-factory.ts")
);

const viewport = { top: 100, bottom: 944, height: 844 };
let topRect = { top: 118, bottom: 280, height: 162 };
let bottomRect = { top: 768, bottom: 920, height: 152 };
const values = new Map();
let writes = 0;
const top = { getBoundingClientRect: () => topRect, closest: () => root };
const bottom = { getBoundingClientRect: () => bottomRect, closest: () => root };
const nodeAction = {
  getBoundingClientRect: () => ({ top: 620, bottom: 728, height: 108 }),
};
const root = {
  getBoundingClientRect: () => viewport,
  querySelector: (selector) =>
    selector === "[data-editor-chrome-top]"
      ? top
      : selector === "[data-editor-chrome-bottom]"
        ? bottom
        : selector === "[data-node-creation-action]"
          ? nodeAction
          : null,
  style: {
    getPropertyValue: (name) => values.get(name) ?? "",
    setProperty: (name, value) => {
      writes++;
      values.set(name, value);
    },
    removeProperty: (name) => values.delete(name),
  },
};
const observers = [];
globalThis.ResizeObserver = class {
  constructor(update) {
    this.update = update;
    this.observed = [];
    observers.push(this);
  }
  observe(target) {
    this.observed.push(target);
  }
  disconnect() {
    this.disconnected = true;
  }
};
const canvas = { closest: () => root, getBoundingClientRect: () => viewport };
assert.deepEqual(readEditorChromeInsets(canvas), { top: 180, bottom: 176 });
assert.deepEqual(
  readEditorChromeInsets(canvas, { includeCanvasControls: true }),
  { top: 180, bottom: 324 },
  "fit alone reserves the visible node action",
);
const desktopViewport = { top: 0, bottom: 1080, height: 1080 };
const desktopCanvas = {
  getBoundingClientRect: () => desktopViewport,
  closest: () => ({
    querySelector: (selector) =>
      selector === "[data-canvas-zoom-controls]"
        ? {
            getBoundingClientRect: () => ({
              top: 963,
              bottom: 1044,
              height: 81,
            }),
          }
        : null,
  }),
};
assert.deepEqual(readEditorChromeInsets(desktopCanvas), { top: 0, bottom: 0 });
assert.deepEqual(
  readEditorChromeInsets(desktopCanvas, { includeCanvasControls: true }),
  { top: 0, bottom: 117 },
  "desktop24px zoom surface extends81px plus36px bottom offset",
);
assert.deepEqual(measureEditorChromeInsets(viewport), { top: 0, bottom: 0 });

element = top;
function ChromeBoundsFixture(position) {
  return useEditorChromeBounds(position);
}
ChromeBoundsFixture("top");
const cleanTop = effects.pop()();
element = bottom;
ChromeBoundsFixture("bottom");
const cleanBottom = effects.pop()();
assert.equal(values.get("--ge-top-chrome-bottom"), "180px");
assert.equal(values.get("--ge-mobile-controls-bottom"), "188px");
assert(
  observers.every((observer) => observer.observed.includes(root)),
  "both toolbar observers track main viewport resizing",
);
const priorWrites = writes;
observers.forEach((observer) => observer.update());
assert.equal(
  writes,
  priorWrites,
  "unchanged measurements do not republish layout variables",
);
topRect = { top: 118, bottom: 316, height: 198 };
bottomRect = { top: 688, bottom: 920, height: 232 };
observers.forEach((observer) => observer.update());
assert.equal(values.get("--ge-top-chrome-bottom"), "216px");
assert.equal(values.get("--ge-mobile-controls-bottom"), "268px");

const insets = readEditorChromeInsets(canvas);
const position = findNodeCreationPosition(
  createEmptyGraphModel(),
  { width: 320, height: 844, zoom: 1, pan: { x: 0, y: 0 } },
  { layout: "mobile" },
  { nodeSize: 72, newNodeWidth: 72, actionHeight: 96, viewportInsets: insets },
);
assert(position);
assert(position.y - 36 >= insets.top + 12);
assert(
  position.y + 36 <= 844 - insets.bottom - 96 - 24,
  "placement clears the actual wrapped controls and action",
);
assert.equal(
  findNodeCreationPosition(
    createEmptyGraphModel(),
    { width: 320, height: 390, zoom: 1, pan: { x: 0, y: 0 } },
    { layout: "mobile" },
    {
      nodeSize: 72,
      newNodeWidth: 72,
      actionHeight: 80,
      viewportInsets: { top: 196, bottom: 176 },
    },
  ),
  null,
  "no-space viewport cannot create an obscured node",
);
cleanTop();
cleanBottom();
assert.equal(values.size, 0);
assert(observers.every((observer) => observer.disconnected));

let success = false;
const heights = [];
function action() {
  cursor = 0;
  return NodeCreationAction({
    mobile: true,
    onAddNode: (height) => {
      heights.push(height);
      return success ? { id: "added", label: "0", order: 0, x: 0, y: 0 } : null;
    },
  });
}
function clickAction() {
  action().props.children[0].props.onClick({
    currentTarget: { getBoundingClientRect: () => ({ height: 96 }) },
  });
}
clickAction();
let rendered = action();
let status = rendered.props.children[2];
assert(status.props.children.includes("Could not add a node"));
assert.equal(
  status.props.tabIndex,
  0,
  "overflowed feedback can receive keyboard focus",
);
assert.equal(status.props.role, "status");
assert.equal(status.props["aria-live"], "polite");
assert.equal(
  rendered.props.children[0].props["aria-describedby"],
  `creation-description ${status.props.id}`,
  "retry keeps the failure associated with the creation action",
);
let stopped = false;
let prevented = false;
status.props.onKeyDown({
  key: "ArrowDown",
  stopPropagation: () => {
    stopped = true;
  },
  preventDefault: () => {
    prevented = true;
  },
});
assert(stopped, "scrolling feedback does not nudge selected graph nodes");
assert(!prevented, "native keyboard scrolling remains available");
success = true;
clickAction();
rendered = action();
status = rendered.props.children[2];
assert.equal(
  status.props.className,
  "sr-only",
  "successful retry clears the visible failure",
);
assert.equal(status.props.tabIndex, undefined);
assert.equal(
  rendered.props.children[0].props["aria-describedby"],
  "creation-description",
);
assert.deepEqual(
  heights,
  [96, 96],
  "creation receives the measured button height on every activation",
);

console.log(
  "Chrome bounds passed (wrapping, viewport resize, numeric placement insets, no-space feedback and measured action height)",
);
