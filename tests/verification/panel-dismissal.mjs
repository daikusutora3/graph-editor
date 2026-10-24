import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";

const feature = (path) =>
  new URL(`../../features/graph-editor/${path}`, import.meta.url).pathname;
let section;
let effects;
mock.module("react", () => ({
  ...React,
  useRef: () => ({ current: section }),
  useState: (initial) => [initial, () => {}],
  useEffect: (effect) => effects.push(effect),

  useLayoutEffect() {},
}));
mock.module(feature("i18n/I18nProvider.tsx"), () => ({
  useI18n: () => ({ messages: { common: { close: "Close" } } }),
}));

class TestNode {
  constructor(parent = null) {
    this.parentNode = parent;
  }
  contains(target) {
    for (let node = target; node; node = node.parentNode) {
      if (node === this) return true;
    }
    return false;
  }
}
class TestElement extends TestNode {
  constructor(parent = null, attributes = {}) {
    super(parent);
    this.attributes = attributes;
    this.isConnected = true;
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  closest(selector) {
    const match = selector.match(/^\[([^=\]]+)(?:=["']?([^"'\]]*)["']?)?\]$/);
    assert(match, `The DOM harness supports attribute selectors: ${selector}`);
    for (let node = this; node; node = node.parentNode) {
      const value = node.getAttribute?.(match[1]);
      if (value != null && (match[2] === undefined || value === match[2])) {
        return node;
      }
    }
    return null;
  }
  focus() {
    document.activeElement = this;
  }
}

const listeners = [];
const timers = new Map();
let timerId = 0;
const captureOf = (options) =>
  options === true ||
  (typeof options === "object" && options?.capture === true);
const body = new TestElement();
Object.assign(globalThis, {
  Node: TestNode,
  Element: TestElement,
  HTMLElement: TestElement,
  document: {
    body,
    activeElement: body,
    addEventListener(name, callback, options) {
      listeners.push({ name, callback, capture: captureOf(options) });
    },
    removeEventListener(name, callback, options) {
      const index = listeners.findIndex(
        (entry) =>
          entry.name === name &&
          entry.callback === callback &&
          entry.capture === captureOf(options),
      );
      if (index !== -1) listeners.splice(index, 1);
    },
  },
  window: {
    setTimeout(callback) {
      const id = ++timerId;
      timers.set(id, callback);
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  },
});

const { EditorPanelShell } = await import(
  feature("ui/chrome/EditorPanelShell.tsx")
);

function pointerDown(target, stopAtTarget = false) {
  const event = {
    target,
    propagationStopped: false,
    stopPropagation() {
      this.propagationStopped = true;
    },
  };
  const registrations = listeners.filter(
    (entry) => entry.name === "pointerdown",
  );
  for (const entry of registrations.filter(
    (registration) => registration.capture,
  )) {
    entry.callback(event);
  }

  if (stopAtTarget) event.stopPropagation();
  if (!event.propagationStopped) {
    for (const entry of registrations.filter(
      (registration) => !registration.capture,
    )) {
      entry.callback(event);
    }
  }
}

function mount(panel, layout) {
  const panelElement = new TestElement(body);
  let closeCalls = 0;
  let cleanups = [];
  const onClose = () => closeCalls++;
  const render = (state) => {
    section = panelElement;
    effects = [];
    EditorPanelShell({
      children: null,
      layout,
      onClose,
      panel,
      state,
      title: panel,
    });
    cleanups = effects.map((effect) => effect()).filter(Boolean);
  };
  const cleanup = () => {
    cleanups.forEach((dispose) => dispose());
    cleanups = [];
  };
  render("open");
  return {
    panelElement,
    get closeCalls() {
      return closeCalls;
    },
    closing() {
      cleanup();
      render("closing");
    },
    unmount: cleanup,
  };
}

const panels = [
  "app",
  "layouts",
  "settings",
  "menu",
  "export",
  "png",
  "starter",
  "shortcuts",
];
const layouts = ["mobile", "compact", "desktop"];
for (const panel of panels) {
  for (const layout of layouts) {
    const context = `${panel}/${layout}`;
    const shell = mount(panel, layout);
    const expectClose = (target, closes, reason, stopAtTarget = false) => {
      const previous = shell.closeCalls;
      pointerDown(target, stopAtTarget);
      assert.equal(
        shell.closeCalls,
        previous + Number(closes),
        `${context}: ${reason}`,
      );
    };
    assert.equal(listeners.length, 1, `${context}: one dismissal observer`);
    expectClose(
      new TestNode(shell.panelElement),
      false,
      "inside content stays open",
    );

    const ownTrigger = panel;
    const trigger = new TestElement(body, {
      "data-editor-panel-trigger": ownTrigger,
      "data-editor-chrome-control": "true",
    });
    expectClose(
      new TestElement(trigger),
      false,
      "the current trigger owns toggling",
    );
    const otherTrigger = new TestElement(body, {
      "data-editor-panel-trigger":
        ownTrigger === "settings" ? "layouts" : "settings",
      "data-editor-chrome-control": "true",
    });
    expectClose(
      new TestElement(otherTrigger),
      true,
      "another panel trigger dismisses",
    );
    expectClose(
      new TestElement(body, {
        "data-editor-chrome-control": "true",
      }),
      true,
      "theme and other toolbar controls dismiss",
    );
    const canvas = new TestElement(body);
    expectClose(canvas, true, "outside canvas dismisses");
    expectClose(
      canvas,
      true,
      "canvas stopPropagation cannot suppress dismissal",
      true,
    );

    shell.closing();
    assert.equal(
      listeners.length,
      0,
      `${context}: closing removes the observer`,
    );
    assert.equal(timers.size, 0, `${context}: closing cancels delayed focus`);
    expectClose(canvas, false, "a closing panel does not dismiss again");
    shell.unmount();
  }
}
const mounted = mount("settings", "desktop");
mounted.unmount();
assert.equal(listeners.length, 0, "Unmount removes the capture listener");
assert.equal(timers.size, 0, "Unmount cancels delayed focus");

console.log(
  "Panel dismissal passed (8 panels × 3 layouts, trigger ownership, canvas capture and cleanup)",
);
