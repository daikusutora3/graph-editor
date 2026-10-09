# Rust/Wasm computation

The editor keeps graph state, IDs, browser text measurement, rendering and
editing history in TypeScript. A dependency-free Rust crate performs the numeric
work in batches: force relaxation, capsule clearance, overlap resolution, curve
distance/shape scoring, final-route collision checks, batched interactive
reroute selection, curve crossings and sampled self-loop obstacles.

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
