# Rust/Wasm computation

The editor keeps graph state, IDs, browser text measurement, rendering and
editing history in TypeScript. A dependency-free Rust crate performs the numeric
work in batches: force relaxation, capsule clearance, overlap resolution, curve
distance/shape scoring, final-route collision checks, batched interactive
reroute selection, curve crossings and sampled self-loop obstacles.
It also projects node capsules into an edge's frame and clusters obstacles.

Force and overlap actions, automatic routing and interactive drag routing run
in a browser Web Worker. The Worker receives an immutable graph snapshot with
measured widths, returns a command or route map, and yields between routing
stages to receive cancellation. The editor checks graph revision and request
identity before applying results. Superseded work cannot overwrite later edits.
Workers or Wasm that cannot load retain the existing sliced JavaScript path.
Force and overlap fallbacks suppress Rust only during each synchronous generator
step, so an already loaded main-window kernel cannot turn the fallback into one
long operation. Other callers retain that kernel.

Cheap arithmetic remains in JavaScript when copying it across the Wasm boundary
costs more than the calculation. React, Cytoscape and DOM/SVG drawing remain in
their existing rendering pipeline. These kernels do not remove rendering cost
or justify increasing graph limits.
Graph traversal and simple layout construction remain in TypeScript; their
substantial clearance pass uses Rust. JSON/TikZ export orchestration retains
its cooperative main-thread slices, and its routing geometry uses these kernels.

## Numeric behavior

The force loop uses the same scaled Euclidean norm in JavaScript and Rust.
Different host `hypot` implementations previously produced tiny differences
that could accumulate during 180 iterations. Canonical operations make the
two current backends agree exactly in the force verification fixtures. Some
legacy force layouts can have different final coordinates when reapplied;
existing saved positions and small-layout golden fixtures are preserved.

Overlap coordinates and routing scores allow bounded floating-point rounding
differences. Tests keep statuses, work accounting, snapped coordinates and
route choices exact. The Wasm tests include random graphs, disconnected
components, negative rounding ties, translated geometry, manual bends,
self-loops, mutation invalidation and degenerate curves.

## Build and deployment

The crate uses Rust 1.99.0 and `wasm32-unknown-unknown`, with no third-party Rust
dependencies. Install the toolchain with rustup, then run:

```sh
bun run build:wasm
bun run check:wasm
bun run build
```

The Wasm asset and its generated TypeScript manifest are checked in. Normal
application builds verify the Rust source hash, artifact hash and Wasm validity
without requiring Rust on the deployment host. Editing Rust requires rebuilding
the artifact. Rust build products under `rust/**/target` are ignored.

Cloudflare continues to serve `out` as static assets. Wasm URLs contain the
binary's content hash and receive `application/wasm` and immutable caching.
The page CSP permits Wasm compilation with `wasm-unsafe-eval`; existing inline
script hashes stay required. The module Worker is same-origin. Shared memory
and Wasm threads are not used, so no COEP configuration is required.

## Verification and measurement

```sh
bun run check
bun run benchmark:wasm
```

The aggregate suite executes actual compiled kernels and the production Worker
entry. Runtime tests cover memory growth, copied results, release after traps,
initialization errors and retries. Worker tests cover structured cloning,
measured widths, interactive reroute selection, cancellation, stale replies,
transport errors, fallback, history and Undo.

The benchmark warms each backend and includes buffer conversion, kernel calls
and command/result construction. It excludes fetching, compilation, Worker
messaging and browser painting. Measure those separately in the actual editor;
CPU speedup is not an overall interaction-speed guarantee.

### Recorded results, 2026-10-09

Warm median CPU timings on macOS arm64 with Bun 1.3.14. Layouts use seven
samples after three warmups; routing uses seven batches after warming each
scenario. Both backends run the same inputs, with conversion and allocation
included. The comparison uses the current canonical JavaScript force norm,
not the older host-specific `Math.hypot` force implementation.

| Scenario                                         | JavaScript ms | Rust/Wasm ms | Speedup |
| ------------------------------------------------ | ------------: | -----------: | ------: |
| Force, 100 vertices                              |         11.27 |         2.83 |   3.98x |
| Force, 200 vertices                              |         21.24 |        11.10 |   1.91x |
| Force, 300 vertices                              |         59.97 |        24.94 |   2.40x |
| Clearance, 1000 long labels                      |          4.41 |         2.32 |   1.90x |
| Overlap, 1000 vertices with one collision        |         16.55 |         0.73 |  22.72x |
| Overlap, 150 coincident vertices                 |         14.63 |         2.72 |   5.37x |
| Node/shape scoring, 1000 obstacles               |         0.883 |        0.344 |   2.57x |
| Curve crossings, 160 curved obstacles            |         0.094 |        0.066 |   1.44x |
| Complete quality routing, 40 vertices / 55 edges |          4.21 |         3.38 |   1.24x |

All benchmark results agreed between backends. Sampled loop cases improved
1.27–1.67x. Cheap cached label cases often lost time when sent directly to
Rust: 1000 labels with one control point took 0.0033 ms in JS and 0.0081 ms
through Wasm. Application dispatch keeps those cases in JS; four-control curves
with 20 labels improved 1.52x through Rust. Such microsecond differences should
not be interpreted as user-visible latency.

At the end of the original migration, the Wasm module was 46,314 bytes. The production static build,
aggregate verification (29 suites), native Rust tests and release packaging
checks passed. Installed Safari 26.6 passed 37 workflow scenarios, including
18 language/viewport/theme combinations. Native obstacle dragging preserved
12.70 px of rendered capsule clearance during preview and after Redo. Storage,
live positions and selection agreed through group dragging and undo/redo.

The approved Safari runner tests the production export at
`http://127.0.0.1:3323/en`, including actual Worker/Wasm completion, force
layout, overlap resolution, routing, cancellation, Undo/Redo and reload
persistence. Native obstacle dragging checks the rendered curve's clearance,
Worker completion during the preview, deferred persistence and undo/redo routes.
Recorded workflow frames include WebDriver and autosave delays; they do not
isolate animation during the kernel execution. It enforces approved paths
before opening Safari and closes the isolated WebDriver session afterward. This is an expert
review, not first-use observation by a human participant.

In the installed SafariDriver 26.6, a native Shift+ArrowDown action emitted
U+001F. The runner uses a DOM keyboard event only after detecting that malformed
event, and records the limitation. Compound modifier actions sometimes retained
native flags after release; the runner detects this and presses/releases each
modifier separately. Native pointer drags, ordinary arrows, menu navigation,
editing, history and export previews are still exercised through WebDriver.

### Follow-up: final collisions and interactive selection

The follow-up compares the remaining kernels with the same JavaScript
operation, including geometry packing, cache validation, allocation, copies,
result construction and backend selection. It also compares complete routing
against a saved source and Wasm snapshot of the previously Rust-enabled app.

Final-route collision checks use a dedicated Rust operation preserving the
original 48px pruning reach, strict 30px distance threshold, ID exclusion and
work units. Curved routes need at least 32 nodes, straight routes at least 256;
a 16-node sample must indicate sufficient nearby geometry. Small and sparse
checks retain JS. Inputs outside bounded geometry and duplicate IDs also retain
JS. Ambiguous 30px or adaptive subdivision ties return to the original JS
operation, preserving the host's exact comparisons.

Interactive selection batches up to 64 straight edges when at least 128 nodes
move and there are at least 128 edges with enough eligible settled routes.
Small drags, whole-graph moves and pending routes use JS. Strict 84px ties,
extreme coordinates and unsupported curves use the JS reference. Each batch
releases its allocations before yielding; cancellation cannot retain a live
Wasm pointer. Edge IDs retain their original insertion order.

| Same operation                                          | JavaScript ms | Rust/Wasm ms | Speedup |
| ------------------------------------------------------- | ------------: | -----------: | ------: |
| Final collisions, 50 nodes / 1 curved control           |        0.0410 |       0.0168 |   2.44x |
| Final collisions, 1000 nodes / 3 curved controls        |        2.1247 |       0.8888 |   2.39x |
| Interactive, 1000 nodes / 400 edges / 128 distant moved |        0.7393 |       0.1925 |   3.84x |
| Interactive, 1000 nodes / 400 edges / 500 distant moved |        2.6427 |       0.2874 |   9.20x |
| Interactive, 1000 nodes / 400 edges / 500 nearby moved  |        0.6465 |       0.2013 |   3.21x |

Interactive timings use real completed routing metadata, ten warmups and seven
10-run batches. The former task took 10.4056ms in the 500-distant-node case;
the 2.6427ms JS result above already includes the task's scheduling and loop
refactor. The overall 36.21x change therefore includes JS changes and must not
be attributed entirely to Rust. Tests cover full-graph moves and actual pending
metadata outside the quality gate without sending those cheap cases to Rust.

The final complete-routing comparison uses both real Wasm-enabled versions:

| Routing fixture                 | Previous Wasm-enabled app ms | Current app ms | Speedup |
| ------------------------------- | ---------------------------: | -------------: | ------: |
| Quality, 40 nodes / 55 edges    |                         3.61 |           2.58 |   1.40x |
| Sparse, 1000 nodes / 400 edges  |                       110.09 |         110.33 |   1.00x |
| Dense, 150 nodes / 220 edges    |                       273.20 |         189.90 |   1.44x |
| Parallel, 100 nodes / 300 edges |                       232.22 |         107.19 |   2.17x |
| Dense, 1000 nodes / 1 edge      |                         6.24 |           6.36 |   0.98x |

All five output hashes and generator step counts agree. Small differences in
the sparse and one-edge cases are not speedups. The JS fallback remains a
separate small function with invariant bounds computed outside its loop;
putting the Rust branch in that loop's function initially slowed sparse
routing by about 10%, and this structure removed that regression.

Holding packed node input in Wasm and skipping its validation were also tested
with alternating complete-routing runs. Holding input changed the dense case
from 245.62 to 245.47ms and the parallel case from 188.79 to 188.56ms; the sparse
case became slower. Skipping validation alone improved large fixtures by only
1–3%. These changes were not adopted because their benefit did not justify
additional memory ownership or weaker mutation checks.

Run the component comparisons with:

```sh
bun run tests/benchmarks/wasm-routing-collisions.ts
bun run tests/benchmarks/wasm-interactive-routing.ts
bun run benchmark:wasm-routing-optimizations
```

For a before/after comparison, save the old `features/`, `lib/`, `public/wasm/`
(as `wasm/`), `tsconfig.json` and a `node_modules` link before making changes.
Pass that directory as `--baseline-root` to either interactive or complete
routing benchmark. The complete comparison alternates both versions over 16
runs, discards five warmups, and requires every output hash to agree. Its 4ms
slice observations are synchronous CPU measurements, excluding message/event
loop delays and painting.

The follow-up artifact is 51,632 bytes. The 31 verification suites, six native
Rust tests, Rust formatting, artifact checks, production Turbopack build and
release packaging checks passed. Safari 26.6 passed the 37 workflow scenarios
again, with 12.70px rendered obstacle clearance during drag preview and Redo.
The first browser attempt captured provisional straight routes after the node
layout was saved. The regression runner now waits for a routing Worker mark
newer than the layout action before checking stable renderer geometry; all four
weight/direction variants passed that stronger check. No expected-curve retry
or product-side workaround was introduced. The local verification server and
isolated SafariDriver session were closed afterward. This change has not been
deployed to production.

### Further routing work: straight routes and Rust obstacle projection

The next stage starts from commit `391df6a`. It checks the straight candidate
with the existing Rust scorer before projecting obstacles or making bent
candidates. A clear straight route returns immediately. A blocked route reuses
that first evaluation, preserving candidate order, work units and generator
boundaries instead of scoring it twice.

Obstacle projection, stable sorting and clustering now have a Rust operation.
The host supplies its chord length and both direction norms. The capsule
boundary still uses all 24 reference bisections, but compares squared distance
to 576, avoiding repeated norm divisions and square roots. Comparisons within
`1e-10` of 576 use the original JS operation; this is a wider ambiguity guard
than a `1e-12` distance comparison at 24px. Extent, clamp, perpendicular-distance
and cluster-merge boundaries also retain JS for ambiguous values.

Within one kernel call, identical half-width bit patterns reuse their two
capsule extents. A lazy cache holds at most 16 widths; additional distinct
widths are calculated normally. Circles need no capsule search. This cache
never survives a call or a generator yield. The host's coordinate, ID, label
and measured-width mutation validation remains active.

Graphs with fewer than 64 nodes use JS projection. All-circle inputs with fewer
than 256 nodes also use JS, because their arithmetic does not consistently
amortize copying. Duplicate IDs, unsafe coordinates and ambiguous boundaries
retain the original projection algorithm.

The final component benchmark uses premeasured widths, matching the production
routing task. Both backends alternate over 12 passes of 50 calls, with five
warm passes and seven measured medians. Every pass requires identical ordered
cluster output. Packing, cache validation, allocation, copies and cleanup are
included; rows selecting JS for both backends make no Rust speedup claim.

| Projected obstacles with mixed wide nodes | JavaScript ms | Rust/Wasm ms | Speedup |
| ----------------------------------------- | ------------: | -----------: | ------: |
| 64 nodes                                  |        0.0383 |       0.0065 |   5.85x |
| 100 nodes                                 |        0.0716 |       0.0163 |   4.40x |
| 300 nodes                                 |        0.1828 |       0.0218 |   8.40x |
| 1000 nodes                                |        0.6399 |       0.0559 |  11.45x |

The complete-routing comparison against `391df6a` uses each version's own
real Wasm artifact and alternates 16 passes, discarding five warm passes:

| Routing fixture                 | Previous app ms | Current app ms | Speedup |
| ------------------------------- | --------------: | -------------: | ------: |
| Quality, 40 nodes / 55 edges    |           16.47 |          14.80 |   1.11x |
| Sparse, 1000 nodes / 400 edges  |          443.28 |          34.25 |  12.94x |
| Dense, 150 nodes / 220 edges    |          914.93 |         894.51 |   1.02x |
| Parallel, 100 nodes / 300 edges |          533.56 |         518.13 |   1.03x |
| Dense, 1000 nodes / 1 edge      |           28.50 |          28.30 |   1.01x |

All five route hashes and generator step counts agree. Background desktop
activity increased absolute durations during this final run. An earlier
isolated straight-only comparison measured the sparse fixture at 121.59 to
7.34ms (16.56x); the final gain includes skipping work in TypeScript and must
not be attributed entirely to the new Rust projection. Dense and parallel
whole-task timings show little additional improvement despite the component
gain. These synchronous measurements still exclude Worker messaging and
browser painting.

Run the new component comparison with:

```sh
bun run tests/benchmarks/wasm-projected-obstacles.ts
```

The projection suite covers 110 fixtures, including 72 actual Rust results and
38 JS selections/fallbacks. Ordered clusters match the frozen JS reference
exactly. Tests include cache capacity and repeated widths, in-place mutation,
translated geometry, strict boundaries and the measured wide-capsule fixture
used by Safari. The new artifact is 61,635 bytes.

The final source passed all 32 application verification suites, 10 native Rust
tests, both TypeScript checks, lint, formatting and all 46 repository policy
self-tests. The production static build and release/header checks also passed.

The first isolated Safari run passed all six Rust workflow scenarios, including
the new 64-node measured-capsule route: its rendered minimum gap was 25.09px,
and reloading preserved its route and saved model. Native dragging, Undo/Redo,
Worker cancellation, layout and overlap resolution also passed. The later,
existing four-node multi-selection test timed out after its Green palette
click; no click-event evidence was captured on that attempt. That fixture has
automatic routing disabled and does not exercise the changed calculations.
The runner now records the native palette events and correctly releases Shift
after its existing SafariDriver keyboard fallback.

Three further attempts stopped at varying canvas-readiness waits. Diagnostics
confirmed `visibilityState: hidden` with a completed Rust routing mark while
rendering remained pending. Switching the same isolated WebDriver window did
not prevent that condition. The full 38-scenario Safari review therefore has
not completed for this change; the six-scenario Rust pass is recorded separately
in `/tmp/graph-editor-safari-review-phase3-first-attempt/rust-compute-results.json`.
All runs checked the 13 allowed/rejected URL cases before opening their isolated
sessions, and closed their sessions afterward. This is an expert review, with
no first-time human participant or native file-download verification.

Cloudflare configuration is unchanged. At this verification stage, the
additional work had not been committed, pushed or deployed.

### Remaining Rust candidates: source and CPU audit

This investigation uses the current `37fc95279bee9c61` artifact and the working
tree containing the straight-route/projection changes above. It does not apply
another product-code rewrite. CPU benchmarks run sequentially on macOS arm64,
Bun 1.3.14, with the real Wasm module loaded before the data/layout/export
benchmarks. Browser painting, Worker transport, download and compilation costs
are excluded. The results below are current costs, not measured speedups for
proposed implementations.

The existing complete-routing benchmark, profiled across its five workloads and
16 passes, collected 4,313 CPU samples. Wasm functions account for 3,965 samples
(91.93% of self time). Candidate node/shape scoring and final-route collision
checks dominate. Consequently, moving the remaining host code to Rust has
limited room to improve those dense workloads. Optimizing the existing
`routing_node_shape` and `routing_node_collisions` operations is the first
performance investigation to pursue. Piece-level distance pruning and reducing
repeated norm calculations are experiments, not established improvements; route
choices, strict threshold fallbacks and work accounting must still agree.

| Remaining area                                                   |  Current measurement | Assessment                                                                           |
| ---------------------------------------------------------------- | -------------------: | ------------------------------------------------------------------------------------ |
| 128 loops at one wide source, long labels, no surrounding nodes  |              14.94ms | Conditional Rust batch candidate after JS preparation improvements                   |
| Same 128 loops with 64 surrounding nodes                         |              45.75ms | Heavy obstacle work already uses Rust; batching the remaining layout stages may help |
| 600 compact wide vertices, one loop per vertex, TikZ             |             972.47ms | Routing dominates; optimize loop processing rather than TeX string generation        |
| 700 × 700 numeric matrix import                                  |        11.07–11.96ms | Conditional ASCII scanner candidate; compare a JS streaming reader first             |
| DAG predicate / SCC / BFS, 1000 vertices and 5000 edges          | 1.05 / 0.74 / 0.94ms | Low priority; little absolute time available to save                                 |
| DAG layout, same graph                                           |               2.43ms | Low priority; substantial node clearance already uses Rust                           |
| Undo/Redo, same graph                                            |          2.71–3.11ms | Retain TypeScript and native JSON processing                                         |
| JSON / edge or adjacency-list import, same limits                |   2.68 / 4.01–4.60ms | Retain TypeScript; strings and graph objects dominate the interface                  |
| One manual-bend pointer event, wide endpoints, numeric work only |             0.0030ms | Too little arithmetic to justify another Wasm boundary                               |
| 5000 SVG hitbox path strings, excluding getter/React/DOM work    |               1.14ms | Low priority; formatting and browser-side data still remain                          |

**Self-loop layout.** Thirty-six fixtures compare the current Rust and JS
backends, alternating seven passes and retaining five measured medians. All
ordered route hashes agree. Wide-source/long-label groups of 32, 64 and 128 loops
with no surrounding obstacles take 1.90, 4.94 and 14.94ms. The relevant obstacle
kernel does not dispatch in these one-node cases. With 64 surrounding nodes,
the existing Rust path takes 10.40, 22.13 and 45.75ms. These are different
workloads; changing labels or adding nodes is not a before/after speedup test.

A separate 1,396-sample profile of the 128-loop one-node case attributes 21.9%
self time to repeated cached label-size reads, 21.0% to generator resumption,
and 19.9% to pill-boundary search (27.8% inclusive). Label-overlap arithmetic
itself is about 0.3%. Even absent labels produce 201,725 generator steps. The
next comparison should therefore precompute label sizes, reuse pill extents for
equal shape/direction inputs and avoid unnecessary pair-level scheduling before
testing a Rust batch of layout size/anchor/pair work. A batch must retain bounded
cancellation intervals and the original status/score/work-budget behavior. The
existing 4ms slicing of 128 loops with 64 obstacles takes 70.28ms in total, with
a maximum observed slice of about 4.014ms; total latency and uninterrupted CPU
time are distinct measurements.

The 600-vertex TikZ case has a loop at each separate vertex. A second profile
uses exactly the export's `simple` mode, rather than mixing it with `quality`
routing, and collects 7,738 samples. Routing is 95.21% inclusive; the existing
`routing_loop_obstacles` Wasm operation is 51.84% self time, and generator
resumption is 16.94%. The TikZ generator itself is 0.14% self time. Moving TeX
formatting to Rust would not address the dominant cost. This case also supports
investigating existing loop-kernel arithmetic and how numerical work is batched.

**Numeric matrix import.** A 700 × 700 sparse matrix contains 490,000 cells and
979,999 ASCII characters, inside the 1,000,000-character plain-input limit.
`io/import-source.ts` creates token strings and numeric rows and checks symmetry;
`io/import-adjacency.ts` then visits every cell again to create nonzero edges.
A useful Rust experiment would scan text once and return nonzero edges plus
matrix statistics. Converting all cells to JS numbers first and sending a dense
f64 buffer adds 3.92MB of copying while retaining token creation. Any fast path
must preserve supported JS numeric forms, Unicode separators, comments and
format detection, or explicitly use the existing fallback. This import runs
after a 150ms preview debounce and reuses its matching result for Apply, so the
11–12ms CPU cost is not a per-frame operation.

An automatic-detection case with 60,000 distinct adjacency rows takes 52.85ms,
but it has 60,001 labels and 60,000 edges and returns a graph-limit error. It is
a stress input, not a supported graph. Earlier limit handling and Worker-based
evaluation are alternatives to language migration for such cases.

**Lower priorities.** Topology traversal is linear and already short at graph
limits. `ui/panels/LayoutsPanel.tsx` caches predicates by graph identity, so a
cache keyed by topology could avoid repeating them after position-only changes.
Range selection, viewport and hitbox updates mainly obtain Cytoscape geometry
or update React/DOM/SVG state; moving small comparisons to Wasm would retain
those costs and add packing/ID reconstruction. The measured manual-bend event
costs about 0.00053ms for circular endpoints and 0.0030ms for 192px endpoints.
These last measurements isolate numeric/string construction and do not claim
to reproduce complete browser interactions.

Candidate-curve batching and persistent Wasm node input have lower priority in
light of the earlier input-retention results above and the current CPU profile.
Single-control label scoring already selects JS because direct Wasm calls were
slower. `scoreCurveCrossings` and `scoreCurveInstability` have no current product
callers, so further optimizing them would not improve this app's active path.

Evidence is saved under `/tmp/graph-editor-rust-audit/` for the complete-routing
profile, `/tmp/graph-editor-rust-loop-candidates.jsonl` and
`/tmp/graph-editor-loop-candidates-120.md` for loop measurements/profiling, and
`/tmp/graph-editor-rust-candidate-data-{topology,history,tikz,import}.json` for
existing data benchmarks. The matched TikZ profile is
`/tmp/graph-editor-rust-candidate-data-tikz-matched.cpuprofile`. Temporary audit
scripts initialize the current module before importing the existing benchmark;
the preexisting application sources and Rust artifact are preserved.

### Additional measured improvements

The follow-up implements three changes: prepared distances in the existing Rust
curve kernels, reusable self-loop preparation in TypeScript, and an ASCII
integer adjacency-matrix scanner in Rust. The saved pre-change source under
`/tmp/graph-editor-rust-phase4-baseline` uses its own real
`37fc95279bee9c61` module; the final module is `b0f4c21baceed2ce`, 64,832 bytes.
CPU measurements below run sequentially on macOS arm64 and Bun 1.3.14. They
exclude browser painting, Worker messaging and initial Wasm loading.

**Curve distances.** Each adaptive line segment prepares its differences,
denominator and bounds once. A conservative L-infinity bound skips distances
that cannot change the result, with a scale-dependent rounding guard. Circular
nodes avoid calculating the same spine endpoint twice. The original arithmetic
and near-threshold fallback flags remain intact. Eight component comparisons
measure 2.54–2.92x gains with matching output hashes; those timings deliberately
exclude ABI allocation and copies.

The complete-routing comparison alternates 16 passes and discards five warmup
passes. Every ordered route hash and generator step count matches:

| Routing fixture                 | Before ms | After ms | Speedup |
| ------------------------------- | --------: | -------: | ------: |
| Quality, 40 nodes / 55 edges    |     2.663 |    1.783 |   1.49x |
| Sparse, 1000 nodes / 400 edges  |     6.682 |    6.663 |   1.00x |
| Dense, 150 nodes / 220 edges    |   187.363 |   79.701 |   2.35x |
| Parallel, 100 nodes / 300 edges |   115.275 |   50.525 |   2.28x |
| Dense, 1000 nodes / 1 edge      |     6.572 |    2.584 |   2.54x |

Dense and parallel median maximum 4ms slices fall from 4.119/4.093ms to
4.032/4.029ms. These are observed cooperative scheduling durations, not hard
real-time bounds. The sparse case already skips most distance work and shows
little further gain. Native reference tests compare floating-point bits for
144 curve fixtures, large translations, non-finite/overflow inputs, threshold
bands and adaptive splitting ties. The JS comparison covers 134 cases, including
112 actual Rust results.

**Self-loop preparation.** Group-local arrays reuse label sizes, label points
and route references. An at-most-1024-entry cache reuses exact-angle capsule
extents and invalidates when measured source width changes. Provisional results
still return before preparation. Helpers without a label cache retain fresh
label reads while suspended. Every yield and work counter is preserved.

| Wide source, labeled loops | Before ms | After ms | Speedup |
| -------------------------- | --------: | -------: | ------: |
| 32, no obstacles           |     2.832 |    2.104 |   1.35x |
| 64, no obstacles           |     7.053 |    4.587 |   1.54x |
| 128, no obstacles          |    22.038 |   15.698 |   1.40x |
| 128, 64 obstacles          |    78.240 |   67.489 |   1.16x |

All ten complete-routing loop cases match routes and step counts. Thirty-four
verification fixtures also match fixed hashes recorded from the previous
implementation, including the full work/yield trace, width and label changes,
manual routes and cache-free helpers. A Rust batch of capsule extents was tried
and removed: the final JS preparation was about 2–27% faster than that extra
Wasm boundary. Existing Rust loop-obstacle scoring remains in use.

**Integer matrix input.** For 128–1000 normalized rows, the scanner accepts the
ASCII safe-integer subset and returns row-major nonzero entries, symmetry and
exact edge counts. It keeps at most 10,000 entries, enough for every valid
5000-edge symmetric graph, while counting all cells for limit warnings. The
host packs raw text into the existing allocation ABI; it does not create and
copy a dense JS number matrix. Decimal, exponent, hex, Unicode and unsupported
integer syntax retain the original Number reader and dense edge-generation path.
Cheap syntax checks avoid scanning a long integer prefix before decimal fallback.

Twelve passes alternate previous, current-JS and current-loaded backends, with
five warmup passes discarded. The comparison includes format detection, graph
creation and warnings; all 21 full evaluation hashes match:

| Matrix input, automatic detection   | Before ms | After ms | Speedup |
| ----------------------------------- | --------: | -------: | ------: |
| Sparse 128 × 128                    |     0.426 |    0.186 |   2.29x |
| Sparse 700 × 700                    |    10.677 |    2.811 |   3.80x |
| Weighted directed 700 × 700         |    10.694 |    3.328 |   3.21x |
| Decimal 300 × 300, JS fallback      |     3.539 |    3.527 |   1.00x |
| Late decimal 700 × 700, JS fallback |    10.125 |    9.574 |   1.06x |

Explicit matrix selection shows 2.94–3.63x gains at 700 rows. Matrix verification
covers 34 fixtures, nine Rust selections, all other Number syntaxes, Unicode,
shape errors, comments, unloaded Wasm and an exact 5000-edge symmetric boundary.
A JS streaming reader was also measured but rejected after decimal-input
regressions. A large paste starts loading the kernel during the existing 150ms
debounce, including on a fresh empty canvas; unloaded or failed Wasm keeps the
synchronous JS fallback. Successful scans leave one input-free performance mark
for browser verification.

The final code passes all 34 application verification suites, 16 native Rust
tests, both TypeScript checks, lint, formatting, 46 repository policy checks,
the production static build and release/header checks. The initial sandboxed
build recorded a port-denial error in Turbopack's generated cache; preserving
that cache in `/tmp/graph-editor-rust-phase4-turbopack-cache` and rebuilding with
local port permission resolved it.

Safari expert review passes six scenarios on the final production build: the
128-row matrix's real Rust preview, Apply, Undo/Redo and persistence; Force
layout; superseded-layout cancellation; overlap resolution; ten loops; and the
new measured wide source with 32 labeled loops and reload. Its routes and saved
model are unchanged after reload. The matrix was entered with a textarea value
setter and input event, not a native clipboard paste. The first attempt stopped
when a Layout click did not open the panel. A bounded retry that checks the
panel's actual state allowed the next run to reach all six scenarios.

That run then timed out in the existing native obstacle-drag scenario: the
three-node canvas was ready and visible, but unfocused; the obstacle had not
moved and no new routing completion mark was present. No input-event trace was
captured, so this does not establish the reason for the failed drag. The final
64-node projected obstacle and the full 40-scenario review have therefore not
passed on this artifact. Partial evidence is recorded in
`/tmp/graph-editor-safari-review/rust-compute-progress.json`; the first attempt
is preserved under `/tmp/graph-editor-safari-review-phase4-first-attempt`.
Both runs passed 13 allowed/rejected URL checks before opening an isolated
session and closed their sessions afterward. No first-time human participant
or native download was verified.

Reproduce the comparisons against a saved pre-change checkout with its own Wasm:

```sh
bun run benchmark:wasm-routing-distances --baseline-root /path/to/before
bun run benchmark:wasm-routing-optimizations --baseline-root /path/to/before
bun run benchmark:loop-preparation --baseline-root /path/to/before
bun run benchmark:wasm-import --baseline-root /path/to/before
```

Final matrix results are recorded in
`/tmp/graph-editor-rust-phase4-import-final.jsonl`, and loop results in
`/tmp/graph-editor-rust-phase4-loop-preparation.json`. Cloudflare configuration
is unchanged. Production deployment is outside this local performance
verification.
