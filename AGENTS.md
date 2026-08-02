# Repository agent policy

## Absolute ban on GitHub Issues

For every task whose working directory, repository, or target is this directory
or one of its descendants, automated agents must not access or operate on GitHub
Issues for this repository.

This ban includes all read and write operations, including:

- listing, searching, fetching, summarizing, or otherwise reading issues;
- creating, editing, reopening, closing, deleting, transferring, pinning, or
  locking issues;
- adding, editing, or deleting issue comments;
- adding or removing labels, assignees, milestones, reactions, or relationships;
- invoking issue-related actions through GitHub connectors, `gh`, REST,
  GraphQL, browser automation, scripts, or any other interface.

Do not bypass this policy by changing the working directory, delegating the
operation, or using a different interface. If a task requires GitHub Issue data
or an Issue operation, stop and report that this repository policy blocks it.

Pull request operations are outside this ban, but use pull-request-specific
tools and do not route them through Issue actions.

This policy remains in force until the user explicitly requests that this file
be changed.

## Enforcement

The project-local Codex `PreToolUse` hook in `.codex/config.toml` rejects known
GitHub Issue operations before their tool call runs. Keep the hook enabled and
review/trust it when Codex reports a changed hook definition.

The hook is defense in depth for Codex sessions, not a replacement for this
policy. Do not disable or bypass it to perform an operation prohibited above.
