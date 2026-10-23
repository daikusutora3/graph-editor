import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { clearConfirmationCopy } from "../../features/graph-editor/i18n/clear-confirmation-copy.ts";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages.ts";

let locale = "en";
let refs = [];
let refIndex = 0;
let effects = [];
let effectDependencies;
mock.module("react", () => ({
  ...React,
  useId: () => "clear-confirmation",
  useRef: (initial) => (refs[refIndex++] ??= { current: initial }),
  useLayoutEffect: (effect, dependencies) => {
    if (
      !effectDependencies ||
      dependencies.some((value, index) => value !== effectDependencies[index])
    )
      effects.push(effect);
    effectDependencies = dependencies;
  },
}));
mock.module("../../features/graph-editor/i18n/I18nProvider.tsx", () => ({
  useI18n: () => ({ locale, messages: messagesByLocale[locale] }),
}));

const { Button, ActionRow } = await import("../../components/ui/controls.ts");
const { ClearGraphControl } =
  await import("../../features/graph-editor/ui/panels/SettingsPanel.tsx");

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

for (locale of ["ja", "en", "zh-Hans"]) {
  refs = [];
  effectDependencies = undefined;
  let clearArmed = false;
  let isGraphEmpty = false;
  let confirmed = 0;
  let cancelled = 0;
  let focused = null;
  const trigger = { focus: () => (focused = "trigger") };
  const cancel = { focus: () => (focused = "cancel") };
  function render() {
    refIndex = 0;
    effects = [];
    const tree = ClearGraphControl({
      clearArmed,
      isGraphEmpty,
      onClear: () => {
        if (clearArmed) confirmed += 1;
        else clearArmed = true;
      },
      onCancelClear: () => {
        cancelled += 1;
        clearArmed = false;
      },
    });
    refs[0].current = {
      querySelector: (selector) =>
        selector === "[data-clear-cancel]" && clearArmed
          ? cancel
          : selector === "[data-clear-trigger]" && !clearArmed
            ? trigger
            : null,
    };
    effects.forEach((effect) => effect());
    return tree;
  }

  const initial = render();
  const clearRow = findElement(
    initial,
    (element) => element.type === ActionRow,
  );
  assert(clearRow);
  assert.equal(focused, null, "opening Settings does not move focus to Clear");
  clearRow.props.onClick();
  const armed = render();
  assert.equal(
    confirmed,
    0,
    "the initial Clear action only opens confirmation",
  );
  assert.equal(focused, "cancel", "arming moves focus to the safe action");

  const cancelAction = findElement(
    armed,
    (element) => element.type === Button && element.props["data-clear-cancel"],
  );
  const confirmAction = findElement(
    armed,
    (element) => element.type === Button && element.props.variant === "danger",
  );
  assert(cancelAction && confirmAction);
  const markup = renderToStaticMarkup(armed);
  assert(markup.includes(clearConfirmationCopy[locale].title));
  assert(markup.includes(clearConfirmationCopy[locale].description));
  assert(markup.includes('aria-labelledby="clear-confirmation-title"'));
  assert(markup.includes('aria-describedby="clear-confirmation-description"'));
  assert(
    !markup.includes('role="dialog"'),
    "confirmation stays inside Settings",
  );
  assert(!markup.includes(messagesByLocale[locale].chrome.clearArmedHint));
  cancelAction.props.onClick();
  render();
  assert.equal(cancelled, 1);
  assert.equal(
    confirmed,
    0,
    "repeating activation on Cancel never clears data",
  );
  assert.equal(focused, "trigger", "Cancel restores the original Clear action");

  clearArmed = true;
  const armedAgain = render();
  assert.equal(focused, "cancel");
  findElement(
    armedAgain,
    (element) => element.type === Button && element.props.variant === "danger",
  ).props.onClick();
  assert.equal(confirmed, 1, "only the explicit destructive action confirms");

  clearArmed = false;
  isGraphEmpty = true;
  const empty = render();
  assert.equal(
    findElement(empty, (element) => element.type === ActionRow).props.disabled,
    true,
    "an empty graph cannot start a clear operation",
  );
}

console.log(
  "Clear confirmation: localized scope, explicit cancel/confirm, safe initial focus and focus restoration passed",
);
