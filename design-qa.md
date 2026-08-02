# Sample card controls — Design QA

- Source visual truth: `/var/folders/50/6xgbvsns0y57591s85h31lcm0000gn/T/codex-clipboard-3f72b88c-b27b-46e2-ab7b-4387d15eecdb.png`
- Implementation screenshot: `local-artifacts/graph-editor-card-controls/sample-card-controls-desktop.png`
- Focused implementation crop: `local-artifacts/graph-editor-card-controls/sample-card-controls-panel.png`
- Fixed-size card evidence: `local-artifacts/graph-editor-card-controls/sample-card-controls-fixed-size.png`
- Number-input focus evidence: `local-artifacts/graph-editor-card-controls/sample-card-number-input-focused.png`
- Dark-theme evidence: `local-artifacts/graph-editor-card-controls/sample-card-controls-dark-theme.png`
- Select-arrow evidence: `local-artifacts/graph-editor-card-controls/sample-card-select-arrow.png`
- Combined comparison: `local-artifacts/graph-editor-card-controls/design-comparison.png`
- Viewport: 1440 × 900 CSS px
- Density: deviceScaleFactor 1
- Source pixels: 740 × 611
- Implementation pixels: 1440 × 900; focused panel crop 680 × 608
- State: light theme, empty graph, Graph Starter open on the Sample tab

## Full-view comparison evidence

The source and implementation were placed in a single comparison image. The
implementation removes the separate shape/node-count/create form and moves the
search field to the top of the sample content. The two-column gallery,
group heading, graph previews, type hierarchy, colors, radii, and spacing tokens
remain consistent with the source. Sized samples add a clearly separated,
card-local control row. Every card now ends with the same explicit Create
action, while only resizable samples expose additional fields.

## Focused region evidence

The focused crop covers the full 680 × 608 starter panel. A second screenshot
centers Caterpillar, Grid, and Disconnected to verify that fixed-size and
resizable cards use the same footer and Create-button alignment. Labels, numeric
values, and create buttons are legible at 1× density.

## Required fidelity surfaces

- Fonts and typography: Existing app display/body families, weights, sizes, and
  line heights are preserved. New labels and buttons reuse existing section and
  control typography.
- Spacing and layout rhythm: Search and group spacing remain aligned to existing
  tokens. The added card footer uses the same horizontal padding and a divider to
  keep preview content and generation controls distinct.
- Colors and visual tokens: All backgrounds, dividers, text, focus, and primary
  action colors use existing application tokens. Cards use the surface token
  with a one-pixel divider-token border; preview frames use the deeper
  background token for separation.
- Image quality and asset fidelity: Existing `SampleGraphPreview` rendering is
  reused without raster replacement or new placeholder assets.
- Copy and content: Existing localized sample titles, subtitles, field labels,
  and create action copy are reused.

## Findings

No actionable P0, P1, or P2 visual differences remain for the selected desktop
target. The intentional difference is the requested card-local generation row,
which increases card height so fewer rows appear simultaneously.

## Primary interactions tested

- The legacy top-level sized-sample form is absent.
- All 68 sample cards expose an explicit Create button.
- Ten supported sample cards also expose local generation controls.
- Path generates 12 nodes from its card-local node-count input.
- Grid generates 30 nodes from 5 rows × 6 columns.
- Clicking a fixed-size card body does not generate a graph.
- A fixed-size Planar card generates 7 nodes from its Create button.
- Pressing a number input keeps its vertical position at 454 px and reports no
  active transform.
- On first focus, typing `12` replaces the selected default value `6`.
- A second click while editing does not reselect the value; typing `3` changes
  `12` to `123`.
- The page reported no console errors during these interactions.
- Hovering a card kept its computed background at `rgb(255, 255, 255)`.
- Card-local numeric fields use a numeric-input-mode text field, so no spinner
  buttons are rendered while digit-only entry and submit-time bounds remain.
- Card-local numeric fields compute to a white `rgb(255, 255, 255)` background
  with a one-pixel solid `rgb(229, 231, 235)` border in the light theme, and
  retain that surface through hover and press.
- The fixed-size Caterpillar footer measured 10.5 px above and 9.5 px below its
  Create button; the form and button centers differ by only the expected
  half-pixel rounding.
- The Knight graph movement select uses a custom chevron positioned 12 px from
  the right edge. Its vertical center exactly matches the select center.
- In the light theme, the first card computed to a white `rgb(255, 255, 255)`
  background with a one-pixel solid `rgb(229, 231, 235)` border.
- Switching through the live theme control changed the same card to
  `rgb(48, 48, 51)` with a `rgb(70, 70, 77)` border, preserving contrast in
  dark mode.

## Comparison history

- Pass 1: No P0/P1/P2 issues were found in the combined desktop comparison, so
  no visual correction loop was required.
- Pass 2: Fixed-size cards received the same explicit Create footer. The focused
  fixed-size-card screenshot confirmed consistent alignment and no new P0/P1/P2
  issues.
- Pass 3: Number inputs no longer translate on press and select their complete
  value only when focus first enters the field. The focus screenshot and typed
  replacement checks found no new P0/P1/P2 issues.
- Pass 4: Cards received a surface background and visible divider border, while
  preview frames moved to the deeper background token. Light and dark theme
  screenshots and computed styles found no new P0/P1/P2 issues.
- Pass 5: Card hover color changes and numeric spinners were removed. Desktop
  verification found no new P0/P1/P2 issues.
- Pass 6: Card-local numeric fields received a white surface and visible border
  that remain stable through hover and press. Focused and resting screenshots
  found no new P0/P1/P2 issues.
- Pass 7: Fixed-size card footers center their Create button vertically, while
  resizable-card controls remain bottom-aligned. Measured geometry and the
  Caterpillar/Grid screenshot found no new P0/P1/P2 issues.
- Pass 8: The card-local select replaced the edge-aligned native arrow with the
  shared custom chevron treatment. Measured geometry and the Knight graph
  screenshot found no new P0/P1/P2 issues.

## Implementation checklist

- [x] Remove the duplicate top-level generator.
- [x] Place size controls inside supported sample cards.
- [x] Give every sample card an explicit Create action.
- [x] Prevent card-body clicks from applying fixed-size samples.
- [x] Keep number inputs stationary while pressed.
- [x] Select the full numeric value on initial focus without disrupting later
      caret placement.
- [x] Give cards a white light-theme surface and visible border with a
      dark-theme-safe token fallback.
- [x] Keep card surfaces unchanged on hover.
- [x] Remove numeric spinner buttons without accepting non-digit input.
- [x] Use a bordered white surface for card-local numeric fields.
- [x] Vertically center Create buttons in fixed-size card footers.
- [x] Inset card-local select chevrons from the right edge.
- [x] Verify desktop layout and primary interactions in the dev app.
- [x] Check console output and automated verification suites.

final result: passed
