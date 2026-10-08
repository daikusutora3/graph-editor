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
capture screenshots, and reload the preview. Use the dedicated `localGraphTab`
binding. No other origins, paths, tabs, application controls, or arbitrary
page scripts are authorized. GitHub Issue restrictions remain unchanged.
Keep the hook enabled and test its permitted and rejected calls.

## Local UI verification exception

Agents may test this application's local preview in the installed Safari using
Apple's `safaridriver` through `tests/browser/safari-workflow.py`.
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

## Enforcement

The project-local Codex `PreToolUse` hook in `.codex/config.toml` rejects known
prohibited GitHub Issue operations before their tool call runs. Keep the hook enabled and
review/trust it when Codex reports a changed hook definition.

The hook is defense in depth for Codex sessions, not a replacement for this
policy. Do not disable or bypass it to perform an operation prohibited above.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
