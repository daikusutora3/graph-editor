# Development

## Local setup

Run commands from the repository root. Use the Bun version declared in
[`package.json`](../package.json) and the checked-in lockfile:

```bash
bun install --frozen-lockfile
bun run dev
```

Open the URL printed by Next.js (normally `http://localhost:3000`). Installation
runs `prepare`, which configures this checkout to use `.githooks`. The commit
hook runs the repository policy self-test and staged privacy check; the push hook
checks outgoing changes for private data.

## Code boundaries

| Location                                        | Responsibility                                         |
| ----------------------------------------------- | ------------------------------------------------------ |
| `app/`                                          | Next.js routes and app entry points                    |
| `features/graph-editor/core/`                   | Graph model, reducers, validation, and layouts         |
| `features/graph-editor/adapters/`               | Browser persistence and Cytoscape integration          |
| `features/graph-editor/canvas/`                 | Rendering and interactive canvas behavior              |
| `features/graph-editor/shell/` and `workflows/` | Editor state and coordinated editing operations        |
| `features/graph-editor/io/`                     | Import, export, clipboard, and file actions            |
| `features/graph-editor/samples/`                | Sample graph catalog                                   |
| `features/graph-editor/ui/` and `i18n/`         | Controls, panels, and localized messages               |
| `tests/verification/`                           | Model, IO, layout, state, and release checks           |
| `tests/browser/` and `tests/benchmarks/`        | Browser regressions and local performance measurements |
| `public/brand/`                                 | Icons and logo assets                                  |

Paths under `features/graph-editor/` in the table share that prefix. The app uses
Jotai and Cytoscape and is statically exported; server-side performance guidance
only applies where that execution path actually exists.

## Choose checks for the change

[`package.json`](../package.json) defines the commands;
[`run-all.ts`](../tests/verification/run-all.ts) lists the verification suites.

| Change or purpose                           | Check                                                                                                                              |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Documentation only                          | Format the edited Markdown and check changed links, paths, and command names                                                       |
| A focused behavior change                   | Run the relevant file with `bun run tests/verification/<suite>.ts`                                                                 |
| Type, lint, or formatting checks separately | `bun run typecheck`, `bun run typecheck:strict`, `bun run lint`, `bun run format:check`                                            |
| All model/IO/state verification suites      | `bun run test`                                                                                                                     |
| Integrated code validation                  | `bun run check` — both type checks, lint, formatting, repository policy, and verification suites                                   |
| Public-build preparation                    | `bun run check:all` — integrated checks, static build, and release assertions                                                      |
| UI behavior or responsive styling           | Reproduce the affected interaction in the browser; use the [browser audits](../scripts/audit/README.md) for their covered surfaces |
| Canvas recovery, fit, history, or bends     | Use the browser regression command below and the [consistency contracts](verification/editor-consistency.md)                       |

The browser regressions and audits run separately from `check` and `check:all`.
For the English-locale regression suite, start the dev server, then run in another
terminal (adjust the port to the running server):

```bash
BASE_URL=http://127.0.0.1:3000/en bun tests/browser/editor-regressions.ts
```

Browser scripts use Playwright's bundled Chromium. Install it if missing with
`bunx playwright install chromium`. The regression suite uses an isolated browser
context and writes its screenshots under `/tmp/graph-editor-review`.

For routing performance, use `bun run benchmark:edge-routing`; for editing and
slicing, use `bun tests/benchmarks/editor-operations.ts`. Compare the same fixtures
on the same machine. Bun timings do not establish browser paint responsiveness.

## Completion evidence

For implementation work, finish the requested behavior and the checks that
exercise it, fixing failures introduced by the change. For UI changes, include
the affected interaction and relevant viewport, theme, or keyboard state in the
browser check. Report what ran and any remaining blocker; an unrun check or an
old screenshot is not a current pass. Documentation-only edits need document
validation, not an application build. An audit-only request ends with findings
and supporting evidence rather than unrelated implementation work.

## Static build and headers

```bash
bun run build
```

Next.js uses `output: "export"` in [`next.config.ts`](../next.config.ts).
Cloudflare static assets use [`wrangler.jsonc`](../wrangler.jsonc).
The build transforms the [`public/_headers`](../public/_headers) template into
`out/_headers`, including page-specific CSP hashes for inline scripts.
The generated header checks enforce the 2,000-character line limit and avoid
overlapping CSP rules. See [browser audits](../scripts/audit/README.md) to exercise
those headers locally. `check:all` validates the build; it does not publish it.
