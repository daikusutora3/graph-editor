# Repository agent policy

## GitHub Issues: web reading only

For every task whose working directory, repository, or target is this directory
or one of its descendants, automated agents may read GitHub Issues for this
repository through the read-only web tool or by opening an Issue URL in the
in-app browser and reading the displayed page. This includes listing and
opening Issues and reading their descriptions and comments.

All GitHub Issue operations through other interfaces remain prohibited,
including GitHub connectors, `gh`, REST, GraphQL, and scripts. In-app browser
calls are limited to opening this repository's Issue URLs and reading the
displayed state. Chrome computer-use calls may also read an already-open
Google Search Console tab for this site's property
(`https://graph-editor.daikusutora3.workers.dev/`). This exception permits
binding that tab, opening this property's fixed search-performance and sitemap
report URLs, and reading their displayed state only; it does not permit clicks,
other navigation, filters, settings changes, sitemap submissions, or indexing
requests. All other computer-use calls are blocked by the hook. In particular,
agents must not:

- creating, editing, reopening, closing, deleting, transferring, pinning, or
  locking issues;
- adding, editing, or deleting issue comments;
- adding or removing labels, assignees, milestones, reactions, or relationships;
- perform any other write operation on Issues.

Do not bypass this policy by changing the working directory, delegating the
operation, or using a different interface. If a task requires a prohibited
Issue operation, stop and report that this repository policy blocks it.

Pull request operations are outside this ban, but use pull-request-specific
tools and do not route them through Issue actions.

This policy remains in force until the user explicitly requests that this file
be changed.

## In-app browser local verification exception

The user authorized in-app browser verification on 2026-10-08. Agents may
open `http://127.0.0.1:3323` or `http://127.0.0.1:3324`, with paths `/`, `/en`, or `/zh-hans`, in the
in-app browser and read the page, enter graph data, operate editor controls,
capture screenshots, and reload the preview. On 2026-10-11, the user also
authorized `/guide`, `/en/guide`, and `/zh-hans/guide`, including page-local
contents links and copying guide examples, for the same local verification.
Use the dedicated `localGraphTab`
binding. No other origins, paths, tabs, application controls, or arbitrary
page scripts are authorized. GitHub Issue restrictions remain unchanged.
Keep the hook enabled and test its permitted and rejected calls.

On 2026-10-11, the user additionally authorized local verification of the
implemented article pages on those same two origins: `/articles`,
`/en/articles`, `/zh-hans/articles`, and their detail pages for the exact slugs
`edge-list`, `adjacency-matrix`, `tree-layout`, `tikz-export`, and
`bipartite-graph`. Agents may open or bind these pages using `localGraphTab`,
read their state, use their page-local contents links, copy their examples,
and verify their guide/editor navigation. Only existing article content
anchors are authorized; unknown slugs, arbitrary fragments, additional query
parameters, and other paths remain prohibited.

The user also authorized the existing editor paths `/`, `/en`, and
`/zh-hans` with the single query parameter `?example=<slug>`, where `<slug>`
is one of the five exact article slugs above. Agents may open or bind these
example editors, edit the isolated example, reload to check restoration, and
use the original-editor link. This extends only the in-app browser exception;
the Safari runner's allowed paths and all other restrictions remain unchanged.

## Safari verification: GitHub Actions dedicated Mac

Run Safari verification on the disposable GitHub-hosted Mac through
`.github/workflows/safari.yml` by default. This includes the full 78-case matrix
and the three native-input cases. Use `tests/browser/safari-workflow.py` with
the approved preview origin and paths below. Safari activation and recovery
restarts must occur on the hosted Mac so verification does not interrupt the
user's normal work.

Do not launch, activate, resize, minimize, restore, quit, or restart Safari on
the user's Mac for routine verification, including exploratory background
probes. If hosted execution is unavailable or fails, diagnose and repair the
GitHub Actions run rather than falling back to local Safari. Report the actual
hosted Safari version and retain results, screenshots, native-input evidence,
and session/driver cleanup records.

The local exception below applies only when the user explicitly requests a
local Safari run and authorizes its possible focus interference for that run.
Earlier permission to automate or restart Safari is not standing permission
to interrupt the user's work. Routine hosted verification does not require
another confirmation.

## Local UI verification exception

With the run-specific authorization above, agents may test this application's
local preview in the installed Safari using Apple's `safaridriver` through
`tests/browser/safari-workflow.py`.
The approved preview origin for this task is `http://127.0.0.1:3323`;
only `/`, `/en`, and `/zh-hans` may be navigated to by this test.
Agents may enter graph test data, operate editor controls, capture screenshots,
and save generated test exports in the test output directory. Use an isolated
WebDriver session, preserve the user's normal browsing data, and close the test
session afterward.

The user additionally authorized enabling Safari remote automation on
2026-10-06. Native Safari interaction may be used solely to open Safari
Settings and enable that setting; approved literal calls must be added to the
hook individually. This does not authorize general browsing or changes to
other settings. Do not request or enter the user's administrator password.

All GitHub Issue restrictions above remain in force. Unrelated applications,
accounts, websites, settings changes, and messages are outside this exception.
Keep the hook enabled. General computer-use calls remain restricted; this
exception does not authorize an unrestricted Safari app binding. The runner
must reject navigation to GitHub Issues and every other origin or path, and
its policy checks must be tested before the Safari session is opened.

Browser verification for this task covers desktop Safari and viewport
simulations. First-use observation requires a real participant; an agent's
walkthrough must be described as an expert review.

## Public repository privacy

Use `daikusutora3` as the maintainer's public identifier. Do not publish private
names, personal email addresses, computer names, absolute home-directory paths,
or conversation details that identify a person or device in files, filenames,
commit/tag messages, or public logs. Describe environments generically and use
repository-relative paths in tracked documentation.

Before committing from a new clone, run `bun run privacy:setup --email
<GitHub-noreply-address>` with the public noreply address from GitHub settings.
The setup uses repository-local configuration, enables `.githooks`, and derives
the public author alias from the noreply address. Never disable the hooks or
use `--no-verify` to get past a privacy rejection. Diagnose rejected values
locally without echoing them into public logs or committing them as test cases.
Additional private aliases belong only in local `privacy.blockedPattern` config.

Both author and committer identities must use approved GitHub noreply addresses.
Check all outgoing commits and annotated tag metadata, including older commits
and merge resolutions. CI runs the public history check without private local
configuration as a second check; it runs after upload and does not replace the
local commit/push guards. Keep GitHub's email privacy and command-line push
blocking settings enabled on the account.

## Enforcement

The project-local Codex `PreToolUse` hook in `.codex/config.toml` rejects known
prohibited GitHub Issue operations before their tool call runs. Keep the hook enabled and
review/trust it when Codex reports a changed hook definition.

The hook is defense in depth for Codex sessions, not a replacement for this
policy. Do not disable or bypass it to perform an operation prohibited above.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
