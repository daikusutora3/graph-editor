import assert from "node:assert/strict";
import type { KeyboardEvent } from "react";

import {
  menuFocusKeyDown,
  tabbableElements,
  trapFocusKeyDown,
} from "../../features/graph-editor/ui/primitives/focus-navigation";

const documentState = {
  activeElement: null as HTMLElement | null,
  defaultView: {
    getComputedStyle: (element: HTMLElement) => ({
      visibility: element.dataset.visibility ?? "visible",
    }),
  },
};
let activations = 0;
type ControlOptions = {
  tag?: string;
  tabIndex?: number;
  href?: string;
  role?: string;
  disabled?: boolean;
  ariaDisabled?: boolean;
  excludedAncestor?: "hidden" | "inert" | "aria-hidden";
  rendered?: boolean | (() => boolean);
  visibility?: string;
};
const metadata = new WeakMap<HTMLElement, ControlOptions>();
function control(options: ControlOptions = {}) {
  const {
    tag = "button",
    tabIndex = tag === "div" || (tag === "a" && !options.href) ? -1 : 0,
    disabled = false,
    ariaDisabled = false,
    excludedAncestor,
    rendered = true,
    visibility = "visible",
  } = options;
  const element = {
    tagName: tag.toUpperCase(),
    tabIndex,
    dataset: { visibility },
    ownerDocument: documentState,
    matches: (selector: string) =>
      (disabled && selector.split(",").includes(":disabled")) ||
      (ariaDisabled && selector.includes("[aria-disabled='true']")),
    closest: (selector: string) => {
      const ancestorSelector =
        excludedAncestor === "aria-hidden"
          ? "[aria-hidden='true']"
          : `[${excludedAncestor}]`;
      return excludedAncestor && selector.split(",").includes(ancestorSelector)
        ? {}
        : null;
    },
    getClientRects: () =>
      (typeof rendered === "function" ? rendered() : rendered) ? [{}] : [],
    focus() {
      documentState.activeElement = this as unknown as HTMLElement;
    },
    click() {
      activations++;
    },
  } as unknown as HTMLElement;
  metadata.set(element, { ...options, tag });
  return element;
}

function matchesQuery(element: HTMLElement, selector: string) {
  const info = metadata.get(element)!;
  return selector.split(",").some((part) => {
    if (part === "[tabindex]") return Object.hasOwn(info, "tabIndex");
    if (part === "a[href]") return info.tag === "a" && !!info.href;
    const role = part.match(/^\[role='([^']+)'\]$/)?.[1];
    return role ? info.role === role : info.tag === part;
  });
}

function panel(controls: HTMLElement[]) {
  const root = control({ tag: "div", tabIndex: -1 });
  root.querySelectorAll = ((selector: string) =>
    controls.filter((element) =>
      matchesQuery(element, selector),
    )) as unknown as HTMLElement["querySelectorAll"];
  return root;
}

const unchecked = control({ tag: "div", tabIndex: -1, role: "radio" });
const checked = control({ tag: "div", tabIndex: 0, role: "radio" });
const nextGroup = control();
const disabled = control({ disabled: true });
const ariaDisabled = control({ ariaDisabled: true });
const hidden = control({ rendered: false });
const hiddenAncestor = control({ excludedAncestor: "hidden" });
const inert = control({ excludedAncestor: "inert" });
const ariaHidden = control({ excludedAncestor: "aria-hidden" });
const invisible = control({ visibility: "hidden" });
const collapsed = control({ visibility: "collapse" });
const link = control({ tag: "a", href: "/guide" });
const noHref = control({ tag: "a" });
const scrollRegion = control({ tag: "div", tabIndex: 0 });
const summary = control({ tag: "summary" });
let disclosureOpen = false;
const disclosureAction = control({ rendered: () => disclosureOpen });
const eligibility = panel([
  unchecked,
  checked,
  nextGroup,
  disabled,
  ariaDisabled,
  hidden,
  hiddenAncestor,
  inert,
  ariaHidden,
  invisible,
  collapsed,
  link,
  noHref,
  scrollRegion,
  summary,
  disclosureAction,
]);
assert.deepEqual(
  tabbableElements(eligibility),
  [checked, nextGroup, link, scrollRegion, summary],
  "Selected radios, native summary and linked/explicit-tabindex controls remain in DOM order while unavailable controls are excluded",
);
disclosureOpen = true;
assert.deepEqual(
  tabbableElements(eligibility),
  [checked, nextGroup, link, scrollRegion, summary, disclosureAction],
  "Opening a disclosure adds its rendered action after the native summary",
);
assert.deepEqual(tabbableElements(null), []);

const close = control();
const textarea = control({ tag: "textarea" });
const action = control();
const last = control({ tag: "a", href: "/guide" });
const dialog = panel([close, textarea, disabled, action, last]);
type TrapOverrides = {
  key?: string;
  shiftKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  defaultPrevented?: boolean;
  composing?: boolean;
};
function trap(root: HTMLElement | null, overrides: TrapOverrides = {}) {
  let prevented = 0;
  const event = {
    key: "Tab",
    shiftKey: false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    defaultPrevented: false,
    ...overrides,
    nativeEvent: { isComposing: overrides.composing ?? false },
    preventDefault() {
      prevented++;
      this.defaultPrevented = true;
    },
  };
  trapFocusKeyDown(event as unknown as KeyboardEvent<HTMLElement>, root);
  return prevented;
}
textarea.focus();
assert.equal(trap(dialog), 1);
assert.equal(
  documentState.activeElement,
  action,
  "Interior textarea Tab explicitly reaches the next enabled button instead of using Safari's native button-skipping order",
);
assert.equal(trap(dialog, { shiftKey: true }), 1);
assert.equal(
  documentState.activeElement,
  textarea,
  "Interior Shift+Tab explicitly returns to the textarea",
);
last.focus();
assert.equal(trap(dialog), 1);
assert.equal(
  documentState.activeElement,
  close,
  "Tab wraps the last control to the first",
);
assert.equal(trap(dialog, { shiftKey: true }), 1);
assert.equal(
  documentState.activeElement,
  last,
  "Shift+Tab wraps the first control to the last",
);
for (const start of [dialog, control({ tag: "div", tabIndex: -1 })]) {
  for (const shiftKey of [false, true]) {
    start.focus();
    assert.equal(trap(dialog, { shiftKey }), 1);
    assert.equal(
      documentState.activeElement,
      shiftKey ? last : close,
      "Root or unlisted focus enters the available order in the requested direction",
    );
  }
}
const single = panel([action]);
action.focus();
assert.equal(trap(single), 1);
assert.equal(
  documentState.activeElement,
  action,
  "A single control remains contained without activation",
);
const empty = panel([disabled, hidden]);
textarea.focus();
assert.equal(trap(empty), 1);
assert.equal(
  documentState.activeElement,
  empty,
  "A dialog without available controls retains focus on its root",
);
const disclosureDialog = panel([textarea, summary, disclosureAction, action]);
disclosureOpen = false;
textarea.focus();
assert.equal(trap(disclosureDialog), 1);
assert.equal(
  documentState.activeElement,
  summary,
  "A closed disclosure's summary remains in the Tab order",
);
assert.equal(trap(disclosureDialog), 1);
assert.equal(
  documentState.activeElement,
  action,
  "Closed disclosure contents are skipped during Tab navigation",
);
disclosureOpen = true;
summary.focus();
assert.equal(trap(disclosureDialog), 1);
assert.equal(
  documentState.activeElement,
  disclosureAction,
  "Opening a disclosure exposes its action to the next Tab without a stale focus cache",
);
for (const overrides of [
  { key: "Enter" },
  { key: " " },
  { key: "Escape" },
  { key: "ArrowDown" },
  { defaultPrevented: true },
  { ctrlKey: true },
  { altKey: true },
  { metaKey: true },
  { composing: true },
]) {
  textarea.focus();
  assert.equal(trap(dialog, overrides), 0);
  assert.equal(
    documentState.activeElement,
    textarea,
    "Consumed events, non-Tab keys, browser shortcuts and composition retain their own behavior",
  );
}
assert.equal(trap(null), 0, "An absent dialog does not intercept the key");
assert.equal(
  activations,
  0,
  "Tab navigation changes focus without activating controls",
);

const firstLink = control({
  tag: "a",
  href: "/guide",
  role: "menuitem",
  tabIndex: -1,
});
const lastAction = control({ role: "menuitem", tabIndex: -1 });
const disabledItem = control({ role: "menuitem", disabled: true });
const hiddenItem = control({ role: "menuitem", rendered: false });
const menu = panel([firstLink, disabledItem, hiddenItem, lastAction]);
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
  "Arrow navigation never activates links or actions",
);
for (const key of ["Enter", " ", "Tab", "Escape", "ArrowLeft"]) press(key);
assert.equal(
  prevented,
  6,
  "Menu activation, Tab and Escape retain their own handlers",
);
assert.equal(activations, 0);

console.log(
  "Focus navigation passed (modal interior/wrap order, native summary, availability, modifier/IME guards and menu navigation)",
);
