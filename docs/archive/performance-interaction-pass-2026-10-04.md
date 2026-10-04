# Performance interaction evaluation, 2026-10-04

This pass follows the [stress evaluation](performance-stress-pass-2026-10-04.md)
in the same checkout at `0a804eb`. It preserves those uncommitted changes and
evaluates additional large-line-count inputs, actual mode switches, gallery
updates and PNG previews. Dependencies, graph limits and input formats are
unchanged. Calculation and browser timing runs use the same installed Bun and
Chromium on the same machine, without concurrent builds or other timing work.

## Inputs with many lines

The importer previously allocated objects for empty/comment lines, eagerly
tokenized every row even when a candidate could be rejected from its header,
and rescanned repeated adjacency rows for analysis and import. Line scanning now
retains only nonempty content with its original line number. Each evaluation owns
lazy first-row/full-row tokens and a bounded adjacency-row cache shared by
analysis and import. Adjacency validation and model construction retain their
separate semantics, encounter order, warnings and limits.

Nine warmed runs per fixture give these calculation medians:

| Input                                                                  |    Before |    After |
| ---------------------------------------------------------------------- | --------: | -------: |
| Valid adjacency input, `a:` repeated 333,333 times, 999,999 characters | 172.14 ms | 23.22 ms |
| Comment-only input, 499,999 lines                                      |  57.43 ms |  7.89 ms |
| Blank input, 999,999 newline characters                                | 121.20 ms | 14.26 ms |
| Invalid one-token rows, 499,999 lines                                  |  57.92 ms | 12.48 ms |
| Edge list above the edge limit, 249,999 lines                          |  57.72 ms | 45.88 ms |

The valid repeated-row case first improved to about 162 ms, then 77 ms; further
evaluation identified the repeated adjacency scans that remained. The final
implementation gives the 23.22 ms median. Exact-count validation still includes
synchronous work; the above-limit edge-list maximum was 51.96 ms. Calculation
timings do not include native textarea editing or establish a response deadline.

All 19 benchmark output signatures match the pre-pass implementation. Independent
comparisons covered 76,867 line-scanning cases, 42,078 complete evaluation cases,
42,078 standalone analysis cases and 32,000 direct adjacency import cases.
Coverage includes UTF-16 code units, separators, random input, format overrides,
invalid syntax, warning/count boundaries and graph ordering. The prior large
matrix optimization remains in place: automatic 700-vertex input measured
11.72 ms in this pass.

Production Starter checks passed on desktop and mobile for the near-limit comment
and repeated-row inputs, including invalid feedback, current preview, explicit
format, Apply, storage, reload, replacement input and close/reopen. Real trusted
clipboard paste also applied and saved the 333,333-row graph correctly.

Extremely high line counts still incur native textarea cost. A trusted paste of
499,999 comment lines took about 2.72 seconds to become ready, with a 2.22-second
worst frame gap; 333,333 valid repeated rows took about 1.82 seconds, with a
1.44-second worst frame gap. Browser traces attribute most of this work to native
editing, internal layout/style objects and subsequent paint, rather than the
import parser. No further JS/React fix preserving the existing editing, caret,
selection and undo behaviour was identified. These inputs do not have a
frame-time guarantee. Playwright's `fill` stalled for over 60 seconds on the same
extreme comment fixture; the real clipboard-paste path did not reproduce that
stall. Functional checks use isolated profiles and storage.

## Mode switching

At 1,000 vertices and 5,000 edges with automatic routing disabled, returning
from Edge to Select recreated thousands of interaction elements. The selection
overlay now uses [React Activity](https://react.dev/reference/react/Activity) to
retain its DOM while hidden and suspend its effects. It is hidden/inert outside
Select; dormant edge geometry is retained until needed. Live geometry is refreshed
before the first visible paint. Node drag and edge bend cancellation release
transient state and pointer capture when the mode changes.

Retaining the DOM alone left roughly 100 ms frame gaps. Browser traces then
identified another cause: clearing a nonexistent `edge-source` class on every
Cytoscape node invalidated node and connected-edge styles. Class removal now
touches only nodes that actually have that class.

Five fresh production pages per version, using real keyboard and toolbar events,
give these medians of each interaction's worst frame gap:

| Interaction                        |   Before |   After |
| ---------------------------------- | -------: | ------: |
| Return to Select with the keyboard | 183.3 ms | 33.4 ms |
| Return to Select with the toolbar  | 116.7 ms | 33.3 ms |
| Enter Edge with the keyboard       |  16.7 ms | 16.7 ms |
| Enter Edge with the toolbar        |  33.4 ms | 33.3 ms |

The 11 long tasks of at least 50 ms on Select return become zero. All 20 measured
mode changes have zero such tasks. Two keyboard returns have 50.0 ms frame gaps;
frame gaps and browser long-task duration are different measurements. Every
fixture retains all 1,000 vertices, 5,000 edges, interaction targets and SVG
paths. Rapid switching, Tab focus, focus feedback and runtime errors are checked.

Desktop/mobile regression checks additionally cover hidden focus exclusion,
retained DOM identity, no dormant edge geometry reads, pan/zoom/graph changes,
node-drag and edge-bend cancellation, delayed pointer-up, source highlights,
Undo/Redo and reload persistence.

## Other evaluated interactions

Paste-format and large-sample index/weight changes were measured on five fresh
desktop pages and one mobile page: 108 operations, no long tasks of at least
50 ms and no runtime errors. Worst frame gaps for desktop operations were
31.5 ms (paste format), 29.4 ms (sample index) and 30.0 ms (sample weights).

All 79 gallery previews were visited with real scrolling, then index, weight and
direction were changed 72 times across desktop/mobile and default/large-sample
conditions. Default previews contain 628 vertices and 973 edges; selecting the
largest random DAG raises the gallery totals to 1,616 and 5,955. There were no
long tasks of at least 50 ms or runtime errors. Worst frame gaps were 26.6 ms
for default desktop, 24.7 ms for default mobile and 43.4 ms for the large desktop
case. One large mobile sample had a 53.8 ms frame gap; the remaining samples
were 31.1–39.4 ms. No additional implementation change was justified by these
workloads.

## PNG previews

Fixed-size Full previews previously regenerated on every canvas zoom even though
the exported pixels stayed identical. With 100 vertices and 400 edges, opening
the preview and performing four zoom changes generated five PNGs. Full previews
now exclude viewport-only inputs from their key and subscription, reducing this
workload to one PNG. Save continues to export the current graph independently.

Evaluation also found existing preview correctness gaps. Viewport previews did
not change after panning or resizing, and Natural/Fixed canvas previews missed
zoom changes within the same rounded percentage, such as 0.500 to 0.504.
Changing only display pixel density also left those previews stale while Save
used the new density. Each case was reproduced by comparing captured preview
Blob bytes with a real downloaded PNG in an isolated production browser.

Natural and Fixed canvas now subscribe to precise zoom and pixel density.
Viewport also includes pan and canvas dimensions. Stable primitive snapshots
suppress notifications when those values are unchanged; hidden preview panes
do not generate images. Resolution media queries are rebound after a density
change, so moving between displays does not require a CSS-size change. Full
previews remain independent of pan, zoom and pixel density. No production CSP
rule is relaxed to inspect preview blobs in the tests.

The resolution listener follows the [browser API's documented monitoring
pattern](https://developer.mozilla.org/en-US/docs/Web/API/Window/devicePixelRatio#monitoring_screen_resolution_or_zoom_level_changes).
CDP's density-only override changed `devicePixelRatio` and media-query matches
without sending resize or resolution-change events in the installed headless
browser. The density tests therefore deliver the missing standard event to the
application's real media-query listener. PNG pixels and downloaded files use the
actual overridden density. This verifies the update contract and output; it does
not establish a physical-monitor handoff. Production polling was not added for
this emulation limitation.

## Review and verification

Independent IO, React and canvas reviews finished without additional actionable
implementation findings. Both type checks, lint, formatting, the repository
policy check and all 23 verification suites passed, as did the static build and
release verification. The pre-existing `next-env.d.ts` change is preserved.

The latest production editor regressions passed recovery/retry, placement,
selection, labels, keyboard editing, history and fitting. Canvas mode and existing
canvas regressions passed on desktop/mobile. Starter stress and complete SVG
preview checks passed current input, format replacement, cancellation, Apply and
persistence, with exact original SVG hashes at 1,000 vertices/5,000 edges.

The latest viewport benchmark retained a 16.7 ms median frame gap at both graph
sizes, with no pan/zoom long tasks of at least 50 ms or runtime errors. One
matched run at the graph limits had a 50.0 ms worst pan gap and 50.1 ms worst zoom
gap. The extra snapshot notification work showed no material regression; these
single-run maximum values are not an additional speedup claim.

CSP verification passed all seven paths with no violations or console/page
errors and confirmed a loaded PNG image. Responsive audits passed all nine
widths from 375 to 1920 px in both light and dark themes. Initial modern JavaScript
is 226,850 gzip bytes, up from this pass's 226,478-byte starting build (+0.16%).
Browser tests use isolated profiles, test storage and the headless browser's
memory clipboard; they do not alter the user's macOS clipboard.

The retained PNG regression passed on desktop/mobile for all four scopes:
unnecessary Full exports, exact fractional zoom, pan, viewport resize, repeated
density changes, hidden/reopened previews and exact saved bytes. Export counts
confirm that unchanged inputs do not create a regeneration loop. The independent
five-case scale proof also confirms the updated dimensions and matching download
hashes.

## Reproduce

Build and start `bun run serve:out`, restarting the server after each rebuild so
its CSP hashes match the HTML. See [Development](../development.md) for the
import, mode, viewport and browser regression commands. Run timing workloads
sequentially; use isolated browser contexts for functional tests.
