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
