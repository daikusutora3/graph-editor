import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  extractIdentityEmail,
  findPrivacyFindings,
  isAllowedEmail,
  isPublicCommitEmail,
  isZeroOid,
  normalizePrivacyValues,
  parsePushUpdates,
  type PrivacyFinding,
} from "./privacy-check-core";

const MAX_BUFFER = 64 * 1024 * 1024;
let blockedPatterns: string[] = [];
let allowedEmails: string[] = [];
let ci = false;
const findings: PrivacyFinding[] = [];
const checkedBlobs = new Set<string>();
const checkedTags = new Set<string>();

try {
  const [mode, ...args] = process.argv.slice(2);
  ci = mode === "--ci";
  if (!ci) {
    blockedPatterns = readLocalConfig("privacy.blockedPattern");
    allowedEmails = readLocalConfig("privacy.allowedEmail");
    if (!allowedEmails.length)
      findings.push({
        source: "repository config",
        reason: "privacy.allowedEmail is not configured",
      });
  }
  switch (mode) {
    case "--staged":
      checkCurrentIdentity();
      checkStagedFiles();
      break;
    case "--commit-message":
      checkCurrentIdentity();
      checkTextFile(args[0], "commit message");
      break;
    case "--pre-push":
      checkPushInput(args[0] ?? "origin");
      break;
    case "--range":
      checkCommitRange(args[0]);
      break;
    case "--ci": {
      const tags = splitLines(
        git(["for-each-ref", "--format=%(objectname)", "refs/tags"]).stdout,
      );
      for (const tag of tags) checkTag(tag);
      checkCommits(splitLines(git(["rev-list", "HEAD", ...tags]).stdout));
      break;
    }
    default:
      failUsage();
  }
  finish();
} catch {
  console.error(
    "Privacy check could not complete; inspect Git configuration and repository access locally. No private error details were printed.",
  );
  process.exit(1);
}

function git(arguments_: string[], options?: { allowFailure?: boolean }) {
  const result = spawnSync("git", arguments_, {
    encoding: "utf8",
    maxBuffer: MAX_BUFFER,
  });

  if (result.status !== 0 && !options?.allowFailure) {
    throw new Error("Git command failed");
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

function emailAllowed(email: string) {
  return (
    isPublicCommitEmail(email) && (ci || isAllowedEmail(email, allowedEmails))
  );
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
  if (!email || !emailAllowed(email)) {
    findings.push({
      source: `${role} identity`,
      reason: ci
        ? "email must be a public GitHub noreply identity"
        : "email must be a public GitHub noreply identity listed in privacy.allowedEmail",
    });
  }
}

function checkStagedFiles() {
  const paths = splitNull(
    git(["diff", "--cached", "--name-only", "-z", "--diff-filter=ACMR"]).stdout,
  );

  for (const path of paths) {
    findings.push(
      ...findPrivacyFindings(path, "staged filename", blockedPatterns),
    );
    checkGitBlob(`:${path}`, "staged file");
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

    checkTag(update.localOid);

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

    const changes = splitNull(
      git([
        "diff-tree",
        "--root",
        "--no-commit-id",
        "--raw",
        "-r",
        "-z",
        "-m",
        "--no-renames",
        "--diff-filter=ACMT",
        commit,
      ]).stdout,
    );
    for (let index = 0; index < changes.length; index += 2) {
      const header = changes[index].split(" ");
      const path = changes[index + 1];
      if (!path || header.length !== 5)
        throw new Error("Invalid Git change record");
      const source = `commit ${shortCommit} blob ${header[3]}`;
      findings.push(
        ...findPrivacyFindings(path, source + " filename", blockedPatterns),
      );
      if (header[1] !== "160000") checkGitBlob(header[3], source);
    }
  }
}

function checkCommitEmail(commit: string, role: string, email: string) {
  if (!emailAllowed(email)) {
    findings.push({
      source: `commit ${commit} ${role}`,
      reason: ci
        ? "email must be a public GitHub noreply identity"
        : "email must be a public GitHub noreply identity listed in privacy.allowedEmail",
    });
  }
}

function checkTag(object: string) {
  if (checkedTags.has(object)) return;
  checkedTags.add(object);
  if (git(["cat-file", "-t", object]).stdout.trim() !== "tag") return;
  const raw = git(["cat-file", "tag", object]).stdout;
  const source = `tag object ${object.slice(0, 12)}`;
  findings.push(...findPrivacyFindings(raw, source, blockedPatterns));
  const header = raw.split("\n\n", 1)[0];
  const tagger = header.split("\n").find((line) => line.startsWith("tagger "));
  if (tagger) {
    const email = extractIdentityEmail(tagger);
    if (!email || !emailAllowed(email))
      findings.push({ source, reason: "tagger email is not approved" });
  }
  const target = /^object ([a-f0-9]+)$/m.exec(header)?.[1];
  if (target) checkTag(target);
}

function checkGitBlob(object: string, source: string) {
  const oid = git(["rev-parse", object]).stdout.trim();
  if (checkedBlobs.has(oid)) return;
  checkedBlobs.add(oid);
  const result = git(["cat-file", "blob", oid], { allowFailure: true });

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
    ci
      ? "Use public GitHub noreply identities and remove private values locally; do not paste private details into CI logs."
      : "Private values stay in local Git config. Run bun run privacy:setup --email <GitHub-noreply-address> to configure a safe identity and hooks.",
  );
  process.exit(1);
}

function failUsage(): never {
  console.error(
    "Usage: privacy-check.ts --staged | --commit-message <path> | --pre-push <remote> | --range <revision-range> | --ci",
  );
  process.exit(2);
}
