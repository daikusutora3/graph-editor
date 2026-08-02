import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  extractIdentityEmail,
  findPrivacyFindings,
  isAllowedEmail,
  isZeroOid,
  normalizePrivacyValues,
  parsePushUpdates,
  type PrivacyFinding,
} from "./privacy-check-core";

const MAX_BUFFER = 64 * 1024 * 1024;
const blockedPatterns = readLocalConfig("privacy.blockedPattern");
const allowedEmails = readLocalConfig("privacy.allowedEmail");
const findings: PrivacyFinding[] = [];

if (blockedPatterns.length === 0) {
  findings.push({
    source: "repository config",
    reason: "privacy.blockedPattern is not configured",
  });
}

if (allowedEmails.length === 0) {
  findings.push({
    source: "repository config",
    reason: "privacy.allowedEmail is not configured",
  });
}

const [mode, ...modeArguments] = process.argv.slice(2);

switch (mode) {
  case "--staged":
    checkCurrentIdentity();
    checkStagedFiles();
    break;
  case "--commit-message":
    checkCurrentIdentity();
    checkTextFile(modeArguments[0], "commit message");
    break;
  case "--pre-push":
    checkPushInput(modeArguments[0] ?? "origin");
    break;
  case "--range":
    checkCommitRange(modeArguments[0]);
    break;
  default:
    failUsage();
}

finish();

function git(arguments_: string[], options?: { allowFailure?: boolean }) {
  const result = spawnSync("git", arguments_, {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });

  if (result.status !== 0 && !options?.allowFailure) {
    const detail = result.stderr.trim() || result.stdout.trim();
    throw new Error(
      `git ${arguments_.join(" ")} failed${detail ? `: ${detail}` : ""}`,
    );
  }

  return result;
}

function readLocalConfig(key: string) {
  const result = git(["config", "--local", "--get-all", key], {
    allowFailure: true,
  });

  return result.status === 0
    ? normalizePrivacyValues(result.stdout.split("\n"))
    : [];
}

function checkCurrentIdentity() {
  checkIdentity("author", git(["var", "GIT_AUTHOR_IDENT"]).stdout);
  checkIdentity("committer", git(["var", "GIT_COMMITTER_IDENT"]).stdout);
}

function checkIdentity(role: string, identity: string) {
  findings.push(
    ...findPrivacyFindings(identity, `${role} identity`, blockedPatterns),
  );

  const email = extractIdentityEmail(identity);
  if (!email || !isAllowedEmail(email, allowedEmails)) {
    findings.push({
      source: `${role} identity`,
      reason: "email is not listed in privacy.allowedEmail",
    });
  }
}

function checkStagedFiles() {
  const paths = splitNull(
    git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]).stdout,
  );

  for (const path of paths) {
    checkGitBlob(`:${path}`, `staged file ${path}`);
  }
}

function checkTextFile(path: string | undefined, source: string) {
  if (!path) {
    findings.push({ source, reason: "file path was not provided" });
    return;
  }

  findings.push(
    ...findPrivacyFindings(readFileSync(path, "utf8"), source, blockedPatterns),
  );
}

function checkPushInput(remoteName: string) {
  const updates = parsePushUpdates(readFileSync(0, "utf8"));
  const commits = new Set<string>();

  for (const update of updates) {
    if (isZeroOid(update.localOid)) {
      continue;
    }

    const revisionArguments = isZeroOid(update.remoteOid)
      ? [update.localOid, "--not", `--remotes=${remoteName}`]
      : [`${update.remoteOid}..${update.localOid}`];

    splitLines(git(["rev-list", ...revisionArguments]).stdout).forEach(
      (commit) => commits.add(commit),
    );
  }

  checkCommits(commits);
}

function checkCommitRange(range: string | undefined) {
  if (!range) {
    findings.push({ source: "commit range", reason: "range was not provided" });
    return;
  }

  checkCommits(splitLines(git(["rev-list", range]).stdout));
}

function checkCommits(commits: Iterable<string>) {
  for (const commit of commits) {
    const shortCommit = commit.slice(0, 12);
    const metadata = git([
      "show",
      "-s",
      "--format=%an%x00%ae%x00%cn%x00%ce%x00%B",
      commit,
    ]).stdout;
    const [
      authorName = "",
      authorEmail = "",
      committerName = "",
      committerEmail = "",
      ...message
    ] = metadata.split("\0");
    const metadataText = [authorName, committerName, message.join("\0")].join(
      "\n",
    );

    findings.push(
      ...findPrivacyFindings(
        metadataText,
        `commit ${shortCommit} metadata`,
        blockedPatterns,
      ),
    );

    checkCommitEmail(shortCommit, "author", authorEmail);
    checkCommitEmail(shortCommit, "committer", committerEmail);

    const paths = splitNull(
      git([
        "diff-tree",
        "--root",
        "--no-commit-id",
        "--name-only",
        "-r",
        "-z",
        "--diff-filter=ACMR",
        commit,
      ]).stdout,
    );

    for (const path of paths) {
      checkGitBlob(`${commit}:${path}`, `commit ${shortCommit} file ${path}`);
    }
  }
}

function checkCommitEmail(commit: string, role: string, email: string) {
  if (!isAllowedEmail(email, allowedEmails)) {
    findings.push({
      source: `commit ${commit} ${role}`,
      reason: "email is not listed in privacy.allowedEmail",
    });
  }
}

function checkGitBlob(object: string, source: string) {
  const result = git(["show", object], { allowFailure: true });

  if (result.status !== 0) {
    findings.push({ source, reason: "could not read file content" });
    return;
  }

  findings.push(...findPrivacyFindings(result.stdout, source, blockedPatterns));
}

function splitLines(value: string) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function splitNull(value: string) {
  return value.split("\0").filter(Boolean);
}

function finish() {
  const uniqueFindings = [
    ...new Map(
      findings.map((finding) => [
        `${finding.source}\0${finding.reason}`,
        finding,
      ]),
    ).values(),
  ];

  if (uniqueFindings.length === 0) {
    console.log("Privacy check passed");
    return;
  }

  console.error(
    `Privacy check blocked this operation (${uniqueFindings.length})`,
  );
  for (const finding of uniqueFindings) {
    console.error(`- ${finding.source}: ${finding.reason}`);
  }
  console.error(
    "Private values stay in repository-local Git config; update the content or config before retrying.",
  );
  process.exit(1);
}

function failUsage(): never {
  console.error(
    "Usage: privacy-check.ts --staged | --commit-message <path> | --pre-push <remote> | --range <revision-range>",
  );
  process.exit(2);
}
