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
Oxlint's React Compiler rules for refs, effect state updates, and dependency
minimization are explicitly disabled to retain the lint coverage used before the
dependency update. Adopting them requires a separate migration of the canvas ref
cache, client hydration, and effect invalidation patterns. The existing Rules of
Hooks and exhaustive-deps checks remain enabled.

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

The focused performance checks also cover JSON import, Unicode validation,
history preparation, select-all, and hitbox rendering:

```bash
bun tests/benchmarks/import-performance.ts --output /tmp/import-before.json
bun tests/benchmarks/graph-validation-performance.ts --output /tmp/validation-before.json
bun tests/benchmarks/selection-performance.ts
bun tests/benchmarks/run-canvas-hitboxes.mjs --output /tmp/canvas-before.json
bun tests/benchmarks/routing-performance.ts --output /tmp/routing-before.json
bun tests/benchmarks/interactive-routing-performance.ts --output /tmp/drag-before.json
bun tests/benchmarks/overlap-performance.ts --output /tmp/overlaps.json
bun tests/benchmarks/run-sample-gallery.mjs --output /tmp/gallery.json
bun tests/benchmarks/run-range-selection.mjs --output /tmp/range.json
```

After a change, pass `--baseline` with the saved JSON path to the import or
validation benchmark to compare medians and output signatures. Run benchmarks
sequentially, without concurrent builds, and keep dependencies unchanged between
versions. The selection check compares the previous array membership scan with
Set membership in the same run; its toolbar rendering measurement uses SSR.
The hitbox check uses isolated Chromium and React's development Profiler. Pass
`--baseline /tmp/canvas-before.json` to compare render medians; these exclude
Cytoscape paint and end-to-end input latency. It also measures real Cytoscape
hitbox reads and checks that skipped renders still use the latest callbacks.

The routing checks include 600 self-loop sources below the quality-routing
cutoff, plus 500 dragged obstacles alongside 400 settled edges. The interactive
check reports the first generator step as well as total work and maximum
slices; a fast average alone does not establish responsive dragging. Both
routing runners accept `--baseline` and compare output signatures.

The overlap benchmark covers separated grids and lines, a single collision,
coincident nodes, and wide labels. Its `--reference` option compares a saved
original module with imports rebased to the same checkout. The gallery runner
can compare an original `SampleGalleryPane.tsx` using `--gallery-source`; it
counts rendered cards and measures React work with all previews visited. The
range runner compares the frozen previous containment implementation on the
same real Cytoscape canvas, covering small and enclosing boxes and all selection
filters. It measures geometry reads, excluding preview class application and
paint. Gallery and range runners use isolated Chromium and do not change browser
profiles; overlap calculation runs in Bun.

For translated SVG hitboxes, live panel updates, PNG export counts on reopening,
and drag/history/persistence at 1,000 nodes and 5,000 edges, run:

```bash
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/canvas-performance-regressions.ts
```

Start `bun run serve:out` after building, and restart it after each rebuild so
its CSP header hashes match the latest HTML. The browser script uses isolated
storage and seeds only its test fixtures.

The next performance pass also checks topology, history, clipboard numbering,
and resumable TikZ export:

```bash
bun tests/benchmarks/topology-performance.ts --output /tmp/topology.json
bun tests/benchmarks/history-clipboard-performance.ts --output /tmp/history.json
bun tests/benchmarks/tikz-performance.ts --output /tmp/tikz.json
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/export-performance-regressions.ts
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/export-rendering-regressions.ts
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/starter-performance-regressions.ts
bun tests/browser/run-dormant-work.mjs
bun tests/browser/run-export-lifecycle.mjs
```

These benchmarks accept `--baseline` to reject changed output signatures.
Topology accepts `--reference-dir`, and history/clipboard accepts
`--original-dir`, for saved original modules with imports resolved to this
checkout. TikZ reports total CPU work and maximum cooperative slices separately.
Its production browser check reloads before each timing sample to exclude the
completed-output cache, then checks format switching, copy, download and reopen.
The starter browser check identifies the built gallery chunk and verifies that
paste-only use does not fetch it. Both checks use fresh browser contexts; export
uses a test-local clipboard stub. The temporary React harnesses instrument parser
calls and task scheduling without modifying the application build.

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
