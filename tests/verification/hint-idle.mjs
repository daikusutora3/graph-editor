import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import { createStore } from "jotai/vanilla";
import * as Jotai from "jotai";

const feature = (path) =>
  new URL(`../../features/graph-editor/${path}`, import.meta.url).pathname;
const store = createStore();
let currentHarness;
mock.module("react", () => ({
  ...React,
  useState: (initial) => currentHarness.state(initial),
  useRef: (initial) => currentHarness.ref(initial),
  useEffect: (effect, deps) => currentHarness.effect(effect, deps),
}));
mock.module("jotai", () => ({
  ...Jotai,
  useAtomValue: (atom) => store.get(atom),
}));
mock.module(feature("i18n/I18nProvider.tsx"), () => ({
  useI18n: () => ({
    messages: { chrome: { selectHint: "select a node" } },
  }),
}));
const listeners = new Map();
const timers = new Map();
const stored = new Map();
let now = 0;
let timerId = 0;
let timerCreations = 0;
let timerCancellations = 0;
Object.assign(globalThis, {
  performance: { now: () => now },
  window: {
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
    setTimeout: (callback, delay) => {
      timerCreations++;
      const id = ++timerId;
      timers.set(id, { callback, at: now + delay });
      return id;
    },
    clearTimeout: (id) => {
      timerCancellations++;
      timers.delete(id);
    },
    addEventListener: (name, listener) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
    },
    removeEventListener: (name, listener) =>
      listeners.get(name)?.delete(listener),
  },
});

const { CanvasHint } = await import(feature("ui/chrome/CanvasHint.tsx"));
const { editorModeAtom, selectionAtom } = await import(
  feature("shell/state/editor-atoms.ts")
);
const { graphAtom, syncExternalGraphAtom } = await import(
  feature("shell/state/graph-atoms.ts")
);
const { HINT_STORAGE_PREFIX, HINTS_RESET_EVENT } = await import(
  feature("ui/chrome/hint-storage.ts")
);
store.set(syncExternalGraphAtom, {
  ...store.get(graphAtom),
  nodes: [{ id: "a", label: "A", order: 0, x: 0, y: 0 }],
});
store.set(editorModeAtom, "select");

function sameDeps(previous, next) {
  return (
    previous && next.every((value, index) => Object.is(value, previous[index]))
  );
}
function harness(component) {
  const slots = [];
  const effects = new Map();
  let cursor;
  let pending;
  let dirty;
  let value;
  let mounted = true;
  let lateUpdates = 0;
  const api = {
    state(initial) {
      const index = cursor++;
      if (!(index in slots)) {
        const slot = {
          value: typeof initial === "function" ? initial() : initial,
        };
        slot.set = (next) => {
          if (!mounted) {
            lateUpdates++;
            return;
          }
          const resolved = typeof next === "function" ? next(slot.value) : next;
          if (!Object.is(resolved, slot.value)) {
            slot.value = resolved;
            dirty = true;
          }
        };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    ref(initial) {
      const index = cursor++;
      return (slots[index] ??= { current: initial });
    },
    effect(effect, deps) {
      const index = cursor++;
      const previous = effects.get(index);
      if (!sameDeps(previous?.deps, deps)) {
        pending.push(() => {
          previous?.cleanup?.();
          effects.set(index, { effect, deps, cleanup: effect() });
        });
      }
    },
    flush() {
      for (let pass = 0; pass < 40; pass++) {
        dirty = false;
        cursor = 0;
        pending = [];
        currentHarness = api;
        value = component();
        pending.forEach((effect) => effect());
        if (!dirty) return value;
      }
      throw new Error("Hint did not settle");
    },
    replayEffects() {
      effects.forEach(({ cleanup }) => cleanup?.());
      effects.forEach((entry) => (entry.cleanup = entry.effect()));
      return api.flush();
    },
    unmount() {
      mounted = false;
      effects.forEach(({ cleanup }) => cleanup?.());
    },
    get lateUpdates() {
      return lateUpdates;
    },
  };
  return api;
}
function dispatch(name) {
  for (const listener of listeners.get(name) ?? []) listener();
}
function activityListeners() {
  return ["pointerdown", "pointermove", "keydown", "wheel"].reduce(
    (count, name) => count + (listeners.get(name)?.size ?? 0),
    0,
  );
}
function advance(target) {
  while (true) {
    const next = [...timers]
      .filter(([, timer]) => timer.at <= target)
      .sort((a, b) => a[1].at - b[1].at)[0];
    if (!next) break;
    const [id, timer] = next;
    now = timer.at;
    timers.delete(id);
    timer.callback();
  }
  now = target;
}

let visible = false;
const hint = harness(() => CanvasHint({ mobile: false, visible }));
hint.flush();
console.log(
  `Hidden hint observer: ${activityListeners()} activity listeners, ${timers.size} timers`,
);
assert.equal(
  activityListeners(),
  0,
  "Hidden panels do not monitor user activity",
);
assert.equal(timers.size, 0);
visible = true;
assert.equal(hint.flush(), null, "A newly available hint waits for inactivity");
assert.equal(activityListeners(), 4);
assert.equal(timers.size, 1);
const baseline = { timerCreations, timerCancellations };
now = 1000;
for (let index = 0; index < 10000; index++)
  dispatch(index % 2 ? "pointermove" : "wheel");
hint.flush();
console.log(
  `10,000 activity events: ${timerCreations - baseline.timerCreations} timer creations, ${timerCancellations - baseline.timerCancellations} cancellations`,
);
assert.equal(
  timerCreations,
  baseline.timerCreations,
  "Activity updates one deadline without allocating event-sized timer work",
);
assert.equal(timerCancellations, baseline.timerCancellations);
advance(2499);
assert.equal(hint.flush(), null);
advance(2500);
assert.equal(
  hint.flush(),
  null,
  "The first timeout must honor the most recent activity",
);
assert.equal(
  timers.size,
  1,
  "Continued activity keeps exactly one pending timeout",
);
advance(3499);
assert.equal(hint.flush(), null);
advance(3500);
assert.equal(
  hint.flush()?.props.text,
  "select a node",
  "The hint appears after a full idle interval",
);
assert.equal(timers.size, 0);
dispatch("keydown");
assert.equal(
  hint.flush(),
  null,
  "Interaction hides an already visible hint immediately",
);
assert.equal(timers.size, 1);
hint.replayEffects();
assert.equal(
  activityListeners(),
  4,
  "Strict Mode effect replay cannot duplicate activity listeners",
);
assert.equal(timers.size, 1);
visible = false;
assert.equal(hint.flush(), null);
assert.equal(activityListeners(), 0);
assert.equal(timers.size, 0);
advance(9000);
visible = true;
assert.equal(
  hint.flush(),
  null,
  "Reopening restarts the idle interval instead of showing a stale hint",
);
store.set(selectionAtom, { nodeIds: ["a"], edgeIds: [] });
hint.flush();
assert.equal(stored.get(`${HINT_STORAGE_PREFIX}select`), "1");
assert.equal(
  activityListeners(),
  0,
  "Completing the hinted action removes activity observation",
);
assert.equal(timers.size, 0);
store.set(selectionAtom, { nodeIds: [], edgeIds: [] });
hint.flush();
assert.equal(activityListeners(), 0, "A learned hint remains dormant");
stored.delete(`${HINT_STORAGE_PREFIX}select`);
dispatch(HINTS_RESET_EVENT);
assert.equal(hint.flush(), null);
assert.equal(
  activityListeners(),
  4,
  "Resetting hints re-arms only the currently useful hint",
);
hint.unmount();
assert.equal(activityListeners(), 0);
assert.equal(timers.size, 0);
advance(20000);
assert.equal(hint.lateUpdates, 0);
assert.equal(
  [...listeners.values()].reduce((count, entries) => count + entries.size, 0),
  0,
);
console.log(
  "Hint idle lifecycle passed (activity deadline, learned/hidden dormancy and cleanup)",
);
