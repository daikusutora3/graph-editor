import assert from "node:assert/strict";
import type { KeyboardEvent } from "react";

import {
  menuFocusKeyDown,
  tabbableElements,
} from "../../features/graph-editor/ui/primitives/focus-navigation";

// DOM doubles keep these focus contracts runnable without launching a browser.
const documentState = {
  activeElement: null as HTMLElement | null,
  defaultView: {
    getComputedStyle: (element: HTMLElement) => ({
      visibility: element.dataset.visibility ?? "visible",
    }),
  },
};
let activations = 0;
function control({
  tabIndex = 0,
  disabled = false,
  excludedAncestor = false,
  rendered = true,
  visibility = "visible",
}: {
  tabIndex?: number;
  disabled?: boolean;
  excludedAncestor?: boolean;
  rendered?: boolean;
  visibility?: string;
} = {}) {
  return {
    tabIndex,
    dataset: { visibility },
    ownerDocument: documentState,
    matches: () => disabled,
    closest: () => (excludedAncestor ? {} : null),
    getClientRects: () => (rendered ? [{}] : []),
    focus() {
      documentState.activeElement = this as unknown as HTMLElement;
    },
    click() {
      activations++;
    },
  } as unknown as HTMLElement;
}

const unchecked = control({ tabIndex: -1 });
const checked = control();
const nextGroup = control();
const disabled = control({ disabled: true });
const hidden = control({ rendered: false });
const inert = control({ excludedAncestor: true });
const invisible = control({ visibility: "hidden" });
const panel = {
  querySelectorAll: () => [
    unchecked,
    checked,
    nextGroup,
    disabled,
    hidden,
    inert,
    invisible,
  ],
} as unknown as HTMLElement;
assert.deepEqual(
  tabbableElements(panel),
  [checked, nextGroup],
  "Panel entry and Tab boundaries must use selected radios and available controls",
);
assert.deepEqual(tabbableElements(null), []);

const firstLink = control({ tabIndex: -1 });
const lastAction = control({ tabIndex: -1 });
const menu = {
  ownerDocument: documentState,
  querySelectorAll: () => [firstLink, disabled, hidden, lastAction],
} as unknown as HTMLElement;
let prevented = 0;
function press(key: string) {
  menuFocusKeyDown({
    key,
    currentTarget: menu,
    preventDefault: () => prevented++,
  } as unknown as KeyboardEvent<HTMLElement>);
}
press("ArrowDown");
assert.equal(documentState.activeElement, firstLink);
press("ArrowDown");
assert.equal(documentState.activeElement, lastAction);
press("ArrowDown");
assert.equal(documentState.activeElement, firstLink);
press("ArrowUp");
assert.equal(documentState.activeElement, lastAction);
press("Home");
assert.equal(documentState.activeElement, firstLink);
press("End");
assert.equal(documentState.activeElement, lastAction);
assert.equal(prevented, 6);
assert.equal(
  activations,
  0,
  "Arrow navigation must never activate links or actions",
);
for (const key of ["Enter", " ", "Tab", "Escape", "ArrowLeft"]) press(key);
assert.equal(
  prevented,
  6,
  "Activation, Tab and Escape retain their native handlers",
);
assert.equal(activations, 0);

console.log(
  "Focus navigation: selected radios, unavailable controls and menu-only focus passed",
);
