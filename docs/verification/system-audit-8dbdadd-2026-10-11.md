# Post-8dbdadd system audit (2026-10-11)

Audited commit: `8dbdadd021401e1d3c596848e20da2902ef2d3e7` (`main`).
The audit started with a clean working tree. Product code, dependencies,
existing tests, policy hooks and Git history were not changed by this audit.
This document records four P2 correctness findings and five P3 performance or
maintenance candidates. It supplements, rather than replaces,
`system-audit-improvements-2026-10-11.md`.

## Scope and evidence

The review covered the recent routing/Worker/import/coordinate changes together
with rendering, editor commands, layouts, persistence, clipboard, PNG actions,
localization and static delivery. The installed Next.js static-export and
lazy-loading guides and the repository React performance skill were consulted.

- The exact commit's [CI run](https://github.com/daikusutora3/graph-editor/actions/runs/38079222341)
  completed successfully, including the `check-all` code/Rust/static-release job.
- A fresh local `node scripts/toolchain.mjs run build` passed with Node 24.15.0,
  Bun 1.4.2 and the current Rust/Wasm artifact. The policy hook self-test passed
  all 60 permitted/rejected cases without changing or disabling the hook.
- All probes listed below were independently executed by the coordinating
  agent against this commit. They use real public command/state functions,
  installed Cytoscape calculations or the real Bun Worker where indicated.
  Hook lifecycle probes control browser resources and asynchronous completion;
  they do not substitute for browser pixels or real clipboard/download behavior.
- The fresh `out/` build from this checkout was served by
  `scripts/audit/serve-out.mjs` at `http://127.0.0.1:3324/en`, with its generated
  headers. The coincident-edge finding was reproduced through editor controls
  and native clicks in the in-app browser. Safari was not used.
- This is local/source/CI verification. Production deployment and actual
  monitor movement were not verified. Operation counts below are not latency
  or browser frame-rate measurements.

## P2: Accepted vertex IDs can break unrelated moves

`features/graph-editor/core/graph/graph-json.ts:152` accepts any nonblank string
as a node ID. A valid imported graph can therefore contain `__proto__`,
`constructor` or `toString`. At
`features/graph-editor/core/graph/graph-reducer.ts:150`, a move reads
`intent.after[node.id]` without checking for an own property. An inherited
object/function is mistaken for a position, so its missing `x` and `y` make the
entire transaction fail the JSON contract.

Reproduction: create two nodes, one with each ID above at `(0, 0)` and one named
`normal` at `(120, 0)`, joined by one edge. Parse and serialization both accept
the model. Move **only** `normal` to `(121, 0)` with
`createMoveNodesCommand`, or select it and use `nudgeSelectedNodesAtom`.
The transaction throws `Graph exceeds the JSON contract`; the nudge leaves
`normal.x` at 120. The control ID `regular` moves successfully.

Some layout producers also assign dynamic IDs into ordinary `{}` dictionaries,
including `layouts/layout-algorithms.ts:271` and
`layouts/layout-geometry.ts:147`. With `__proto__`, Tree/Bipartite/SCC/Radial
fail to apply. BFS produces no own `__proto__` entry but currently applies by
reading the prototype position. Standard generated IDs did not reproduce this.
The rejected transaction preserves the original model; this is an editability
and dictionary-contract problem, not evidence of global prototype pollution.

Recommended correction: use own-property lookups and consistently construct
dynamic-key position dictionaries with safe own properties or a null prototype.
Retain imported IDs. Cover partial moves, nudge, all layout families and
Worker/Wasm result reconstruction with these IDs, not only JSON parsing.

Probe: `/tmp/graph-editor-reserved-id-audit.ts`.

## P2: Valid boundary coordinates can permanently disable all compute Workers

The new coordinate contract accepts values up to and including ±1e9. Overlap
relaxation at `layouts/resolve-node-overlaps.ts:114` does not ensure that its
output remains in that range. Two nodes at `(0, 1e9)` produce, in both JS and
Rust, `a.y = 999999969.9995`, `b.y = 1000000030.0005`, zero remaining pairs and
`status = resolved`. Applying that result is rejected by the graph contract.

The real Worker returns the same out-of-range result. The result check at
`compute/worker-client.ts:168` throws, and the catch at line 185 calls
`failWorker(true)`. Lines 87–91 set the global `unavailable` flag and stop both
lanes. A subsequent ordinary routing request then returns `null` without
creating another Worker. The observed Worker count remains one created and
zero live, even for valid successor input. Subsequent calls use the JS fallback
until the page is reloaded, so one legal geometry edge case removes the
performance benefit of both Worker lanes.

Fourteen probes covered y=0, ±999999900, ±999999985 and ±1e9, with grid snapping
on and off. JS and Rust agreed in all cases. The ordinary and 100px-inside
inputs remained valid; the 15px-inside and boundary cases exceeded the range.
Force layout remained valid because it creates and normalizes independent
seeds. The graph contract correctly prevents saving the invalid result.

Recommended correction: make overlap output obey the coordinate contract,
for example through a whole-result translation when feasible, and explicitly
report inability to resolve when it is not feasible. Separate input-dependent
geometry failures from permanent Worker protocol/ABI failures. Test a valid
routing request after the rejected boundary job as well as the rejected job.

Probe: `/tmp/graph-editor-overlap-coordinate-boundary.ts`.
Captured responses: `/tmp/graph-editor-overlap-coordinate-boundary-8dbdadd.json`.

## P2: A hidden non-loop edge retains a fake loop's click area

The recent SVG correction uses endpoint identity to distinguish a real loop
from distinct nodes at the same coordinate. The transparent interaction path at
`canvas/GraphCanvasHitboxOverlays.tsx:566` still uses coordinate equality and
calls `createLoopHitboxPath`. `SelectEdgePath` at line 408 installs pointer
handlers on that transparent path with an 18px stroke.

Installed Cytoscape reports `isLoop() = false` for two nodes at `(0, 0)` joined
by a normal edge. The corrected SVG preview has zero stroked edges. However,
the interaction path is the fake cubic loop
`M-23.64 -4.17 C-55.15 -9.72 -9.72 -55.15 -4.17 -23.64` at zoom 1.

Browser reproduction used IDs `coincident-a` and `coincident-b`, no weights,
and `allowSelfLoops=false`. At the 721×954 viewport the overlapping nodes were
centered around `(360, 465)` with a 36px radius. Clicking `(319, 424)`, visibly
outside the node and with no line there, changed the edge checkbox from false
to true and opened the `Edge A–B` toolbar. This corroborates the source probe
with an actual user interaction.

Recommended correction: carry endpoint identity or `isLoop` through the Hitbox
contract. A collapsed ordinary edge must follow the same geometry policy in
Canvas interaction and SVG preview. Check real self-loops, distinct coincident
endpoints, selection, bend gestures and separation afterward.

Probe: `/tmp/graph-editor-canvas-coincident-audit.ts`.
Browser screenshot: `/tmp/graph-editor-ui-review/audit-8dbdadd-coincident-hitbox.png`.

## P2: PNG setting changes remove busy state while a save is still running

`ui/io/graph-io-screenshot.ts:145` resets both action states to idle whenever
an export setting changes. The download guard at line 391 and Save button at
`ui/panels/PngPanel.tsx:283` use that state as the busy flag. Completion at
`graph-io-screenshot.ts:414` has a mounted check but no action-ID check.

The real hook with controlled asynchronous exports reproduces this sequence:

1. Save A starts: `saving`, one pending export.
2. Change padding: `idle`, while A is still pending.
3. Save B starts: `saving`, two pending exports.
4. A finishes: internal state becomes `saved` while B is still pending.
5. Save C can start while B is still pending.

The visible Save busy indicator/disabled state therefore ends before the
currently running action does. Old completions and feedback-reset timers can
also update state belonging to a later action. The same shared reset is used
for Copy; the deterministic probe exercised Save, not real clipboard writes.
The existing renderer FIFO continues to serialize PNG capture, so this finding
does not claim image-selection corruption or simultaneous renderer mutation.

Recommended correction: separate actual pending actions from completion
feedback for a setting revision, and use action IDs to reject stale feedback
updates and timers. Preserve the policy that an explicit save can finish after
settings change. Test A/B completion order, settings edits during the action,
failure and unmount.

Probe: `/tmp/graph-editor-png-action-state-audit.mjs`.

## P3: An ordinary one-edge edit bypasses incremental Hitbox reads

`adapters/cytoscape/rendered-hitbox-reader.ts:60` resets all geometry whenever
`model !== graph`, even if the Cytoscape dirty-element set contains one edge.
Editor commands create immutable graph roots, so the differential path is lost
at ordinary committed edits, although it still works during changes retaining
the same model reference.

The probe uses a valid, serialized/parsed weighted model with 100 nodes and
300 edges. A real `update-edge` command changes weight `1` to `2` and the real
adapter reports one updated Cytoscape element with label `2`. Spies count the
element reads in installed Cytoscape:

| Read path                                           | Node rendered-position reads | Edge rendered-midpoint reads |
| --------------------------------------------------- | ---------------------------: | ---------------------------: |
| Retained-root control after the same adapter update |                            2 |                            1 |
| Actual immutable command root                       |                          200 |                          300 |
| Re-read of that unchanged root                      |                            0 |                            0 |

The retained-root control deliberately keeps old model display data; it is not
a valid replacement implementation. It demonstrates the available geometry
delta. The correction must update model labels/edge data alongside geometry.
This is confirmed excess work, not a measured frame-rate regression. Give it
priority among performance follow-ups because it affects routine edits.

Recommended correction: distinguish structural/order changes from display-data
changes and update the model indexes and dirty IDs incrementally. Keep full
resets for replacement/add/remove, pan/zoom and any unsupported invalidation.
Cover labels, styles, route changes, dimensions and edge visibility before
removing the reference-reset condition.

Probe: `/tmp/graph-editor-hitbox-read-audit.ts`.

## Other P3 maintenance and performance candidates

| Candidate                                                                 | Evidence and impact                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Recommended scope                                                                                                                                                                                           |
| ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mixed-selection color shortcut is two history operations                  | `shell/state/editor-shortcut-actions.ts:99` and `:109` dispatch separately. One `C` on two nodes and one edge creates two history entries and serializes the whole graph twice. One Undo restores only edges; two restore everything. The existing `editor-state` test explicitly expects two commands, so this is a behavior/operation-boundary proposal rather than a newly discovered regression.                                                                         | Introduce one compound color operation if one shortcut should mean one Undo, preserving distinct node/edge color cycles and rejected-transaction atomicity. CPU time was not measured.                      |
| DPR-only change does not request a Canvas repaint                         | `adapters/cytoscape/graph-canvas-lifecycle.ts:381` updates export signatures and rebinds the media query only. The lifecycle probe invokes that callback with unchanged CSS dimensions and DPR 1→2: backing width stays 1280, resize count 4 and paint count 1; needed backing width is 2560 and the export signature already contains DPR 2. Installed Cytoscape detects density in a later requested render, but its idle render loop does not itself request that render. | Request the existing resize/repaint adapter on density changes, preserving camera and overlay geometry. Confirm real monitor transitions separately; those were not tested here.                            |
| Repeated candidate-bow calculation inside sibling comparison              | `core/layout/edge-routing.ts:519` recomputes the identical `representativeBow(candidate)` inside `edges.every`. For 100/200/400 fixture edges, instrumented calls are 30,370 / 120,286 / 482,978. A temporary loop-hoist prototype uses 664 / 1,320 / 2,648 calls, with identical route hashes and generator steps (902 / 1,758 / 3,486).                                                                                                                                    | Hoist the candidate invariant after profiling its actual cost. This is separate from the already-fixed group label-spacing scan. The sibling comparisons remain O(E²); no wall-time improvement is claimed. |
| Integrity/recovery messages lack Chinese and a coordinate-specific reason | `i18n/integrity-copy.ts` only defines Japanese and English. `StorageNotice.tsx:39`, `EditorChrome.tsx:85`, `GraphCanvas.tsx:548` and `ExportPanel.tsx:124` select English for `zh-hans`. Generic rejection text lists size/text limits but does not explain the newly enforced coordinate range. This candidate is supported by source inspection; recovery-error UI was not forced in the browser.                                                                          | Make shared message coverage exhaustive over supported locales and return an actionable coordinate-specific rejection reason. Keep the existing recovery and original-data backup flow.                     |

Additional probes: `/tmp/graph-editor-color-undo-audit.ts`,
`/tmp/graph-editor-density-lifecycle-audit.mjs`, and
`/tmp/graph-editor-parallel-distinct-work-count.mjs`.
The count results are also recorded at
`/tmp/graph-editor-parallel-distinct-work-count-8dbdadd.json`.
Temporary probes/screenshots are local evidence; the scenarios and results
above remain reproducible descriptions if those temporary files are removed.

## Assessment of the recent implementation

The two Worker lanes, cancellation ownership, replay input snapshots, stale
response guards and pagehide disposal remain reasonable. Group-local lazy
label-spacing reuse addresses the measured hotspot without a global cache.
The text-limit preflight and atomic rejection protect the model; the SVG
endpoint-identity correction is also sound. The new findings expose consumers
and output paths that need to follow those contracts more consistently.

The PNG renderer FIFO, preview cancellation, Object URL/bitmap cleanup,
selection restoration, command rejection and preservation of invalid saved
source data did not show an additional issue in the reviewed scenarios. The
existing relevant storage/history/clipboard/IO/text/coordinate suites passed
during the audit. Their scope does not cover the new IDs, boundary recovery and
action-feedback interleavings above.

The fresh static build's HTML-referenced modern initial JS totals 767,721 B,
or 242,041 B gzip. Canvas and Gallery remain dynamically loaded. This metric
excludes later dynamic chunks and Worker/Wasm downloads and is not a complete
editor startup measurement. No new bundle regression or worthwhile library
replacement was established. Earlier experiments found little benefit from
retaining packed Wasm input or removing validation, so those were not proposed
again. The confirmed follow-ups are primarily contract/state/differential-work
corrections; further broad Rust migration is not justified by this audit.

## Browser cleanup and publication state

The original three-node/three-edge graph was restored with Undo, then reloaded
to clear only the temporary test history. Its exported JSON was compared with
the pre-test JSON: positions, colors, edge weights, manual routes and settings
all matched. The original camera view and Gamma selection were restored. No
viewport override was applied. Restored screenshot:
`/tmp/graph-editor-ui-review/audit-8dbdadd-restored.png`.

No implementation, new goal, commit, push or production deployment was made by
this investigation. The only workspace addition is this report.
