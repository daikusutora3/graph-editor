# Performance evaluation, 2026-10-04

This evaluation starts at `610507d`, after the earlier performance passes. It
repeats measurement, implementation and independent review for input parsing,
wide-label layouts, canvas interaction targets and adjacency-matrix export.
Dependencies and graph limits are unchanged. Timing runs use the same machine
and installed runtimes and run separately from builds and other checks.

## Measurements

The input and layout values are warmed Bun calculation medians. Matrix values
are Chromium calculation medians from 15 alternating old/new runs. Canvas values
are the median of each of five fresh production pages' worst frame gap.

| Workload                                                      |   Before |    After |
| ------------------------------------------------------------- | -------: | -------: |
| Automatic input, 111,111 repeated `a: b c d` rows             | 38.72 ms |  7.81 ms |
| Automatic input, 66,666 repeated weighted adjacency rows      | 22.26 ms |  4.82 ms |
| Explicit adjacency input, 111,111 repeated rows               | 14.24 ms |  6.23 ms |
| Automatic input, 249,999 short edge-pair rows above the limit | 44.85 ms | 33.06 ms |
| Grid layout, 1,000 vertices with long labels                  | 12.84 ms |  4.85 ms |
| Shift press/release, 1,000 vertices / 5,000 edges             |  50.1 ms |  33.4 ms |
| Matrix export, 707 isolated vertices                          |  11.7 ms |   0.2 ms |
| Matrix export, 707 vertices / 5,000 directed edges            |  12.2 ms |   1.2 ms |
| Weighted matrix export, 700 vertices / 5,000 directed edges   |  11.9 ms |   1.3 ms |
| Weighted matrix export, 650 vertices / 5,000 undirected edges |  10.7 ms |   1.8 ms |
| Dense weighted matrix export, 70 vertices / 4,900 edges       |   0.8 ms |   0.7 ms |

The input benchmark has 24 exact output signatures matching the original.
An independent comparison also covered 24,012 evaluation, analysis and direct
import results with repeated, invalid, weighted, Unicode, random and limit
inputs. All 14 layout signatures match, as do 400 random clearance fixtures.
All six matrix benchmark outputs and 4,000 additional old/new matrix export
results match exactly.

The first duplicate-row implementation used a WeakSet and made 60,000 distinct
adjacency rows slower (52.64 to 59.14 ms). Re-evaluation replaced it with a fresh
scan token stored on the source-owned parsed row. The final distinct-row result
is 53.63 ms; explicit parsing is 22.48 to 22.13 ms. This removes the measured
regression while retaining the repeated-row improvement. Exact counting still
includes synchronous work, and native textarea editing is outside these parser
measurements.

The first sparse matrix implementation cost an extra 0.2 ms for the small dense
fixture. Dense graphs now retain the original direct array writes when the total
cell count is less than twice the edge count. Sparse output uses zero runs and
sorted occupied columns; output ordering, weight text and limits stay the same.

The canvas workload performs ten Shift press/release cycles per page, retaining
all 1,000 node buttons, 5,000 edge buttons and 5,000 SVG paths. Worst gaps change
from 50.0–66.7 to 33.4–33.5 ms. The one observed 51 ms long task becomes zero
tasks of at least 50 ms. An isolated React development Profiler additionally
measures modifier renders at 31.95 ms before and below its 0.1 ms timer precision
after; this is separate from production browser latency.

Production drag evaluation at the same limits, with automatic routing both
disabled and enabled, had no long tasks of at least 50 ms and about 33.4 ms
worst frame gaps. Full geometry reads remain measurable, but an additional
partial geometry cache was not justified by these workloads. Existing sliced
force layout and export preparation retain their scheduling.

Initial modern JavaScript changes from 226,850 to 227,056 gzip bytes (+0.09%).
These measurements cover the listed workloads and hardware, not universal
latency or frame-time guarantees.

## Implementation and review

- Count every adjacency row, but scan a repeated parsed row's labels and weight
  inference once per synchronous scan. Tokens do not retain options or graph
  state. Reusing a source across analysis/import and number/string weight options
  preserves counts, repeated edges and warning line numbers.
- Reuse loose edge-list token rows between automatic analysis and import. Gather
  labels directly into a Set while preserving first encounter order and index
  inference.
- Skip capsule pairs already separated vertically during layout clearance.
  Shared scale only increases, and node heights remain fixed. Preserve positions,
  numeric output and generator yield boundaries.
- Apply range-selection inactivity to the node/edge interaction layer boundaries
  with `inert`. Memoized children keep their geometry and DOM identity while
  callbacks still read the latest committed props.
- Build large sparse matrices from occupied cells and repeated zero strings;
  retain dense writes for small dense graphs. Preserve export validation and
  exact spacing and values.

Independent reviews found no remaining actionable performance or regression
findings in these changes. Layout benchmark output mismatches now return a
failing exit status. Export reopen verification waits for the current prepared
output, rather than asserting while the documented preparation state is visible.

## Verification

Both type checks, lint, formatting, the repository policy's 27 assertions, all 23
verification suites, static build and release verification passed. The existing
`next-env.d.ts` change was restored byte-for-byte after Next's build generation.

Production canvas suites passed node/SVG-stroke drags released under Shift,
Meta and Control on desktop/mobile, retained targets, focus exclusion/recovery,
pan/zoom, range filters and 1,000-vertex / 5,000-edge drag, Undo/Redo and reload
persistence. Actual preview IDs match the frozen original geometry on the same
Cytoscape graph. That original preview requires control-point containment and
excludes the fixture's curved edge, whereas native committed selection includes
it. The preview/native difference predates this change and is preserved.

Starter checks passed desktop/mobile input, format changes, sample loading on
intent, close/reopen, focus and persisted Apply. Editor checks passed recovery,
placement, fitting, bends, inline editing and keyboard movement. Responsive
checks passed nine widths from 375 to 1920 px in both themes. CSP verification
passed all seven paths without violations or console/page errors and loaded a
PNG preview.

Export rendering/long-line checks passed desktop/mobile complete DOM and native
selection, glyph widths, gutter alignment, scrolling, copy/download and fallback
paths. The actual matrix panel passed exact output, Copy, download and reopening
at 707 vertices / 5,000 edges, and disabled actions with the 708-vertex limit
warning. Exclusive TikZ generation checks retained a 16.8 ms median worst frame
gap and 33.3 ms maximum over five fresh generations.

Reproduction commands are in [Development](../development.md); save import/layout
baselines and use `--baseline` to reject changed output signatures. Browser tests
use isolated contexts and test storage/clipboard.
