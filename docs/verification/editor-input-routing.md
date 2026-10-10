# Input, preview and routing follow-up

Local expert review on 2026-10-10, starting from `eb9e11e`. The optimized
static build is served at `http://127.0.0.1:3323/en` and reviewed in the Codex
in-app browser. Existing Rust/Wasm assets remain current.

## Behavior

- Switching from paste to samples focuses search after its lazy content mounts.
  It restores focus only when the removed control left focus on the document
  or panel root. A subsequent choice of Close, Back or another control wins;
  closing and disconnected content do not claim focus.
- Directed previews retain the original curve and clip its final approach at
  the target's pill boundary. De Casteljau subdivision preserves the curve's
  shape instead of rebuilding it around a shortened chord; the marker's tip
  meets that boundary. Long labels and focused pill shapes are included.
  Coincident endpoints and self-loops retain the existing loop representation.
  Curves wholly inside the target remain hidden underneath it; overlapping
  nodes are not moved apart. Editor bounds encompass the original curve,
  marker triangle and stroke; gallery padding reserves its fixed screen paint.
  Focused pills explicitly use equal `rx`/`ry` radii to match the clipping shape.
  This avoids the independent radius clamping of an implicit SVG corner
  ([SVG rectangle geometry](https://www.w3.org/TR/SVG2/shapes.html#RectElement)).
- After the user's preview observation, editor-preview strokes use the same
  graph-pixel constants as the canvas (2px node border, 2.5px edge), scaled with
  its geometry. Their visibility floors are 0.75px and 1px. The former radius
  formula made these about 2.5 times too thick; SVG arrows also inherit edge
  stroke size. Gallery strokes retain their existing style.
- Starter actions distinguish empty, reading, checking, review, ready and
  warning states in all three locales. Rejected input no longer offers
  "0 valid edges". Pending/rejected input cannot show the previously accepted
  SVG. Only ready and warning states enable Apply. File read failures retain
  the existing input and show a separate alert.
- Interactive routing sends only old moved-node positions alongside the
  current model. The Worker reconstructs current nodes followed by old moved
  positions, preserving duplicate-ID last-wins lookup and obstacle order.
  Selection uses the same unmeasured widths as the old interaction snapshot;
  final routing retains measured widths. Legacy full snapshots remain accepted.
  There is no remote graph cache or change to cancellation/restart semantics.
- The geometry reader owns identity-preserving hitbox snapshots and ID indexes.
  Partial invalidations compare only replacement entries. Changed arrays are
  copied once; no-op invalidations retain the whole array and all entries.
  Full reads reconcile geometry and rebuild indexes after topology, model,
  global style or viewport changes. The Hook no longer repeats a full reconciliation.
  Pan is committed separately so equal geometry after an opposite node movement
  still clears the old CSS translation.
- Following the user's narrow-width typography observation, the global 16px
  input override applies only to small coarse-pointer/no-hover screens.
  Mouse/keyboard windows keep 13px controls. Paste uses 13px type, 1.5 line
  height and 12px horizontal padding below a 480px editor container; wider
  editors retain 14px, 1.6 and 16px. Cards narrower than 300px use a 13px title
  and an 88px preview column, giving their descriptions more width. Touch
  control heights and the 16px touch-input override remain in place.
- The mobile selection palette uses one row of equal-width grid cells, capped
  at 44px per color and constrained by the toolbar's available width. All seven
  node colors stay together at 320px; edge palettes use six cells. Swatches
  retain their 22px visual diameter, 44px button height and radio keyboard
  behavior. Label/Delete actions can still occupy a separate row.

## CPU comparisons

```bash
bun run tests/benchmarks/hitbox-updates.ts --output /tmp/graph-editor-hitbox-updates.json
bun run tests/benchmarks/worker-routing-input.ts --output /tmp/graph-editor-worker-routing-input.json
bun run tests/benchmarks/hitbox-overlay-mount.tsx --output /tmp/graph-editor-overlay-mount.json
```

Hitbox measurements compare the complete `eb9e11e` reader plus React-state
reconciliation against the new reader, using two real Cytoscape calculation
instances. Each condition runs 60 times with ten warmup iterations; order
alternates and all 480 snapshots match in geometry and ordering. Timing does
not include assertions. Font measurement is deterministic, zoom is 1, and
there is no DOM layout, rasterization or browser frame measurement.

| 1,000 nodes / 5,000 edges   | Previous read/reconcile | Indexed snapshot | Previous including Cy update | New including Cy update |
| --------------------------- | ----------------------: | ---------------: | ---------------------------: | ----------------------: |
| Idle read                   |                 0.116ms |         <0.001ms |                      0.116ms |                <0.001ms |
| Unrelated data invalidation |                 0.184ms |          0.026ms |                      0.193ms |                 0.034ms |
| One moved node              |                 0.221ms |          0.052ms |                      0.478ms |                 0.291ms |
| 128 moved nodes             |                 2.908ms |          2.554ms |                     10.193ms |                10.101ms |

One-node preparation improved about 4.25×, or 1.65× including the Cy update.
At 100 nodes / 400 edges, one-node total changed 0.193ms to 0.182ms. Moving
all 100 nodes produced essentially no gain (6.811ms to 6.715ms total, with
the read itself slightly slower). Large-group updates still spend most of
their time recomputing Cytoscape geometry; this change does not establish a
significant speedup there. Sub-millisecond idle ratios are not FPS claims.

Worker comparisons include request preparation, structured clone and Worker
interaction restoration, excluding route calculation. Each condition has 60
equivalence checks. At 1,000 nodes / 5,000 edges:

| Moved nodes | Full interaction | Compact interaction | Reduction |
| ----------- | ---------------: | ------------------: | --------: |
| 1           |          5.188ms |             4.867ms |      6.2% |
| 128         |          5.443ms |             5.202ms |      4.4% |
| 1,000       |          5.731ms |             5.468ms |      4.6% |

The full routing graph and route baseline still cross the Worker boundary, so
input savings are modest. Existing response deltas remain in use.

The actual overlay components generate 6,000 buttons and 5,000 SVG paths at
1,000 nodes / 5,000 weighted edges. Bun SSR HTML generation took a median
33.255ms (five warmups, ten measured runs); 100/400 took 2.744ms. This is a
mount/HTML-generation assessment, not a browser commit or update measurement.
React still constructs full hitbox lists when their geometry arrays change.
Virtualization and chunked DOM updates remain unimplemented because this
measurement does not establish their browser benefit or keyboard-focus cost.
Unchanged snapshots now allow the existing memoized lists to skip that work.

### Corrected calculation fixture

The former headless preset layout fitted its 1px viewport and collapsed zoom
to `1e-50`, making position changes almost invisible in screen coordinates.
`fit: false` now gives meaningful movement at zoom 1. New tests explicitly
require changed arrays and unchanged earlier snapshots. Historical geometry
numbers in `editor-polish.md` are annotated as superseded.

The prior full-read comparison was rerun with the corrected fixture and the
current reader: at 1,000/5,000 it measured 5.195ms full versus 0.243ms
incremental, including move/refresh. This compares against a full read, while
the table above compares against the more recent incremental implementation.
These baselines must not be combined into one cumulative speedup claim.

## Verification

- Both TypeScript configurations, lint, format, the 60 policy permitted/rejected
  checks and all 38 verification suites pass. The latest build and static
  release contract pass; Rust/Wasm artifacts are current.
- SVG checks inspect actual rendered center positions, endpoints, terminal
  tangents, curve sides and markers for straight/bent, reverse, diagonal,
  subpixel, coincident and focused previews. Independent geometry checks cover
  original-curve prefixes, pill boundaries, long labels, chained curves that
  leave/reenter the target, extreme bend positions and completely hidden paths.
  Actual SVG marker vertices, sampled painted curves and stroked node extents
  are checked at multiple sizes in both variants, including focus and loops.
  An independent marker calculation finds no overflow in 972 combinations of
  variant, focus, size, chord and bend, including the previously overflowing
  0.1px chord / 48px and 50px bends.
  Preview stroke checks independently compare the canvas stylesheet to SVG
  strokes at three sizes, including visibility floors and the gallery style.
- Starter contracts use the real parser for invalid JSON, limits, ambiguity,
  partial imports, warning-only zero-edge graphs and valid empty JSON. Body
  and Footer SSR are checked in all three locales. Deferred focus uses DOM
  doubles, including later focus, closing and disconnection.
- Geometry tests compare full reads after movement, no-op data, label/style,
  zoom/pan, parallel addition/removal, reordering, model changes and mode
  switching. Previous arrays remain immutable. Equal geometry after opposite
  pan/node movement is covered; Hook pan synchronization is independently
  reviewed in source.
- Real Bun Worker tests cover compact/legacy interaction, measured-width
  selection, duplicate IDs, response deltas, concurrent requests, cancellation,
  malformed replies and restart. Independent TS/Rust fixture comparisons agree.
- In-app observations: cold and warm sample entry focus search; Tab advances
  to Category; Back returns focus to Paste. Unsupported JSON clears the old
  preview and disables "Review the input". A partial edge list offers "Apply
  after reviewing warnings" with its warning and preview. Test inputs are
  previewed without applying them to the user's graph. The browser also shows
  "Checking input…" with a disabled action and no stale SVG during a replacement,
  then restores the accepted preview and Apply action after parsing.
- Final-build previews are inspected at 320px with a 160px chord / 60px bend,
  a 20px chord / 180px bend and the 0.1px chord / 50px overflow fixture. The
  normal arrow touches its target; short curves keep their direction and paint
  stays in the frame. Overlapping input positions remain overlapping. Filtered
  DAG gallery previews are also checked after the paint-fit changes.
- Narrow typography is compared at 320px and checked at 360px and 480px.
  Screenshots use the same JSON before/after at 320px and filtered DAG sample
  cards at 320/360px.
- Selection palettes are checked with seven node colors and six edge colors at
  320px, with node colors also checked at 360px and 320×390. Colors stay in one
  row, controls remain separate from the bottom toolbar, and Tab from the
  selected color advances to Label without changing the graph. Node selection,
  mode switching and inline-label editing/cancel are exercised. Close removes
  the starter after its exit animation and restores focus to Load; Escape from
  sample search does the same. The original 12-node/18-edge graph and empty
  edit history remain intact. Viewport overrides and test selection are cleared.

Screenshots and raw JSON are saved in the task's Codex visualization output
directory under `editor-input-routing/`, with working screenshots in
`/tmp/graph-editor-ui-review`. The Issue-policy hook is enabled and unchanged.
Safari and Playwright browser execution are not used. File-picker behavior,
physical touch/keyboard and browser drag-frame performance remain outside
the observed UI coverage; the related asynchronous/data contracts are tested.
