# Post-0c46b3f audit and autonomous improvements (2026-10-11)

Base: `0c46b3fe06866c877ff63f8635fdae2d5ac483ee` on `main`.
The working tree was clean at the start. The user authorized fixing supported
findings autonomously during this audit. This report records local source,
regression and browser evidence; it does not establish a production release.
Earlier audit/remediation reports are preserved as historical observations.

## Scope and decisions

Reviewed the previous special-ID/coordinate/Worker/PNG/Hitbox/history changes
alongside persistence, imports/exports, routing, UI activity, toolchain, static
delivery, CSP and dependency configuration. Installed Next.js client/static
guides and the repository React performance skill were consulted. Confirmed
problems were fixed; libraries and Rust kernels were retained where no supported
replacement or additional defect was found.

| Finding                                                                                       | Resolution                                                                                                                                                                                                                                                                                                                                       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A compact cluster around ±1e9 loses native Canvas text                                        | One renderer coordinate-origin adapter projects distant domain positions near zero, with inverse conversions at drag, placement and live-routing boundaries. Stable nearby edits retain the origin; active drags defer rebasing. Camera compensation preserves rendered positions. Domain IDs, JSON coordinates and Worker inputs are unchanged. | `canvas-coordinates`: positive/negative extremes, immutable input, exact domain roundtrips, camera tolerance, native installed projections, live routing and reset. `canvas-lifecycle`: actual drag/cancel/commit, grid snapping, Undo/Redo, background tap, rebase overlay compensation and normal zoom. Actual positive/negative-boundary labels, curves and loops were inspected in the in-app browser, including PNG at 320px width. |
| Successful Undo/Redo leaves a prior rejected-coordinate notice                                | Clear the typed command failure after the patch contract succeeds.                                                                                                                                                                                                                                                                               | `geometry-contracts`: rejected edit → successful Undo/Redo. Browser nudge beyond y=1e9 → rejection → Undo removed the notice and restored the prior drag.                                                                                                                                                                                                                                                                                |
| Concurrent flushes of one save generation duplicate writes or report an obsolete lock failure | Check both generation and pending-data ownership inside the Web Lock and in the rejection handler. Only the still-pending edit can write or fail.                                                                                                                                                                                                | `autosave`: controlled competing lock callbacks and promise failures, one localStorage write, no stale failed status after successful save. New regressions fail with the previous implementation.                                                                                                                                                                                                                                       |
| JSON settings accepts inherited whitelist names                                               | Require `Object.hasOwn` in the supported-settings whitelist.                                                                                                                                                                                                                                                                                     | `integrity`: own boolean `__proto__`, `constructor` and `toString` keys are rejected instead of silently discarded.                                                                                                                                                                                                                                                                                                                      |
| NUL-separated adjacency pair keys collide for valid IDs                                       | Encode endpoint pairs as JSON tuples, retaining undirected canonical ordering.                                                                                                                                                                                                                                                                   | `io-contracts`: `a→b\0c` and `a\0b→c`, both directions, adjacency list/matrix roundtrips; real parallel edges still reject lossy output.                                                                                                                                                                                                                                                                                                 |
| Patch validation repeats the serialization contract's scans                                   | Remove the single-caller validation wrapper and use `serializeGraphModel` as the sole patch contract gate.                                                                                                                                                                                                                                       | Existing invalid-patch, history, geometry and integrity suites pass. Proxy work-count probe: original collection `map` passes 3→0, edge iteration 2→1; serialized bytes and untouched collection identity agree.                                                                                                                                                                                                                         |
| Hidden/learned hints keep activity listeners and recreate a timer per event                   | Observe idle activity only for an available visible unlearned hint. Retain one timer that checks the most recent activity deadline.                                                                                                                                                                                                              | `hint-idle`: hidden/learned dormancy, reset, immediate hide, complete 2.5s wait, reopening, Strict effects and unmount. Original hook fails the new resource-count regressions.                                                                                                                                                                                                                                                          |
| Manual-curve sibling reconciliation still repeats candidate bow calculation                   | Hoist one representative bow per candidate and reuse it in spacing and scoring.                                                                                                                                                                                                                                                                  | `routing-parallel-spacing`: six simple/parallel/quality × 100/200 reversed labeled/manual fixtures, old-code negative control, unchanged route values/order/ties/yields/manual geometry and immutable input. Isolated CPU measurements below.                                                                                                                                                                                            |
| Sample gallery starts a redundant import promise outside React's lazy error path              | Remove the chrome prefetch effect and its exported loader; keep the one lazy component import.                                                                                                                                                                                                                                                   | `sample-gallery-load`: actual chrome mount effects with a controlled delayed import failure, two import invocations/one unhandled rejection → one import/zero unhandled rejections. Healthy loading renders the real sample search and cards with one import and no errors.                                                                                                                                                              |

The rendering origin lives at the Cytoscape adapter boundary rather than in the
saved graph. Origins use a `WeakMap` keyed by the canvas instance; empty/normal
graphs return to zero. Origin changes are included in HTML overlay baselines,
so compensating pan does not throw click targets offscreen for an intermediate
frame. Ordinary zoom still uses local pan deltas. No dependency internals,
global prototypes or private renderer implementation are patched.

## Measured work

For a 10,000-event pointer/wheel burst while a hint is eligible, timer
creations/cancellations fall from 10,000/10,000 to 0/0 during the burst, with
one existing deadline timer. Hidden hints have zero activity listeners/timers,
previously four/one. These are controlled resource counts, not FPS or latency.

Manual-curve quality routing used Node 24.15.0/Bun 1.4.2 and the current compiled
Rust/Wasm. Benchmarks ran without another build or CPU benchmark. Seven passes,
two warmups, median of five measured passes; no mocks/spies in measured runs.

| Reversed labeled edges, including one fixed manual curve |   Before |    After | Reduction |
| -------------------------------------------------------- | -------: | -------: | --------: |
| 100                                                      |  8.559ms |  7.621ms |     11.0% |
| 200                                                      | 24.989ms | 21.571ms |     13.7% |

Route hashes, ordering and generator steps (4,064/8,120) agree. Current Rust
kernel use (`routing_node_shape`: 88/280) was confirmed in a discarded warmup.
`Math.round` work fell from 161,850→6,136 and 662,352→12,236 in the counted
regression runs. Sibling comparison remains quadratic; this local benchmark
does not establish browser frame-rate or input-latency improvement.

Reproducer: `tests/benchmarks/routing-parallel-spacing-performance.ts --manual`,
with `--module` for the saved baseline routing module and `--baseline` for
comparison. Local measurements: `/tmp/graph-editor-manual-bow-before.json` and
`/tmp/graph-editor-manual-bow-after.json`.

Initial modern JavaScript in the final static build is 771,837 bytes / 243,649
gzip, versus 772,237 / 243,696 at the base (−400 / −47). This is effectively
unchanged and excludes later dynamic chunks, Worker code and Wasm; it is not
a complete download/startup measurement. Reproducer: `initial-bundle.ts`.

## Integrated validation and limits

Final `node scripts/toolchain.mjs run check:all` passed: both type checks,
lint/format, 60 permitted/rejected policy cases, 57 verification suites, 18
Rust tests, current Wasm artifact verification, Next.js static build and
release verification. The intentional invalid-PNG lifecycle fixture logs a
warning while its asserted failure/recovery behavior passes.

Verification uses the dedicated in-app browser at `http://127.0.0.1:3324/en`;
Safari, other browser runners and arbitrary page scripts were not used. The
server was restarted with the final build and generated CSP headers.

Canvas observations after coordinate integration (no canvas sources changed
in the later gallery-only cleanup):

- A/B labels at x=1e9, y=999999940/1e9 were visible in the native canvas.
  Dragging B by −180 screen pixels at zoom 1.5 produced x=999999880,
  y=1e9 in exported JSON. A rejected downward nudge followed by Undo
  removed the rejection notice; Redo restored the drag.
- A background click in Node mode created a domain position at
  (999999938.9420183, 999999880), preserving the large coordinate origin.
- Replacing the fixture with positions (−1e9, −1e9) and
  (−999999880, −999999880) retained visible A/B, the manual curved edge
  label and the self-loop label. This also exercised origin replacement.
- Full PNG previews rendered those labels, curve and loop at 1920×1145
  (positive fixture after drag) and 1920×1920 (negative fixture).
  At 320×720, scrolling the modal exposed the complete negative-fixture
  preview while Close, Save and Copy remained available.
- The original three-node graph was restored. Exported JSON matched the
  captured original coordinates, curves, colors, IDs and settings exactly.
  Reloading retained that graph and reset the temporary verification history;
  Select mode and the original Gamma selection were restored.

Screenshots: `/tmp/graph-editor-ui-review/followup-large-coordinates.png`,
`followup-large-png.png`, `followup-negative-coordinates.png`, and
`followup-png-320.png` in the same directory, with the restored original view
in `followup-final-restored.png`. The temporary viewport override
was reset after narrow-width verification.

After the gallery cleanup and final gate, the server was restarted and the
in-app browser was reloaded. Load → Use a sample changed from Loading samples
to the real search, category selector and cards (79/79 available entries).
The original graph remained after closing the gallery, with Undo/Redo disabled
and Gamma selected. Final gallery pixels are recorded in
`/tmp/graph-editor-ui-review/followup-sample-loading.png`; the restored-view
screenshot above was refreshed on this final build.

The coordinate-origin improvement addresses distant compact clusters. A graph
spanning most of the entire ±1e9 range can still have huge local extents; this
audit does not establish raster accuracy across every accepted possible span.
OS clipboard contents, physical monitor moves and production deployment were
not retested. Controlled tests distinguish algorithm/API behavior from pixels.

The gallery failure regression uses React server streaming with controlled
mount effects and a held Bun module-loader promise. It confirms removal of the
redundant unhandled prefetch rejection; the single lazy rejection still reaches
React's render-error path. Browser chunk-failure recovery/local error-boundary
behavior was not verified or redesigned. Current pinned
toolchain, CI configuration, static CSP delivery and established Worker
failure/cancellation/lane ownership had no additional supported defect in this
review. Remote CI for this uncommitted working tree was not checked. An unrelated
concurrent promo-recording addition in `tests/browser/safari-workflow.py` is
preserved and is outside this audit; no Safari session was run by this audit.
