# Remediation of the 8dbdadd system audit (2026-10-11)

Base: `8dbdadd021401e1d3c596848e20da2902ef2d3e7` on `main`.
Scope: all nine findings/candidates in
`system-audit-8dbdadd-2026-10-11.md`. That historical audit is preserved.
This report describes the local implementation; it is not a production release.

## Design and regression coverage

| Audit item                                           | Implementation                                                                                                                                                                                                                                                                                                                                                                   | Verification                                                                                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accepted special vertex IDs                          | Mutable position builders use `Map`, with `Object.fromEntries` at the existing Record boundary. Partial position lookups require own properties. Imported IDs remain intact.                                                                                                                                                                                                     | `node-id-contracts`: partial edits, inherited values, nudge, Undo/Redo, public sample helpers, all 12 JS/Rust layouts, and actual Worker transport.                                                                                                                                                                   |
| Boundary overlap output and Worker recovery          | JS and Rust share bounded-output finalization. Uniform translation preserves clearance; snapped translations use whole 24px steps. An infeasible span returns the original supported positions, a recounted collision total and `unresolved`. Input-dependent coordinate failures settle only their job; malformed results and ABI failures retain permanent-failure protection. | `overlap-boundary`: 24 JS/Rust cases, positive/negative limits, near-boundary input, horizontal displacement, grid, infeasible span, idempotence and real Worker successor jobs. `worker-lanes` covers concurrent jobs, repeated input failures and resource cleanup.                                                 |
| Hidden ordinary edge's fake loop target              | Hitboxes carry endpoint-derived `isLoop`. A coincident ordinary edge has an empty stroke path; its selection-path DOM is omitted. Actual self-loops retain their geometry.                                                                                                                                                                                                       | `canvas-rendering` compares loop/ordinary/collapsed/separated cases. In-app browser blank-space click no longer selects the hidden edge; separating endpoints restores normal selection, and a real loop remains clickable.                                                                                           |
| PNG busy-state race                                  | Each explicit Copy/Save action owns a synchronous pending ticket. Busy state survives setting changes; settings invalidate completion feedback only. Action IDs, input revisions and cleaned-up timers prevent stale completion from overwriting later work. Preview warnings have a separate owner.                                                                             | `canvas-lifecycle` covers both completion orders, same-render re-entry, changed settings, stale timers, preview success after action failure, fallback, unmount and Strict effects replay. Actual Full/Viewport PNG previews were inspected in the browser.                                                           |
| Immutable model edits force full Hitbox reads        | Model membership determines structural reset. Display labels/endpoint identity are compared independently; Cytoscape invalidations identify changed geometry. Camera and structural changes retain full reads.                                                                                                                                                                   | `canvas-rendering` uses a real saved model and successful immutable weight command, compares all geometry/text/order to full reads, and covers label/style/routing/visibility/order/structural changes.                                                                                                               |
| Mixed-selection color is two Undo operations         | A domain-specific `set-selection-colors` intent changes node and edge colors in one existing transaction, retaining their distinct cycles.                                                                                                                                                                                                                                       | `editor-state` covers one history entry, complete Undo/Redo and atomic rejection. Browser JSON confirmed both color changes and one-click Undo of both.                                                                                                                                                               |
| DPR-only changes leave stale Canvas backing size     | The density media-query callback invokes the existing resize/repaint adapter, flushes overlays and refreshes export signatures. It rebinds the query and ignores destroyed canvases.                                                                                                                                                                                             | `canvas-resize` executes installed Cytoscape sizing and lifecycle callbacks: DPR 1→2→1→3→1, one repaint per change, no repaint for unchanged density, preserved camera/core/selection/readiness and cleaned-up listeners.                                                                                             |
| Repeated candidate bow calculation                   | Compute a candidate's representative bow once before comparing its siblings. Scheduling boundaries and route values are preserved.                                                                                                                                                                                                                                               | `routing-parallel-spacing` checks bounded calculation counts plus existing reference route values and steps. An old-code negative control fails the new work-count regression. The isolated benchmark below checks actual Rust use and output equivalence.                                                            |
| Recovery messages lack Chinese and coordinate reason | `integrityCopy` exhaustively satisfies all supported locales. `GraphContractError` and `CommandFailure` carry a typed reason; the UI chooses coordinate-specific guidance without parsing diagnostics.                                                                                                                                                                           | `integrity-feedback` renders the actual backup/rejection notice in all three locales, checks every recovery key and count message. `geometry-contracts` verifies reason propagation and retained graph/history on rejection. Actual Chinese rejection and unchanged exported coordinates were checked in the browser. |

### Renderer ID boundary discovered during integration

Browser verification found another aspect of special-ID handling: installed
Cytoscape 3.34.3 uses an ordinary object for its removal visited set. Native
`remove()` skips IDs such as `__proto__` and `constructor`; replacing a two-node
graph could leave those nodes alongside the three-node replacement. The source
and a direct installed-library probe reproduced this before the codec fix.

`adapters/cytoscape/cytoscape-ids.ts` provides one reversible boundary codec.
Object-prototype names and IDs starting with its reserved prefix are escaped;
ordinary IDs retain their representation. Node/edge IDs and endpoints are
encoded entering Cytoscape, and decoded for selection, interaction, geometry,
history and model-facing routing. Model IDs, JSON and Worker payloads retain
their original values. No dependency internals or global prototypes are patched.
`cytoscape-ids` exercises prototype names and prefix collisions through actual
adapter edits, selection, routing, deletion, replacement, clearing and Undo/Redo.
The final static build was also verified in the in-app browser with three nodes
(`__proto__`, `constructor`, `__ge_id__:__proto__`) and two special-ID edges.
Nudging retained the original exported IDs; deleting `constructor` removed its
rendered node and both incident edges, and Undo restored them. Replacing that
graph with the original three-node graph left exactly Alpha/Beta/Gamma and
their three edges, with no residual special-ID nodes. The exported original
JSON matched exactly after replacement.

## Final integrated checks

`node scripts/toolchain.mjs run check:all` passed on the final implementation:
54 verification suites, 18 Rust tests, application and test type checks,
lint/format checks, 60 policy-hook checks, current Wasm artifact verification,
the Next.js static build and release verification. The policy hook remained
enabled. No Rust source or compiled Wasm artifact changed in this remediation.

The final static build's initial modern JavaScript was 772,237 bytes
(243,696 gzip), compared with 767,721 (242,041 gzip) at the audited base:
+4,516 bytes / +1,655 gzip, about 0.59% / 0.68%. This measures the initial
unique script/preload resources, excluding nomodule scripts, later dynamic
chunks, Worker code and Wasm; it is not a complete download or startup-latency
measurement. Reproducer: `tests/benchmarks/initial-bundle.ts` against `out/`.

## Measured work and CPU time

For a real immutable weight edit on 100 nodes and 300 edges, node rendered
position reads fall from **200 to 2** and edge midpoint reads from **300 to 1**.
The resulting full geometry, labels and Cytoscape order agree with the full-read
reference. Idle and equivalent model reads perform zero geometry reads. These
are operation counts, not browser frame-rate measurements.

One mixed-selection `C` now creates one history entry and one graph serialization
instead of two; both element types return to their prior colors with one Undo.

The candidate-bow benchmark used Node 24.15.0/Bun 1.4.2 and the current compiled
Rust/Wasm, with no concurrent CPU benchmark or build. Seven passes were run;
the first two were warmups and the table gives the median of five measured
passes. Measured runs had no mocks, spies or diagnostic wrappers.

| Reversed labeled parallel edges |   Before |    After | Reduction |
| ------------------------------- | -------: | -------: | --------: |
| 100                             | 4.607 ms | 4.056 ms |     12.0% |
| 200                             | 9.042 ms | 8.075 ms |     10.7% |

Both cases retain the previous route hash, generator steps (902/1,758) and
active Rust kernel count (`routing_node_shape`: 17, verified in a discarded
warmup). Maximum generator-step time was essentially unchanged. This short
local comparison establishes a localized CPU reduction; input latency and FPS
were not measured. Sibling comparison remains quadratic in group size.

Reproducer: `tests/benchmarks/routing-parallel-spacing-performance.ts`, using
`--module` for a saved baseline routing module and `--baseline` for comparison.
Local measurements: `/tmp/graph-editor-bow-hoist-before-8dbdadd.json` and
`/tmp/graph-editor-bow-hoist-after-8dbdadd.json`.

## Browser observations and limits

The production static export from this checkout was served at
`http://127.0.0.1:3324/en` and `/zh-hans` using `scripts/audit/serve-out.mjs`.
Verification used the dedicated in-app browser only. The policy hook stayed
enabled; Safari and arbitrary page scripts were not used.

- Normal 721×954 and explicit 320×720 viewport sizes were observed. The actual
  Viewport PNG dimensions changed from 769×1002 to 368×768 with 24px padding,
  confirming a real CSS viewport resize after the browser's transition settled.
  Full PNG remained 1920×1828 and retained curves, arrows and a self-loop.
- At coincident endpoints, clicking the previous false loop location (319,424)
  produced no edge selection. Dragging the second vertex apart made the normal
  edge selectable again. A real Gamma self-loop was still selectable by its
  visible stroke. A normal weight edit updated the displayed text and Undo
  restored it.
- With both nodes at (1e9,1e9), overlap resolution returned y=999999939.9990001
  and y=1e9, with both x=1e9. The JSON remained valid, and a subsequent force
  layout succeeded. A rejected rightward nudge displayed the Chinese X/Y range
  explanation while retaining the exported input.
- At these extreme absolute coordinates the native Canvas sometimes showed an
  empty circle or missing text. The same IDs draw normally after force layout.
  Installed-library calculations retain correct labels/font and rendered
  Hitboxes (about 6.5e-8px difference versus a translated normal fixture); its
  text-texture path passes coordinates around 1e9 into `fillText` despite a
  compensating context translation. A native raster/texture precision limit is
  therefore suspected, but not proved by the calculation probe. This is a
  separately observed rendering limitation: the coordinate contract and Worker
  output tests do not establish accurate pixels at every supported extreme.
- DPR-only behavior was verified through the real installed sizing code and
  controlled lifecycle events. A physical move between monitors was not tested.
  Clipboard/download completion ordering uses controlled API tests; the browser
  review checked preview pixels and controls, not OS clipboard contents.

Local screenshots:
`/tmp/graph-editor-ui-review/remediation-coincident-no-ghost.png`,
`remediation-coordinate-zh.png`, `remediation-bounded-overlap-json.png`, and
`remediation-png-320.png`, plus `remediation-cytoscape-ids-replaced.png` and
`remediation-final-restored.png` in the same directory. Temporary artifacts may be
removed; the scenarios and permanent regression suites above remain reproducible.

The original three-node graph's exact JSON, English route and normal viewport
were restored after testing. Production deployment and remote CI for this
uncommitted working tree were not checked.
