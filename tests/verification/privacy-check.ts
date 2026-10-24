import {
  extractIdentityEmail,
  findPrivacyFindings,
  isAllowedEmail,
  isPublicCommitEmail,
  isZeroOid,
  normalizePrivacyValues,
  parsePushUpdates,
} from "../../scripts/privacy-check-core";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Privacy guard");
const patterns = normalizePrivacyValues([
  "  PrivateAlias ",
  "privatealias",
  "",
]);

expect(
  patterns.length === 1 && patterns[0]?.toLowerCase() === "privatealias",
  "private patterns should be trimmed and deduplicated case-insensitively",
);

const blockedFindings = findPrivacyFindings(
  "author PRIVATEALIAS",
  "fixture",
  patterns,
);
expect(
  blockedFindings.length === 1 &&
    !blockedFindings[0]?.reason.includes("PrivateAlias"),
  "findings should detect private values without echoing them",
);

expect(
  findPrivacyFindings(
    ["file:/", "Users", "example", "project"].join("/"),
    "fixture",
    [],
  ).length === 1,
  "macOS home-directory paths should be blocked",
);
expect(
  findPrivacyFindings(
    ["C:", "Users", "example", "project"].join("\\"),
    "fixture",
    [],
  ).length === 1,
  "Windows home-directory paths should be blocked",
);
expect(
  findPrivacyFindings("docs/example/project", "fixture", []).length === 0,
  "repository-relative paths should be allowed",
);

expect(
  isAllowedEmail("SAFE@users.noreply.github.com", [
    "safe@users.noreply.github.com",
  ]),
  "allowed email comparison should be case-insensitive",
);
expect(
  !isAllowedEmail("personal@example.com", ["safe@users.noreply.github.com"]),
  "unlisted emails should be rejected",
);
expect(
  extractIdentityEmail("Safe User <safe@example.com> 123 +0000") ===
    "safe@example.com",
  "Git identity email should be extracted",
);

const updates = parsePushUpdates(
  "refs/heads/main abc refs/heads/main def\nrefs/heads/topic 000 refs/heads/topic 123\n",
);
expect(
  updates.length === 2 && updates[0]?.localOid === "abc",
  "pre-push input should parse ref updates",
);
expect(isZeroOid("000000"), "all-zero object IDs should be recognized");
expect(!isZeroOid("000100"), "non-zero object IDs should not be deleted");

expect(
  isPublicCommitEmail("123+safe@users.noreply.github.com"),
  "GitHub noreply identities should be public-safe",
);
expect(
  isPublicCommitEmail("noreply@github.com"),
  "GitHub merge identities should be public-safe",
);
expect(
  !isPublicCommitEmail("personal@example.com"),
  "example addresses must not be real commit identities",
);
const privateEmail = ["private", "mail.fixture-provider.net"].join("@");
const emailFindings = findPrivacyFindings(privateEmail, "fixture", []);
expect(
  emailFindings.some(
    (row) => row.reason === "contains a non-public email address",
  ),
  "unknown non-public addresses should be blocked without a configured private list",
);
expect(
  !JSON.stringify(emailFindings).includes(privateEmail),
  "email findings must not echo the address",
);
expect(
  findPrivacyFindings("mailto:" + privateEmail, "fixture", []).length > 0,
  "mailto links should also be checked",
);
expect(
  findPrivacyFindings("http://127.0.0.1:3323@github.com/", "fixture", [])
    .length === 0,
  "URL authority test fixtures must not be mistaken for email addresses",
);
expect(
  findPrivacyFindings(
    "safe@example.com safe@users.noreply.github.com",
    "fixture",
    [],
  ).length === 0,
  "reserved documentation domains and public noreply addresses should be allowed",
);

expect(
  findPrivacyFindings(
    "Co-Authored-By: Claude <noreply@anthropic.com>",
    "fixture",
    [],
  ).length === 0,
  "public bot attribution should be preserved without allowing personal addresses on the same domain",
);
expect(
  findPrivacyFindings(["person", "anthropic.com"].join("@"), "fixture", [])
    .length > 0,
  "the public bot exception must not allow arbitrary addresses on that domain",
);

for (const path of [
  ["", "Users", "example"].join("/"),
  ["", "home", "example"].join("/"),
  ["C:", "Users", "example"].join("\\"),
]) {
  expect(
    findPrivacyFindings('"' + path + '"', "fixture", []).length > 0,
    "quoted home roots must be blocked even without a trailing directory",
  );
  expect(
    findPrivacyFindings("prefix " + path + " suffix", "fixture", []).length > 0,
    "home roots must be detected at whitespace boundaries",
  );
}
expect(
  findPrivacyFindings(
    JSON.stringify(["C:", "Users", "example", "project"].join("\\")),
    "fixture",
    [],
  ).length > 0,
  "JSON-escaped Windows paths should be blocked",
);

expect(
  findPrivacyFindings("App-menu Up/Down/Home/End move focus", "fixture", [])
    .length === 0,
  "keyboard shortcut sequences are not absolute home paths",
);
expect(
  findPrivacyFindings("docs/home/example/file", "fixture", []).length === 0,
  "relative paths containing a home segment should be allowed",
);

expect(
  findPrivacyFindings(
    "git@github.com:daikusutora3/graph-editor.git",
    "fixture",
    [],
  ).length === 0,
  "public GitHub SSH remotes should not be mistaken for personal email",
);

finish();
