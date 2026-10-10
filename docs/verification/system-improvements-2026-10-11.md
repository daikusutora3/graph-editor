# System improvements

This document preserves the earlier implementation record. Publication and the
subsequent audit fixes are tracked in
[the system audit](system-audit-2026-10-11.md) and
[audit improvements](system-audit-improvements-2026-10-11.md).

Implemented on 2026-10-10–11, starting from
`b1f94643fd4a3ee9e4281b91e9bdf405d863c006`. This report covers the eight findings
accepted in the system review. It records local verification before commit and
push; production deployment has not been verified.

## Changes and regression evidence

| Finding                                                              | Result                                                                                                                                                                                                               | Verification                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Comment markers in string weights are truncated on text re-import    | Text exports reject weights containing `#` or `//` and use the existing JSON guidance. JSON and TikZ retain those values.                                                                                            | `io-contracts`: comment markers, safe Unicode/single slash round trips, JSON/TikZ.                                                                                                                                                                     |
| Mixed node/edge Cut loses independently selected edges               | Clipboard contents combine internal edges of selected nodes with explicitly selected edges. Paste maps copied node endpoints and retains existing unselected endpoints.                                              | `history-clipboard`: mixed Copy/Cut/Paste, boundary edges, attributes, Undo/Redo, edge-only use, missing endpoints and parallel-edge constraints, through actual Jotai actions.                                                                        |
| Concurrent PNG requests share temporary selection state              | One FIFO owner serializes renderer mutation and PNG encoding. It reapplies selection policy immediately before capture and restores the latest selection/draft refs. A failed request does not block later requests. | New `image-export` suite uses real Cytoscape selection operations with controlled font, frame and PNG completion: three concurrent requests, failures, edits before capture/during encoding, destruction, Core replacement and restoration exceptions. |
| Local static preview can expose files outside `out/`                 | Listener binds to `127.0.0.1`; decoded request paths and canonical file paths must stay inside the export. Traversal, exterior symlinks and invalid URI input are rejected.                                          | New `static-preview-server` suite makes real loopback requests against disposable fixtures; also verifies clean routes, MIME/cache/security headers, 404, HEAD and method rejection.                                                                   |
| Editor preview ignores paint settings                                | Editor SVG uses node/edge/arrow colors, `showNodeLabels`, and `arrowScale`, including node width and arrow paint bounds.                                                                                             | `sample-preview`: all eight colors compared against the Canvas stylesheet; 360 additional SVG fit cases, marker references and unchanged Gallery output. IAB comparisons described below.                                                              |
| Parallel-edge events repeatedly expand already-dirty groups          | Full invalidation and existing dirty IDs skip expansion; structural events retain precedence.                                                                                                                        | `canvas-rendering`: actual Cytoscape events, expansion counts and geometry equivalence with full reads, including reverse edges, self-loops and structural changes.                                                                                    |
| Malformed Worker diagnostics can orphan a Promise                    | Keep pending requests until response processing completes. Invalid responses settle all pending work with the existing fallback; optional performance-mark failures do not invalidate valid results.                 | `wasm-worker`: eight fault cases covering response/result/diagnostics, performance marks, cleanup and message decoding, plus existing cancellation/retry/restart behavior.                                                                             |
| Git hooks and validation entry points are inconsistent; CI is absent | `commit-msg` uses the same pinned launcher as the other hooks; three READMEs and development instructions agree. A push/PR workflow installs pinned Node/Bun/Rust and runs `check:all`.                              | `toolchain`: all three hooks run with Bun absent from the hook PATH, preserving arguments. CI YAML parsed; local `check:all` passed. Remote execution and deployment integration remain unverified.                                                    |

The PNG owner deliberately does not cache blobs by graph revision. Revision
alone does not represent transient renderer geometry during dragging, so such a
cache could return an old image. Preview/copy/save retain their individual
options and asynchronous APIs.

For 1,000 parallel edges with 1,000 style events while a full read is already
pending, expansion visits fell from 1,000,000 to zero in the same deterministic
probe. After a snapshot, a dirty group expands once (1,000 visits). These are
work counts, not browser FPS or latency measurements.

## Local checks

- `node scripts/toolchain.mjs run check:all`: both TypeScript checks, Oxlint,
  Prettier, 60 policy cases, all 41 verification suites, 18 native Rust tests,
  current Wasm artifact, static production build and release assertions passed.
- The additional PNG await-boundary and restoration-exception tests passed
  separately after that integrated run; the final code-check run includes them.
- The local preview was rebuilt and its server restarted so CSP hashes match
  the current HTML. It serves only `http://127.0.0.1:3324`.

## In-app browser review

Used the permitted local IAB tab at `/en`, with 320 × 720 and 1280 × 900
viewports. Safari and standalone browser runners were not used.

1. Before the build, a three-node JSON fixture with red/blue/green nodes,
   colored edges, hidden labels, arrow scale 2 and a self-loop rendered with
   default paint and visible labels in Load preview.
2. The same fixture after the build rendered the colors, hidden labels and
   larger arrows at both widths. The dark-theme preview also retained the
   expected colors and fit. Applying and reloading retained model settings.
3. Text export showed the JSON guidance and disabled copy/save for `tag#1`
   and `path//end`. Switching to Save for editing produced enabled JSON output
   containing both original weights and all settings.
4. PNG Full/Viewport/Full changes finished with the expected preview dimensions
   and rendered image. The selected node remained selected on the main canvas,
   while the PNG preview excluded its selection highlight.
5. A separate node plus an independent edge could be selected together with
   Shift-click. The IAB keyboard-chord calls produced no Cut state change, so
   browser Cut/Paste acceptance is **not confirmed**. The actual Jotai
   Cut/Paste/Undo/Redo regression suite passed; keyboard dispatch remains a
   limitation of this browser review, not a claimed browser pass.

Screenshots are local review artifacts under `/tmp/graph-editor-ui-review/`:
`before-320-system-preview.jpg`, `after-320-system-preview.jpg`,
`after-1280-system-preview.jpg`, `after-1280-system-preview-dark.jpg`,
`after-1280-system-text-export.jpg`, `after-1280-system-png.jpg`, and
`after-1280-system-mixed-selection.jpg`.

## Publication boundary

At the time of the initial verification above, the new GitHub workflow had not
run remotely. Its subsequent failure is covered by the follow-up below. GitHub
required-check rules and Cloudflare dashboard settings have not been inspected
or changed. See
[Development](../development.md#continuous-verification-and-release-connection) for
connecting successful checks to publication. A workflow file and a local pass
do not establish an active production deployment gate.

## Follow-up audit improvements (2026-10-11)

Starting from `f59e0480f2708f2ac636ed0ad30476bfc1c6a90a`, this follow-up addresses
all accepted findings from the review of the initial implementation.

| Area                         | Improvement and evidence                                                                                                                                                                                                                                                                                                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Collision boundary test      | Replace a host-dependent fixed expectation at the 30px boundary with the JavaScript reference result computed on the same host. Keep Rust dispatch, null fallback and the 256-work-unit assertion. This addresses the failure in [the first remote CI run](https://github.com/daikusutora3/graph-editor/actions/runs/38062424085); a new Ubuntu CI run is pending publication.                                                 |
| Adjacency import             | Share target/weight parsing with import analysis. Parenthesized string weights such as `tag:1` and `a->b` round-trip while malformed targets and parentheses remain rejected. Separate the 5,000 actual-edge limit from a 10,000-entry budget, allowing 5,000 undirected edges exported in both directions. Tests cover auto/explicit imports, directed overflow, repeated-entry overflow and warnings in all three languages. |
| PNG cancellation and cleanup | Abort stale preview work and font/frame/image-decode waits; revoke temporary and retained Object URLs on failure or unmount and close bitmaps in `finally`. Reopening a canceled preview retries. Copy/Save remain independent of preview cancellation. Encoding already inside Cytoscape cannot be canceled, so the exclusive renderer owner remains held until encoding finishes and selection is restored.                  |
| Edge bending                 | Read precise Cytoscape zoom in the pointer gesture instead of the rounded display value. The actual pointer-handler test at zoom `0.0449` produces bow 100 rather than the former 112.3.                                                                                                                                                                                                                                       |
| Parallel-edge geometry       | Expand each unordered endpoint pair once per refresh while preserving reverse edges, loops and structural changes. Actual Cytoscape tests compare the affected collection, geometry and order with the prior behavior.                                                                                                                                                                                                         |
| Local redirects              | Apply all 11 current `out/_redirects` rules before assets, preserving query strings and existing containment/header checks. Pure Request fixtures test all 22 GET/HEAD aliases, destination CSP, precedence and boundaries. The preview intentionally implements the current exact local rules rather than the full Cloudflare redirect language.                                                                              |
| Undo retention               | Combine the existing 150-transaction cap with a 32MiB estimated patch-retention budget, trimming oldest transactions and retaining the newest even if it alone exceeds the budget. Cached transaction costs avoid re-walking history. Small edits still retain 150 entries on large graphs; large replacement, Undo/Redo and branching tests pass.                                                                             |
| Preview calculations         | Prepare node indexes, widths, curve segments and editor clipping once and share them between bounds and SVG rendering. Keep gallery sizing and editor model sizing distinct. All 35 before/after SVG cases matched; four representative SVG fixtures and the existing fit/paint cases guard rendering.                                                                                                                         |
| Routing calculations         | Reuse collision counts from the initial and winning candidate evaluations within a routing task. No cross-task cache is added. Regression tests independently recompute final status; the five-node/four-parallel-edge fixture performs 36 scans instead of 44.                                                                                                                                                                |
| Worker result validation     | Validate result shapes and finite numeric fields for routing, layout and overlap jobs before accepting success. Malformed responses settle all pending requests through the existing fallback and clean up the Worker. Eleven malformed-result cases and three valid empty-graph cases pass. Only explicit `null` route deltas retain previous routing.                                                                        |

### Performance evidence

Same-machine Bun 1.4.2 measurements, five warm-ups and 15 iterations, report
medians. The benchmark uses real Cytoscape projections and the current Wasm
kernel with deterministic font metrics; it does not measure DOM rendering,
rasterization or browser FPS.

| Workload                       |   Before |    After |
| ------------------------------ | -------: | -------: |
| Geometry, 100 parallel edges   |  1.544ms |  1.334ms |
| Geometry, 500 parallel edges   |  9.863ms |  6.167ms |
| Geometry, 1,000 parallel edges | 24.603ms | 10.268ms |
| Dense Wasm routing             | 92.179ms | 88.158ms |
| Parallel Wasm routing          | 56.174ms | 48.310ms |
| Sparse JavaScript routing      |  1.403ms |  1.500ms |
| Sparse Wasm routing            |  0.381ms |  0.374ms |

All nine workload output hashes matched their before versions. Dense/parallel
Wasm collision calls decreased from 1,592/3,196 to 1,313/2,636. Sparse results
do not show a universal latency improvement. Reproduce with
`tests/benchmarks/geometry-routing-performance.ts`, using its documented
`--output` and `--baseline` options. Captured results are
`/tmp/graph-editor-geometry-routing-before-2026-10-11.json` and
`/tmp/graph-editor-geometry-routing-after-2026-10-11.json`.

For 260 nodes and 259 directed editor edges, preview preparation reduces index
construction from three to one, width calculations from 1,298 to 260, curve
segment calculations from 777 to 259, and clipping calculations from 518 to 259. These are work counts; no browser preview timing is claimed. SVG equality
results are in `/private/tmp/graph-editor-preview-equality-result.json`.

A separate Bun history fixture applies 50 distinct valid JSON replacements,
each with 1,000 nodes, 5,000 edges and 256-character labels/string weights.
Retained history decreases from 50 to three transactions, and post-GC heap
decreases from 120.50MB to 10.74MB. These are whole-process heap measurements
from separate before/after runs, not a browser memory measurement or an exact
heap cap. The 32MiB budget estimates retained patch cost and allows a single
oversized latest transaction. Captured results are
`/tmp/graph-editor-history-memory-comparison-before-2026-10-11.json` and
`/tmp/graph-editor-history-memory-comparison-after-2026-10-11.json`.

### Follow-up verification

- `node scripts/toolchain.mjs run check:all` passed both TypeScript checks,
  Oxlint with warnings denied, Prettier, 60 policy tests, all 43 verification
  suites, 18 native Rust tests, the current Wasm artifact check, static
  production build and release assertions. The integrated log is
  `/tmp/graph-editor-system-followup-check-all-2026-10-11.log`.
- The real screenshot hook lifecycle suite covers unmounts, stale revisions,
  canceled decode, failed decode, reopen/retry, Strict Mode replay and an
  explicit download completing after unmount without late UI state updates.
  Additional independent probes cover Copy after unmount, bitmap/toBlob
  cancellation cleanup and reopening an already-ready preview.
- The policy hook remains enabled and unchanged. Browser verification used
  only the authorized in-app tab at `http://127.0.0.1:3324/en`; Safari and
  standalone browser runners were not used.
- The current production build was served again with matching CSP. At 320 ×
  720 and 1280 × 900, the PNG and Load previews retained colored nodes/edges,
  hidden labels, enlarged arrows and a self-loop, without overflow. PNG
  Full/Viewport/Full changes and close/reopen completed; the observed final
  image sizes were 1919 × 1641 and 1328 × 948 respectively.
- Loading and exporting an adjacency fixture retained both `tag:1` and
  `a->b`. Actual editor Undo/Redo restored the corresponding previous/next
  graphs. The original graph was restored, the viewport reset, and reloading
  confirmed its persisted settings. This is an expert browser review; the
  fractional-zoom bend gesture and 5,000-edge import are covered by code
  regression tests rather than claimed browser interactions.

Follow-up screenshots under `/tmp/graph-editor-ui-review/`:
`after-320-followup-png.png`, `after-1280-followup-png.png`,
`after-1280-followup-adjacency.png`, `after-1280-followup-load.png`, and
`after-320-followup-load.png`.

The follow-up is not committed or pushed at the time of this record. A remote
Ubuntu CI rerun and production deployment remain unverified. No Cloudflare
dashboard configuration or GitHub Issue state was changed.
