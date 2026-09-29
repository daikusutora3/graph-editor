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

## Enforcement

The project-local Codex `PreToolUse` hook in `.codex/config.toml` rejects known
prohibited GitHub Issue operations before their tool call runs. Keep the hook enabled and
review/trust it when Codex reports a changed hook definition.

The hook is defense in depth for Codex sessions, not a replacement for this
policy. Do not disable or bypass it to perform an operation prohibited above.
