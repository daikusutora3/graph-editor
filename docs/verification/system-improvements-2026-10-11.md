# System improvements

Implemented on 2026-10-10–11, starting from
`b1f94643fd4a3ee9e4281b91e9bdf405d863c006`. This report covers the eight findings
accepted in the system review. It records local verification before commit and
push; production deployment has not been verified.

## Changes and regression evidence

| Finding                                                              | Result                                                                                                                                                                                                               | Verification                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Comment markers in string weights are truncated on text re-import    | Text exports reject weights containing `#` or `//` and use the existing JSON guidance. JSON and TikZ retain those values.                                                                                            | `io-contracts`: comment markers, safe Unicode/single slash round trips, JSON/TikZ.                                                                                                                                                                     |
| Mixed node/edge Cut loses independently selected edges               | Clipboard contents combine internal edges of selected nodes with explicitly selected edges. Paste maps copied node endpoints and retains existing unselected endpoints.                                              | `history-clipboard`: mixed Copy/Cut/Paste, boundary edges, attributes, Undo/Redo, edge-only use, missing endpoints and parallel-edge constraints, through actual Jotai actions.                                                                        |
| Concurrent PNG requests share temporary selection state              | One FIFO owner serializes renderer mutation and PNG encoding. It reapplies selection policy immediately before capture and restores the latest selection/draft refs. A failed request does not block later requests. | New `image-export` suite uses real Cytoscape selection operations with controlled font, frame and PNG completion: three concurrent requests, failures, edits before capture/during encoding, destruction, Core replacement and restoration exceptions. |
| Local static preview can expose files outside `out/`                 | Listener binds to `127.0.0.1`; decoded request paths and canonical file paths must stay inside the export. Traversal, exterior symlinks and invalid URI input are rejected.                                          | New `static-preview-server` suite makes real loopback requests against disposable fixtures; also verifies clean routes, MIME/cache/security headers, 404, HEAD and method rejection.                                                                   |
| Editor preview ignores paint settings                                | Editor SVG uses node/edge/arrow colors, `showNodeLabels`, and `arrowScale`, including node width and arrow paint bounds.                                                                                             | `sample-preview`: all eight colors compared against the Canvas stylesheet; 360 additional SVG fit cases, marker references and unchanged Gallery output. IAB comparisons described below.                                                              |
| Parallel-edge events repeatedly expand already-dirty groups          | Full invalidation and existing dirty IDs skip expansion; structural events retain precedence.                                                                                                                        | `canvas-rendering`: actual Cytoscape events, expansion counts and geometry equivalence with full reads, including reverse edges, self-loops and structural changes.                                                                                    |
| Malformed Worker diagnostics can orphan a Promise                    | Keep pending requests until response processing completes. Invalid responses settle all pending work with the existing fallback; optional performance-mark failures do not invalidate valid results.                 | `wasm-worker`: eight fault cases covering response/result/diagnostics, performance marks, cleanup and message decoding, plus existing cancellation/retry/restart behavior.                                                                             |
| Git hooks and validation entry points are inconsistent; CI is absent | `commit-msg` uses the same pinned launcher as the other hooks; three READMEs and development instructions agree. A push/PR workflow installs pinned Node/Bun/Rust and runs `check:all`.                              | `toolchain`: all three hooks run with Bun absent from the hook PATH, preserving arguments. CI YAML parsed; local `check:all` passed. Remote execution and deployment integration remain unverified.                                                    |

The PNG owner deliberately does not cache blobs by graph revision. Revision
alone does not represent transient renderer geometry during dragging, so such a
cache could return an old image. Preview/copy/save retain their individual
options and asynchronous APIs.

For 1,000 parallel edges with 1,000 style events while a full read is already
pending, expansion visits fell from 1,000,000 to zero in the same deterministic
probe. After a snapshot, a dirty group expands once (1,000 visits). These are
work counts, not browser FPS or latency measurements.

## Local checks

- `node scripts/toolchain.mjs run check:all`: both TypeScript checks, Oxlint,
  Prettier, 60 policy cases, all 41 verification suites, 18 native Rust tests,
  current Wasm artifact, static production build and release assertions passed.
- The additional PNG await-boundary and restoration-exception tests passed
  separately after that integrated run; the final code-check run includes them.
- The local preview was rebuilt and its server restarted so CSP hashes match
  the current HTML. It serves only `http://127.0.0.1:3324`.

## In-app browser review

Used the permitted local IAB tab at `/en`, with 320 × 720 and 1280 × 900
viewports. Safari and standalone browser runners were not used.

1. Before the build, a three-node JSON fixture with red/blue/green nodes,
   colored edges, hidden labels, arrow scale 2 and a self-loop rendered with
   default paint and visible labels in Load preview.
2. The same fixture after the build rendered the colors, hidden labels and
   larger arrows at both widths. The dark-theme preview also retained the
   expected colors and fit. Applying and reloading retained model settings.
3. Text export showed the JSON guidance and disabled copy/save for `tag#1`
   and `path//end`. Switching to Save for editing produced enabled JSON output
   containing both original weights and all settings.
4. PNG Full/Viewport/Full changes finished with the expected preview dimensions
   and rendered image. The selected node remained selected on the main canvas,
   while the PNG preview excluded its selection highlight.
5. A separate node plus an independent edge could be selected together with
   Shift-click. The IAB keyboard-chord calls produced no Cut state change, so
   browser Cut/Paste acceptance is **not confirmed**. The actual Jotai
   Cut/Paste/Undo/Redo regression suite passed; keyboard dispatch remains a
   limitation of this browser review, not a claimed browser pass.

Screenshots are local review artifacts under `/tmp/graph-editor-ui-review/`:
`before-320-system-preview.jpg`, `after-320-system-preview.jpg`,
`after-1280-system-preview.jpg`, `after-1280-system-preview-dark.jpg`,
`after-1280-system-text-export.jpg`, `after-1280-system-png.jpg`, and
`after-1280-system-mixed-selection.jpg`.

## Publication boundary

The new GitHub workflow has not run remotely yet. GitHub required-check rules
and Cloudflare dashboard settings have not been inspected or changed. See
[Development](../development.md#continuous-verification-and-release-connection) for
connecting successful checks to publication. A workflow file and a local pass
do not establish an active production deployment gate.
