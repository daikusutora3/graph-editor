# Responsive editor UI review

Local expert review on 2026-10-10, starting from `915dcaf`. Browser verification
uses the Codex in-app browser at `http://127.0.0.1:3323/en` with explicit viewport
overrides. Screenshots are saved locally in `/tmp/graph-editor-ui-review`.
This is a viewport review, not a physical-device or participant study.

## Changes

- Below 375 px, the mobile toolbar uses two rows so Select, its range selector,
  Node, Edge, Undo, Redo and Menu retain separate usable targets. Select and the
  range selector share matching heights and adjoining corners. The pointer-only
  range trigger stays 24 px wide in narrow windows, with Select's content inset
  adjusted to balance the joined background rather than crowd the left edge.
- Selection controls, empty-state padding and toast placement reserve room for
  the actual toolbar height. Long selection summaries truncate visually while
  preserving the full accessible name.
- Inline label inputs clamp horizontally to the canvas with 16 px margins.
  Long text scrolls inside the input; shortening it restores its graph anchor.
- Popovers align with the control that opened them and clamp to the editor
  bounds. The mobile app menu opens under its brand button. Other mobile panels
  keep their bottom-sheet behavior. Open panels recalculate after resizing;
  the mobile Menu uses the Settings anchor when resized to desktop.
- PNG scope/background settings wrap according to available panel width. Size
  options and preset labels remain readable instead of truncating or overlapping.
- Import candidates stack on narrow screens. Export-purpose labels and the
  import warning action wrap within their buttons. Sample generation settings
  wrap, and input previews account for long node-pill widths.
- Layout tooltips wrap and align to the outside columns; expanded panel triggers
  suppress the tooltip that would appear behind their panel.

## Observed coverage

| Surface                | In-app browser observations                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Toolbar and range menu | 320, 375 and 468 px balanced joined Select background; mode switching and range selection; 320 px dark theme       |
| App menu               | 320 px popover below brand; opening keyboard shortcuts                                                             |
| Layout and settings    | 320 px combined menu, scrolling to lower settings; Japanese and Chinese labels; 768 and 1280 px anchored panels    |
| Resize while open      | Combined Menu from 320 to 768 px; Layout from 768 to 1280 px                                                       |
| PNG                    | 320 px Full/Fit, Fixed canvas inputs, Viewport/Clear preview; 320 × 390 px scrolling with footer visible           |
| Export                 | 320 px edge list, JSON and TikZ; purpose labels and save/copy footer                                               |
| Import                 | Empty input, ambiguous tree/weighted-parent input, invalid JSON, long Latin/CJK labels in the preview              |
| Samples                | 320 px generation settings, normal card, four-parameter Knight card, parameter normalization and no search results |
| Canvas actions         | Node/edge selection bars, long selection summary, node/edge context menus and inline editing                       |
| Empty canvas           | 320 × 900 px and 320 × 390 px, including scrolling to start actions                                                |
| Keyboard shortcuts     | 320 px top and bottom of the scrolling list; PNG Escape closes and restores opener focus                           |

The layout sweep also covers 390, 480, 640, 767 and 960 px. The 640 px case uses
a 390 px height. Main editor chrome was checked again against the static
production build. Test edits were undone; the original 12-node/18-edge graph
survived reload. Language and theme were restored to English/light.

The review does not simulate storage quota/conflict failures, renderer failures,
clipboard permission failures, a native file chooser or a physical mobile
keyboard. Existing model/release verification covers its corresponding data
contracts. The observations above use the in-app browser.

## Validation

- `bun run check`: both TypeScript configurations, lint, formatting, Issue-policy
  guard and 34 verification suites.
- `bun run build`: current Rust/Wasm assets and optimized static Next.js output.
- `bun run tests/verification/release.ts`.

The Issue-policy hook remains enabled. Its extra allowlist permits fixed in-app
browser viewport dimensions, API documentation and local screenshot paths;
arbitrary page scripts, other origins and Issue writes remain blocked.
