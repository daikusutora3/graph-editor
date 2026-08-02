# Repository privacy guard

These hooks prevent private aliases, personal email addresses, and absolute home
paths from being committed or pushed. Actual private values are stored only in
this repository's local `.git/config`; never add them to a tracked file.

Required repository-local settings:

```sh
git config --local user.useConfigOnly true
git config --local user.email "<public-safe-email>"
git config --local --add privacy.allowedEmail "<public-safe-email>"
git config --local --add privacy.blockedPattern "<private-value>"
git config --local core.hooksPath .githooks
```

The pre-commit hook checks the effective author and committer plus every staged
file. The commit-msg hook checks the commit message. The pre-push hook scans all
outgoing commit metadata and changed file contents, so older local commits are
also blocked before publication.

Run the same checks manually with:

```sh
bun run privacy:check
bun run privacy:check:unpushed
```
