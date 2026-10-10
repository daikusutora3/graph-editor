import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, delimiter, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(
  readFileSync(resolve(root, "package.json"), "utf8"),
);
const expectedBun = /^bun@(\d+\.\d+\.\d+)$/.exec(manifest.packageManager)?.[1];
const expectedNode = readFileSync(
  resolve(root, ".node-version"),
  "utf8",
).trim();

function fail(message) {
  console.error(`Toolchain mismatch: ${message}`);
  process.exit(1);
}

if (!expectedBun || !/^\d+\.\d+\.\d+$/.test(expectedNode)) {
  fail(
    "packageManager and .node-version must declare exact Bun and Node versions.",
  );
}

if (process.versions.node !== expectedNode) {
  fail(`Node ${expectedNode} is required; found ${process.versions.node}.`);
}

const args = process.argv.slice(2);
const checkOnly = args.length === 1 && args[0] === "--check";
const localBun = resolve(root, ".local-bin/bun");
// A lifecycle check must inspect the Bun that invoked it, even when a correct
// repository-local binary is available. The launcher chooses that local binary.
const bun = checkOnly
  ? process.env.npm_execpath || "bun"
  : existsSync(localBun)
    ? localBun
    : "bun";
const version = spawnSync(bun, ["--version"], { encoding: "utf8" });
if (version.error || version.status !== 0) {
  fail(
    `Bun ${expectedBun} is required. Install it on PATH or at .local-bin/bun.`,
  );
}
const actualBun = version.stdout.trim();
if (actualBun !== expectedBun) {
  fail(
    `Bun ${expectedBun} is required; found ${actualBun}. Use node scripts/toolchain.mjs to run the pinned local Bun.`,
  );
}

if (checkOnly) {
  console.log(`Toolchain verified: Bun ${expectedBun}, Node ${expectedNode}`);
} else {
  const environment = { ...process.env };
  if (bun === localBun) {
    environment.PATH = `${dirname(localBun)}${delimiter}${process.env.PATH || ""}`;
  }
  const result = spawnSync(bun, args, {
    cwd: root,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) {
    console.error(result.error.message);
  }
  process.exit(result.status ?? 1);
}
