# Post-9ee968a audit and improvements (2026-10-11)

Base: `9ee968ab51efa155bb0c7421bdda08d974f06d5a` on `main`.
The user authorized investigating the whole application and autonomously fixing
supported findings. Five findings were corrected in this working tree.
The pre-existing change to `tests/browser/safari-workflow.py` belongs to another
task and was left untouched. No commit, push or deployment is part of this run.

## Scope and design assessment

The review covered the recent coordinate, routing, Worker and PNG changes,
layout generation, graph input, persistence, localization and static delivery.
The installed Next.js client/lazy-loading documentation and the repository
React performance skill were consulted. The existing Worker lanes,
cancellation, geometry rejection, incremental hitbox reads, image export
ownership and resource cleanup remain appropriate in the reviewed scenarios.
No additional defect was reproduced in those paths.

The corrections use existing component, input-source and computation contracts.
There is no new dependency, Rust ABI change, global cache or hook-policy change.
Rust remains the force kernel; reducing its JavaScript orchestration overhead
is more useful here than moving more code across the Wasm boundary.

## Corrected findings

| Finding                                                                  | Correction and regression evidence                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Force layout rescanned all edges for every connected component           | Build node-to-component membership and edge buckets once, preserving edge/component order. The 300-node, 150-component, 5,000-edge regression reduces membership reads from 765,600 to 10,600; coordinates, input immutability and all 151 generator steps match the reference path.                                                                 |
| Structured edge-list input repeated line reading and tokenization        | Pass the existing `ImportSource` through detection and structured import. Prepared sources add no further reads/tokenization. Tests cover weighted graphs, physical warning line numbers, extra edges, text limits and the existing strict raw-header syntax.                                                                                        |
| Explicit JSON selection showed another format's analysis on invalid JSON | Explicit format controls both parsing and analysis; successfully parsed JSON reuses its model for analysis. Public analysis/evaluation parity and parsing-once regressions cover the mismatch.                                                                                                                                                       |
| A failed sample chunk removed the entire editor                          | Put the lazy gallery inside a local error boundary with translated feedback and Retry. Close, Back to Paste and the current graph remain outside the boundary. Retry creates a fresh lazy component and boundary key; ordinary renders retain their identity. Actual browser failure/recovery is checked separately from controlled component tests. |
| Locale aliases accepted inherited dictionary properties                  | Require an own property before returning a locale. Actual provider preference/storage-event tests cover `__proto__`, `constructor`, unsupported values, valid aliases, route/browser fallback and listener cleanup.                                                                                                                                  |

The new import-source, locale-preference and sample-boundary suites are
registered in `tests/verification/run-all.ts`. The force regression extends the
existing Wasm layout suite; JavaScript/Rust force equivalence now covers 38
fixtures with exactly matching coordinates.

## Measurements

Force measurements use Node 24.15.0, Bun 1.4.2 and the existing compiled Rust
kernel. Each result is the median of seven measured pass means after two
warmups; each pass runs ten full layouts. Other heavy work was paused during
the final comparison. Instrumentation is absent from measured runs. Rust call
counts were collected in a discarded warmup.

| Workload                                                       |   Before |    After | Reduction |
| -------------------------------------------------------------- | -------: | -------: | --------: |
| 100 vertices, 50 components, 5,000 interleaved parallel edges  | 5.068 ms | 4.213 ms |     16.9% |
| 300 vertices, 150 components, 5,000 interleaved parallel edges | 8.277 ms | 5.232 ms |     36.8% |

The output hashes, node order, generator steps (51/151) and Rust kernel calls
(50/150) agree before and after. These are disconnected-graph CPU measurements,
not browser FPS or a speedup claim for every graph.

For a 1,000-vertex, 5,000-weighted-edge structured input, actual evaluation
operation counts are:

| Input mode                    | Line reads before/after | Tokenizations before/after |
| ----------------------------- | ----------------------: | -------------------------: |
| Auto                          |                   2 / 1 |             15,002 / 5,001 |
| Explicit structured edge list |                   2 / 1 |             10,001 / 5,001 |

Both evaluations produce the complete graph and retain format/weight semantics.
No wall-time improvement is claimed for these parsing operation counts.

Initial modern JavaScript changed from 771,837 to 773,199 bytes; gzip changed
from 243,649 to 244,084 bytes (+435 bytes, about 0.18%). The local recovery UI
adds a small initial-delivery cost. This metric sums initial modern chunks;
deferred gallery chunks, Worker and Wasm assets are outside it.

## Verification

`node scripts/toolchain.mjs run check:all` passed: both TypeScript checks,
warning-free lint, formatting, all 60 permitted/rejected policy-hook cases,
60 verification suites, 18 Rust tests, Wasm freshness, production static build,
generated per-page CSP headers and release verification. Log:
`/tmp/graph-editor-9ee968a-improvements-check-all.log`.

The controlled pre-fix browser test served the exact base build at
`http://127.0.0.1:3323/en` and returned HTTP 503 only for the sample-gallery
chunk. Opening Samples produced the browser's whole-page failure screen and
removed editor controls. Screenshot:
`/tmp/graph-editor-ui-review/sample-chunk-before.png`.

The final build was then served by the same temporary server. Opening Samples
with its gallery chunk still returning HTTP 503 displayed the local translated
error, Retry, Close and Back to Paste. At 320×720 all recovery controls remained
visible. Back to Paste worked; returning to Samples failed locally again.
After removing the server's failure flag, Retry rendered the real gallery
(79/79 entries for the retained undirected graph). Closing and reopening the
gallery also completed normally after the initial Suspense loading state.
No sample was applied. The 12-node/18-edge graph's exported JSON before and
after failure, recovery and reopening matched exactly, including positions,
weights and settings.

Browser screenshots:

- `/tmp/graph-editor-ui-review/sample-chunk-after.png`
- `/tmp/graph-editor-ui-review/sample-chunk-after-320.png`
- `/tmp/graph-editor-ui-review/sample-chunk-recovered-320.png`
- `/tmp/graph-editor-ui-review/import-json-explicit-invalid.png`

The explicit JSON browser check selected JSON and entered `0 1\n1 0`. The UI
reported invalid Graph Editor JSON and kept the apply action disabled. The
analysis-format contract is checked by the public analysis/evaluation tests;
the browser check confirms rejection and its visible guidance. The test input
was cleared and Auto detect restored, without applying it.

The fault server was stopped and the viewport override reset. The ordinary
preview at `http://127.0.0.1:3324/en` now serves the final build with generated
headers. Its original three-node/three-edge graph's JSON was read and confirmed
unchanged; Gamma selection was restored and Undo/Redo remained disabled.

The temporary fault server and toggle live under `/tmp`; there is no production
fault switch. Only authorized in-app browser editor controls, page reads,
screenshots and viewport changes are used. Safari and arbitrary page scripts
are not used. Existing browser graph data is retained.

Local test/build evidence does not establish remote CI or production release.
Physical monitor/DPR transitions, OS clipboard behavior and pixel accuracy for
graphs spanning the full accepted coordinate domain are outside this run.
