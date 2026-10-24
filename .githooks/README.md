# Repository privacy guard

The hooks block unapproved author/committer/tagger email addresses, non-public
email addresses in content, private aliases, and absolute home-directory paths.
Public GitHub noreply identities, the documented public Claude co-author
address in attribution text, and reserved example domains in documentation and
fixtures are allowed. Commit authors and committers still require GitHub noreply
identities. URL authority test fixtures are not treated as email.
Actual private aliases stay only in local `.git/config`, never in tracked files.

After cloning and installing the pinned toolchain, configure your public identity:

```sh
bun run privacy:setup --email <your-GitHub-noreply-address>
```

Use the noreply address shown in your GitHub email settings. Setup enables the
maintained hooks, sets `user.useConfigOnly`, adds that public address to the local
allowlist, and derives the public author alias from it. It never changes global
Git configuration. An optional `--name <public-alias>` selects a public account
alias explicitly. Previous private email/full-name values are added to the local
blocklist without being printed. Existing private patterns are preserved.

For this repository's maintainer, the public alias is `daikusutora3`. Other
contributors should use their own public account alias and GitHub noreply address.
Add any extra private names or device identifiers locally:

```sh
git config --local --add privacy.blockedPattern "<private-value>"
```

Installing dependencies enables `.githooks`; a clone without an email allowlist
fails closed until configured. Environment overrides such as `GIT_AUTHOR_EMAIL`
are checked too. Never bypass a privacy rejection using `--no-verify`.

The pre-commit hook checks effective identities, staged contents, and filenames.
The commit-msg hook checks the message. The pre-push hook checks every outgoing
commit and changed blob, including merge resolutions, plus annotated and nested
tag metadata. Reused blobs are checked once. Errors identify object IDs rather
than repeating private values or filenames.

```sh
bun run privacy:check
bun run privacy:check:unpushed
bun run privacy:check:ci
```

The CI check scans committed history reachable from HEAD and all tags. It uses
public noreply/email/path rules without requiring a private blocklist or local
Git configuration. CI runs after upload, so it catches bypassed hooks but cannot
prevent that initial publication. Keep the account's email privacy and
[command-line push blocking](https://docs.github.com/en/account-and-profile/how-tos/email-preferences/blocking-command-line-pushes-that-expose-your-personal-email-address)
enabled too; GitHub checks the most recent commit's author for that account-level
setting. The local pre-push check also covers older authors and committers.

Integration tests use isolated temporary repositories and real Git hooks to
verify unsafe identities, content, filenames, messages, older commits, merge
resolutions, and taggers are blocked without echoing private values. They use
synthetic values and never push to a remote service.
