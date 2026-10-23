import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import * as Jotai from "jotai";
import { renderToStaticMarkup } from "react-dom/server";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory.ts";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages.ts";
import { sampleGraphGroups } from "../../features/graph-editor/samples/registry.ts";

let locale = "en";
let states = [];
let stateIndex = 0;
let idIndex = 0;
let events = [];
let activeElement = null;
let applied = 0;
const search = {
  focus: () => {
    events.push("focus-search");
    activeElement = search;
  },
};
const searchRef = { current: search };
mock.module("react", () => ({
  ...React,
  useId: () => ["sample-search", "sample-category"][idIndex++],
  useRef: () => searchRef,
  useLayoutEffect() {},
  useMemo: (compute) => compute(),
  useCallback: (callback) => callback,
  useState: (initial) => {
    const index = stateIndex++;
    if (!(index in states))
      states[index] = typeof initial === "function" ? initial() : initial;
    return [
      states[index],
      (next) => {
        events.push(`set-state-${index}`);
        states[index] = typeof next === "function" ? next(states[index]) : next;
      },
    ];
  },
}));
mock.module("jotai", () => ({
  ...Jotai,
  useStore: () => ({ get: () => createEmptyGraphModel().settings }),
}));
mock.module("../../features/graph-editor/i18n/I18nProvider.tsx", () => ({
  useI18n: () => ({ locale, messages: messagesByLocale[locale] }),
}));
mock.module(
  "../../features/graph-editor/workflows/starter/use-apply-graph-model.ts",
  () => ({
    useApplyGraphModel: () => () => {
      applied += 1;
      return true;
    },
  }),
);

const { Button, Select } = await import("../../components/ui/controls.ts");
const { SampleGalleryPane } =
  await import("../../features/graph-editor/ui/samples/SampleGalleryPane.tsx");

function findElement(tree, predicate) {
  if (!tree || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
    return undefined;
  }
  if (predicate(tree)) return tree;
  return findElement(tree.props?.children, predicate);
}
function render() {
  stateIndex = 0;
  idIndex = 0;
  return SampleGalleryPane({ onSampleApplied() {} });
}
function inputOf(tree) {
  return findElement(tree, (element) => element.type === "input");
}

for (locale of ["ja", "en", "zh-Hans"]) {
  states = [];
  const messages = messagesByLocale[locale];
  const tree = render();
  const header = renderToStaticMarkup(tree.props.children[0]);
  assert(header.includes('<label for="sample-search"'));
  assert(header.includes(messages.samples.searchAria));
  assert(header.includes('<label for="sample-category"'));
  assert(header.includes(messages.samples.category));
  assert(header.includes('id="sample-search"'));
  assert(header.includes('id="sample-category"'));
  assert(!header.includes("placeholder="), "search retains a visible label");

  inputOf(tree).props.onChange({ target: { value: "no-such-sample-12345" } });
  const searched = render();
  const clearSearch = findElement(
    searched,
    (element) =>
      element.type === "button" &&
      element.props["aria-label"] === messages.samples.clearSearch,
  );
  assert(clearSearch);
  activeElement = clearSearch;
  events = [];
  clearSearch.props.onClick();
  assert.equal(
    events[0],
    "focus-search",
    "reset focuses search before unmount",
  );
  assert.equal(activeElement, search);
  assert.equal(inputOf(render()).props.value, "");

  inputOf(render()).props.onChange({
    target: { value: "no-such-sample-12345" },
  });
  findElement(render(), (element) => element.type === Select).props.onChange({
    target: { value: sampleGraphGroups[0].key },
  });
  const filtered = render();
  const resetFilters = findElement(
    filtered,
    (element) =>
      element.type === Button &&
      element.props.children === messages.samples.clearFilters,
  );
  assert(resetFilters, "an unmatched query offers filter recovery");
  activeElement = resetFilters;
  events = [];
  resetFilters.props.onClick();
  assert.equal(events[0], "focus-search", "filter reset retains modal focus");
  assert.equal(activeElement, search);
  const reset = render();
  assert.equal(inputOf(reset).props.value, "");
  assert.equal(
    findElement(reset, (element) => element.type === Select).props.value,
    "all",
  );
}
assert.equal(applied, 0, "search recovery never applies a graph sample");

console.log(
  "Sample controls: visible localized labels and synchronous search/filter focus restoration passed",
);
