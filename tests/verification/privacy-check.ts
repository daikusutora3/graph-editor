import {
  extractIdentityEmail,
  findPrivacyFindings,
  isAllowedEmail,
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

finish();
