import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";

let effect;
let headerHeight = 60;
let headerWidth = 1023;
let top = 84;
let scrolls = 0;
let observed;
let disconnected = false;
const properties = new Map();
const listeners = new Map();
const target = {
  getBoundingClientRect: () => ({ top }),
  scrollIntoView(options) {
    assert.deepEqual(options, { block: "start", behavior: "instant" });
    scrolls++;
    top = Number.parseFloat(properties.get("--reading-header-height")) + 24;
  },
};
const page = {
  contains: (element) => element === target,
  style: {
    setProperty: (name, value) => properties.set(name, value),
    removeProperty: (name) => properties.delete(name),
  },
};
const header = {
  closest: () => page,
  getBoundingClientRect: () => ({
    height: headerHeight,
    width: headerWidth,
  }),
};
let notifyObserver;
Object.assign(globalThis, {
  window: {
    location: { hash: "#section" },
    innerHeight: 900,
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener(name, callback) {
      assert.equal(listeners.get(name), callback);
      listeners.delete(name);
    },
  },
  document: {
    getElementById: (id) => (id === "section" ? target : null),
  },
  getComputedStyle: () => ({
    scrollMarginTop:
      Number.parseFloat(properties.get("--reading-header-height")) + 24 + "px",
  }),
  ResizeObserver: class {
    constructor(callback) {
      notifyObserver = callback;
    }
    observe(element) {
      observed = element;
    }
    disconnect() {
      disconnected = true;
    }
  },
});
mock.module("react", () => ({
  ...React,
  useRef: () => ({ current: header }),
  useEffect: (callback) => {
    effect = callback;
  },
}));
const { ContentStickyHeader } =
  await import("../../components/content/ContentStickyHeader.tsx");
ContentStickyHeader({ children: null });
const cleanup = effect();
assert.equal(observed, header);
assert.equal(properties.get("--reading-header-height"), "60px");
assert.equal(scrolls, 0);

// The sidebar breakpoint changes the document before dispatching resize.
// Its induced scroll must not erase the destination visible before resizing.
headerWidth = 1024;
top = -160;
listeners.get("scroll")();
listeners.get("resize")();
assert.equal(scrolls, 1);
assert.equal(top, 84);
notifyObserver();
assert.equal(scrolls, 1, "the observer must not scroll the same target twice");

// Reading past an old fragment must not jump back to it on the next resize.
top = -300;
listeners.get("scroll")();
headerWidth = 1023;
top = -120;
listeners.get("resize")();
assert.equal(scrolls, 1, "manual reading position is preserved");

// A wider header can cover a newly selected destination.
top = 90;
listeners.get("hashchange")();
headerWidth = 767;
headerHeight = 108.2;
top = 70;
notifyObserver();
assert.equal(properties.get("--reading-header-height"), "109px");
assert.equal(top, 133);
assert.equal(scrolls, 2);

// Missing fragments and destinations below the viewport must not be restored.
window.location.hash = "#missing";
listeners.get("hashchange")();
headerWidth = 768;
listeners.get("resize")();
assert.equal(scrolls, 2);
window.location.hash = "#section";
top = 1100;
listeners.get("hashchange")();
headerWidth = 1200;
listeners.get("resize")();
assert.equal(scrolls, 2);

cleanup();
assert(disconnected);
assert.equal(listeners.size, 0);
assert.equal(properties.size, 0);
console.log(
  "Content header resize passed (sidebar breakpoint, event ordering, anchor visibility, reading position and cleanup)",
);
