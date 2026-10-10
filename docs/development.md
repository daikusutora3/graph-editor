# Development

## Local setup

Run commands from the repository root. Node is pinned to **24.15.0** in
[`.node-version`](../.node-version); Bun is pinned to **1.4.2** by
`packageManager` in [`package.json`](../package.json). Use your Node version
manager to select the pinned Node. The Node type definitions target the same
24.x runtime family.

Install the exact Bun version from the
[official release](https://github.com/oven-sh/bun/releases/tag/bun-v1.4.2). Either
use it on `PATH`, or place the executable at `.local-bin/bun` for this checkout.
The latter is ignored by Git and does not change the global Bun installation.
For macOS on Apple Silicon, a repository-local installation is:

```bash
bun_download_dir="$(mktemp -d)"
curl -fL https://github.com/oven-sh/bun/releases/download/bun-v1.4.2/bun-darwin-aarch64.zip -o "$bun_download_dir/bun.zip"
unzip -q "$bun_download_dir/bun.zip" -d "$bun_download_dir"
mkdir -p .local-bin
cp "$bun_download_dir/bun-darwin-aarch64/bun" .local-bin/bun
```

Use the dependency-free Node launcher to select and verify Bun before installing
dependencies or running commands:

```bash
node scripts/toolchain.mjs install --frozen-lockfile
node scripts/toolchain.mjs run dev
```

The launcher prefers `.local-bin/bun`, requires the exact Node and Bun versions,
and puts that Bun on the child process's `PATH`, so nested `bun` commands retain
the same version. It fails before starting Bun when a selected runtime differs
from the pin. It does not download runtimes automatically.

For the `bun` commands below, select the local installation in the current
terminal first, or use `node scripts/toolchain.mjs` in place of `bun`:

```bash
export PATH="$PWD/.local-bin:$PATH"
bun run toolchain:check
```

The install, dev, build, and integrated-check lifecycle hooks also verify the
actual calling Bun. A direct install with the wrong Bun reports an error, but
Bun can resolve dependencies or write its lockfile before running `preinstall`;
the Node launcher is the entry point that verifies before those operations.

Open the URL printed by Next.js (normally `http://localhost:3000`). Installation
runs `prepare`, which configures this checkout to use `.githooks`. The commit
hook runs the repository policy self-test and staged privacy check; the push hook
checks outgoing changes for private data. All three Git hooks, including the
commit-message check, use the Node launcher and work with a checkout-local Bun
even when Bun is absent from the shell's `PATH`.

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
| Native Rust kernels                         | `bun run test:rust` — offline, locked Cargo tests                                                                                  |
| Integrated code validation                  | `bun run check` — both type checks, lint, formatting, repository policy, and verification suites                                   |
| Public-build preparation                    | `bun run check:all` — integrated checks, native Rust tests, static build, and release assertions                                   |
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
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/png-preview-regressions.ts
```

Start `bun run serve:out` after building, and restart it after each rebuild so
its CSP header hashes match the latest HTML. The browser script uses isolated
storage and seeds only its test fixtures.
The PNG check verifies that fixed-size full previews survive zooming, panning and
reopening, that saved bytes match the preview, and that dependent scopes refresh
after fractional zoom, pan and viewport resize on desktop and mobile.
It also compares downloaded bytes after display-density changes. Headless CDP
changes the density without its standard resolution event, so the test supplies
that event to the real media-query listener; it does not test a physical display
handoff.

The next performance pass also checks topology, history, clipboard numbering,
and resumable TikZ export:

```bash
bun tests/benchmarks/topology-performance.ts --output /tmp/topology.json
bun tests/benchmarks/history-clipboard-performance.ts --output /tmp/history.json
bun tests/benchmarks/tikz-performance.ts --output /tmp/tikz.json
bun tests/benchmarks/run-export-matrix.mjs --output /tmp/export-matrix.json
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

For near-limit matrix input, paste previews, canvas zoom and single-line JSON,
the stress evaluation also has these checks:

```bash
bun tests/benchmarks/import-performance.ts --output /tmp/import-stress.json
BASE_URL=http://127.0.0.1:3123/en bun tests/benchmarks/canvas-viewport-performance.ts --output /tmp/viewport.json
BASE_URL=http://127.0.0.1:3123/en bun tests/benchmarks/canvas-mode-performance.mjs --output /tmp/modes.json
BASE_URL=http://127.0.0.1:3123/en bun tests/benchmarks/canvas-modifier-performance.mjs --output /tmp/modifiers.json
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/canvas-mode-regressions.ts
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/preview-performance-regressions.ts
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/export-line-layout-regressions.ts
```

Run timings sequentially. The viewport benchmark reports frame gaps and browser
long tasks. Preview verification compares the full original SVG markup and
exercises input/format replacement, close/reopen and persisted Apply on desktop
and mobile. Long-line export checks retain exact source text, selection and
copy/download while exercising preparation, cancellation and scrolling.
The mode benchmark measures actual keyboard and toolbar interactions across five
fresh pages at the graph limits. Its regression check covers retained hitboxes,
hidden focus exclusion, live geometry, draft highlights and drag/bend cancellation.
The modifier benchmark measures Shift press/release at the same limits. Canvas
regressions also exercise captured node/stroke drags while Shift, Meta or Control
is held on release. The matrix benchmark compares the previous dense allocation
with current output in Chromium, including sparse and dense weighted graphs.

For implementation work, finish the requested behavior and the checks that
exercise it, fixing failures introduced by the change. For UI changes, include
the affected interaction and relevant viewport, theme, or keyboard state in the
browser check. Report what ran and any remaining blocker; an unrun check or an
old screenshot is not a current pass. Documentation-only edits need document
validation, not an application build. An audit-only request ends with findings
and supporting evidence rather than unrelated implementation work.

## Static build and headers

Numeric kernels and Worker execution are described in
[Rust/Wasm computation](verification/rust-compute.md). Rebuild edited Rust with
`bun run build:wasm`; ordinary builds verify the checked-in artifact with
`bun run check:wasm` and do not require a Rust toolchain.

`bun run test:rust` and `bun run check:all` also run native kernel tests.
Install the pinned toolchain declared in
[`rust-toolchain.toml`](../rust/graph-kernels/rust-toolchain.toml) first.
Build and test scripts share toolchain selection: the repository's
`.local-bin/rust` installation when present, otherwise Cargo on `PATH`.

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

`node scripts/toolchain.mjs run serve:out` binds only to `127.0.0.1`, normally on
port 3123. Set `PORT` to choose another local port. It serves only files whose
canonical paths remain inside `out`, including symlink targets, and rejects
malformed URI input and directory traversal. Header rules are loaded at startup;
restart the server after rebuilding so CSP hashes match the new HTML.

## Continuous verification and release connection

[`.github/workflows/verify.yml`](../.github/workflows/verify.yml) runs the
`check-all` job on pushes and pull requests using an Ubuntu runner. It installs
Node from `.node-version`, Bun from `package.json`, and Rust with the components
and target declared in `rust/graph-kernels/rust-toolchain.toml`. Dependencies are
installed with the frozen lockfile before running the same
`node scripts/toolchain.mjs run check:all` command as local release validation.
The kernel currently has no registry dependencies, so its locked Cargo tests
need no fetch step and remain offline.

The workflow grants only `contents: read`, keeps checkout credentials out of the
working tree, and contains no deploy command or repository secrets. The setup
follows the official [Node action](https://github.com/actions/setup-node),
[Bun action](https://github.com/oven-sh/setup-bun),
[Rust toolchain file](https://rust-lang.github.io/rustup/overrides.html#the-toolchain-file),
and [GitHub permissions](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#permissions)
documentation. Browser regressions remain separate from this job.

Creating the workflow does not make another service wait for its result. The
current GitHub ruleset and Cloudflare build settings have not been inspected or
changed. To connect validation to publication:

1. After the workflow's first successful run, require `check-all` for changes to
   `main` through a [GitHub branch rule](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches#require-status-checks-before-merging).
   This protects merges; account for any permitted direct pushes or rule bypass.
2. Inspect the Worker's existing build and deploy commands in Cloudflare. For a
   Workers Builds connection, use `.node-version`, set the build variable
   `BUN_VERSION=1.4.2`, and ensure the declared Rust toolchain is installed.
   Set `SKIP_DEPENDENCY_INSTALL=1` and use this build command:
   `node scripts/toolchain.mjs install --frozen-lockfile && node scripts/toolchain.mjs run check:all`.
   This runs installation and validation before the following deploy command.
   These version and install controls are documented in the
   [Cloudflare build image](https://developers.cloudflare.com/workers/ci-cd/builds/build-image/);
   the build/deploy sequence is described in
   [build configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/).
3. If the current Cloudflare build environment cannot provide that toolchain,
   use a separately configured deployment job that depends on `check-all` and
   publishes its validated output. Such a job requires an authorized deployment
   setup; it is not part of this read-only CI workflow.

Confirm the live build settings and checks before reporting an active production
gate. A local pass or a workflow file alone does not establish that a public
deployment waited for it.
