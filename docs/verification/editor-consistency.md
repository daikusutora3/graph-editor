# Editor consistency and responsiveness

Implemented from the September 6 design review:

- Commands expose `applied` / `noop` with the committed graph reference. Rejected layouts do not fit or close the panel.
- The Canvas provider holds one replaceable fit request. No-op imports fit without another edit, unmounted canvases retain requests, and superseded or timed-out requests are discarded. Ordinary fitting does not hide an already visible canvas.
- Retry remounts the canvas session, preserving the graph and history while recreating renderer effects and transient interactions. The initialization timeout starts on mount, before automatic routing completes.
- Menu bending starts from committed manual routing or the displayed control point, preserving both distance and weight. Missing routing does not imply a straight edge. Committed manual bends take precedence over cached automatic metadata immediately.
- Index-base changes use exact integer arithmetic. Zero-padded integer strings still normalize (`0007` becomes `8`); non-integer labels remain unchanged. Labels exceeding the existing limit reject the complete transaction. Stored values remain strings.
- Storage conflict actions own replacement, baseline acceptance, cancellation of scheduled writes, and fresh-document saving. They consume the exact displayed raw snapshot; loading remains undoable and does not immediately write back.
- Automatic routing and overlap resolution retain their progress between slices. Superseded work is discarded. Overlap resolution commits once. No storage, history, graph schema, worker, or state-library migration was introduced.

## Measurements

Run `bun tests/benchmarks/editor-operations.ts` on the same machine and deterministic fixtures. These are local Bun measurements, not browser paint timings or guarantees for other hardware. Sliced totals exclude waiting between browser frames. Each candidate remains atomic, so a slow candidate can exceed the 4 ms target.

| Fixture                                               | Operation          | Before: maximum synchronous call | After: maximum slice |
| ----------------------------------------------------- | ------------------ | -------------------------------: | -------------------: |
| 100 nodes / 500 edges, long labels and parallel edges | Initial routing    |                        147.63 ms |              5.38 ms |
| Same                                                  | Drag routing       |                        149.55 ms |              5.18 ms |
| 200 coincident nodes / 400 edges                      | Overlap resolution |                         31.39 ms |              4.00 ms |
| 1,000 nodes / 5,000 edges                             | Drag routing       |                         76.37 ms |              4.10 ms |
| Same                                                  | Overlap resolution |                         27.97 ms |              4.00 ms |

The long-label initial routing total changed from a mean of 142.50 ms to 114.55 ms in the sliced run. Reusing candidate subdivisions reduces repeated geometry work; slicing primarily improves responsiveness, and can increase elapsed completion time. Transaction preparation was about 5 ms near the limits, so patch generation was left unchanged. No spatial grid was added.

## Verification

- `bun run check`: type checks, lint, format, repository policy, existing verification suites, and regression tests for exact labels, canonical no-op results, storage conflict operations, stale overlap work, and bend origins.
- With a local server running: `BASE_URL=http://127.0.0.1:3100/en bun tests/browser/editor-regressions.ts`. This injects renderer-construction failures, retries before and after display, and checks placement, history, identical imports, identical layouts, dragging, automatic bend inheritance, and range selection.
- The browser test retains the real retry button's React callback solely in its isolated browser context to exercise a post-display remount. No test API is shipped with the application.
