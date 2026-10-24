import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Privacy Git integration");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const directory = mkdtempSync(join(tmpdir(), "graph-editor-privacy-"));
const environment: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  ...Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  ),
};
Object.assign(environment, {
  GIT_CONFIG_NOSYSTEM: "1",
  GIT_CONFIG_GLOBAL: "/dev/null",
});
const safeEmail = "safe@users.noreply.github.com";
const privateEmail = ["private", "mail.fixture-provider.net"].join("@");
const otherEmail = ["another", "mail.fixture-provider.net"].join("@");

function command(
  cwd: string,
  executable: string,
  args: string[],
  input?: string,
  extra = {},
) {
  return spawnSync(executable, args, {
    cwd,
    input,
    env: { ...environment, ...extra },
    encoding: "utf8",
  });
}
function git(cwd: string, args: string[], input?: string, extra = {}) {
  const result = command(cwd, "git", args, input, extra);
  if (result.status !== 0) throw new Error("Fixture Git command failed");
  return result.stdout.trim();
}
function guard(cwd: string, args: string[], input?: string) {
  return command(
    cwd,
    "bun",
    [join(root, "scripts/privacy-check.ts"), ...args],
    input,
  );
}
function fixture(name: string) {
  const cwd = join(directory, name);
  mkdirSync(cwd);
  git(cwd, ["init", "-q", "-b", "main"]);
  git(cwd, ["config", "user.name", "safe"]);
  git(cwd, ["config", "user.email", safeEmail]);
  writeFileSync(join(cwd, "safe.txt"), "safe\n");
  git(cwd, ["add", "safe.txt"]);
  const tree = git(cwd, ["write-tree"]);
  const commit = git(cwd, ["commit-tree", tree, "-m", "fixture"]);
  git(cwd, ["update-ref", "refs/heads/main", commit]);
  return { cwd, tree, commit };
}
function rejected(result: ReturnType<typeof guard>, reason: string) {
  const output = result.stdout + result.stderr;
  expect(result.status !== 0, reason);
  expect(
    !output.includes(privateEmail) && !output.includes(otherEmail),
    reason + " without printing private values",
  );
}

try {
  const { cwd, tree, commit } = fixture("hooks");
  for (const path of [
    "package.json",
    ".node-version",
    "scripts/toolchain.mjs",
    "scripts/privacy-check.ts",
    "scripts/privacy-check-core.ts",
    "scripts/privacy-setup.ts",
    ".githooks/pre-commit",
    ".githooks/commit-msg",
    ".githooks/pre-push",
    ".codex/hooks/block_github_issues.py",
  ]) {
    const target = join(cwd, path);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, path), target);
  }
  git(cwd, ["config", "user.name", "Private Fixture"]);
  git(cwd, ["config", "user.email", privateEmail]);
  const setup = command(cwd, "bun", [
    "scripts/privacy-setup.ts",
    "--email",
    safeEmail,
  ]);
  expect(
    setup.status === 0,
    "setup should replace a private local identity with an explicit public identity",
  );
  expect(
    !(setup.stdout + setup.stderr).includes(privateEmail),
    "setup must not print previous private identities",
  );
  expect(
    git(cwd, ["config", "--local", "user.name"]) === "safe",
    "setup should use the public alias instead of a personal name",
  );
  expect(
    git(cwd, ["config", "--local", "user.useConfigOnly"]) === "true",
    "setup should disable inferred identities",
  );
  expect(
    git(cwd, ["config", "--local", "core.hooksPath"]) === ".githooks",
    "setup should install the maintained hooks",
  );
  expect(
    git(cwd, [
      "config",
      "--local",
      "--get-all",
      "privacy.blockedPattern",
    ]).includes(privateEmail),
    "setup should keep previous private values only in local configuration",
  );
  writeFileSync(join(cwd, "public.txt"), "public\n");
  git(cwd, ["add", "public.txt"]);
  expect(
    command(cwd, "git", ["commit", "-qm", "public fixture"]).status === 0,
    "real commit hooks should allow public-safe changes",
  );
  const secretPath = join(cwd, otherEmail + ".txt");
  writeFileSync(secretPath, otherEmail);
  git(cwd, ["add", "--", otherEmail + ".txt"]);
  rejected(
    command(cwd, "git", ["commit", "-qm", "must be blocked"]),
    "real pre-commit should reject private content and filenames",
  );
  git(cwd, ["read-tree", "HEAD"]);
  rmSync(secretPath);
  writeFileSync(join(cwd, "public.txt"), "public update\n");
  git(cwd, ["add", "public.txt"]);
  rejected(
    command(cwd, "git", ["commit", "-qm", privateEmail]),
    "real commit-msg should reject a private message",
  );
  rejected(
    command(cwd, "git", ["commit", "-qm", "private identity"], undefined, {
      GIT_AUTHOR_EMAIL: otherEmail,
    }),
    "environment author overrides must be rejected",
  );
  const unsafe = git(
    cwd,
    ["commit-tree", tree, "-p", commit, "-m", "old private identity"],
    undefined,
    { GIT_AUTHOR_EMAIL: privateEmail },
  );
  const update = `refs/heads/unsafe ${unsafe} refs/heads/unsafe ${"0".repeat(40)}\n`;
  rejected(
    command(cwd, "sh", [".githooks/pre-push", "origin", "unused"], update),
    "real pre-push should reject an older unsafe commit",
  );
  const tag = git(
    cwd,
    ["mktag"],
    `object ${commit}\ntype commit\ntag private-tagger\ntagger safe <${privateEmail}> 1000 +0000\n\nfixture\n`,
  );
  rejected(
    guard(
      cwd,
      ["--pre-push", "origin"],
      `refs/tags/private-tagger ${tag} refs/tags/private-tagger ${"0".repeat(40)}\n`,
    ),
    "annotated tagger identities must be checked",
  );
  const outer = git(
    cwd,
    ["mktag"],
    `object ${tag}\ntype tag\ntag outer\ntagger safe <${safeEmail}> 1000 +0000\n\nfixture\n`,
  );
  rejected(
    guard(
      cwd,
      ["--pre-push", "origin"],
      `refs/tags/outer ${outer} refs/tags/outer ${"0".repeat(40)}\n`,
    ),
    "nested annotated tags must be checked",
  );

  const ci = fixture("ci");
  expect(
    guard(ci.cwd, ["--ci"]).status === 0,
    "CI should verify safe committed history without private local configuration",
  );
  expect(
    guard(ci.cwd, ["--range", "HEAD"]).status !== 0,
    "local hooks should fail closed without the email allowlist",
  );
  const left = git(ci.cwd, [
    "commit-tree",
    ci.tree,
    "-p",
    ci.commit,
    "-m",
    "left",
  ]);
  const right = git(ci.cwd, [
    "commit-tree",
    ci.tree,
    "-p",
    ci.commit,
    "-m",
    "right",
  ]);
  writeFileSync(join(ci.cwd, "merge.txt"), otherEmail);
  git(ci.cwd, ["add", "merge.txt"]);
  const mergeTree = git(ci.cwd, ["write-tree"]);
  const merge = git(ci.cwd, [
    "commit-tree",
    mergeTree,
    "-p",
    left,
    "-p",
    right,
    "-m",
    "merge resolution",
  ]);
  git(ci.cwd, ["update-ref", "refs/heads/main", merge]);
  rejected(
    guard(ci.cwd, ["--ci"]),
    "CI must reject content introduced only by a merge resolution",
  );
  git(ci.cwd, ["update-ref", "refs/heads/main", ci.commit]);
  const badAuthor = git(
    ci.cwd,
    ["commit-tree", ci.tree, "-p", ci.commit, "-m", "unsafe author"],
    undefined,
    { GIT_AUTHOR_EMAIL: privateEmail },
  );
  const safeChild = git(ci.cwd, [
    "commit-tree",
    ci.tree,
    "-p",
    badAuthor,
    "-m",
    "safe tip",
  ]);
  git(ci.cwd, ["update-ref", "refs/heads/main", safeChild]);
  rejected(
    guard(ci.cwd, ["--ci"]),
    "CI must inspect older authors even when the tip is public-safe",
  );
  git(ci.cwd, ["update-ref", "refs/heads/main", ci.commit]);
  const badCommitter = git(
    ci.cwd,
    ["commit-tree", ci.tree, "-p", ci.commit, "-m", "unsafe committer"],
    undefined,
    { GIT_COMMITTER_EMAIL: privateEmail },
  );
  git(ci.cwd, ["update-ref", "refs/heads/main", badCommitter]);
  rejected(
    guard(ci.cwd, ["--ci"]),
    "CI must inspect committer identities separately",
  );
  git(ci.cwd, ["update-ref", "refs/heads/main", ci.commit]);
  const ciTag = git(
    ci.cwd,
    ["mktag"],
    `object ${ci.commit}\ntype commit\ntag unsafe\ntagger safe <${privateEmail}> 1000 +0000\n\nfixture\n`,
  );
  git(ci.cwd, ["update-ref", "refs/tags/unsafe", ciTag]);
  rejected(guard(ci.cwd, ["--ci"]), "CI must check published tag metadata too");
  const failedSetup = command(ci.cwd, "bun", [
    join(root, "scripts/privacy-setup.ts"),
    "--email",
    privateEmail,
  ]);
  rejected(failedSetup, "setup must refuse a private destination address");
  expect(
    readFileSync(join(cwd, "safe.txt"), "utf8") === "safe\n",
    "privacy setup must not alter repository files",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
finish();
