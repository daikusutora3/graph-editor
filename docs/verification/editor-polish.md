# Editor input, keyboard and drag improvements

Local verification on 2026-10-10, starting from `2e9bf40`. UI observations use
the Codex in-app browser at `http://127.0.0.1:3323/en` and the optimized static
build. This is an expert review with viewport overrides.

## Implemented behavior

- File reads carry a generation. Selecting another file, editing input,
  closing/reopening the starter or switching to samples invalidates the old
  read. Failed reads retain the existing input; selecting the same file again
  permits retry. Apply is disabled while a read is pending. Read failures and
  size limits have Japanese, English and Chinese messages.
- Before decoding, files are limited to three UTF-8 bytes per allowed UTF-16
  unit plus a BOM. Decoded text retains the existing 1M text / 2M JSON character
  limits. `File.text()` cannot be aborted; invalidated results are discarded.
- App-menu Up/Down/Home/End move focus without activating links. Panel entry
  and Tab trapping use available controls with nonnegative `tabIndex`, so a
  roving radio group contributes its selected item. Disabled, hidden, inert
  and invisible controls are excluded.
- Import previews include extrema of the actual chained quadratic curves and
  cubic self-loops, editor node-pill bounds and shortened directed endpoints.
  Endpoint normalization is independent of scale, including subpixel chords.
  Gallery cards retain fixed screen-size nodes and conservative loop space;
  directed curved cards may reserve more whitespace.
- UI regression/audit sources distinguish the pointer-only 24px range trigger
  from 44px mobile controls. Android touch profiles include the mobile user
  agent, and expect the range trigger to be hidden. Invalid-input fixtures use
  unsupported-version JSON; arbitrary free-form labels can be valid graphs.
- Rendered hitboxes reuse unchanged geometry. Node changes refresh that node
  and incident edges; edge changes refresh parallel edges. Add/remove, model,
  global style and viewport changes require full reads. Returning to selection
  mode restores edge hitboxes, and canvas disposal removes listeners.
- Interactive Worker replies replace retained routes with null markers when
  more than half are unchanged. Every reply retains the router's full key
  order, including additions/deletions, and restores against that request's
  baseline snapshot. Concurrent jobs, cancellation and Worker restart need no
  shared remote baseline. Invalid replies fall back before success diagnostics
  are recorded. Routing metadata remains immutable, as in existing callers.

## Measurements

The geometry numbers below are the historical run for this batch. A later
review found that the headless preset layout automatically fitted its 1px
viewport, collapsing zoom to `1e-50`. Geometry comparison still passed, but
movement was almost invisible in rendered coordinates. The fixture now uses
`fit: false`; use the corrected zoom=1 comparison in
[the follow-up report](editor-input-routing.md) for current performance claims.
The Worker clone comparison is independent of that viewport issue.

Reproduce the CPU benchmark with:

```bash
bun run tests/benchmarks/incremental-hitboxes.ts --output /tmp/graph-editor-incremental-hitboxes.json
```

Two separate Cytoscape instances use the installed projection and bounding-box
calculations, with deterministic font measurements and no DOM/raster renderer.
Thirty moves of one node alternate the measurement order; the first five are
warmup. Every result is compared to a full geometry read.

| Nodes / edges | Full geometry median | Incremental median | Reduction factor | Full reply clone | Delta encode/clone/restore | Reduction factor |
| ------------- | -------------------- | ------------------ | ---------------- | ---------------- | -------------------------- | ---------------- |
| 100 / 400     | 0.655 ms             | 0.251 ms           | 2.61×            | 0.231 ms         | 0.123 ms                   | 1.87×            |
| 1,000 / 5,000 | 5.591 ms             | 0.375 ms           | 14.91×           | 2.934 ms         | 0.949 ms                   | 3.09×            |

Geometry timings include moving the node and refreshing projections. Reply
timings use realistic route arrays with ten changed edges; the delta path also
includes the client's per-request shallow Map snapshot. Both full and delta
outputs are compared, including reordered keys. These are Bun CPU timings and
structured-clone measurements, not browser frame rates or pointer latency.

The incoming Worker job still contains the full graph/baseline; its clone took
5.250 ms at 5,000 edges. Response optimization reduces only the return path.
No new Rust kernel is introduced: the measured costs are renderer geometry
reads and JavaScript transport, while existing Rust routing kernels remain in
use. Avoiding a stateful Worker graph cache preserves the existing cancellation
and fallback contract.

## Observed UI coverage

- App menu at the normal 468px width: End to Keyboard shortcuts, Down to
  GitHub, Up to Keyboard shortcuts and Home to GitHub. URL remains local;
  links are not activated. Escape restores the opener.
- PNG at 1280×900: End selects Viewport; reopening focuses that selected radio.
  Tab moves to the selected White radio; Shift+Tab returns to Viewport. Home
  restores Full. Escape restores the PNG opener.
- Import at 320×900: directed 50px chord with a 180px bend, directed 0.5px
  straight chord, unsupported-version JSON, sample switching and reopening
  with empty input. Test imports are previewed without applying them.
- Path/Cycle sample cards at 320×900 render inside the scrolling gallery.
  The original 12-node/18-edge graph remains after reload. Viewport overrides
  are reset, and the editor remains English/light.

Screenshots and raw benchmark JSON are saved outside the repository in the
task's Codex visualization output directory, under `editor-polish/`. Working
screenshots are also available in `/tmp/graph-editor-ui-review`.

The screenshots are `after-polish-menu-end.jpg`,
`after-polish-selected-radio.jpg`, `after-polish-curved-preview-320.jpg`,
`after-polish-short-preview-320.jpg`, `after-polish-invalid-json-320.jpg`,
`after-polish-samples-320.jpg` and `after-polish-editor.jpg`.

## Automated verification and limits

- `bun run check`: both TypeScript configurations, lint, formatting, policy
  guard (60 permitted/rejected checks), and 37 verification suites.
- New file-read tests cover reversed completion order, edits, close/reopen,
  stale failures, retry and UTF-8/BOM/character boundaries.
- Focus tests cover selected radios, unavailable controls and non-activating
  menu arrows. SVG tests independently sample rendered paths, circles and pills
  at 160×150, including ±180px bends, loops, focus and subpixel directed chords.
- Hitbox tests compare installed Cytoscape calculations after moves, data/style
  changes, add/remove, zoom/pan, model changes and mode switching.
- Real Bun Worker and client tests cover delta order, concurrent baselines,
  late cancellation responses, malformed replies and diagnostic marks.
- `bun run build` and `bun run tests/verification/release.ts` pass with current
  Rust/Wasm assets and static output.

Safari and Playwright browser suites were not run. Native file-picker reads,
physical touch/mobile keyboards and browser drag-frame performance are not
established by this review. File-read races/errors and drag geometry use the
automated contracts above; the maintained touch profile is source coverage.
The Issue-policy hook stays enabled and unchanged.
