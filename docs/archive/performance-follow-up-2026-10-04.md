# Follow-up performance evaluation, 2026-10-04

This pass evaluated the current editor at `6e506f0`, then repeated improvements,
measurements and independent reviews. It builds on the earlier
[performance evaluation](performance-2026-10-04.md).

## Measurements

Before and after used the same installed dependencies and machine. Timing runs
were separated from builds and other benchmarks. Values below are medians.

| Workload                                            |   Before |    After | Evidence                                     |
| --------------------------------------------------- | -------: | -------: | -------------------------------------------- |
| Edit one sample parameter with all 79 cards visited |  3.70 ms |  0.70 ms | Chromium, React development Profiler         |
| Cards rendered by that edit                         |       79 |        1 | Instrumentation in temporary benchmark build |
| Cards rendered by an external graph edit            |       79 |        0 | Local generation settings snapshot retained  |
| Overlap check, separated 1,000-node grid            | 21.52 ms | 0.409 ms | Bun calculation, identical output signature  |
| Overlap check, separated 1,000-node line            | 21.81 ms | 2.643 ms | Bun calculation, identical output signature  |
| Resolve one collision in 1,000-node grid            | 27.59 ms | 15.36 ms | Bun calculation, identical output signature  |
| Small range preview, 1,000 nodes / 5,000 edges      | 37.85 ms |  1.85 ms | Chromium, real Cytoscape geometry            |
| Enclosing range preview, same graph                 | 38.25 ms |  4.90 ms | Same canvas and selected preview IDs         |

The gallery timing measures React work with every card marked visible. Its
harness does not load production CSS or measure complete input latency. Card
render counts directly verify that an unrelated card no longer rerenders.
Actual application browser checks cover layout and interaction separately.

Range timings exclude preview class application and paint. The measured maximum
after the change was 2.5 ms for a small box and 6.2 ms for an enclosing box. Node
only filtering remained around 0.4 ms. These are local measurements, not universal
latency guarantees.

The initial overlap comparison showed small differences in dense cases. An
alternating repeat after warm-up measured coincident 150 nodes at
15.12 → 14.90 ms and wide-label 150 nodes at 14.70 → 14.30 ms, with no material
regression. Resumable collision calculations retained approximately 4 ms slices.
Force layouts still perform their deterministic calculation in slices; this pass
does not change their output or approximate their forces.

Initial modern JavaScript changed from 224,285 to 224,587 gzip bytes (0.13%). This
pass targets operation cost; it does not reduce the initial download size.

## Changes and repeated review

- Memoize sample cards and use shared stable callbacks. Read gallery generation
  settings once when it opens, preserving the existing local snapshot behavior.
- Check separated graphs before overlap relaxation. Nonmoving checks sort by Y
  and skip vertically distant pairs, while collision resolution retains its
  original stable pair order and numerical output.
- Reject outside edge endpoints before requesting control or segment points
  during range preview. Each frame still reads current geometry.

The first range change made small selections faster but left enclosing boxes
around 36 ms. Re-evaluation traced this to Cytoscape's rendered plural getters
calling `.map()` on unavailable segment/control data, producing exceptions for
thousands of edges. A second implementation uses guarded model getters and the
installed renderer's exact zoom/pan transformation. It still reads all endpoint
and model geometry for an enclosing box; it avoids those unavailable rendered
getter exceptions. Geometry is never cached across preview frames.

Independent review also corrected the benchmark counters to distinguish model
getters from rendered getters. Equivalence coverage includes finite-point
filtering, coercion, sparse arrays, malformed-point failures, boundaries, curves,
self-loops, segment paths, all selection filters, and live translated/scaled
viewports. Overlap checks cover 18 permanent original-output fixtures plus 200
randomized comparisons. Reviews ended with no remaining actionable findings in
the implementation.

## Reproduce

Run benchmarks separately, using the runners described in
[Development](../development.md):

```bash
bun tests/benchmarks/overlap-performance.ts --output /tmp/overlaps.json
bun tests/benchmarks/run-sample-gallery.mjs --output /tmp/gallery.json
bun tests/benchmarks/run-range-selection.mjs --output /tmp/range.json
```

The gallery runner accepts `--gallery-source` for the original component. The
overlap runner accepts `--reference` for the original module with imports rebased
to the same checkout. Range comparison uses its frozen original implementation.
Benchmark instrumentation never enters the application bundle.

## Verification

The normal and strict type checks, lint, formatting, repository policy check,
all 21 verification suites, static build, and release verification passed.

All three actual application browser suites passed against the final static
build:

- Editor recovery, placement, import, layouts, drag, bends, range selection,
  inline labels, keyboard editing, and Undo.
- Gallery search, parameter replacement, fullwidth input and IME, previews,
  generation settings, clipboard, Create, persistence, Undo, and mobile rendering
  in Japanese, English and Chinese with light/dark themes.
- Canvas pan and hitboxes, range previews for all/nodes/edges with curves and
  loops, pointer cleanup, live panels, PNG reopening, and 1,000-node / 5,000-edge
  drag → Undo → Redo → reload persistence. Range fixtures are validated with the
  graph serializer before seeding browser storage.

CSP checks passed across all seven tested paths, with no violations or console
errors. Responsive UI checks passed at nine widths from 375 to 1920 px in the
light theme. Browser storage uses isolated test contexts, without modifying user
browser profiles. Independent reviews ended with no remaining actionable findings in
the evaluated changes; these checks do not prove universal performance on every
device or graph configuration.
