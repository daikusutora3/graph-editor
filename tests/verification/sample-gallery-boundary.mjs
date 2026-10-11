import assert from "node:assert/strict";
import { mock } from "bun:test";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import { integrityCopy } from "../../features/graph-editor/i18n/integrity-copy";

// The actual boundary and retry callbacks are exercised without browser DOM.
// The in-app-browser review verifies React's client error capture and refetch.
let attempt;
const setAttempt = (next) => {
  attempt = typeof next === "function" ? next(attempt) : next;
};
mock.module("react", () => ({
  ...React,
  useState: (initial) => {
    attempt ??= typeof initial === "function" ? initial() : initial;
    return [attempt, setAttempt];
  },
}));
let locale = "en";
const feature = (path) =>
  new URL(`../../features/graph-editor/${path}`, import.meta.url).pathname;
mock.module(feature("i18n/I18nProvider.tsx"), () => ({
  useI18n: () => ({ locale, messages: messagesByLocale[locale] }),
}));
const { StarterSampleBody } = await import(
  feature("ui/panels/StarterPanel.tsx")
);
let applied = 0;
const onSampleApplied = () => applied++;
const render = () => StarterSampleBody({ onSampleApplied }).props.children;
const initial = render();
const Boundary = initial.type;
assert(
  Boundary.prototype instanceof React.Component,
  "The optional sample panel needs a local React error boundary",
);
const galleryOf = (boundary) => boundary.props.children.props.children;
const firstGallery = galleryOf(initial);
assert.equal(firstGallery.props.onSampleApplied, onSampleApplied);
assert.equal(
  galleryOf(render()).type,
  firstGallery.type,
  "Ordinary parent rerenders retain the gallery's lazy identity",
);
const failed = new Boundary(initial.props);
failed.state = Boundary.getDerivedStateFromError(
  new Error("Controlled chunk failure"),
);
const failureElement = failed.render();
for (const language of ["ja", "en", "zh-Hans"]) {
  locale = language;
  const html = renderToStaticMarkup(failureElement);
  assert(html.includes('role="alert"'));
  assert(html.includes(messagesByLocale[language].starter.samplesLoadFailed));
  assert(html.includes(integrityCopy[language].retry));
}
const failureBody = failureElement.type(failureElement.props);
const retry = React.Children.toArray(failureBody.props.children).find(
  (element) => element.props.onClick,
);
assert(retry, "The local error panel offers an explicit retry");
retry.props.onClick();
const retried = render();
assert.notEqual(
  retried.key,
  initial.key,
  "Retry mounts a fresh boundary instead of retaining its failed state",
);
assert.notEqual(
  galleryOf(retried).type,
  firstGallery.type,
  "Retry creates a fresh lazy request instead of replaying the cached rejection",
);
assert.equal(galleryOf(render()).type, galleryOf(retried).type);
assert.equal(galleryOf(retried).props.onSampleApplied, onSampleApplied);
assert.equal(new Boundary(retried.props).state.failed, false);
assert.equal(
  applied,
  0,
  "Failure and retry never apply a sample or change the document",
);
console.log(
  "Sample gallery boundary passed (localized recovery, stable lazy identity and fresh retry)",
);
