import { spawnSync } from "node:child_process";

const suites = [
  { name: "core", path: "tests/verification/graph-core.ts" },
  { name: "samples", path: "tests/verification/samples.ts" },
  { name: "layouts", path: "tests/verification/layouts.ts" },
  { name: "cytoscape", path: "tests/verification/cytoscape-adapter.ts" },
  { name: "editor", path: "tests/verification/editor-state.ts" },
  { name: "io", path: "tests/verification/io-contracts.ts" },
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
