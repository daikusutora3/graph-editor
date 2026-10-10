# Follow-up system audit

Reviewed on 2026-10-11, starting from
`cb3acbe11cde836864fb0435d6fa9507f77e5fa9`. The starting worktree was clean.
The audit covers current rendering, imports, history, PNG lifecycle,
Worker/Rust/Wasm computation, CI and static delivery. Source correctness,
local measurements, browser observations and remote CI are recorded separately.

During this audit, the user additionally requested stable coordinate tests and
a fix for graph flicker on resize. Those follow-ups are recorded below; the
other findings were recommendations at the time of the audit. All five
remaining candidates are now implemented and their follow-up evidence is
recorded in [Audit improvements](system-audit-improvements-2026-10-11.md).

## Findings

### P1: Host-specific coordinate hashes stop remote verification (published and CI verified)

The coordinate-test and resize fixes were subsequently committed and pushed as
`a2518db9c841952331e1e8a3f23ca0174e5e9c00`.
[Verify run 38074178753](https://github.com/daikusutora3/graph-editor/actions/runs/38074178753)
completed successfully for that exact commit. The evidence below describes the
original investigation, not a new failure at that commit.

[Actions run 38070934531](https://github.com/daikusutora3/graph-editor/actions/runs/38070934531)
for `cb3acbe` failed in `verify:overlaps`. Five fixtures fail only the frozen
SHA256 comparison in `tests/verification/overlaps.ts`: wide labels, fractional
widths, shuffled fractional widths, order ties and shuffled order ties.
Clearance, zero residual collisions, input preservation, idempotence and
generator agreement all pass in that Linux run. Type checks, lint, formatting,
policy checks and the preceding suites pass; native Rust tests, build and
release assertions are not reached.

The original all-pairs resolver was restored into a temporary reference.
Current and original results match exactly in all 18 fixtures on local native
Bun, native Node and Bun with only `Math.hypot` replaced by a scaled-square-root
approximation. That replacement reproduces the same five hash failures while
preserving exact current/reference agreement. The largest local coordinate
difference between native Bun and the other approximation is
`8.53e-14` pixels, with unchanged node order, status and remaining-pair count.
The [ECMAScript specification](https://tc39.es/ecma262/multipage/numbers-and-dates.html#sec-math.hypot)
permits an implementation-approximated result for `Math.hypot`.

This is strong evidence that the frozen hashes are not portable. Linux
coordinates themselves were not printed by CI and were not obtained locally;
the numerical differences above are local measurements, not Linux measurements.
Tests should preserve strict status/order expectations and meaningful
coordinate checks with a small absolute tolerance rather than change product
calculations to match one host's hash.

Evidence: `/tmp/graph-editor-ci-cb3acbe-failed.log`,
`/tmp/graph-editor-overlaps-bun-native.json`,
`/tmp/graph-editor-overlaps-bun-scaled.json`,
`/tmp/graph-editor-overlaps-node-native.json`.

### P2: Repeated parallel-label spacing dominates some routing tasks

`core/layout/edge-routing.ts` calls `parallelLabelSpacing` inside the candidate
group's `every()` loop. Each call scans every label in the same immutable
endpoint group. With labeled reverse parallel edges and collision refinement,
this creates work approaching cubic growth in group size. This is a separate
remaining cost from the collision-count reuse implemented in `cb3acbe`.

| Five-node workload         |   Current | Task-local reuse prototype |
| -------------------------- | --------: | -------------------------: |
| 100 labeled parallel edges |  185.36ms |                     5.10ms |
| 200 labeled parallel edges | 1368.74ms |                    10.21ms |

These are spy-free CPU medians from seven alternating runs, excluding the first
two warm-ups, with the current Rust/Wasm kernel initialized. Diagnostic warm-ups
confirmed both paths use the Rust node-shape kernel. Final route hashes and
generator step counts (902/1758) match on every run. The valid fixtures were
accepted by production JSON serialization and parsing.

The prototype is temporary and has not been applied to product code. A lazy
task-local value per endpoint group is the supported improvement; it avoids
global stale caches and unnecessary work for retained/pending routes. No
browser latency or FPS claim follows from these CPU measurements.

Evidence: `/tmp/graph-editor-route-spacing-timing-wasm-cb3acbe.json`.

### P2: A large single Rust call delays Worker cancellation and replacement

The Worker checks its 4ms slice budget between `task.next()` calls. Force layout
and overlap resolution perform a whole Rust call inside one such step, so the
Worker cannot read a cancel message or a replacement request until it returns.

With the current source in a real Bun Worker and 1,000-node fixtures, cancel
followed immediately by a small replacement request takes 311–327ms to complete
for Force and 267–275ms for overlap resolution. Old responses are emitted, but
the client's canceled-request guard prevents their application. This is a
responsiveness issue rather than a demonstrated wrong-result application.

Candidates are resumable numerical kernels or a dedicated heavy-layout Worker
that can be replaced on cancellation. The measurements are from Bun Workers;
browser event latency has not been measured.

Evidence: `/tmp/graph-editor-worker-cancellation-audit-cb3acbe.json`.

### P2: Text import previews can accept an unapplicable model

The text parsers and `evaluateGraphInput` do not enforce the shared 256-code-point
label/weight limit before returning success. With string weights, the input
`2 1\n0 1 ` followed by 257 ASCII characters returns detected/success, no
warnings, and Starter status `ready`. Applying that model through the real Jotai
command returns rejected: `Graph exceeds the JSON contract`.

The same mismatch occurs for edge-pair labels, adjacency weights and 257 emoji
code points. The corresponding 256-code-point cases apply successfully.
Rejected models preserve the existing graph by reference, so data protection
works; the preview and input guidance disagree with the application contract.

The IAB also shows a 260-character weight as `N=2 M=1` with Apply enabled.
Clicking Apply leaves the Load panel unchanged; closing it reveals the global
rejection notice and the unchanged original graph. The parser should use shared
text validation and a field/line-specific limit warning before displaying an
applicable preview. Automatic truncation would lose data and is not recommended.

Evidence: `/tmp/graph-editor-import-contract-audit-cb3acbe.ts` and
`/tmp/graph-editor-ui-review/audit-long-weight-ready.png`.

### P2: Coincident distinct nodes are mistaken for a self-loop in SVG preview

`ui/samples/preview-geometry.ts` selects loop geometry by comparing node
coordinates instead of endpoint IDs. For `a -> b` where both nodes are at
`(0, 0)`, production JSON parsing accepts the model, Cytoscape reports
`edge.isLoop() === false`, but the SVG preview uses a cubic loop. This happens
even with `allowSelfLoops: false`.

The behavior was reproduced in the permitted IAB Load preview. The existing
before/after SVG equality tests preserve old output, so they cannot detect an
old semantic mismatch. Use endpoint identity for loop classification and add a
Canvas/preview agreement case for distinct coincident nodes. Treat the
degenerate non-loop edge separately.

Evidence: `/tmp/graph-editor-preview-audit-2026-10-11.json` and
`/tmp/graph-editor-ui-review/audit-coincident-preview.png`.

### P3: Finite coordinates alone do not ensure finite geometry

JSON validation accepts node x coordinates `-1e308` and `1e308`. Their difference
overflows, and the real SVG renderer produces `NaN` positions, dimensions,
stroke widths and path coordinates. This was reproduced through production
JSON parsing and `SampleGraphPreview`; it was not applied to the user's canvas.

A shared operating range for stored coordinates, or overflow-safe geometry plus
a final finite-output guard, should be defined. This boundary-input issue has
lower priority than the normal-workflow findings above.

Evidence: `/tmp/graph-editor-preview-audit-2026-10-11.json`.

## Current implementation and measured limits

The recent PNG FIFO owner, cancellation cleanup, Object URL ownership, bitmap
`finally` cleanup, estimated Undo retention budget, autosave exclusion, Worker
result validation, delta reconstruction and Wasm allocation cleanup remain
appropriate in the reviewed scenarios. No new confirmed normal-workflow
correctness defect was found in those paths.

The refactored preview's synchronous work was measured separately. With five
warm-ups and 15 samples in Bun 1.4.2:

| Model                     | Simple routing | Prepared geometry | Complete static SVG render |
| ------------------------- | -------------: | ----------------: | -------------------------: |
| 300 nodes / 1,000 edges   |         0.72ms |            2.34ms |                     5.90ms |
| 1,000 nodes / 5,000 edges |         3.10ms |            7.65ms |                    24.20ms |

The full SVG number is server rendering rather than browser rendering or input
latency. This local evidence does not justify prioritizing a Rust rewrite of
preview preparation. React deferral keeps lower-priority rendering interruptible,
but does not itself make calculations faster; see
[the React documentation](https://react.dev/reference/react/useDeferredValue).
Target the measured repeated label-spacing work first.

## Verification scope

- Targeted local suites passed: sample-preview, overlaps, io-contracts,
  autosave, history-clipboard, image-export, wasm-worker, wasm-runtime,
  wasm-layouts, wasm-overlaps and routing-collision-reuse.
- The latest committed source was rebuilt locally and release assertions passed.
  An initial restricted build could not open its internal PostCSS port; its
  cached failure was preserved in `/tmp/graph-editor-next-cache-audit-cb3acbe-2026-10-11`.
  Rebuilding with the permitted local process access and a fresh cache succeeded.
- The previous pre-commit export initially failed only the sitemap commit-date
  assertion; rebuilding at `cb3acbe` resolved this artifact staleness. The local
  server was restarted at `http://127.0.0.1:3324` with matching CSP.
- Browser reproduction used only the permitted local IAB tab and editor controls.
  Safari and standalone browser runners were not used. The original graph was
  preserved through the rejected import and preview-only loop reproduction.
- The hook remains enabled. No Issue state, deployment setting, remote workflow
  or public application was changed by this audit.

## Requested follow-ups during the audit

### Stable coordinate regressions

`tests/verification/overlaps.ts` now compares the 18 original resolver outputs
against stored numeric coordinate goldens. Status, remaining-pair count, node
IDs/order and grid coordinates stay exact. Non-grid coordinates use an absolute
`1e-7px` tolerance, below the resolver's `1e-5px` clearance threshold. Eight new
cases cover coincident fractional measured widths, grid snapping, shuffled input,
a cluster translated by `1e8`, extreme finite separated coordinates and large
fractional separated coordinates.

All 26 cases run with native and scaled `Math.hypot` implementations (52 case
executions). Checks preserve input, finite positions, clearance, idempotence and
generator/synchronous agreement. Comparator mutation checks accept `1e-9px`
rounding but reject `1e-4px` displacement, NaN, changed status, collision count,
node order and even `1e-9px` displacement off an exact grid coordinate. Bun 1.4.2
and Node 24.15.0 both pass locally; the Node run uses its TypeScript stripping
and a temporary relative-import loader. These changed tests were subsequently
pushed in `a2518db` and passed the remote Linux Verify run linked above.

### Resize flicker

The installed Cytoscape 3.34.3 resize implementation updates canvas width/height,
which clears the backing stores synchronously, then leaves the next paint to
the normal RAF loop. A ResizeObserver delivery after that loop can expose a
blank frame. The new adapter `graph-canvas-resize.ts` synchronously repaints
after an actual backing-size change. It first flushes pending rendered styles
so simultaneous graph/style updates invalidate old geometry and layer textures.
Same-size notifications retain `cy.resize()` events but skip the additional
paint; the normal queued RAF remains intact. The two viewport-resize callers
use the adapter without recreating the core or issuing an automatic fit.

`canvas-resize.mjs` is registered in the standard verification runner. It uses
the installed canvas sizing, Core events and projection/cache calculations,
with canvas pixels represented by reset/paint sentinels and a deterministic
React/RAF harness. It reproduces the old cleared-but-pending state and covers
five successive widths, density-only changes, simultaneous label/style edits,
deferred batch notification, destroyed cores, first-render acknowledgement,
explicit fit and StrictMode cleanup/replay. Core identity, elements, positions,
zoom, pan, selection, display readiness, hitboxes and PNG signatures are checked.
A no-flush negative control fails on the old label rather than hiding that
boundary in the paint stub. An independent probe through the installed actual
Canvas renderer and LayeredTextureCache confirms old layers reach `drawImage`
without the flush and are invalidated after it.

The rebuilt app was checked in the permitted IAB at 600, 468, 320, 768 and
1280px widths. Rendered positions and selected Alpha stayed unchanged through
resizes, and the UI retained 150% zoom. A coordinate click selected Gamma at its
rendered position after resize, and the PNG panel generated the expected full
graph preview. The graph model was preserved; test selection was cleared and
the temporary viewport override was reset. Final screenshots show settled
rendering, not a frame-by-frame video of resize. Prevention of the blank interval
is verified by the installed resize implementation and paint-order regression.

Final local `check:all` passed: both TypeScript configurations, Oxlint, Prettier,
60 hook policy checks, all 44 verification suites, 18 native Rust tests,
production build, current Wasm assertion and release assertions. The final
test-only batch addition was rechecked separately after that full run. The
changes were subsequently committed and pushed in `a2518db`, whose remote
Verify run passed. The additional improvements in the linked follow-up report
were a separate, uncommitted change set when that verification was recorded.

Browser evidence: `/tmp/graph-editor-ui-review/after-resize-320.png`,
`/tmp/graph-editor-ui-review/after-resize-1280.png`,
`/tmp/graph-editor-ui-review/after-resize-final.png`.
