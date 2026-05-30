import { spawnSync } from "node:child_process";

const suites = [
  { name: "core", path: "tests/verification/graph-core.ts" },
  { name: "samples", path: "tests/verification/samples.ts" },
  { name: "layouts", path: "tests/verification/layouts.ts" },
  { name: "cytoscape", path: "tests/verification/cytoscape-adapter.ts" },
  { name: "editor", path: "tests/verification/editor-state.ts" },
  { name: "io", path: "tests/verification/io-contracts.ts" },
  { name: "release", path: "tests/verification/release.ts" },
] as const;

type SuiteName = (typeof suites)[number]["name"];

const requested = process.argv.slice(2);
const suiteNames = new Set<SuiteName>(suites.map((suite) => suite.name));
const unknownNames = requested.filter(
  (name): name is string => !suiteNames.has(name as SuiteName),
);

if (unknownNames.length > 0) {
  console.error(`Unknown verification suite: ${unknownNames.join(", ")}`);
  console.error(`Available suites: ${[...suiteNames].join(", ")}`);
  process.exit(1);
}

const selectedSuites =
  requested.length > 0
    ? suites.filter((suite) => requested.includes(suite.name))
    : suites.filter((suite) => suite.name !== "release");

for (const suite of selectedSuites) {
  console.log(`\n> verify:${suite.name}`);
  const result = spawnSync("bun", ["run", suite.path], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

console.log(
  `\nVerification passed (${selectedSuites.map((suite) => suite.name).join(", ")})`,
);
