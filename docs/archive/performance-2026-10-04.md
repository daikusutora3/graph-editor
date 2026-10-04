# Performance evaluation, 2026-10-04

This investigation repeated measurement, implementation and independent review
for graph editing, routing, chrome subscriptions and PNG preview work. Existing
sample-gallery changes were retained in the shared checkout.

## Measurements

Before and after runs used the same fixtures and installed dependencies on the
same Mac. Timing runs were separated from builds. Times are medians unless
specified otherwise.

| Workload                                                 |                 Before |     After | Evidence                                            |
| -------------------------------------------------------- | ---------------------: | --------: | --------------------------------------------------- |
| Select one node and edge, 1,000 nodes / 5,000 edges      |                9.25 ms |   5.15 ms | Chromium, React development Profiler                |
| 600 self-loop sources, 90 px grid                        |              660.30 ms |   7.78 ms | Bun routing computation                             |
| 600 self-loop sources, coincident nodes                  |              668.82 ms |   1.77 ms | Bun routing computation                             |
| 600 self-loop sources, compact long labels               |              676.78 ms | 102.86 ms | Bun routing computation                             |
| Drag 500 nodes alongside 400 settled edges, short labels |               87.41 ms |  22.53 ms | Headless Cytoscape, total routing task              |
| Same drag with long obstacle labels                      |              942.98 ms |  26.09 ms | Headless Cytoscape, total routing task              |
| Long-label drag's first generator step                   |              942.70 ms |   0.19 ms | Same interactive workload                           |
| Long-label drag's maximum 4 ms slice                     |              972.47 ms |   4.28 ms | Same interactive workload                           |
| Idle chrome subscriptions over 100 committed moves       | 100 notifications each |         0 | Graph, revision, history and settings subscriptions |
| Storage status notifications for 100 queued edits        |                    100 |         1 | Latest queued document still saved intact           |
| Unchanged PNG reopening                                  |    2 redundant exports |         0 | Actual browser, instrumented Cytoscape PNG calls    |

Core routing output signatures matched before and after for all measured
fixtures. Additional equivalence checks covered dense obstacles, clearance
boundaries, translated coordinates, fractional loop directions, old and new
drag positions, long pill labels and curved metadata. Independent adapter
comparison covered 160 fixtures.

These are local measurements, not universal latency guarantees. React Profiler
results exclude Cytoscape paint and end-to-end input latency. Bun and headless
Cytoscape timings measure calculation work. The first generator step and maximum
slice expose pauses that a total or average can hide. Compact loop routing still
takes about 103 ms in total; the browser runs it in slices of about 4 ms.
Initial modern JavaScript was 223,683 → 224,232 gzip bytes; this investigation
targeted editing work rather than download size.

## Changes and review findings

- Separate SVG path reconciliation from selection-dependent label buttons.
- Keep translated hitbox SVG paths visible inside the outer canvas clip. A
  regression reproduced an edge appearing after pan but having no clickable
  stroke before this fix.
- Subscribe chrome and hints to the values they display, and read event-only
  state when the handler runs. Graph-dependent panels stay live while visible
  and during their closing animation.
- Retain identical storage status snapshots without duplicate notifications.
- Prune loop obstacles that cannot contribute a score, reuse sample geometry,
  and yield between direction candidates. Rounded fractional direction behavior
  was retained after a review finding.
- Yield during drag obstacle classification and width preparation, reuse curve
  subdivision, and reject remote obstacles before expensive distance checks.
- Wait for active PNG preview inputs to finish debouncing before export. A
  second review found dormant revision inputs generating duplicate images on
  reopening; the browser regression counts calls to detect this.

## Verification

The verification runners are documented in [Development](../development.md).
The relevant commands are:

```bash
bun run check
bun run build && bun tests/verification/release.ts
bun tests/benchmarks/run-canvas-hitboxes.mjs --output /tmp/canvas.json
bun tests/benchmarks/routing-performance.ts --output /tmp/routing.json
bun tests/benchmarks/interactive-routing-performance.ts --output /tmp/drag.json
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/editor-regressions.ts
BASE_URL=http://127.0.0.1:3123/en bun tests/browser/canvas-performance-regressions.ts
BASE_URL=http://127.0.0.1:3123 bun run audit:csp
BASE_URL=http://127.0.0.1:3123 bun run audit:ui
THEME=dark BASE_URL=http://127.0.0.1:3123 bun run audit:ui
```

The canvas performance browser regression exercises panning, stroke selection,
modifier keys, Settings/Export updates, PNG reopening with and without edits,
and drag → Undo → Redo → reload at the supported 1,000-node / 5,000-edge limits.
Its browser storage is isolated from the user's browser profile.

All 19 verification suites, normal and strict typechecks, lint, formatting,
repository policy checks, the static build and release verification passed.
Both browser regression suites and CSP checks passed. The responsive audit
reported no findings at nine widths from 375 to 1920 px in both themes.
Independent reviews ended with no remaining actionable findings in the evaluated
performance changes.
