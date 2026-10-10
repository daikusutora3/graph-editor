import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import * as Jotai from "jotai";
import { replaceModelCommand } from "../../features/graph-editor/core/graph/graph-intents";
import { graphAtom } from "../../features/graph-editor/shell/state/graph-atoms";
import {
  executeCommandAtom,
  historyAtom,
} from "../../features/graph-editor/shell/state/history-atoms";

const store = Jotai.createStore();
let applications = 0;
let closes = 0;
// Exercise the real Apply handler before any debounced preview exists. Effects
// and hook scheduling are irrelevant to this direct current-text action.
mock.module("react", () => ({
  ...React,
  useState: (initial) => [initial, () => {}],
  useRef: (current) => ({ current }),
  useMemo: (create) => create(),
  useCallback: (callback) => callback,
  useEffect() {},
  useLayoutEffect() {},
}));
mock.module("jotai", () => ({
  ...Jotai,
  useAtomValue: () => ({
    ...store.get(graphAtom).settings,
    weighted: true,
    weightKind: "string",
    indexBase: 0,
  }),
}));
mock.module(
  "../../features/graph-editor/workflows/starter/use-apply-graph-model",
  () => ({
    useApplyGraphModel: () => (model) => {
      applications++;
      return (
        store.set(executeCommandAtom, replaceModelCommand(model)).status !==
        "rejected"
      );
    },
  }),
);
const { useGraphStarterState: renderStarterState } =
  await import("../../features/graph-editor/workflows/starter/graph-starter-state");
const starter = renderStarterState({
  open: true,
  onClose: () => closes++,
  textareaRef: { current: null },
});

starter.applyText(`2 1\n0 1 ${"😀".repeat(256)}`);
assert.equal(applications, 1);
assert.equal(closes, 1);
assert.equal(store.get(graphAtom).edges[0].weight, "😀".repeat(256));
const graph = store.get(graphAtom);
const history = store.get(historyAtom);
for (const input of [
  `2 1\n0 1 ${"x".repeat(257)}`,
  `a: b(${"😀".repeat(257)})`,
  `${"界".repeat(257)} b`,
  `a b ${"x".repeat(257)}`,
]) {
  starter.applyText(input);
  assert.equal(
    applications,
    1,
    "fatal text-limit input cannot reach Apply even before debounce settles",
  );
  assert.equal(closes, 1, "rejected input keeps the panel open");
  assert.equal(
    store.get(graphAtom),
    graph,
    "rejected input preserves graph by reference",
  );
  assert.equal(
    store.get(historyAtom),
    history,
    "rejected input preserves history by reference",
  );
}
console.log(
  "Starter import guard passed (current-input rejection preserves graph/history before debounced validation)",
);
