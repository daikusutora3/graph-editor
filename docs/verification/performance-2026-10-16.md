# Performance improvements, 2026-10-16

Baseline: `595087f` (clean checkout at the start of this pass).
Started 2026-10-16 01:45 JST. Approximately three hours of autonomous
measurement, implementation, browser verification and review formed the initial
audit. It was delivered as uncommitted local changes. The user subsequently
requested review, then commit and push if no problems remained. Git publication
is reported separately from the local verification below; no production
deployment is part of this work.

Use the pinned launcher, `node scripts/toolchain.mjs`, for Bun 1.4.2 and
Node 24.15.0. Global Bun is older and was not used for the reported timings.
Runtime metadata retains Bun's reported `process.versions` values; the CPU
benchmark runtime is Bun.
This pass ran its CPU comparisons sequentially, without its builds or browser
tests running concurrently. The separate low-duty lifecycle diagnostic can
overlap correctness checks and UI review. Before/after implementations share
the same dependencies and runtime.

## Retained improvements

### Validate saved documents without a normalized graph copy

Every edit, Undo and Redo validates the graph before committing it. The previous
serializer built another complete normalized model, then recursively compared
it with the original. For ordinary data properties, the serializer now checks
the same canonical fields, coordinates, text limits, IDs, orders, references and
settings directly.
Import normalization continues to produce canonical objects. There is no cache
that assumes caller-owned models cannot change.

The permanent differential suite checks 1,146 normal/invalid cases against the
original normalize-and-compare contract, including inherited/non-enumerable and
undefined properties, routing normalization, duplicate IDs/orders, missing
endpoints and in-place mutation. An additional temporary comparison ran 10,000
deterministic generated documents against the untouched original module;
serialization output/rejection and import normalization agreed. The follow-up review reran that 10,000-case comparison on the reviewed source;
[review-verification-log.txt](performance-2026-10-16/review-verification-log.txt)
retains the result.

Descriptor checks restrict the direct path to ordinary data records and arrays
with ordinary numeric entries and default iteration/`every` behavior. Accessors
and non-default array hooks use the original normalize-and-compare path without
extra getter reads during classification. Follow-up review added 17 cases for
getter read counts, exceptions, numeric array accessors and mutation after prior
validation, plus two cases preserving the legacy normalization/exception order
when `toJSON` returns `undefined`. Numeric entries and custom iterators can
disagree, so the fallback also preserves the original array-hook behavior.
Independent cases pass against an untouched source archive, not just shared
validation predicates. This does not claim identical observation of arbitrary
Proxy traps.

The final comparison below includes the accessor guards added during review.
Their checks reduce the speedup relative to the earlier direct-only validator,
while preserving legacy getter behavior. Superseded values remain in
[pre-review-measurements.json](performance-2026-10-16/pre-review-measurements.json).

The paired benchmark alternates execution order in one Bun process, with ten
warmups and 35 measured calls per implementation and operation. All JSON,
transaction and history-patch output hashes agree.

| Fixture / complete CPU operation                            |   Before |    After |
| ----------------------------------------------------------- | -------: | -------: |
| 1,000 nodes / 5,000 edges, serialize                        | 2.204 ms | 1.667 ms |
| Same graph, prepare node edit                               | 2.399 ms | 1.712 ms |
| Same graph, restore history patch                           | 2.243 ms | 1.684 ms |
| 256-character labels, prepare node edit                     | 2.447 ms | 1.988 ms |
| Styled/weighted graph with manual curves, prepare node edit | 4.108 ms | 3.768 ms |

These include JSON encoding and contract validation, not storage I/O, rendering
or browser input latency. The manual-curve fixture retains the full routing
normalization comparison. Evidence: [serialization.json](performance-2026-10-16/serialization.json).
Reproduce with `tests/benchmarks/serialization-performance.ts --reference-root`
pointing to an unchanged source archive of the baseline commit.

### Deduplicate geometry invalidation before deleting parallel edges

Before removing a group of elements, collect one representative per unordered
endpoint pair and invalidate surviving parallel edges once. If no old edges
survive, newly added edges already own all geometry that needs refreshing.
Removal itself keeps Cytoscape's original sequential order, preserving the
remaining overlay/focus order and element identities.

| Two nodes / 1,000 reversed parallel edges |   Before |    After |
| ----------------------------------------- | -------: | -------: |
| Remove half the edges                     | 60.90 ms | 38.59 ms |
| Remove all edges                          | 76.49 ms | 43.10 ms |
| Clear graph                               | 61.59 ms | 38.99 ms |

Fifteen measured samples and five warmups per version, alternating order;
all element data, pool order, counts and final geometry hashes agree across
12 workloads. Sparse 1,000/5,000 half-deletion was approximately 3% slower
(85.52 vs 88.26 ms), so this is a concentrated parallel-edge improvement.
The all-edge and reset cases had modest gains for the sparse fixture.
These are real Cytoscape synchronization/geometry timings without DOM paint.
Evidence: [canvas-sync.json](performance-2026-10-16/canvas-sync.json).

### Reduce temporary objects in SVG preview preparation

Curve extrema use the original derivative roots and De Casteljau arithmetic
without building successive arrays of points. Model bounds accumulate extrema
rather than collecting coordinate arrays; path generation computes only the
coordinates actually used by each presentation variant.

At 1,000 nodes / 5,000 edges, preparation plus SVG path strings changed from
7.337 to 3.713 ms for the undirected editor and 11.236 to 6.540 ms for the
directed editor. Gallery cases also improved. These measurements exclude
routing and DOM rendering. Exact existing SVG goldens and 20,000 deterministic
random curves passed. Boundary/coincident/positive-and-negative-zero probes
preserve serialized geometry; IEEE signed-zero values are not claimed identical.
Evidence: [preview-geometry.json](performance-2026-10-16/preview-geometry.json).

### Compare label endpoint pairs without serializing strings

Label-overlap scoring previously ordered and JSON-serialized two endpoint arrays
for every edge-pair comparison. Direct forward/reverse endpoint equality keeps
the same parallel-label exclusion without those allocations. Public helpers
still observe mutations; this introduces no graph cache.

The 1,000-node / 400-labelled-edge sparse routing fixture changed from 46.070
to 29.970 ms. One-edge and dense controls showed little change. Six complete
routing workloads preserve exact routes, generator yields and Rust-call counts.
Evidence: [routing-label-pairs.json](performance-2026-10-16/routing-label-pairs.json).

### Send only the geometry used by overlap resolution

The overlap Worker reads nodes and geometry settings, but previously cloned and
posted the complete edge list too. Its owned replay snapshot now excludes those
unused edges. The caller's graph is untouched; cancellation/replay still owns a
deep snapshot, and the no-edge path keeps its previous transport behavior.

Real Bun Workers running the production Worker/Wasm code measured the complete
client snapshot, message transport, overlap computation and decoded reply:

| 1,000-node fixture                           |   Before |    After |
| -------------------------------------------- | -------: | -------: |
| No edges, unchanged positions                | 1.478 ms | 1.488 ms |
| 5,000 edges, unchanged positions             | 6.064 ms | 1.407 ms |
| 5,000 edges, overlap resolution changes them | 6.849 ms | 2.049 ms |

The reference client is the original Git blob, with only its import locations
rewritten to load beside the benchmark. Recorded hashes identify both forms.
These are warm Worker measurements with file-backed Wasm loading; they exclude
cold browser startup. Exact results, caller mutation isolation and queued
successor replay are checked. Evidence: [worker-overlap.json](performance-2026-10-16/worker-overlap.json).
The no-edge control is 0.010 ms slower in this final paired run.

### Apply a mixed selection's color as one edit

Choosing one color with both nodes and edges selected previously dispatched two
commands. It now uses the existing combined command: one document validation,
one save-queue update and one history entry. One Undo restores both kinds; Redo
reapplies them together. Separate node and edge palettes retain their commands.

The 1,000-node / 5,000-edge integration check observes one full-graph JSON
serialization instead of two, and one history entry instead of two. It also
checks explicit/default colors, invalid colors and no-op feedback. Actual
local browser interaction confirmed the one-step Undo/Redo behavior, and the
JSON/TikZ export contents and actual PNG preview were inspected.

The final complete palette action, with all 1,000 nodes and 5,000 edges selected,
changed from 9.834 to 6.281 ms. The 20-node/30-edge control changed from 0.128 to
0.081 ms. This paired CPU comparison restores the original serializer and
selection helper in the reference and dispatches its original node-then-edge
commands; the current side calls the production combined palette helper.
Each side has 10 warmups and 25 measured actions, alternating execution order.
Setup, exact graph checks, serialization counting and full Undo/Redo assertions
run outside timing. The resulting graph is identical; the intentional history
change is two entries/Undo steps becoming one.
Evidence: [palette-combined.json](performance-2026-10-16/palette-combined.json).

### Reuse measured routing geometry across kernel initialization

Initial routing now measures the current graph once per graph/font revision,
sharing that geometry between the routing key, provisional routes and Worker
submission. The Worker's own Wasm initialization no longer gets cancelled when
the main thread's independent Wasm loader finishes. An active JavaScript
fallback still restarts with the newly available kernel; stale work is aborted
on graph/font/settings changes or unmount.

The actual hook lifecycle harness compares startup transitions against the
original hook: four measurements / four thousand node copies / two Worker
posts / one abort become one measurement / one thousand copies / one post /
zero aborts. This is deterministic lifecycle evidence with resource doubles,
not a browser latency measurement. Exact route acceptance, fallback upgrade,
font changes and stale reply ownership are covered. Evidence:
[startup-before.json](performance-2026-10-16/startup-before.json),
[startup-after.json](performance-2026-10-16/startup-after.json).

### Reuse numeric routing snapshots when their inputs are unchanged

The numeric Wasm snapshot depends on ordered IDs, coordinates and effective
node widths. A new node object with those same values no longer invalidates it.
When a measured width is present, changing the label alone also leaves that
numeric input unchanged. Nullish measured widths still depend on the label;
in-place changes of coordinates, width, IDs, order or length remain checked.

With both factory modules bundled the same way and sharing one Rust kernel,
the final sparse routing median changed from 28.434 to 27.379 ms. Dense cases
changed by roughly 0–3%; the one-edge control changed from 0.103 to 0.111 ms.
This is a small allocation reduction, not a general large speedup. Six complete
route outputs, generator yields and Rust-call counts agree. Null/undefined,
zero/negative/non-finite width and mutable-input boundary tests pass.
Evidence: [routing-snapshot.json](performance-2026-10-16/routing-snapshot.json).

The final combined comparison replaces both routing changes with their original
`595087f` modules in the reference factory. Sparse labelled routing changes from
45.887 to 29.736 ms; small/dense/parallel labelled cases improve about 6–7%.
The unlabelled dense control is 3.8% slower (95.169 to 98.739 ms), and the
one-edge control is 0.0084 ms slower. Exact routes, yields and kernel work agree.
Use these combined results for the final source; do not multiply the isolated
speedups. Evidence: [routing-combined.json](performance-2026-10-16/routing-combined.json).

To reproduce, run `tests/benchmarks/prepare-routing-snapshot-comparison.mjs` with
`--reference-revision 595087f982a6e6c84a949a47b98e7d9458bd0d8f`,
`--all-routing-changes` and an `--output-directory`. Then pass its
`current/routing.mjs` and `reference/routing.mjs` to
`tests/benchmarks/routing-label-pairs-performance.ts --module ... --reference ...`.

### Avoid building unused selection indexes after an edit

Selection pruning now returns immediately when there is no selection, and
builds a node/edge ID index only for the selected kinds. It keeps selection
identity when all IDs remain valid, and retains the original fresh-array,
ordering and duplicate behavior when pruning removes an ID. There are no
graph-identity caches; subsequent in-place graph changes remain observable.

Two same-form, alternating paired runs measure actual `executeCommandAtom`
after store setup, including graph/history/selection/revision changes. At
1,000 nodes / 5,000 edges, empty-selection edits change from 1.176 to 0.962 ms
and from 1.149 to 0.933 ms (18–19% less); node-only edits improve 9–14%.
Mixed/select-all controls are noisy, so this is not a claim for every edit.
These are intermediate-stage isolated-pruning measurements, taken before the
final array-hook and accessor compatibility guards. Both variants used the same
optimized serializer from that stage; only the reference selection helper came
from the original commit. They are not timings of the final reviewed serializer.
Tests cover missing/duplicate/special/cross-kind IDs, array identity, mutable
graphs and deletion with Undo/Redo. Evidence:
[selection-pruning.json](performance-2026-10-16/selection-pruning.json),
[selection-pruning-control.json](performance-2026-10-16/selection-pruning-control.json).
The same comparison method is available in
`tests/benchmarks/selection-pruning-performance.mjs` with the same
`--reference-revision` plus an `--output-directory`. Running it on current source
uses the current serializer, rather than reconstructing those intermediate
bundles.

For the final combined command comparison, both the reference serializer and
selection helper come from `595087f`, with all other dependencies shared.
The actual node edit includes graph, history, selection and revision changes
after store initialization; exact outputs and selection identity agree.

| Selection, 1,000 nodes / 5,000 edges |   Before |    After |
| ------------------------------------ | -------: | -------: |
| Empty                                | 2.758 ms | 1.583 ms |
| One node                             | 2.789 ms | 1.542 ms |
| One edge                             | 2.758 ms | 1.662 ms |
| Mixed, with stale IDs                | 2.838 ms | 1.714 ms |
| All nodes and edges                  | 2.890 ms | 1.876 ms |

These are command CPU times, excluding browser storage and rendering. Do not
multiply them by the serializer or isolated-pruning speedups. Each side has
10 warmups and 25 measured actions with alternating order. Evidence:
[command-combined.json](performance-2026-10-16/command-combined.json).
Reproduce with the same helper plus `--all-command-changes`; add `--mixed-color`
for the complete palette action. Final harness and serializer-source hashes are
in [final-measurement-manifest.json](performance-2026-10-16/final-measurement-manifest.json).

## Candidates rejected after measurement

- Caching repeated force-attraction offsets preserved coordinates but regressed
  the JavaScript fallback and added Wasm code. All force/Rust/artifact changes
  from this experiment were removed.
- Deferring the first paste preview saved only about 3.3 KB gzip across the
  complete initial bundle comparison. The added loading/retry boundary and
  first-preview delay did not justify that saving; it was removed. Preview
  geometry improvements remain synchronous.
- Freezing owned routing-node arrays to bypass validation made representative
  routing slower in both Wasm and JavaScript. That experiment was removed;
  public mutable inputs continue to be checked.
- Tracking changed Cytoscape fields in a bitmask reduced setter notifications
  but added work to the unchanged majority: the same-form cached-reader control
  changed from 2.987 to 3.156 ms, with single-edge color from 4.579 to 5.335 ms.
  Keeping the original boolean fast path and checking fields only before writes
  removed that common-path regression, but bulk full-workflow controls were
  still roughly 1–4% slower. Both setter variants were removed. The retained
  deletion improvement is independent. Rejection evidence:
  [mask](performance-2026-10-16/canvas-sync-mask-rejected.json),
  [selective common edits](performance-2026-10-16/canvas-sync-selective-single.json),
  [selective bulk edits](performance-2026-10-16/canvas-sync-selective-bulk.json).
- Replacing a tiny class-list Set with array membership passed 40,000 semantic
  parity cases but did not improve the unchanged majority (4.027 to 4.201 ms).
  It was also removed. Evidence:
  [short classes](performance-2026-10-16/canvas-sync-short-classes-rejected.json).

## Verification

Follow-up review found and fixed accessor/read-order compatibility in the
serializer, with 19 new fresh-fixture regressions. The reviewed source passed
the complete 73-suite check and a Node 24.15.0 Webpack production build, CSP
generation and release validation. Logs:
[review-verification-log.txt](performance-2026-10-16/review-verification-log.txt).
A fresh English isolated-example smoke confirmed mixed color, one-step
Undo/Redo and restoration after reload:
[reviewed UI smoke](performance-2026-10-16/ui-review.md#follow-up-review-smoke).
The earlier multi-locale/mobile/large-graph evidence below retains its original
source snapshot.

- Final integrated `node scripts/toolchain.mjs run check` passed: both TypeScript
  configurations, lint, formatting, all 1,630 hook policy checks and all 73
  verification suites. The local HTTP fixture needs execution outside the
  default port sandbox; it passed in that environment. The final checks, build
  and differential-comparison output is retained in
  [verification-log.txt](performance-2026-10-16/verification-log.txt).
- Native Rust: 18 tests passed. Checked-in Wasm matches its Rust source/build.
- Final Webpack production build, CSP generation for 26 pages / 33 inline
  hashes and release verification passed. Unique modern initial JavaScript
  changed from 777,139 to 779,544 bytes; gzip changed from 243,844 to 244,048
  bytes (+204). These count entry-page script/preload references, not network
  latency. Evidence: [before](performance-2026-10-16/bundle-before.json),
  [after](performance-2026-10-16/bundle-after.json).

- The fixed Safari performance workload did not complete: WebDriver's large
  native textarea entry timed out, then Safari refused a new isolated session
  because it was still paired. Untimed preparation was changed to paste-like
  input, but reconnection remains blocked. Partial timings are not reported.
  The normal Safari application was not restarted or its browsing data touched.
  The unverified performance extension was not retained in the normal runner.
  A final retry of the unchanged normal runner at 19:02 UTC passed its 13 URL
  policy checks but could not create a Safari session for the same reason.
  Evidence: [safari-limit.json](performance-2026-10-16/safari-limit.json).
- Earlier authorized in-app browser review verified mixed-selection color/Undo/Redo,
  JSON and TikZ exports, an actual PNG preview and force/overlap layout controls.
  Japanese/English/Chinese interaction, mobile curves/deletion/Undo
  and short-viewport scrolling evidence is in
  [ui-review.md](performance-2026-10-16/ui-review.md), tied to the build before
  the follow-up serializer compatibility fixes in
  [source-manifest-before-review.json](performance-2026-10-16/source-manifest-before-review.json).
  This is expert review;
  the large-fixture timing claims are separate CPU/Worker measurements.
  That earlier UI check also generated a seeded 1,000-node/5,000-edge connected graph,
  verified the exact control counts, selected/recolored all elements with one
  Undo/Redo, then deleted and restored all elements. The isolated example and
  default viewport were restored afterward. These state transitions are not
  browser latency or throughput measurements.
- A 40-second real-Worker smoke passed 20 cycles, 64 exact reference outputs,
  two actually-started force cancellations/replays and two disposal/recreation
  cycles. It observed 42 compact routing deltas, no Worker errors, at most two
  live owners and zero after final cleanup. The initial fixture had accidentally
  exercised only full routing responses; it was corrected before this passing
  smoke. Evidence: [worker-lifecycle-smoke.json](performance-2026-10-16/worker-lifecycle-smoke.json).
- The 90-minute real-Worker low-duty lifecycle soak passed, from 17:47:33 to
  19:17:33 UTC (02:47:33–04:17:33 JST). Across 2,699 cycles, 8,637 reference
  results matched exactly, including 5,668 compact routing responses. It covered
  180 actually-started force cancellations with successor replay and 270
  pagehide disposal/recreation cycles. Worker errors: zero; maximum live
  fixture owners: two; final live owners and their recorded Wasm byte total:
  zero. Native reclamation can complete asynchronously after owner disposal.
  All recorded frozen compute/Worker, harness and asset hashes still agree;
  the serializer was outside that frozen input set. Evidence:
  [worker-lifecycle-soak.json](performance-2026-10-16/worker-lifecycle-soak.json).
  Resource diagnostics cover native Bun Workers and logical fixture ownership;
  they cannot establish browser heap/GPU behavior or the absence of leaks.
  The 180 logged checkpoints are retained in
  [worker-lifecycle-samples.json](performance-2026-10-16/worker-lifecycle-samples.json).
  After the first minute, post-GC host heap ranged from 6.73 to 7.75 MiB;
  RSS ranged from 93.98 to 252.53 MiB and finished at 244.55 MiB. RSS was not
  flat. Completed-response active Wasm probes totaled 2,424,832 bytes; these
  are not in-kernel peak measurements.
- Final serializer, combined edit/palette and overlap CPU comparisons ran
  sequentially after the soak ended, using the source and fixture identified in
  [final-measurement-manifest.json](performance-2026-10-16/final-measurement-manifest.json).
  Product and built-output identities for the reviewed source are recorded in
  [source-manifest.json](performance-2026-10-16/source-manifest.json). Earlier UI
  screenshots retain their separate before-review manifest; they do not establish
  that every interaction was repeated on a later build.
- The default Turbopack build could not bind its internal transformation port in
  this execution environment, including the escalated attempt. The official
  Webpack build succeeded for both the baseline and final source. Browser
  comparison uses those matching production builds and the normal generated CSP.

Browser interactions are an expert review. They do not establish
first-use human usability, physical touch latency, GPU completion or production
performance. No production deployment was inspected or changed.

## Reproduce the final command comparisons

Run these separately, without a concurrent build or other benchmark. Temporary
output directories contain the paired bundles, per-module hashes and results.
The reference revision must remain available in the local Git repository.

```sh
node scripts/toolchain.mjs run tests/benchmarks/selection-pruning-performance.mjs \
  --reference-revision 595087f982a6e6c84a949a47b98e7d9458bd0d8f \
  --all-command-changes --output-directory /tmp/graph-editor-command-comparison

node scripts/toolchain.mjs run tests/benchmarks/selection-pruning-performance.mjs \
  --reference-revision 595087f982a6e6c84a949a47b98e7d9458bd0d8f \
  --all-command-changes --mixed-color \
  --output-directory /tmp/graph-editor-palette-comparison
```

The first command measures the real edit atom with the original serializer and
selection helper restored only on the reference side. The second additionally
compares the original two-command palette dispatch with the production atomic
palette helper. Neither command measures DOM paint, storage I/O or browser
input latency.
