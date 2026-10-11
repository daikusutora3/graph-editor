import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mock } from "bun:test";
import { plugin } from "bun";
import * as React from "react";
import { renderToReadableStream } from "react-dom/server";
import { createStore } from "jotai/vanilla";

// Isolate module caches and test mocks so a failed module never contaminates
// the healthy-load scenario or another verification suite.
const scenario = process.argv
  .find((argument) => argument.startsWith("--scenario="))
  ?.slice(11);
if (!scenario) {
  for (const value of ["reject", "success"]) {
    const result = spawnSync(
      "bun",
      ["run", import.meta.filename, `--scenario=${value}`],
      { stdio: "inherit" },
    );
    if (result.status !== 0) process.exit(result.status ?? 1);
  }
  console.log(
    "Sample gallery loading passed (real chrome effects, controlled import failure and healthy lazy render)",
  );
  process.exit(0);
}
assert(["reject", "success"].includes(scenario));

// Execute the actual chrome render and its mount effects. Hold the optional
// module load until the fallback commits, matching effects running while a
// browser's chunk request is still pending. Browser resources are doubles.
const originalUseState = React.useState;
const originalLazy = React.lazy;
const effects = [];
let lazyImports = 0;
let prefetchImports = 0;
mock.module("react", () => ({
  ...React,
  useState: (initial) =>
    originalUseState(initial === "paste" ? "sample" : initial),
  useEffect: (effect) => effects.push(effect),
  lazy: (load) =>
    originalLazy(() => {
      lazyImports++;
      return load();
    }),
}));
const feature = (path) =>
  new URL(`../../features/graph-editor/${path}`, import.meta.url).pathname;
const controlledError = new Error("Controlled sample module load failure");
let rejectLoad;
if (scenario === "reject") {
  const gate = new Promise((_, reject) => {
    rejectLoad = reject;
  });
  plugin({
    name: "controlled-sample-module-failure",
    setup(build) {
      build.onLoad({ filter: /SampleGalleryPane\.tsx$/ }, async () => {
        await gate;
        return { contents: "", loader: "js" };
      });
    },
  });
}
const localStorage = new Map();
const media = {
  matches: false,
  addEventListener() {},
  removeEventListener() {},
};
Object.assign(globalThis, {
  HTMLElement: EventTarget,
  window: {
    localStorage: {
      getItem: (key) => localStorage.get(key) ?? null,
      setItem: (key, value) => localStorage.set(key, value),
      removeItem: (key) => localStorage.delete(key),
    },
    matchMedia: () => media,
    addEventListener() {},
    removeEventListener() {},
    setTimeout: () => 1,
    clearTimeout() {},
  },
  document: {
    title: "test",
    documentElement: { dataset: {}, style: {} },
    addEventListener() {},
    removeEventListener() {},
  },
  navigator: { platform: "test", userAgent: "test", maxTouchPoints: 0 },
});

const panelPath = feature("ui/panels/StarterPanel.tsx");
const panelExports = await import(panelPath);
// Count the old eager request while retaining its real import promise. This
// is absent once chrome uses only the lazy component's request.
const originalPrefetch = panelExports.loadSampleGalleryPane;
if (originalPrefetch) {
  mock.module(panelPath, () => ({
    ...panelExports,
    loadSampleGalleryPane: (...args) => {
      prefetchImports++;
      return originalPrefetch(...args);
    },
  }));
}
const { Provider } = await import("jotai");
const { I18nProvider } = await import(feature("i18n/I18nProvider.tsx"));
const { GraphCanvasProvider } = await import(
  feature("canvas/GraphCanvasProvider.tsx")
);
const { EditorChrome } = await import(feature("ui/chrome/EditorChrome.tsx"));
const { editorPanelAtom } = await import(
  feature("shell/state/editor-atoms.ts")
);
const store = createStore();
store.set(editorPanelAtom, "starter");
const unhandled = [];
const renderErrors = [];
const listener = (error) => unhandled.push(error);
process.on("unhandledRejection", listener);
const cleanups = [];
try {
  const tree = React.createElement(
    Provider,
    { store },
    React.createElement(
      I18nProvider,
      { initialLocale: "en" },
      React.createElement(
        GraphCanvasProvider,
        null,
        React.createElement(EditorChrome),
      ),
    ),
  );
  const stream = await renderToReadableStream(tree, {
    onError: (error) => {
      renderErrors.push(error);
    },
  });
  for (const effect of effects) {
    const cleanup = effect();
    if (typeof cleanup === "function") cleanups.push(cleanup);
  }
  if (scenario === "reject") rejectLoad(controlledError);
  const html = await new Response(stream).text();
  await new Promise((resolve) => setTimeout(resolve, 20));
  console.log(
    JSON.stringify({
      scenario,
      importInvocations: lazyImports + prefetchImports,
      lazyImports,
      prefetchImports,
      renderErrors: renderErrors.length,
      unhandled: unhandled.length,
    }),
  );
  assert.equal(lazyImports, 1, "The sample body initiates one lazy import");
  assert.equal(
    prefetchImports,
    0,
    "Mount effects must not start a duplicate sample import",
  );
  assert.equal(
    unhandled.length,
    0,
    "Sample loading must not create an unhandled prefetch rejection",
  );
  if (scenario === "reject") {
    assert(
      html.includes("Loading samples"),
      "Suspense retains the actual sample fallback",
    );
    assert.equal(
      renderErrors.length,
      1,
      "The rejected module reaches React's render error path",
    );
    assert.equal(renderErrors[0], controlledError);
  } else {
    assert.equal(renderErrors.length, 0);
    assert(
      html.includes("Search samples") && html.includes("data-sample-kind"),
      "Healthy lazy loading renders the actual gallery and its cards",
    );
  }
} finally {
  cleanups.reverse().forEach((cleanup) => cleanup());
  process.off("unhandledRejection", listener);
}
