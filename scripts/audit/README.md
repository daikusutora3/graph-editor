# Audit scripts

Use these checks when UI geometry, themes, or static-export headers change.
They are separate from `bun run check` and `bun run check:all`.
Run from the repository root. Install Playwright's bundled Chromium if needed:

```bash
bunx playwright install chromium
```

## Responsive UI and themes

Start `bun run dev`, then run in another terminal:

```bash
BASE_URL=http://localhost:3000 bun run audit:ui
THEME=dark BASE_URL=http://localhost:3000 bun run audit:ui
```

Use the Japanese root route; the script selects controls by Japanese labels.
Adjust the port to the running server. It checks target sizes, text contrast,
and overlapping or off-screen chrome at widths from 375 to 1920 CSS pixels.
It exits nonzero for reported findings. Panels are scanned when the script
finds their controls, so inspect its coverage and manually exercise the changed
interaction; a pass does not establish that every feature or sample was tested.

## Screenshot review and interaction regressions

`ui-review.mjs` captures 23 editor states (21 per mobile viewport, 22 per
desktop viewport): empty, import/validation, sample search, selection/editing,
context menus, layouts/settings, export formats, PNG, help and drawing modes.
It uses fresh storage for every viewport and never opens the user's browser
profile. The default widths include both sides of the 640, 768, 960 and 1280px
breakpoints. It records horizontal clipping inside panels and selection
toolbars, off-screen panels and document overflow in `manifest.json`.

```bash
BASE_URL=http://127.0.0.1:3310 OUTPUT_DIR=/tmp/graph-editor-ui-review/before bun scripts/audit/ui-review.mjs
# After changing the UI, capture the same conditions and reject geometry findings:
BASE_URL=http://127.0.0.1:3310 OUTPUT_DIR=/tmp/graph-editor-ui-review/after FAIL_ON_FINDINGS=1 bun scripts/audit/ui-review.mjs
```

Use `WIDTHS=320,375,768`, `HEIGHTS=390,900`, `THEMES=light,dark` and
`LOCALES=ja,en,zh-Hans` to choose additional dimensions. Not every combination
is necessary for every change; retain the actual coverage in the manifest.
For short-window comparisons, capture before and after with
`WIDTHS=320,667,768,1280 HEIGHTS=390` under `before-short` and `after-short`.

The report builder assembles matching before/after images into an offline
gallery and five annotations using the original pixels. Its annotations expect
Japanese light screenshots at 320×900, 1440×900, 320×390 and 768×390. Additional
capture directories are merged when present; the mobile recapture directories
take precedence. Keep generated images outside the repository.

```bash
INPUT_DIR=/tmp/graph-editor-ui-review OUTPUT_DIR=/tmp/graph-editor-ui-review/report RENDER_ANNOTATIONS=1 bun scripts/audit/ui-review-report.mjs
BASE_URL=http://127.0.0.1:3310 bun tests/browser/responsive-ui-regressions.ts
```

The regression check exercises import application, pointer and keyboard color
selection, persistence, 44px mobile toolbar targets, focus restoration and
short-window sample creation at five widths in all three locales and both
themes. It also sweeps 147 widths from 320 to 2560px in both themes, including
additional breakpoint neighbors, and writes `width-sweep.json` to `OUTPUT_DIR`
(default `/tmp/graph-editor-ui-review`). Browser engine and physical mobile
keyboard coverage remain separate from these Chromium checks.

## Import, edit and export workflow across browser engines

`ui-workflow.ts` checks Japanese, English and simplified Chinese at 320, 414,
768 and 1280px: import, selection, JSON download, switching to graph data and
PNG, and persistence after reload. Mobile cases simulate a visual viewport
shrinking to 390px while the layout viewport remains 900px; both the textarea
and footer must remain visible. This is a reproducible keyboard-layout check,
not a physical-device or installed-Safari test.

```bash
bunx playwright install firefox webkit
BASE_URL=http://127.0.0.1:3310 bun tests/browser/ui-workflow.ts
BROWSER=firefox BASE_URL=http://127.0.0.1:3310 bun tests/browser/ui-workflow.ts
BROWSER=webkit BASE_URL=http://127.0.0.1:3310 bun tests/browser/ui-workflow.ts
BASE_URL=http://127.0.0.1:3310 bun tests/browser/sample-catalog.ts
```

`sample-catalog.ts` exercises all 79 samples at 375px, including empty and
nonnumeric parameter validation where applicable, creation and saved node/edge
counts. It covers default configurations; exhaustive parameter combinations
remain outside its scope. Numeric boundaries and generation integrity are
covered separately by `tests/verification/sample-parameters.ts`.

## Static-export headers

Build and serve the export in one terminal:

```bash
bun run build
bun run serve:out
```

Once the server reports port 3123, run in another terminal:

```bash
BASE_URL=http://localhost:3123 bun run audit:csp
```

The server applies `out/_headers`. The browser script visits localized app and
guide routes plus a missing route, exercises PNG preview, and reports CSP
violations, console errors, and page errors. It requires a rendered sample and
a loaded PNG preview, accumulates CSP violations across every navigation, and
fails on any collected violation or console/page error.
Stop the local server with Ctrl-C when finished.

For editor recovery/history regressions and broader build checks, see the
[development guide](../../docs/development.md#choose-checks-for-the-change).

## Sample gallery

Start the dev server on port 3310, then run:

```bash
BASE_URL=http://127.0.0.1:3310 bun tests/browser/sample-gallery.ts
```

Pass the root URL, without a locale suffix. This uses isolated browser contexts
to verify search aliases, category filtering, parameter retention, live previews,
normalized values, input copying, creation, Undo/Redo, and persistence. It also
checks that the large-graph preview finishes before Create becomes available,
and renders Japanese, English, and Chinese at 375 px in light and dark themes.
Screenshots are written to `/tmp/graph-editor-sample-review`.

Graph properties and generation limits are covered by `bun run test`, including
shortest paths, negative cycles, matching, bridges, seeded generation, and
configurable graph families.

## Installed Safari and panel focus

After building, start the approved local preview on the fixed port:

```bash
PORT=3323 bun run serve:out
/usr/bin/python3 tests/browser/safari-workflow.py
BASE_URL=http://127.0.0.1:3323 bun run tests/browser/panel-focus.ts
```

Restart `serve:out` after rebuilding: its CSP header rules are read at startup.
The Safari runner uses Apple's installed `safaridriver` in an isolated session.
It accepts no arguments and permits only `/`, `/en`, and `/zh-hans` on
`http://127.0.0.1:3323`. It checks keyboard entry, Tab, Escape, immediate typing,
import, selection, color, dragging, JSON output, PNG preview and reload persistence
in 3 languages, 3 window widths and 2 themes. Screenshots and actual viewport
sizes are recorded in `/tmp/graph-editor-safari-review`. Safari's native file
download is not exercised; the runner saves the generated JSON itself.
The focus regression deliberately delays initial focus until after typing to
verify that automatic focus cannot interrupt the user's input.
