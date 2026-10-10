import { spawnSync } from "node:child_process";

const suites = [
  { name: "toolchain", path: "tests/verification/toolchain.ts" },
  {
    name: "static-preview-server",
    path: "tests/verification/static-preview-server.ts",
  },
  { name: "wasm-runtime", path: "tests/verification/wasm-runtime.ts" },
  { name: "wasm-worker", path: "tests/verification/wasm-worker.ts" },
  { name: "worker-lanes", path: "tests/verification/worker-lanes.ts" },
  {
    name: "worker-cancellation",
    path: "tests/verification/worker-cancellation.ts",
  },
  { name: "wasm-layouts", path: "tests/verification/wasm-layouts.ts" },
  { name: "wasm-overlaps", path: "tests/verification/wasm-overlaps.ts" },
  { name: "wasm-routing", path: "tests/verification/wasm-routing.ts" },
  {
    name: "wasm-routing-collisions",
    path: "tests/verification/wasm-routing-collisions.ts",
  },
  {
    name: "wasm-interactive-routing",
    path: "tests/verification/wasm-interactive-routing.ts",
  },
  {
    name: "wasm-projected-obstacles",
    path: "tests/verification/wasm-projected-obstacles.ts",
  },
  {
    name: "loop-preparation",
    path: "tests/verification/loop-preparation.ts",
  },
  { name: "wasm-import", path: "tests/verification/wasm-import.ts" },
  { name: "integrity", path: "tests/verification/integrity.ts" },
  { name: "autosave", path: "tests/verification/autosave.ts" },
  { name: "core", path: "tests/verification/graph-core.ts" },
  {
    name: "geometry-contracts",
    path: "tests/verification/geometry-contracts.ts",
  },
  { name: "samples", path: "tests/verification/samples.ts" },
  { name: "sample-preview", path: "tests/verification/sample-preview.ts" },
  { name: "focus-navigation", path: "tests/verification/focus-navigation.ts" },
  {
    name: "sample-parameters",
    path: "tests/verification/sample-parameters.ts",
  },
  {
    name: "algorithmic-samples",
    path: "tests/verification/algorithmic-samples.ts",
  },
  { name: "layouts", path: "tests/verification/layouts.ts" },
  { name: "layout-topology", path: "tests/verification/layout-topology.ts" },
  { name: "overlaps", path: "tests/verification/overlaps.ts" },
  { name: "edge-routing", path: "tests/verification/edge-routing.ts" },
  {
    name: "routing-collision-reuse",
    path: "tests/verification/routing-collision-reuse.mjs",
  },
  {
    name: "routing-parallel-spacing",
    path: "tests/verification/routing-parallel-spacing.mjs",
  },
  { name: "cytoscape", path: "tests/verification/cytoscape-adapter.ts" },
  { name: "canvas-rendering", path: "tests/verification/canvas-rendering.ts" },
  { name: "editor", path: "tests/verification/editor-state.ts" },
  {
    name: "history-clipboard",
    path: "tests/verification/history-clipboard.ts",
  },
  {
    name: "chrome-subscriptions",
    path: "tests/verification/chrome-subscriptions.ts",
  },
  { name: "storage", path: "tests/verification/storage.ts" },
  {
    name: "storage-notifications",
    path: "tests/verification/storage-notifications.ts",
  },
  { name: "io", path: "tests/verification/io-contracts.ts" },
  {
    name: "import-text-contracts",
    path: "tests/verification/import-text-contracts.ts",
  },
  {
    name: "starter-import-guard",
    path: "tests/verification/starter-import-guard.mjs",
  },
  {
    name: "starter-file-read",
    path: "tests/verification/starter-file-read.ts",
  },
  {
    name: "starter-input-ui",
    path: "tests/verification/starter-input-ui.tsx",
  },
  { name: "tikz", path: "tests/verification/tikz.ts" },
  { name: "screenshot", path: "tests/verification/screenshot.ts" },
  { name: "image-export", path: "tests/verification/image-export.ts" },
  { name: "canvas-lifecycle", path: "tests/verification/canvas-lifecycle.mjs" },
  { name: "canvas-resize", path: "tests/verification/canvas-resize.mjs" },
  { name: "privacy", path: "tests/verification/privacy-check.ts" },
  { name: "i18n", path: "tests/verification/i18n-literals.ts" },
  { name: "canvas", path: "tests/verification/canvas-logic.ts" },
  {
    name: "range-selection-preview",
    path: "tests/verification/range-selection-preview.ts",
  },
] as const;

for (const suite of suites) {
  console.log(`\n> verify:${suite.name}`);
  const result = spawnSync("bun", ["run", suite.path], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(
  `\nVerification passed (${suites.map((suite) => suite.name).join(", ")})`,
);
