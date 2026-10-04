# Performance stress evaluation, 2026-10-04

This pass starts at `0a804eb` and evaluates inputs and interactions near the
editor's existing limits. It follows the [previous evaluation](performance-recheck-2026-10-04.md).
Dependencies and graph limits are unchanged. Measurements use the same machine,
installed Bun runtime and Chromium; timing runs are sequential and separated
from builds and functional checks.

## Import

The automatic matrix path read/tokenized the input again for analysis, then
converted and scanned the numeric matrix several times. Each evaluation now
owns its parsed lines and tokens, with a lazy numeric matrix shared by analysis
and import. One numeric traversal checks finite values, symmetry, binary/weighted
values and directed/undirected edge counts. Token matching avoids redundant
trim/filter passes while retaining JavaScript whitespace and comma semantics.

Nine warmed runs per fixture give these calculation medians:

| Input                                                      |   Before |    After |
| ---------------------------------------------------------- | -------: | -------: |
| Automatic sparse matrix, 700 vertices / 979,999 characters | 41.92 ms | 11.20 ms |
| Explicit matrix, same input                                | 21.95 ms | 11.21 ms |
| Automatic weighted directed matrix, 700 vertices           | 40.49 ms | 11.75 ms |
| Automatic empty matrix, 700 vertices                       | 42.47 ms | 11.14 ms |
| Automatic edge list, 1,000 vertices / 5,000 edges          |  5.94 ms |  5.22 ms |

All 13 benchmark output signatures match the original implementation. Independent
comparison covered 15,640 complete import/analysis results across binary,
weighted, invalid, ambiguous, random and limit inputs and options. Token parity
covered all UTF-16 code units and separator combinations (66,497 cases).
Retained tests independently enumerate all 512 three-vertex binary matrices,
with directed and weighted overrides, and check the near-limit matrix.

## Paste preview

Large previews previously created all SVG edge/node children in a single React
component during a synchronous debounced update. Preview updates now use a
transition, and 128-item component boundaries let React yield while preparing
the next complete preview. The final SVG remains identical: no edges, arrows,
labels, colours or opacity layers are combined or omitted. The current input
and options are still validated directly when Apply cannot reuse that preview.

Five fresh production pages give a median worst frame gap of 60.2 ms before and
38.3 ms after. The mobile case went from 63.0 to 36.9 ms. Complete SVG markup,
with only React's generated marker ID normalized, matches the original for all
5,000 paths and 1,000 vertices. Parsing and the final browser commit/layout still
include synchronous work; transitions do not establish a deadline.

## Canvas zoom

At 1,000 vertices / 5,000 edges, browser traces attributed repeated long tasks
to the styles and positions of 6,000 empty HTML interaction buttons. Dedicated
CSS preserves sizes, mobile targets, cursors and focus feedback. Pixel
translation replaces left/top changes while pill widths continue to follow
zoom. Event handlers and SVG stroke hitboxes retain their existing behaviour.

The matched production viewport workload has 45 pan frames and 15 zoom updates.
Zoom long tasks of at least 50 ms went from 15 to zero. The maximum frame gap
went from 83.3 to 66.7 ms; the median remained 16.7 ms. In a separate matched
eight-zoom trace, the largest browser task went from 71.9 to 46.4 ms, aggregate
layout from 34.78 to 14.81 ms and aggregate paint from 139.68 to 30.12 ms.
The 100-vertex / 400-edge fixture remains at about 16.8 ms maximum frame gap.
These are measured workloads, not universal frame-time deadlines.

## Exceptionally long export lines

A compact JSON document with 1,000 vertices, 5,000 edges and 256-character CJK
labels has 1,878,044 characters on one line. Browser glyph layout alone took
about 198 ms, outside the prior multiline-export optimization. For long ASCII
and CJK lines, font measurement now advances between animation frames, then
positions bounded text groups with their measured widths. Every character stays
in the DOM and copy/download still use the exact original export string.

Ordinary JSON string values remain together at group boundaries. Unusually
long IDs are capped as well. Short/multiline output, bidi and shaping-sensitive
text (including combining and halfwidth voicing marks) retain the normal text
path. Fonts invalidate prepared widths; format/text changes and unmount cancel
pending work. A missing canvas context falls back to the original display.
Preparation can take longer overall in exchange for shorter uninterrupted work.

For the same production fixture, the first cold generation's worst frame gap
went from 216.6 to 50.1 ms. Preparation takes roughly half a second in this case;
later switches back to the prepared output have 16.7–33.3 ms worst frame gaps.
These cold values are individual samples, not a five-sample cold median. An
isolated typography comparison measured 197.6 ms for the single text node and
6.7 ms for the positioned groups, excluding the font measurement work that is
now scheduled in slices.

The new browser checks verify exact DOM and native selection, including ranges
crossing a group boundary, actual glyph widths, the last character, repeated
horizontal scrolling, raw copy/download, font changes, text/format changes,
close/reopen and all fallback paths on desktop and mobile.

## Review and verification

Independent operation, React and canvas reviews finished without remaining
actionable findings in the evaluated implementation. Both type checks, lint,
format, the repository policy check, all 23 verification suites, the static build
and release verification passed. The editor and canvas browser regressions
passed selection, zoom, focus, curves/loops, dragging, history and reload at the
graph limits. Initial modern JavaScript changed from 225,059 to 226,478 gzip
bytes (+0.63%). The pre-existing `next-env.d.ts` change is preserved.

Final CSP verification passed all seven paths without violations or console
errors, including PNG generation. Responsive audits passed nine widths from
375 to 1920 px in the light theme. The dormant-work harness and 33 export
lifecycle assertions passed, as did desktop/mobile multiline output selection,
gutter alignment and repeated horizontal scrolling. Starter checks retained
sample loading only on intent, current format/input, focus, Apply and storage.
All browser checks use isolated contexts and test-local storage/clipboard.

## Reproduce

Build, start `bun run serve:out`, then use the commands in
[Development](../development.md). Import accepts saved original modules via
`--reference` and output signatures via `--baseline`. Browser timing tests use
isolated profiles and fresh storage. Inspect calculation time, frame gaps,
long tasks and total completion time separately.
