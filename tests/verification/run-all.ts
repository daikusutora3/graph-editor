import { spawnSync } from "node:child_process";

const suites = [
  { name: "integrity", path: "tests/verification/integrity.ts" },
  { name: "autosave", path: "tests/verification/autosave.ts" },
  { name: "core", path: "tests/verification/graph-core.ts" },
  { name: "samples", path: "tests/verification/samples.ts" },
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
  { name: "cytoscape", path: "tests/verification/cytoscape-adapter.ts" },
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
  { name: "tikz", path: "tests/verification/tikz.ts" },
  { name: "screenshot", path: "tests/verification/screenshot.ts" },
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
