import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_STORAGE_KEY,
  detectBrowserLocale,
  toLocale,
} from "../../features/graph-editor/i18n/locale";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";

for (const [input, expected] of [
  ["JA-jp", "ja"],
  ["EN-us", "en"],
  ["ZH-cn", "zh-Hans"],
  ["zh-Hans", "zh-Hans"],
  ["zh-SG", "zh-Hans"],
  ["", null],
  [null, null],
  [undefined, null],
  ["unsupported", null],
  ["__proto__", null],
  ["constructor", null],
  ["CONSTRUCTOR", null],
]) {
  assert.equal(
    toLocale(input),
    expected,
    `Locale preference ${String(input)} must resolve only to a supported language`,
  );
}
assert.equal(
  detectBrowserLocale(["__proto__", "constructor", "ZH-cn"]),
  "zh-Hans",
);
assert.equal(detectBrowserLocale(["constructor"]), DEFAULT_LOCALE);

let localeState;
const effects = [];
const listeners = new Map();
const stored = new Map();
const setLocaleState = (next) => {
  localeState = typeof next === "function" ? next(localeState) : next;
};
mock.module("react", () => ({
  ...React,
  useState: (initial) => {
    localeState ??= initial;
    return [localeState, setLocaleState];
  },
  useEffect: (effect) => effects.push(effect),
  useLayoutEffect() {},
  useCallback: (callback) => callback,
  useMemo: (create) => create(),
}));
Object.assign(globalThis, {
  window: {
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
    },
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name, callback) => {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
  },
  document: { documentElement: { dataset: { locale: "__proto__" } } },
  navigator: { languages: ["constructor", "en-US"] },
});
const { I18nProvider } =
  await import("../../features/graph-editor/i18n/I18nProvider");
const render = (initialLocale) =>
  I18nProvider({ children: null, initialLocale }).props.value;
render("en");
const cleanup = effects[0]();
const onStorage = listeners.get("storage");
assert.equal(typeof onStorage, "function");
onStorage({ key: LOCALE_STORAGE_KEY, newValue: "ja-JP" });
assert.equal(render("en").locale, "ja");
onStorage({ key: "other-preference", newValue: "zh-cn" });
assert.equal(
  render("en").locale,
  "ja",
  "Unrelated storage updates leave language unchanged",
);
for (const newValue of [
  "__proto__",
  "constructor",
  "CONSTRUCTOR",
  "unknown",
  null,
]) {
  onStorage({ key: LOCALE_STORAGE_KEY, newValue });
  const value = render("en");
  assert.equal(
    value.locale,
    "en",
    "Invalid cross-tab preferences fall back to the current route language",
  );
  assert.equal(
    value.messages,
    messagesByLocale.en,
    "Preference recovery retains usable UI messages",
  );
}
cleanup();
assert.equal(listeners.size, 0);
localeState = undefined;
effects.length = 0;
stored.set(LOCALE_STORAGE_KEY, "constructor");
render(undefined);
const startupCleanup = effects[0]();
assert.equal(
  render(undefined).locale,
  "en",
  "Invalid saved and document preferences fall through to supported browser language",
);
startupCleanup();
assert.equal(listeners.size, 0);
console.log(
  "Locale preferences passed (aliases, inherited-name rejection, startup and cross-tab fallback)",
);
