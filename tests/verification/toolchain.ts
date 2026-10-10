import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdtempSync,
  mkdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Toolchain");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const fixture = realpathSync(
  mkdtempSync(join(tmpdir(), "graph-editor-toolchain-")),
);
const node = spawnSync("node", ["--version"], {
  encoding: "utf8",
}).stdout.trim();

function fixtureBun(path: string, version: string) {
  writeFileSync(
    path,
    `#!/bin/sh\nif [ "$1" = "--version" ]; then\n  printf '%s\\n' '${version}'\nelse\n  exec node -e 'console.log(JSON.stringify({args:process.argv.slice(1),path:process.env.PATH.split(require("node:path").delimiter)[0]}))' -- "$@"\nfi\n`,
    { mode: 0o755 },
  );
}

function run(args: string[], environment: Partial<NodeJS.ProcessEnv> = {}) {
  return spawnSync("node", [join(fixture, "scripts/toolchain.mjs"), ...args], {
    cwd: fixture,
    env: { ...process.env, npm_execpath: "", ...environment },
    encoding: "utf8",
  });
}

try {
  mkdirSync(join(fixture, "scripts"));
  mkdirSync(join(fixture, ".local-bin"));
  copyFileSync(
    join(root, "scripts/toolchain.mjs"),
    join(fixture, "scripts/toolchain.mjs"),
  );
  writeFileSync(
    join(fixture, "package.json"),
    '{"packageManager":"bun@1.4.2"}',
  );
  writeFileSync(join(fixture, ".node-version"), node.slice(1));
  const localBun = join(fixture, ".local-bin/bun");
  const wrongBun = join(fixture, "wrong-bun");
  fixtureBun(localBun, "1.4.2");
  fixtureBun(wrongBun, "1.3.14");

  const launch = run(["run", "sample", "argument with spaces"]);
  expect(
    launch.status === 0,
    "The launcher should select the pinned local Bun.",
  );
  const launched = JSON.parse(launch.stdout);
  expect(
    JSON.stringify(launched.args) ===
      JSON.stringify(["run", "sample", "argument with spaces"]),
    "The launcher should preserve arguments without shell interpolation.",
  );
  expect(
    launched.path === join(fixture, ".local-bin"),
    "Nested Bun commands should use the same pinned local binary.",
  );

  const wrongCaller = run(["--check"], { npm_execpath: wrongBun });
  expect(
    wrongCaller.status === 1 && wrongCaller.stderr.includes("found 1.3.14"),
    "A lifecycle check should reject the actual wrong Bun despite a correct local binary.",
  );
  const correctCaller = run(["--check"], { npm_execpath: localBun });
  expect(
    correctCaller.status === 0,
    "The pinned caller should pass verification.",
  );

  // Git hooks run outside the launcher's child PATH. Test that each hook can
  // select the repository-local Bun when no Bun is available on its own PATH.
  const nodeBinary = spawnSync("node", ["-p", "process.execPath"], {
    encoding: "utf8",
  }).stdout.trim();
  const gitBinary = spawnSync("which", ["git"], {
    encoding: "utf8",
  }).stdout.trim();
  const hookPath = join(fixture, "hook-path");
  mkdirSync(hookPath);
  symlinkSync(nodeBinary, join(hookPath, "node"));
  symlinkSync(gitBinary, join(hookPath, "git"));
  mkdirSync(join(fixture, ".githooks"));
  mkdirSync(join(fixture, ".codex/hooks"), { recursive: true });
  writeFileSync(
    join(fixture, ".codex/hooks/block_github_issues.py"),
    "import sys\nsys.exit(0)\n",
  );
  const initialized = spawnSync(gitBinary, ["init", "--quiet", fixture], {
    encoding: "utf8",
  });
  if (initialized.status !== 0) throw new Error(initialized.stderr);
  for (const [hook, args, expectedArgs] of [
    ["pre-commit", [], ["--staged"]],
    [
      "commit-msg",
      [join(fixture, "message with spaces.txt")],
      ["--commit-message", join(fixture, "message with spaces.txt")],
    ],
    [
      "pre-push",
      ["origin", "test-remote"],
      ["--pre-push", "origin", "test-remote"],
    ],
  ] as const) {
    const target = join(fixture, ".githooks", hook);
    copyFileSync(join(root, ".githooks", hook), target);
    const result = spawnSync("/bin/sh", [target, ...args], {
      cwd: fixture,
      env: { ...process.env, PATH: hookPath, npm_execpath: "" },
      encoding: "utf8",
    });
    expect(
      result.status === 0,
      `${hook} should select local Bun without relying on a global Bun.`,
    );
    const executed = JSON.parse(
      result.stdout.trim().split("\n").at(-1) || "{}",
    );
    expect(
      JSON.stringify(executed.args) ===
        JSON.stringify([
          "run",
          join(fixture, "scripts/privacy-check.ts"),
          ...expectedArgs,
        ]),
      `${hook} should preserve privacy-check arguments.`,
    );
  }

  fixtureBun(localBun, "1.3.14");
  const wrongLocal = run(["run", "sample"]);
  expect(
    wrongLocal.status === 1 && wrongLocal.stderr.includes("found 1.3.14"),
    "An outdated local installation should fail rather than fall back silently.",
  );
  writeFileSync(join(fixture, ".node-version"), "0.0.0");
  const wrongNode = run(["run", "sample"]);
  expect(
    wrongNode.status === 1 &&
      wrongNode.stderr.includes("Node 0.0.0 is required"),
    "The launcher should reject a Node version that differs from the pin.",
  );
} finally {
  rmSync(fixture, { recursive: true, force: true });
}

finish();
