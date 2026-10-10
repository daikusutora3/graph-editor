# System audit improvements

Implemented on 2026-10-11 from a clean worktree at
`a2518db9c841952331e1e8a3f23ca0174e5e9c00`. This closes the five remaining
candidates in [the system audit](system-audit-2026-10-11.md). The earlier
coordinate-test and resize fixes were already published in that commit, and
[its Linux Verify run](https://github.com/daikusutora3/graph-editor/actions/runs/38074178753)
passed. This report records local verification of the separate improvements
below before their commit and push.

## Parallel-edge spacing

`edge-routing.ts` now lazily computes distinct bow spacing once per immutable
endpoint group in a routing task. It reuses neither another task's input nor
global state, and retained/pending groups do not trigger unnecessary work.

| Five-node workload         |    Before |   After |
| -------------------------- | --------: | ------: |
| 100 labeled parallel edges |  183.03ms |  4.81ms |
| 200 labeled parallel edges | 1369.04ms | 10.42ms |

These are local CPU medians from seven runs with two discarded warm-ups,
the current Rust/Wasm initialized, and no spies or diagnostics in timed runs.
Route hashes, generator steps (902/1758) and Rust kernel calls agree. A separate
14-fixture comparison preserves all route values, generator steps and work
units. The negative control using the old implementation fails the label-read
regression (3,037,100 reads versus 200). This is CPU work, not measured browser
input latency or FPS.

Reproduce same-machine measurements before and after the change using
`tests/benchmarks/routing-parallel-spacing-performance.ts --output <file>` and
`--baseline <before-file> --output <after-file>` through the pinned toolchain.
The earlier source must be measured before applying this change.

## Heavy Worker cancellation

Force layout and overlap resolution now share a dedicated heavy Worker;
routing and the remaining layouts use the interactive Worker. A heavy abort
terminates that owner immediately. Concurrent retained heavy requests replay
with the original cloned input, IDs, timeouts and abort listeners. Late replies
and errors from old owners are ignored. Routing cancellation remains cooperative.
Both Workers stay warm after success; abort, transport failure and pagehide
release the appropriate owners. There are at most two live Workers, with a
separate Wasm instance for each initialized lane.

In real local Bun Workers, starting the Rust force kernel on a 1,000-node,
999-edge fixture, cancelling it and immediately routing a three-node fixture
took a median **319.14ms before and 0.574ms after** in the final reproducible
benchmark (three trials each). An earlier run measured 335.81ms/0.58ms.
Maximum live Workers was two and pagehide left zero. A small heavy operation
took 7.68ms cold and 0.206ms warm, supporting warm retention. Normal warm
1,000-node force computation took 335.10ms/327.61ms; before/after and cold/warm
numerical results match exactly. Idle committed Wasm memory increased from
1,245,184 to 2,359,296 bytes and returned to zero after disposal; this excludes
JavaScript and native Worker heaps. This isolates responsiveness and does not accelerate
the numerical algorithm itself. Local file fetch and Bun Workers were used;
HTTP, browser startup and browser scheduling are outside this timing scope.

`worker-lanes.ts` covers isolated completion, parallel replay, caller mutation,
old-owner and cross-lane replies, cancellation during initialization, original
deadlines, construction/send failures, warm reuse, termination exceptions,
pagehide and timer/listener cleanup. The existing `wasm-worker.ts` retains
retry, transport, allocation and result-validation coverage.

`worker-cancellation.ts` also runs a real Worker with the compiled Rust kernel.
An ABI entry signal ensures cancellation happens after the 1,000-node force
call starts, and assertions check actual owner disposal and unchanged successor
routes without a machine-dependent timing threshold. Run
`node scripts/toolchain.mjs run tests/benchmarks/worker-cancellation-performance.ts`
for the standalone measurements. Its optional argument selects a separately
captured client source for same-machine before/after comparison.

## Text import and apply consistency

Every text parser now enforces the existing shared limit of 256 Unicode code
points for labels and weights before offering an applicable model. Limit
warnings include field, source line, observed count and maximum in all three
locales. The entire import fails instead of dropping rows or truncating text.
The Apply handler checks the newly evaluated parse result as well as detection,
so invoking it before preview validation cannot replace the graph with an empty
failure model. Explicit string-weight options also work in edge-pair detection.

`import-text-contracts.ts` runs 150 evaluations across field types, automatic
and explicit formats, ASCII, BMP, emoji, combining sequences and unpaired
surrogates at 256/257 code points. It includes direct parser parity, repeated
adjacency sources and late-row atomic rejection. Additional regressions ensure
an invalid endpoint, extra column or extra row cannot hide an oversized weight;
ordinary partial-import guidance remains available with valid field lengths.
`starter-import-guard.mjs`
invokes the actual hook handler and real Jotai replace command to verify valid
application and graph/history preservation on failure. `starter-input-ui.tsx`
checks disabled actions, warning text and absence of stale SVG in three locales.

## Coincident nodes and finite geometry

Preview loops now use endpoint IDs, matching Cytoscape's `isLoop()` semantics.
An edge between distinct coincident nodes is hidden under their shared position
because its direction and visible length are undefined. It becomes a normal
edge after separation. Actual self-loops retain their loop geometry and margin.

Stored node coordinates and Worker geometry metadata now share a finite
operating range of **±1,000,000,000**. This retains the `1e8` translated regression,
keeps normal floating-point precision below the resolver's clearance threshold,
and avoids overflow in differences, squares and curve calculations. JSON,
commands, storage, Worker input/results and Wasm routing use the same boundary;
the standalone preview rejects unsupported positions before preparing bounds.
Input outside the range is rejected, not clamped. Invalid saved raw data remains
available for recovery and is not overwritten by autosave.

`geometry-contracts.ts` checks inclusive boundaries, nearby out-of-range values,
extreme finite values, NaN/infinities, sparse arrays, routing metadata, finite
SVG, actual Cytoscape loop identity, JSON round trips, commands, undo/redo and
storage preservation. It passes in Bun and a bundled Node execution. The raw
out-of-contract Wasm fallback probe is retained separately from supported JSON
input tests.

## Acceptance

- Final `node scripts/toolchain.mjs run check:all` passed both TypeScript
  configurations, Oxlint, Prettier, 60 hook policy cases, all **50 verification
  suites**, **18 native Rust tests**, current Wasm checks, the production build
  and release assertions. An earlier integrated run was deliberately stopped
  during build to incorporate the independently reviewed ignored-row import
  regression; the final run includes that fix.
- The rebuilt export was served with matching CSP at the authorized
  `http://127.0.0.1:3324/en` in-app browser. At 320 × 900, a 257-character weight
  shows its field/line/count warning, no SVG and a disabled Review action;
  reducing it to 256 restores `N=2 M=1` and enabled Apply.
- A distinct coincident-node JSON fixture shows two model vertices and one
  edge without a fabricated loop or protruding arrow. The `±1e308` fixture
  is rejected before rendering, with Apply disabled. These were preview-only
  checks and were not applied to the user's graph.
- At 1280 × 900, actual Force layout completed and Undo restored the graph.
  Save-for-editing JSON before and after matched in node coordinates, labels,
  colors, weights, manual routes and settings. The original camera position
  was restored, the test input cleared, viewport override reset, and a reload
  confirmed the original persisted graph. Gamma selection was restored.
  Reload resets transient Undo history; this does not establish history
  persistence. The browser action confirms UI completion, while actual Rust
  entry and cancellation ownership are established by the real-Worker suite.
- Source and independent review cover all five candidates. The hook remains
  enabled and unchanged. Safari and standalone browser runners were not used.
  This is an expert browser review; no Issue operation, new commit/push or
  public deployment was performed. Remote CI for this new change set remains
  unverified until publication.

Browser screenshots under `/tmp/graph-editor-ui-review/`:
`after-audit-import-limit-320.png`, `after-audit-coincident-320.png`,
`after-audit-coordinate-limit-320.png`, `after-audit-improvements-final.png`.
Local timing captures are `/tmp/parallel-spacing-{before,after}-a2518db.json`
and `/tmp/graph-editor-worker-cancellation-{before,after}-final.json`.
