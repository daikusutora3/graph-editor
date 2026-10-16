# Local production UI expert review

The initial audit review below used the Webpack static export from before the
follow-up serializer compatibility fixes. It ran through the authorized in-app
browser on `http://127.0.0.1:3324`, using synthetic isolated article-example
sessions. The original editor document was not edited. Product source and output
hashes for these checks are preserved in
[source-manifest-before-review.json](source-manifest-before-review.json).
These screenshots establish behavior on that build; they do not verify later
builds. Subsequent checks are recorded separately with their own scope.

The preview server was restarted after rebuilding the CSP headers: its handler
loads `_headers` once on startup. The screenshots below use that audit build's
production JavaScript and matching headers.

The requested 1280px desktop viewport produced 1242 × 900 screenshots in the
in-app panel. Those rows establish the listed interactions/export contents;
they do not establish that every desktop toolbar control fits at 1280px.

| Locale / requested viewport     | Verified behavior                                                                                                                                                                                    | Evidence                                                                          |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| English, 1280 × 900             | Four nodes/four edges: blue mixed swatch, one Undo restores red with Undo disabled, one Redo restores blue                                                                                           | [Undo](after-final-undo.jpg)                                                      |
| English, 1280 × 900             | JSON shows all node/edge colors as blue with original coordinates; actual PNG preview shows the same graph without selection halos, labelled 1469 × 1920 px                                          | [PNG preview](after-final-png.jpg)                                                |
| Chinese, 390 × 720              | Five nodes/four edges: mixed swatch green, one Undo restores default node and edge colors, Undo disabled/Redo enabled                                                                                | [Chinese Undo](after-final-chinese-undo.jpg)                                      |
| Japanese, dark theme, 320 × 900 | Paste `3 5\n1 2\n1 2\n2 1\n2 3\n3 3`; preview shows the self-loop and three parallel edges, controls remain visible, Apply produces the matching canvas                                              | [Paste preview](after-final-japanese-preview.jpg)                                 |
| Japanese, dark theme, 320 × 900 | Delete one parallel edge: four edge hitboxes remain, two parallel routes visible; keyboard Undo restores all five hitboxes and three parallel routes. The separate edge and self-loop remain visible | [Deleted](after-final-parallel-delete.jpg), [Undo](after-final-parallel-undo.jpg) |
| Japanese, dark theme, 960 × 390 | Input/preview body scrolls to the full curved preview while Apply remains visible; Escape returns focus to the Load opener                                                                           | [Short viewport](after-final-short-viewport.jpg)                                  |

The original comparison server was then stopped. That source/export was served
at `http://127.0.0.1:3323`, and the duplicate 3324 server was stopped.
Additional English checks at an actual 960 × 720 capture verified that all
toolbar controls fit. Starting with red nodes and default-colored edges, one
green swatch and one Undo restored both different original colors, with Undo
disabled and Redo enabled. The resulting PNG preview was 1920 × 1327 px:
[Undo](after-delivery-undo.jpg), [PNG preview](after-delivery-png.jpg).

The light theme and default viewport were restored after verification. The
saved images are unedited browser JPEG screenshots; the PNG preview is an image
shown inside that browser screenshot, not a captured native PNG download.

That export on port 3323 was also checked with a large synthetic graph at
an actual 960 × 720 viewport. The visible Samples form generated **Random
connected graph**, 1,000 nodes / 5,000 edges, seed 1, undirected and unweighted.
The editor exposed exactly 1,000 node controls and 5,000 edge controls. Fit to
view, Select All and the mixed color palette remained operable. One green
swatch colored all selected elements, one Undo restored the default color,
and one Redo reapplied green:
[Color](after-large-palette.jpg), [Undo](after-large-undo.jpg).

Deleting that selection produced the empty-graph starter screen. One Undo
restored all 1,000 node and 5,000 edge controls and the green graph:
[Delete/Undo](after-large-delete-undo.jpg). Two further Undos reverted the color
action and sample generation, restoring the original four-node/four-edge
isolated example with Undo disabled. The viewport override was reset and Fit
to view restored a readable small graph. Reloading retained that four-node,
four-edge graph and reset both Undo and Redo to disabled. The original editor
was not changed.
These are successful UI state transitions; tool-call duration is not an input
latency, rendering throughput or before/after timing measurement.

These are an agent's expert checks, not a first-use human observation or a
complete browser/device matrix. They do not measure input latency, GPU
completion or physical touch behavior. Large 1,000-node/5,000-edge timing claims
come from the separately scoped CPU/Worker benchmarks, not these UI checks.
The Safari performance extension was not retained after its incomplete run.

## Follow-up review smoke

After the serializer accessor/read-order fix, the reviewed Node 24.15.0 Webpack
export was served with newly generated CSP headers at
`http://127.0.0.1:3323/en?example=edge-list`. Current product/build identities
are in [source-manifest.json](source-manifest.json). The English isolated
four-node/four-edge example was reloaded, all elements selected, and the green
swatch applied. One Undo button activation restored red nodes and default edges
and disabled Undo; one Redo restored green. Evidence:
[Reviewed color](after-reviewed-color.jpg), [Reviewed Undo](after-reviewed-undo.jpg).
The final Undo and reload restored the original graph with both history buttons
disabled. No viewport override was applied and the original editor was not used.

This smoke covers the listed operations only. It does not repeat the earlier
large-graph, multi-locale, export or mobile matrix on the new build.
