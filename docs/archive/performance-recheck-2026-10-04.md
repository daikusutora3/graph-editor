# Performance re-evaluation, 2026-10-04

This pass starts at `bd47f31` and repeats evaluation, implementation, measurement
and independent review after the [previous pass](performance-follow-up-2026-10-04.md).
The evaluated areas are startup work, topology/layouts, history, clipboard,
large exports and the existing editor interactions.

## Measurements

The same installed dependencies and machine were used before and after. Timing
runs were separated from builds and other benchmarks. Bun values are calculation
medians; Chromium values measure the actual static application.

| Workload                                                  |   Before |   After |
| --------------------------------------------------------- | -------: | ------: |
| DAG predicate, 1,000 isolated vertices                    | 10.13 ms | 0.16 ms |
| BFS layout, 1,000 isolated vertices                       |  4.58 ms | 0.47 ms |
| SCC analysis, 1,000 vertices / 5,000 edges                | 17.67 ms | 0.85 ms |
| DAG layout, same graph                                    | 19.63 ms | 2.68 ms |
| Undo, 1,000 vertices / 5,000 edges                        |  5.87 ms | 2.88 ms |
| Redo, same graph                                          |  5.72 ms | 2.90 ms |
| Undo with 256-character labels                            |  6.73 ms | 2.88 ms |
| Redo with 256-character labels                            |  6.52 ms | 3.37 ms |
| Paste 500 vertices / 2,500 edges                          |  2.15 ms | 1.47 ms |
| Same paste with sparse existing orders                    |  1.91 ms | 1.44 ms |
| Worst frame gap per fresh TikZ generation, median of five | 200.0 ms | 16.8 ms |

Topology uses seven measured runs; history/clipboard uses fifteen. All 18
topology and six history/clipboard output signatures match their originals.
Topology comparisons also include 100 random/reordered/disconnected/root cases
and 20 force-layout cases. An object reuse candidate for force layout showed no
gain and was removed.

The export fixture has 600 compact self-loop sources with long labels and
automatic routing. Its uninterrupted CPU calculation was 115.74 ms before,
113.17 ms after. Resumable calculation takes approximately the same work, with
a measured maximum slice of 4.02 ms for this fixture; the UI schedules steps
between animation frames. Small/limit fixtures had maximum slices of 4.46/4.71
ms. All three exact output signatures match. These are measured cooperative
slices, not hard deadlines on every graph or device.

The first sliced implementation still had a median worst frame gap of 66.7 ms.
A Chromium trace identified an 89 ms text layout. The final version lays out
large output in 50-line groups using `content-visibility`, retaining every
character in the DOM. The final five fresh-generation samples had a median worst
frame gap of 16.8 ms and a maximum of 33.4 ms (before: 216.7 ms maximum).
Each sample reloads the page to exclude completed
export cache hits; initial canvas routing settles before timing starts.

The normal/long BMP-label full-size import and transaction preparation checks
were around 2.6–3.5 ms, so their validation contract was retained. Initial modern
JavaScript changed from 224,587 to 225,059 gzip bytes, an increase of 0.21%.

## Changes and review

- Remove repeated ready-queue sorting from DAG/SCC calculations where ranks and
  cycle detection do not depend on ready-node order. Cache SCC order keys and
  barycenter scores; accumulate BFS component maxima and consume FIFO queues
  with a cursor.
- Reuse the JSON produced by restored-model validation when scheduling Undo/Redo
  saves. Preserve untouched node/edge array references for absent patch sections.
- Fill clipboard order gaps with a monotonic cursor, preserving labels, remapped
  endpoints, attributes, offsets, selection and input limits.
- Stop paste-preview parsing and parse-key serialization while hidden or showing
  samples. Keep preview work active through the closing animation and validate
  directly when Apply cannot use the current preview. Load gallery JavaScript
  when samples are requested.
- Parse the external storage document only for conflicts, memoized by raw/status.
- Generate TikZ through the existing resumable routing task, show preparation
  state, cancel superseded work and enable copy/download only for current output.
  Keep the synchronous export API and format/size restrictions.
- Render large export text and line numbers in matching groups, while retaining
  full text selection and scrolling. Memoize groups for unrelated parent updates.

Independent review also found that a prior copy result could label new output as
copied. Feedback now belongs to its text/format, and graph/format/visibility
changes, newer attempts and unmount invalidate delayed completions and timers.
Deterministic tests exercise the actual EditorChrome with canceled callbacks,
late clipboard completion, errors and real TeX expansion beyond the output limit.

Additional scrolling review caught text clipped inside the contained groups.
Text groups now use their content width with an intrinsic inline-size cache;
gutter groups retain their original width and right alignment. Desktop/mobile
browser checks verify a long Unicode line in a far group, horizontal scrolling,
width/position retention while offscreen, selection parity with a plain pre, and
matching gutter positions through the final partial group and trailing newline.

## Reproduce

Run the benchmark and browser commands in [Development](../development.md).
Before/after JSON can be supplied with `--baseline` to reject changed signatures.
Keep timing runs sequential and use the same installed dependency versions.
The browser export test uses isolated storage and a test-local clipboard stub.

## Verification

Normal/strict type checks, lint, format, the repository Issue policy check,
all 23 verification suites, static build and release verification passed.
The topology suite exhausts 512 directed three-vertex graphs against independent
reachability, including self-loops, and checks layout order/root/tie contracts.
History checks cover validation, untouched references, sparse numbering, queued
save supersession, revisions and external storage conflict handling.

The isolated React/Chromium dormant-work harness passed large valid/invalid
retained input, settings changes, paste/sample/closing/reopen transitions,
Apply fallback, conflict changes, startup failures and Retry. The export lifecycle
harness passed 33 assertions for pending actions, cancellation, current output,
copy/download, reopen, empty/error states, limits and late clipboard completion.

Application browser suites passed recovery, editing, layout, imports, bends,
range selection, live panels and 1,000-node / 5,000-edge drag → Undo → Redo →
reload persistence. Gallery search, parameter replacement, fullwidth digits/IME,
preview, clipboard, Create, persistence/Undo and mobile light/dark rendering in
Japanese, English and Chinese passed.

Production starter checks passed desktop/mobile paste → samples → paste, closing
preview, settings changes while closed, reset/reopen, focus and persisted Apply.
Network checks confirm no gallery request on initial or paste-only use, followed
by its request on sample intent. Final export checks passed exact output, format
cancellation, copy/download, reopen and the scrolling checks described above.

Final CSP checks passed all seven tested paths with no violations or console
errors. Responsive UI checks passed nine widths from 375 to 1920 px in the light
theme. Test browser contexts are isolated from user browser profiles. The
pre-existing `next-env.d.ts` change was preserved byte-for-byte.

Independent reviews finished with no remaining actionable findings in the
evaluated implementation. Measurements and browser checks cover the specified
fixtures and machine; they do not establish universal latency guarantees.
