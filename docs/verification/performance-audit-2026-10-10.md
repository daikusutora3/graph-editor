# Performance and implementation audit

Review of `d491ffcf6e6b51a0c99d04d08872f8c927d312d6` on 2026-10-10.
Product code is unchanged. Proposed optimizations below are temporary prototypes,
not improvements already shipped in the application.

The current architecture is appropriate: Rust/Wasm handles substantial numeric
work, a Worker keeps it off the UI thread, and TypeScript owns rendering, editing,
history and browser integration. The strongest next opportunities are avoiding
repeated work and clarifying ownership of transient operations.

## Recommended order

1. Deduplicate hitbox invalidation before expanding connected/parallel edges.
2. Give PNG export one owner for asynchronous selection suppression and restore.
3. Reuse known final-route collision results without penalizing sparse routing.
4. Separate editor preview paint settings from simplified gallery presentation;
   prepare shared preview geometry once. Use precise zoom for bend geometry.
5. Harden Worker response completion, then remove no-op serialization and
   redundant validation where the existing graph contract permits it.

Browser update/commit profiling should precede overlay virtualization or a
stateful Worker graph cache. These changes have larger correctness costs than
the narrow improvements above.

## Hitbox invalidation: measured improvement candidate

`adapters/cytoscape/rendered-hitbox-reader.ts:29–48` expands connected edges on a
node event, then expands the same parallel group for every subsequent edge style
event. `graph-canvas-geometry-refresh.ts:26` updates every affected element's
style. With many parallel edges, this repeats an already completed invalidation.

A temporary reader returns early while full invalidation is pending or the
element is already dirty. Add/remove and Core events still request a full read
before these shortcuts.

| Two nodes, parallel edges | Current move + refresh + read | Temporary deduplication |
| ------------------------- | ----------------------------: | ----------------------: |
| 100                       |                       2.070ms |                 1.515ms |
| 500                       |                      26.430ms |                10.113ms |
| 1,000                     |                     105.330ms |                31.309ms |

Four sizes (50, 100, 500 and 1,000 edges) ran 40 alternating comparisons each,
excluding ten warmups. All 160 geometry and order comparisons agreed. For 1,000
edges, read alone changed only 4.601ms to
4.523ms: the gain comes from invalidation, not snapshot reconciliation.

The temporary reader also passed the existing canvas-rendering suite, covering
model, width/label style, zoom/pan, hidden/select mode, parallel add/update/remove,
element reordering and node removal. Permanent integration should retain these
checks and add a targeted event-expansion count assertion.

This is a concentrated parallel-edge workload, not a general graph speedup.
After deduplication, Cytoscape projection and
`graph-canvas-geometry-refresh.ts:19` still expand parallel groups. Expanding one
representative per endpoint pair is a further candidate, but its benefit and
reverse-edge/self-loop/add/remove behavior have not been separately verified.

Evidence: `/tmp/graph-editor-audit-rendering-dedup-results.json` and
`/tmp/graph-editor-hitbox-reader-dedup.ts`.

## Routing: reuse existing Rust results selectively

`core/layout/edge-routing.ts:494`, `504` and `557` can evaluate identical final
node/curve collisions for the branch condition, initial best score and final
status. A deterministic probe found 415 exact duplicates among 1,689 collision
calls in the dense fixture, and 920 among 3,300 in the parallel fixture. Nearly
all of these repeat an operation already using Rust.

A temporary task-local cache, bounded to 1,024 entries, retained the original
work-unit charges and generator steps. Twenty alternating comparisons, excluding
five warmups, produced the following medians. All five route hashes and step
counts matched.

| Complete routing workload    |  Current | Temporary cache |
| ---------------------------- | -------: | --------------: |
| Dense, 150 nodes / 220 edges | 80.295ms |        73.013ms |
| Parallel, 100 / 300          | 51.014ms |        34.213ms |
| Quality, 40 / 55             |  1.903ms |         1.757ms |
| Sparse, 1,000 / 400          |  5.760ms |         5.963ms |
| One edge, 1,000 / 1          |  2.453ms |         2.494ms |

The last two cases had no cache hits and became slower. Prefer local reuse of a
known collision result first; enable broader reuse only when repeated lanes
justify it. Keep the cache inside one immutable routing task. Preserve mutable
public-helper behavior, strict-threshold fallback, work accounting and yields.

A current routing CPU profile placed approximately 83.2% of self samples inside
Wasm, including final collision checks and node-shape scoring. This does not
support another broad TypeScript-to-Rust migration.

Evidence: `/tmp/graph-editor-routing-duplicate-probe.ts`,
`/tmp/graph-editor-routing-collision-cache-prototype.jsonl` and
`/tmp/graph-editor-routing-collision-cache-ordinary.jsonl`.

## PNG export: asynchronous ownership and repeated encoding

`adapters/cytoscape/graph-canvas-image-export.ts:46–91` temporarily removes
selection, waits for fonts/a frame/PNG encoding, then restores selection and a
shared boolean guard. `ui/io/graph-io-screenshot.ts:254`, `320` and `399` can start
preview, copy and download exports independently. The footer disables each action
only for its own pending state.

A deterministic probe used the actual export function and actual Cytoscape
selection operations, with controllable asynchronous PNG completion:

1. Export A removes selection and begins encoding.
2. Export B starts while A is still encoding, finding no selected elements.
3. A completes, restores selection and clears the shared suppression guard.
4. B reaches its next frame and invokes PNG rendering with selection present.

Both requests specified `includeSelection: false`. Observed render invocations
had `selected: false` and then `selected: true`; the guard was also false while B
remained pending. An independent rerun agreed. This establishes a concurrency
problem in the function; actual PNG pixels and in-browser frequency were not
measured.

Serialize the renderer mutation or otherwise give concurrent exports one
selection-state owner. Consider sharing an in-flight/completed blob for the same
revision and export settings, since a ready preview currently retains only its
URL and copy/download render again. Preserve fresh snapshot keys and clipboard
user-activation requirements. Verify different export settings, failures,
unmount and selection changes during encoding.

Evidence: `/tmp/graph-editor-export-overlap-probe.ts`.

## Preview and zoom: separate presentation from geometry

`ui/samples/SampleGraphPreview.tsx:122`, `150`, `258` and `291–309` ignore
`showNodeLabels`, model colors and `arrowScale` in the editor variant. Accepted
JSON with colored nodes/edges, hidden labels and arrow scale 2 generated the same
editor SVG as the default settings; Cytoscape elements correctly retained colors
and hidden labels. This predates the most recent commit. Simplified gallery
presentation is intentional, but applying it to an imported editor preview can
misrepresent the result.

Share geometry preparation while keeping editor paint settings explicit. The
current render also builds several node indexes and clips directed curves once
for arrow bounds (`492–537`) and again for drawing (`241–252`). Routing and raw
bounds run before the 128-item React chunks begin. In the 1,000/5,000 fixture,
simple routing took 3.214ms and raw bounds 3.638ms; complete directed editor SVG
SSR took 30.433ms. These numbers identify preparation work, not browser frame
duration or a measured saving from refactoring.

Preserve focused pills, original curve prefixes, marker triangles, stroke
floors, coincident endpoints and distinct gallery/editor scaling conventions.

Separately, `canvas/GraphCanvas.tsx:702` passes integer display zoom back into bend
geometry. Actual zoom `0.0449` becomes `0.04` through `readZoomPercent`. A pure
function probe returned bow 100 using the exact zoom and 112.3 using the rounded
value for the same pointer. Both zooms are within the supported range. Read
precise zoom at the geometry event boundary; keep integer percent for display.
Actual browser dragging at this zoom was not tested.

Evidence: `/tmp/graph-editor-preview-fidelity-audit.ts` and
`/tmp/graph-editor-data-ui-audit-results-isolated.txt`.

## Worker and transaction cleanup

- `compute/worker-client.ts:81–124` removes pending state and cancellation before
  processing diagnostic fields outside its decode try block. Fault injection
  with a valid request ID/result and `kernels: null` threw from `Object.entries`,
  leaving the Promise unresolved after its timeout and abort listener were
  removed. The normal Worker supplies valid fields, so this is robustness
  coverage rather than an observed normal-response failure. Protect the whole
  response/decode/diagnostics path and settle every request on failure. Diagnostic
  marks should not precede confirmed completion.
- Compact input still copies the whole graph and route baseline. At 1,000/5,000,
  prepare + clone + restoration took 5.205–5.889ms, of which clone accounted for
  4.917–5.614ms. Rust cannot remove this transport cost. Measure real sending and
  interaction latency before introducing revision caches or transferable data;
  retain the current stateless restart/cancellation contract where possible.
- `core/graph/graph-transaction.ts:24` serializes before checking for an empty
  patch. A no-op at 1,000/5,000 took 2.376ms versus 2.499ms for one node update.
  Retain validation for external replacement input; an internal reducer that
  proves no change can return the existing validated model early.
- `core/graph/graph-validation.ts:5–25` repeats ID/order/endpoint checks already
  performed by serialization. Serializer alone took 2.338ms; the wrapper took
  2.550ms. This is a small contract-ownership cleanup, not a major speedup.

Evidence: `/tmp/graph-editor-worker-client-malformed-probe.ts`,
`/tmp/graph-editor-current-worker-routing-input-clean.json` and the data/UI
results above.

## Good implementations to retain

Immutable hitbox snapshots and ID indexes have one owner. Pan uses a layer
transform and separate commit synchronization. Stable handlers read committed
props, memoized children reuse unchanged geometry, and hidden selection controls
use Activity/inert. Chrome reads graph/revision state only for relevant panels.

Worker responses use request identity and graph revision; cancellation and
restart do not depend on a remote retained graph. The ABI copies results and
tests ownership, traps, thresholds and JS fallback. History shares unchanged
collections and reuses validated serialized output for persistence. Input
evaluation shares parsed data, file generations reject obsolete reads, and Apply
checks the current input/settings. These boundaries do not need a wholesale
rewrite.

The remaining full React list traversal is real, but the existing overlay SSR
measurement is not a browser update/commit measurement. Keyboard focus,
selection and offscreen interaction must accompany any chunking/virtualization
comparison. Likewise, initial static JS was 769,060 bytes / 240,877 gzip bytes;
additional panel loading splits are possible but were not prototyped here.

## Verification and measurement limits

`bun run check` passed both TypeScript configurations, lint, formatting, all 60
Issue-policy checks and all 38 verification suites. `bun run test:rust` passed
18 native tests. Current Wasm assets passed `bun run check:wasm`. Temporary
prototype equivalence and fault-injection results above are additional audit
evidence, not newly integrated regression tests.

Measurements used Bun 1.3.14 and installed Cytoscape 3.34.3 on the same local
machine. Final CPU runs were sequential; preliminary overlapping runs were
discarded. Calculation fixtures use real Cytoscape geometry with deterministic
font metrics. Data/UI measurements used five warmups and twenty measured runs.

No DOM layout, canvas rasterization, browser FPS, physical touch latency or
deployment performance was measured. React SSR figures exclude browser commits.
Worker clone measurements exclude scheduling and pointer-event latency. No
Safari or Playwright browser execution was used. Production deployment was not
examined; the application code remained unchanged throughout this audit.
