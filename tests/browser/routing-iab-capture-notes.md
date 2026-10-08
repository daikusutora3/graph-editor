The fixed Before/After matrix is `routing-iab-manifest.json` (49 primary scenes,
plus ten boundary photographs). `routing-iab-report-helper.mjs` saves artifacts
only; it contains no browser API or hidden state inspection. Browser interaction
remains in the authorized root CUA context and the existing local IAB tab.

For each graph scene, import `scene.graph` directly through the actual Load JSON
form. The recorded run did not import `emptyInputText` between scenes: graph
replacement preserves the same mounted canvas. Wait for the Load dialog to
close, a true `data-canvas-ready` attribute, and expected node and edge HTML
hitbox counts. Obtain a DOM snapshot after each UI action batch. Do not evaluate
mutations of Cytoscape or localStorage.

The root helper's `view150` clicks Fit graph to view, Reset zoom to 100%, and
Zoom in five times. It runs before the frozen actions for modes starting with
`ui-`, and again afterward unless capture timing is immediate. The 120% scene
then clicks Zoom out three times from 150%. Native-auto-fit scenes click Fit
before actions; native-import scenes have no forced viewport operation after
Apply. Their actual view can change with corrected geometry. `restore` imports
the original scene graph through the same Load form; `import` uses the action
graph. `layout` and `offset` operate the Layout panel and wait for it to close.
`native-zoom-out` uses the specified number of native Zoom out clicks.

Sample-preview scenes open the actual sample picker, search `sampleKind`, and
capture its visible card. Sample-applied scenes submit that card with default
parameters, undirected/unweighted settings, and offset enabled. For After,
submit the current sample UI again; do not import the Before coordinates.

Capture native JPEG pixels before DOM bounds inspection. Verify the raster
shows the intended graph separately from DOM geometry. Pass DOM-derived ready,
counts, hitbox rectangles, and optional SVG path attributes to `saveScene` with
`validatedDOM: true`. Cytoscape label bounds APIs are not used in IAB. Do not
call visibility/focus/rAF: those APIs are absent in the DOM facade.

The recorded boundary photographs were interleaved immediately after their
primary scene. Keep each no-selection primary JPEG, then collect
center/left/right/top/bottom JPEGs through actual pointer input. `saveBoundary`
merges these ten child photos and records observed selection/edit state without
claiming editing when no editor opens. Reuse the same Before pointer coordinates
for After. The two short-label After right/bottom photos were recaptured after
native accessibility observation showed selection, followed by a native
screenshot; the resulting blue edge was visually checked.

The report is `primary_complete` after 49 primary photos and `complete` after
all ten boundary photos. All 59 Before photographs were required before any
After capture. Recorded entries retain declared frozen conditions and DOM
measurements; their `actualActions` fields are empty. Conditions and helper
source document the intended replay, but they are not a per-entry executed-action
trace. Any additional manual replay steps must be described separately rather
than inferred from those empty arrays.

The original graph was preserved from the 3323 IAB origin at
`/tmp/graph-editor-routing-comparison/iab/preserved-graph.json`. After used the
dedicated worktree at origin 3324, whose browser storage is separate. Do not
restore a 3324 graph to the concurrently used 3323 origin. Source provenance and
capture-time dirty-tree limitations are retained with the comparison artifacts.
Safari photos remain separate supplementary evidence and cannot substitute for
an IAB Before/After scene. The native PNG Save/download and supplemental
Tree→Line→Tree, mixed-manual, and same-ID route transition photographs are also
separate from the fixed 59 pairs.
