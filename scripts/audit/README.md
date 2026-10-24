# Audit scripts

Use these checks when UI geometry, themes, or static-export headers change.
They are separate from `bun run check` and `bun run check:all`.

For agent tasks, rendered UI verification can use the in-app
browser at the approved `http://127.0.0.1:3323` or `:3324` preview, on `/`,
`/en` or `/zh-hans`, through the `localGraphTab` binding, or installed Safari
through the fixed runner below. Keep the policy hook enabled and follow
`AGENTS.md` for the exact allowed paths and operations. Do not launch Playwright
or other browser automation through an interface outside those exceptions.
The CLI commands below document the maintained audit tools; changes to their
source or a passing `bun run check` do not establish that those browser suites
were executed. Record actual in-app screenshots and interactions separately.

## Installed Safari regression

Start the approved preview at `http://127.0.0.1:3323`, then run from the
repository root without URL, scenario, or command overrides:

```bash
python3 tests/browser/safari-workflow.py
```

The runner tests the URL policy before opening isolated Safari WebDriver
sessions, renews the session between suites to isolate native input state, and
closes the final session afterward. Editor workflow and range-selection cases
also start in fresh sessions. Navigation and refresh wait for a new document
before checking editor state. It visits only `/`, `/en`, and
`/zh-hans`. The default run covers design controls, Rust/Wasm computation,
multi-selection and history, range menus and gestures, edge routing, and the
localized import/edit/export/reload workflow. Ordinary buttons use native
keyboard activation; drag and hover checks use native pointer actions.
The expected editor state is checked between workflow stages. Commands such as
Undo and setting toggles are not replayed on a timeout. Only read-only WebDriver
requests may be retried after transport failures. A hover check may repeat
pointer entry once when a recorded window blur interrupted tooltip display.

The design-guidelines stage checks all three locales in both themes at two
requested Safari window widths. It exercises persistent input examples,
validation associations and disclosures, sample-search focus, keyboard graph
creation, explicit clear/cancel and Undo, output focus, button press feedback,
and PNG dimension drafts committed by Tab, Enter, and a real pointer blur.
Controlled fields are emptied with native Select All and Backspace so their
React input handlers observe the edit.

The responsive-text stage constrains the editor to exact CSS boxes inside the
Safari window: 320×390 with 16px root text, and 320×900 or 1280×900 with 24px
root text. It measures toolbar bounds, text containment, rendered node sizes,
native keyboard creation, hitbox alignment, and node/chrome overlap in all
three locales and both themes. It also fits the graph back inside the measured
toolbar bounds and checks that the first start card remains visible. The
range-menu suite moves the real pointer onto a tooltip, waits there, and checks
Escape dismissal and description cleanup. The browser viewport and constrained editor
box are recorded separately. A further 320×390 enlarged-text creation guard
is tested only if its action is visible and unobscured; skipped coverage is
reported explicitly. This simulates a smaller editor and larger text, rather
than a physical mobile viewport or a changed system accessibility setting.

Results and screenshots are saved under `/tmp/graph-editor-safari-review`.
Use `results.json` from a completed run for the full-suite result. A `passed`
status is saved only after session cleanup succeeds; `cleanup.json` carries the
same run ID and records session closure and driver shutdown. Requested
window sizes are reported alongside actual viewport sizes. Focus appearance
checks record when Safari's test window is inactive, because keyboard focus in
the DOM alone does not establish that an active focus outline was displayed.
This is an expert review on installed desktop Safari, not a physical-device,
screen-reader, native-download, or first-time-participant test. Any native
keyboard limitations and use of DOM keyboard events are recorded per case.

The 2026-10-24 UI review verified application commit `fe217bd` with 82
verification suites, type checks, lint, formatting, the production build, and
release checks. Safari completed 67 cases across the other seven stages on
that application source. The three multi-selection cases remain incomplete:
fixture import emitted a saved event containing the expected graph, while a
later WebDriver storage read returned null. The runner retains the failure,
before/after diagnostics, and successful session cleanup; this is not a
passing 70-case run. The cause of that storage discrepancy is unconfirmed.

The follow-up application commit `3435483` uses Next.js 16.4.1. All 83
verification suites, 27 Rust tests, the production build, and release checks
passed; dependency audit returned `{}` and the build no longer emitted the
security reminder. The new enlarged-routing stage passed in both Safari
themes: root text 16→24→16px produced 48→72→48px nodes, Worker/Wasm recomputed
the route, coordinates stayed unchanged, and the enlarged rendered curve
cleared the obstacle by at least 8.477px. It waits for an actual renderer frame
before capturing screenshots.

Persistence testing now checks a native storage probe before importing the
fixture. This distinguishes an application failure from Safari's storage
backend rolling back a write: `native-storage-preflight.json` records its
immediate, delayed, and next-command reads. The follow-up probe failed even in
fresh sessions and a new automation window; sessionStorage retained its value,
while localStorage returned null and IndexedDB could not open its database.
WebKit's system log reported an ENOENT opening the isolated
`SafariAutomation/<UUID>/Origins/.../LocalStorage/localstorage.sqlite3`.
No normal Safari data or browser settings were changed by the runner. After
the user restarted Safari on 2026-10-24, the native storage probe retained its
value across delayed and separate-command reads. All 72 cases then passed on
application commit `3435483`, including all three multi-selection variants,
the two enlarged-routing cases, and every earlier regression stage. The run
ID `1792804341985462000` matches `results.json` and `cleanup.json`; both session
closure and driver shutdown succeeded. All 12 focus-appearance cases passed.
SafariDriver still sends U+001F for Shift+ArrowDown in the three
multi-selection variants, so that nudge uses the existing DOM KeyboardEvent
fallback and records the limitation. It is not evidence of native delivery of
that key combination. Earlier failed artifacts remain diagnostic history;
use the matching completed-run results for the current verification status.

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
and overlapping or off-screen chrome at widths from 320 to 1920 CSS pixels,
with separate pointer and Android touch profiles. Mobile toolbar controls must
be at least 44×44px. The range selector is available only to pointer input and
may be 24px wide; its mobile height must still be at least 44px. Touch profiles
must hide that selector. Desktop controls use a 30px minimum, with the same
24px width exception for the pointer-only range selector.
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
selection, persistence, input-specific target sizes, app-menu arrows without
link activation, selected-radio panel entry, focus restoration and short-window
sample creation at five widths in all three locales and both themes, with
separate pointer and Android touch profiles. Touch emulation includes a mobile
user agent; `hasTouch` alone does not select the app's touch platform.
Validation uses unsupported-version JSON, because free-form node labels such
as `not a graph` can describe a valid edge. It also sweeps 147 widths from 320
to 2560px in both themes with pointer input, including
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

## Panel keyboard verification in the in-app preview

Start the approved local preview, then bind its permitted route in the in-app
browser as `localGraphTab`. Capture the rendered state at 320, 375, 768 and
1280px where the changed interaction differs. Use browser controls and the
page's accessible controls for interaction; do not inject scripts.

- Open the app menu. Up/Down wrap through available menu items, and Home/End
  reach the first/last item. These keys must move focus without opening links
  or the shortcuts panel. Escape closes the menu and restores its trigger.
- On desktop, choose Directed in Settings, close it and reopen it. Initial
  focus must land on Directed. Tab moves to the selected weight option; arrow
  keys still change radio values. Disabled controls and controls hidden by the
  UI must be skipped. Check forward and backward Tab at the panel boundaries.
- Open Load graph and start typing immediately. Initial focus must preserve an
  already focused input. Close with Escape, confirm focus returns to the
  opener, and reopen using the keyboard. With unsupported-version JSON such
  as `{"version":999}`, Apply must remain disabled while warnings are visible.
- At narrow widths with pointer input, inspect the range selector separately:
  it may be 24px wide while the other toolbar controls remain at least 44px.
  Record the input platform with the screenshots. An in-app desktop preview
  does not establish touch-device coverage.

`tests/verification/focus-navigation.ts` checks the selected-radio Tab contract,
unavailable controls and focus-only menu navigation without starting a browser.
The maintained browser regressions add rendered focus and geometry assertions;
report them as unexecuted when only source and nonbrowser checks ran.
