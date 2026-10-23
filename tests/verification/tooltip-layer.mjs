import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";

let effects = [];
mock.module("react", () => ({
  ...React,
  useEffect: (effect) => effects.push(effect),
  useId: () => "test-tooltip",
}));

class EventSurface {
  listeners = [];
  addEventListener(name, callback, capture = false) {
    this.listeners.push({ name, callback, capture });
  }
  removeEventListener(name, callback, capture = false) {
    this.listeners = this.listeners.filter(
      (entry) =>
        entry.name !== name ||
        entry.callback !== callback ||
        entry.capture !== capture,
    );
  }
  dispatch(name, properties = {}) {
    for (const entry of this.listeners) {
      if (entry.name === name) entry.callback(properties);
    }
  }
}

class TestElement {
  attributes = {};
  dataset = {};
  children = [];
  parentNode = null;
  isConnected = false;
  hidden = false;
  textContent = "";
  style = {};
  focusVisible = false;
  rect = { left: 100, top: 100, width: 40, height: 40 };

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "data-tooltip") this.dataset.tooltip = String(value);
    if (name === "data-tooltip-side") {
      this.dataset.tooltipSide = String(value);
    }
  }
  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
  removeAttribute(name) {
    delete this.attributes[name];
  }
  append(child) {
    child.parentNode = this;
    child.isConnected = this.isConnected;
    this.children.push(child);
  }
  remove() {
    if (this.parentNode) {
      this.parentNode.children = this.parentNode.children.filter(
        (child) => child !== this,
      );
    }
    this.parentNode = null;
    this.isConnected = false;
  }
  matches(selector) {
    if (selector === ":focus-visible") return this.focusVisible;
    const match = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/);
    assert(match, `Supported attribute selector: ${selector}`);
    const value = this.getAttribute(match[1]);
    return value !== null && (match[2] === undefined || value === match[2]);
  }
  closest(selector) {
    for (let node = this; node; node = node.parentNode) {
      if (node.matches(selector)) return node;
    }
    return null;
  }
  querySelector(selector) {
    for (const child of this.children) {
      if (child.matches(selector)) return child;
      const descendant = child.querySelector(selector);
      if (descendant) return descendant;
    }
    return null;
  }
  getBoundingClientRect() {
    const rect =
      this.className === "ge-tooltip"
        ? {
            left: Number.parseFloat(this.style.left) || 0,
            top: Number.parseFloat(this.style.top) || 0,
            width: Math.min(100, Number.parseFloat(this.style.maxWidth)),
            height: Math.min(28, Number.parseFloat(this.style.maxHeight)),
          }
        : this.rect;
    return {
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
    };
  }
}

const observers = [];
class TestObserver {
  targets = new Set();
  constructor(callback) {
    this.callback = callback;
    observers.push(this);
  }
  observe(target) {
    this.targets.add(target);
  }
  disconnect() {
    this.targets.clear();
  }
  notify() {
    if (this.targets.size) this.callback();
  }
}

const { TooltipLayer } = await import("../../components/ui/TooltipLayer.tsx");

function mount() {
  const body = new TestElement();
  body.isConnected = true;
  const documentSurface = new EventSurface();
  const windowSurface = new EventSurface();
  const visualViewport = new EventSurface();
  Object.assign(visualViewport, {
    offsetLeft: 0,
    offsetTop: 0,
    width: 320,
    height: 720,
  });
  const timers = new Map();
  let now = 0;
  let nextTimer = 0;
  Object.assign(documentSurface, {
    body,
    documentElement: { clientWidth: 320, clientHeight: 720 },
    createElement: () => new TestElement(),
  });
  Object.assign(windowSurface, {
    visualViewport,
    matchMedia: () => ({ matches: true }),
    setTimeout(callback, delay = 0) {
      const id = ++nextTimer;
      timers.set(id, { callback, due: now + delay });
      return id;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
  });
  Object.assign(globalThis, {
    document: documentSurface,
    window: windowSurface,
    Element: TestElement,
    HTMLElement: TestElement,
    ResizeObserver: TestObserver,
    MutationObserver: TestObserver,
  });
  effects = [];
  observers.length = 0;
  TooltipLayer();
  const cleanups = effects.map((effect) => effect());
  const tooltip = body.children.find(
    (element) => element.className === "ge-tooltip",
  );
  assert(tooltip, "mount creates a single body-level tooltip");
  const advance = (duration) => {
    const until = now + duration;
    for (;;) {
      const next = [...timers.entries()]
        .filter(([, timer]) => timer.due <= until)
        .sort((first, second) => first[1].due - second[1].due)[0];
      if (!next) break;
      now = next[1].due;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = until;
  };
  const trigger = (text, parent = body) => {
    const element = new TestElement();
    element.setAttribute("data-tooltip", text);
    parent.append(element);
    return element;
  };
  const dispatch = (name, target, properties = {}) =>
    documentSurface.dispatch(name, { target, ...properties });
  const hover = (target, properties = {}) =>
    dispatch("pointerover", target, { pointerType: "mouse", ...properties });
  const focus = (target) => dispatch("focusin", target);
  const key = (value) => dispatch("keydown", body, { key: value });
  const notifyMutation = () => observers[1].notify();
  const unmount = () => {
    cleanups.forEach((cleanup) => cleanup());
    assert.equal(body.children.includes(tooltip), false, "tooltip is removed");
    assert.equal(documentSurface.listeners.length, 0, "document cleanup");
    assert.equal(windowSurface.listeners.length, 0, "window cleanup");
    assert.equal(visualViewport.listeners.length, 0, "viewport cleanup");
    assert.equal(timers.size, 0, "pending tooltip timers are cancelled");
    assert(
      observers.every((observer) => observer.targets.size === 0),
      "all observers are disconnected",
    );
  };
  return {
    body,
    tooltip,
    timers,
    documentSurface,
    trigger,
    dispatch,
    hover,
    focus,
    key,
    advance,
    notifyMutation,
    unmount,
  };
}

{
  const layer = mount();
  const first = layer.trigger("First hint");
  const second = layer.trigger("Second hint");
  layer.hover(first);
  layer.advance(349);
  assert(layer.tooltip.hidden, "hover waits before showing a tooltip");
  layer.advance(1);
  assert.equal(layer.tooltip.hidden, false, "hover shows after 350 ms");
  assert.equal(layer.tooltip.textContent, "First hint");
  assert.equal(first.getAttribute("aria-describedby"), "test-tooltip");
  layer.key("Tab");
  layer.focus(second);
  layer.advance(0);
  assert.equal(
    layer.tooltip.textContent,
    "Second hint",
    "keyboard focus takes precedence over a stationary hovered trigger",
  );
  assert.equal(first.getAttribute("aria-describedby"), null);
  assert.equal(second.getAttribute("aria-describedby"), "test-tooltip");
  layer.dispatch("focusout", second, { relatedTarget: first });
  layer.focus(first);
  layer.advance(0);
  assert.equal(layer.tooltip.textContent, "First hint", "Tab changes hints");
  assert.equal(second.getAttribute("aria-describedby"), null);
  layer.dispatch("focusout", first, { relatedTarget: layer.body });
  assert(layer.tooltip.hidden, "leaving keyboard focus hides the hint");
  layer.unmount();
}

{
  const layer = mount();
  const trigger = layer.trigger("Hint with an existing description");
  trigger.setAttribute("aria-describedby", "existing-description");
  trigger.focusVisible = true;
  layer.focus(trigger);
  layer.advance(0);
  assert.equal(
    trigger.getAttribute("aria-describedby"),
    "existing-description test-tooltip",
    "focus-visible adds the hint without replacing existing descriptions",
  );
  layer.key("Escape");
  assert(layer.tooltip.hidden, "Escape dismisses the active tooltip");
  assert.equal(
    trigger.getAttribute("aria-describedby"),
    "existing-description",
  );
  const child = new TestElement();
  trigger.append(child);
  layer.hover(child);
  layer.focus(trigger);
  layer.advance(350);
  assert(layer.tooltip.hidden, "the dismissed trigger stays dismissed");
  layer.dispatch("focusout", trigger, { relatedTarget: layer.body });
  layer.dispatch("pointerout", child, { relatedTarget: layer.body });
  layer.hover(trigger);
  layer.advance(350);
  assert.equal(layer.tooltip.hidden, false, "a fresh hover can show it again");
  layer.unmount();
  assert.equal(
    trigger.getAttribute("aria-describedby"),
    "existing-description",
  );
}

{
  const layer = mount();
  const trigger = layer.trigger("Hoverable hint");
  layer.hover(trigger);
  layer.advance(350);
  layer.dispatch("pointerout", trigger, { relatedTarget: layer.tooltip });
  layer.hover(layer.tooltip);
  layer.advance(1000);
  assert.equal(layer.tooltip.hidden, false, "the tooltip itself retains hover");
  assert.equal(trigger.getAttribute("aria-describedby"), "test-tooltip");
  layer.dispatch("pointerout", layer.tooltip, { relatedTarget: layer.body });
  layer.advance(149);
  assert.equal(
    layer.tooltip.hidden,
    false,
    "leaving a hint has a short grace period",
  );
  layer.advance(1);
  assert(layer.tooltip.hidden, "the hint closes after leaving both surfaces");
  assert.equal(trigger.getAttribute("aria-describedby"), null);
  layer.unmount();
}

{
  const layer = mount();
  const focused = layer.trigger("Previously focused hint");
  const hovered = layer.trigger("Hint being read with the pointer");
  const nextFocused = layer.trigger("Next keyboard hint");
  layer.key("Tab");
  layer.focus(focused);
  layer.advance(0);
  layer.hover(hovered);
  layer.advance(350);
  assert.equal(layer.tooltip.textContent, "Hint being read with the pointer");
  layer.dispatch("pointerout", hovered, { relatedTarget: layer.body });
  layer.hover(layer.body);
  layer.advance(100);
  assert.equal(
    layer.tooltip.textContent,
    "Hint being read with the pointer",
    "the pointer can cross the body gap despite another focused control",
  );
  assert.equal(layer.tooltip.hidden, false);
  layer.hover(layer.tooltip);
  layer.advance(1000);
  assert.equal(
    layer.tooltip.textContent,
    "Hint being read with the pointer",
    "hovering the tooltip retains its anchor despite another focused control",
  );
  assert.equal(hovered.getAttribute("aria-describedby"), "test-tooltip");
  assert.equal(focused.getAttribute("aria-describedby"), null);
  layer.dispatch("focusout", focused, { relatedTarget: nextFocused });
  layer.focus(nextFocused);
  layer.advance(0);
  assert.equal(
    layer.tooltip.textContent,
    "Next keyboard hint",
    "a new keyboard focus supersedes the retained pointer tooltip",
  );
  assert.equal(hovered.getAttribute("aria-describedby"), null);
  layer.unmount();
}

{
  const layer = mount();
  const focused = layer.trigger("Previously focused neighbour");
  const hovered = layer.trigger("Dismiss this pointer hint");
  layer.key("Tab");
  layer.focus(focused);
  layer.advance(0);
  layer.hover(hovered);
  layer.advance(350);
  layer.dispatch("pointerout", hovered, { relatedTarget: layer.body });
  layer.advance(100);
  layer.hover(layer.tooltip);
  layer.key("Escape");
  layer.dispatch("pointerout", layer.tooltip, { relatedTarget: layer.body });
  layer.hover(layer.body);
  layer.advance(500);
  assert(
    layer.tooltip.hidden,
    "Escape stays dismissed after hiding the tooltip emits pointerout",
  );
  assert.equal(focused.getAttribute("aria-describedby"), null);
  assert.equal(hovered.getAttribute("aria-describedby"), null);
  layer.hover(focused);
  layer.advance(350);
  assert.equal(
    layer.tooltip.textContent,
    "Previously focused neighbour",
    "a fresh pointer entry can show the neighbour after dismissal",
  );
  layer.unmount();
}

{
  const layer = mount();
  const trigger = layer.trigger("Cross the gap");
  layer.hover(trigger);
  layer.advance(350);
  layer.dispatch("pointerout", trigger, { relatedTarget: layer.body });
  layer.hover(layer.body);
  layer.advance(140);
  layer.hover(layer.tooltip);
  layer.advance(1000);
  assert.equal(
    layer.tooltip.hidden,
    false,
    "crossing the gap cancels dismissal",
  );
  layer.dispatch("pointerout", layer.tooltip, { relatedTarget: trigger });
  layer.hover(trigger);
  assert.equal(
    layer.timers.size,
    0,
    "returning to the trigger needs no new delay",
  );
  assert.equal(layer.tooltip.hidden, false);
  layer.key("Escape");
  assert(layer.tooltip.hidden, "Escape also dismisses a pointer hint");
  layer.hover(trigger);
  layer.advance(350);
  assert(layer.tooltip.hidden, "hovering the same trigger cannot undo Escape");
  layer.dispatch("pointerout", trigger, { relatedTarget: layer.body });
  layer.hover(trigger);
  layer.advance(350);
  assert.equal(
    layer.tooltip.hidden,
    false,
    "leaving and returning starts a fresh hover",
  );
  layer.dispatch("pointerout", trigger, { relatedTarget: layer.tooltip });
  layer.hover(layer.tooltip);
  layer.key("Escape");
  layer.key("Escape");
  assert(layer.tooltip.hidden, "Escape dismisses a hovered tooltip itself");
  assert.equal(trigger.getAttribute("aria-describedby"), null);
  layer.unmount();
}

{
  const layer = mount();
  const trigger = layer.trigger("Click dismisses the hint");
  layer.hover(trigger);
  layer.advance(350);
  layer.dispatch("pointerdown", trigger);
  layer.focus(trigger);
  layer.hover(trigger);
  layer.advance(350);
  assert(
    layer.tooltip.hidden,
    "pointer focus does not reopen a dismissed hint",
  );
  layer.dispatch("pointerout", trigger, { relatedTarget: layer.body });
  layer.hover(trigger);
  layer.advance(350);
  assert.equal(
    layer.tooltip.hidden,
    false,
    "fresh hover after a click can show the hint",
  );
  layer.unmount();
}

{
  const layer = mount();
  const trigger = layer.trigger("Pending hint");
  layer.hover(trigger);
  layer.advance(200);
  layer.dispatch("pointerout", trigger, { relatedTarget: layer.body });
  layer.advance(200);
  assert(
    layer.tooltip.hidden,
    "leaving before the reveal cancels the pending hint",
  );
  assert.equal(layer.timers.size, 0);
  layer.hover(trigger);
  layer.advance(350);
  layer.dispatch("pointerout", trigger, { relatedTarget: layer.body });
  layer.unmount();
  layer.advance(150);
  assert(layer.tooltip.hidden, "unmount cancels a pending bridge delay");
}

{
  const layer = mount();
  const first = layer.trigger("Focused hint");
  const second = layer.trigger("Next focused hint");
  layer.key("Tab");
  layer.focus(first);
  layer.advance(0);
  layer.hover(first);
  layer.dispatch("pointerout", first, { relatedTarget: layer.body });
  layer.advance(500);
  assert.equal(
    layer.tooltip.hidden,
    false,
    "keyboard focus survives pointer departure",
  );
  layer.hover(layer.tooltip);
  layer.dispatch("focusout", first, { relatedTarget: second });
  layer.focus(second);
  layer.advance(0);
  assert.equal(
    layer.tooltip.textContent,
    "Next focused hint",
    "new keyboard focus replaces a hovered tooltip",
  );
  assert.equal(first.getAttribute("aria-describedby"), null);
  layer.unmount();
}

{
  const layer = mount();
  const expanded = layer.trigger("Open popover trigger");
  expanded.setAttribute("aria-expanded", "true");
  layer.hover(expanded);
  layer.advance(350);
  assert(layer.tooltip.hidden, "open popovers suppress their trigger hints");
  const toolbar = new TestElement();
  toolbar.setAttribute("role", "toolbar");
  layer.body.append(toolbar);
  const menu = new TestElement();
  menu.setAttribute("data-range-selection-controls", "");
  toolbar.append(menu);
  const rangeTrigger = layer.trigger("Range toolbar hint", toolbar);
  layer.hover(rangeTrigger);
  layer.advance(350);
  assert(
    layer.tooltip.hidden,
    "range menus suppress surrounding toolbar hints",
  );
  menu.remove();
  layer.hover(rangeTrigger);
  layer.advance(350);
  assert.equal(layer.tooltip.hidden, false, "closed range menus permit hints");
  rangeTrigger.setAttribute("aria-expanded", "true");
  layer.notifyMutation();
  assert(
    layer.tooltip.hidden,
    "opening a popover hides an already visible hint",
  );
  assert.equal(rangeTrigger.getAttribute("aria-describedby"), null);
  layer.unmount();
}

{
  const layer = mount();
  const trigger = layer.trigger("Scroll hint");
  layer.hover(trigger);
  layer.advance(350);
  layer.dispatch("scroll", layer.body);
  assert(layer.tooltip.hidden, "scroll dismisses a visible tooltip");
  assert.equal(trigger.getAttribute("aria-describedby"), null);
  assert(
    layer.documentSurface.listeners
      .filter(
        (entry) => entry.name === "scroll" || entry.name === "pointerdown",
      )
      .every((entry) => entry.capture === true),
    "scroll and pointer dismissal run even when inner handlers stop propagation",
  );
  layer.unmount();
}

{
  const layer = mount();
  const mouseTrigger = layer.trigger("Mouse-only hint");
  layer.hover(mouseTrigger, { pointerType: "touch" });
  layer.advance(350);
  assert(layer.tooltip.hidden, "touch interaction does not invent hover hints");
  layer.hover(mouseTrigger);
  assert.equal(layer.timers.size, 1, "hover schedules a pending hint");
  layer.unmount();
  layer.advance(350);
  assert(layer.tooltip.hidden, "unmount cannot resurrect a pending tooltip");
}

{
  const layer = mount();
  const removed = layer.trigger("Removed hover target");
  const focused = layer.trigger("Keyboard hint after removal");
  layer.hover(removed);
  layer.advance(350);
  removed.remove();
  layer.notifyMutation();
  assert(layer.tooltip.hidden, "removing a trigger hides its tooltip");
  layer.key("Tab");
  layer.focus(focused);
  layer.advance(0);
  assert.equal(
    layer.tooltip.textContent,
    "Keyboard hint after removal",
    "a disconnected hover target cannot block keyboard hints",
  );
  layer.unmount();
  assert.equal(focused.getAttribute("aria-describedby"), null);
}

console.log("Tooltip layer events, suppression and cleanup passed");
