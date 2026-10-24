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
also start in fresh sessions. Each design-controls case starts in a fresh
isolated session as well. Navigation and refresh wait for a new document
before checking editor state. It visits only `/`, `/en`, and
`/zh-hans`. The default run covers design controls, Rust/Wasm computation,
multi-selection and history, range menus and gestures, edge routing, and the
localized import/edit/export/reload workflow. Ordinary buttons use native
keyboard activation; drag and hover checks use native pointer actions.
A fixed Japanese short-feedback preflight runs first and is recorded separately
as `feedbackPreflight`. It does not seed checkpoints or count toward the matrix.
The nine matrix stages must return their fixed case counts and 78 cases in total.
Editor drags check the measured hit target, use absolute viewport coordinates,
and require trusted pointer down/up events and the exact displacement after
converting through the canvas zoom. Native pointer buttons are tracked across
commands; activation, window movement, minimization, and focus recovery are
suspended while a button is held, so inspecting a drag preview cannot cancel
the drag. Group-drag waypoints use zero-duration native moves with pauses,
and require an exact live preview without saving before pointer release. Pointer capture, cancellation, focus,
keyboard input, and saved coordinates are recorded for each drag. The final
trusted pointerup coordinates are applied through the same zoom and grid
conversion before saving. Missing or superseded move events cannot determine
the saved endpoint. Pointer cancellation and window blur restore the snapshot;
Undo and Redo retain the complete multi-node move as one history entry.
The expected editor state is checked between workflow stages. Commands such as
Undo and setting toggles are not replayed on a timeout. Timed-out commands are
never resent, including reads: their backend operation may still be pending. Commands
are separated by 20ms. With explicit native-control authorization, a transport
timeout can restart Safari and the driver in a new isolated session. Design,
editor-workflow, and responsive-text cases retain only fully asserted results
in memory under the same run ID and source fingerprint. Their exact case keys
and ordered prefix are checked before resuming; a new run clears this cache and
does not read previous JSON results. Three consecutive timeouts without a new
completed case stop the run, with an absolute limit of three times the stage's
expected case count. The other stages rerun as a whole, at most twice.
Completed stages remain recorded under the same run ID; assertions are never
retried, including assertions masked by a cleanup timeout. The runner checks a fingerprint
of its source, runtime helper, and production output before and after every
stage. A hover check may repeat pointer entry once when a recorded window blur interrupted tooltip display.

Native Safari activation, focus restoration, minimize/restore recovery, and
recovery restarts are disabled by default. Default input and wait operations
do not recover document focus. Starting a SafariDriver session can still affect
the desktop; this runner does not guarantee background execution. After the
user reported interference with normal work, live Safari runs were suspended.
Earlier restart permission must not be treated as permission to resume
foreground testing while the user is working. Only after direct user
authorization for an exclusive foreground run may the caller create
`/tmp/graph-editor-safari-review/exclusive-foreground-request.json` with the exact
payload `{"action":"exclusive-foreground-safari-for-78-case-review"}`. This file controls
the run; its presence does not establish user authorization. The runner consumes
it once and records `nativeActivationAuthorized`. If WebDriver restoration
leaves the test document inactive, the fixed `open -a Safari` command activates
Safari before the runner restores its owned window. The runner requires visible
focus before continuing native input. Element lookup returns the WebDriver
reference from a synchronous DOM query, avoiding SafariDriver's asynchronous
find-node polling; subsequent key and pointer inputs remain native.
Recovery restarts request a normal quit first; if necessary, SIGTERM is limited
to the single Safari process after verifying its owner and executable again.
SIGKILL is never used for Safari. The recovery does not read or modify normal
browsing content, browser data files, or settings. The authorized run starts
with a fresh browser and enables diagnostics only for its isolated WebDriver
sessions.

The recovery and lifecycle checks can run without operating Safari:

```bash
python3 tests/browser/safari_runtime.py --self-test
python3 tests/browser/safari-workflow-runtime-test.py
```

The design-guidelines stage checks all three locales in both themes at two
requested Safari window widths. It exercises persistent input examples,
validation associations and disclosures, sample-search focus, keyboard graph
creation, explicit clear/cancel and Undo, output focus, button press feedback,
and PNG dimension drafts committed by Tab, Enter, and a real pointer blur.
For controlled fields, DOM focus and select prepare the selection; native
Backspace must empty the focused field before native typing continues. The
runner does not assign the value or synthesize an input event.
The pointer-blur check uses the measured background-button center and trusted
native pointer down/up/click events. It requires the draft dimension to commit
on blur before the click and the preview to become exactly 1440×720px.

The responsive-text stage constrains the editor to exact CSS boxes inside the
Safari window: 320×390 with 16px root text, and 320×900, 768×900, or 1280×900
with 24px root text (24 cases). It measures toolbar bounds, text containment, rendered node sizes,
native keyboard creation, hitbox alignment, and node/chrome overlap in all
three locales and both themes. It also fits the graph back inside the measured
toolbar bounds and checks that the first start card remains visible. Each top
panel must contain its controls on a single row. Narrow panels hide text labels
and key hints without adding ellipses. The
range-menu suite moves the real pointer onto a tooltip, waits there, and checks
Escape dismissal and description cleanup. The browser viewport and constrained editor
box are recorded separately. A further 320×390 enlarged-text creation guard
is tested only if its action is visible and unobscured. If the shorter toolbar
leaves enough room to add a node, the rendered node must avoid the chrome and
the test undoes the addition; that case does not claim guard coverage. Skipped coverage is
reported explicitly. When creation is blocked, the feedback must clear both
toolbars and the action, expose a full text line, and receive native Tab focus.
Responsive keys use a 100ms hold and release all actions after each key.
Native key names, modifiers, default prevention, and scroll offsets are recorded.
ArrowDown and End must scroll overflowing text to its final visible line while
the graph remains unchanged, with a measured focus outline of at least 2px.
Each responsive case uses a fresh isolated session. This simulates a smaller editor and larger text, rather
than a physical mobile viewport or a changed system accessibility setting.

Results and screenshots are saved under `/tmp/graph-editor-safari-review`.
Use `results.json` from a completed run for the full-suite result. A `passed`
status is saved only after session cleanup succeeds; `cleanup.json` carries the
same run ID and records session closure and driver shutdown. Requested
window sizes are reported alongside actual viewport sizes. All 12 export-focus
cases require a computed outline of at least 2px, including native Shift+Tab to
the format selector and Tab back to the output. All 18 editor-workflow cases
also require a 2px outline on the native Tab destination button. The raw document-focus state
and screenshots are recorded separately; an inactive window does not exempt
a case from the outline assertion.
This is an expert review on installed desktop Safari, not a physical-device,
screen-reader, native-download, or first-time-participant test. Any native
keyboard limitations are recorded per case. Multi-selection keyboard nudges
require trusted native keydown and keyup events; there is no DOM KeyboardEvent
fallback.

The Next.js 16.4.1 update passed 83 verification suites, 27 Rust tests,
the production build, and release checks; dependency audit returned `{}` and
the build no longer emitted the security reminder. Its enlarged-routing stage
passed in both Safari themes: root text 16→24→16px produced 48→72→48px nodes,
Worker/Wasm recomputed the route, coordinates stayed unchanged, and the
enlarged rendered curve cleared the obstacle by at least 8.477px. It waits for
an actual renderer frame before capturing screenshots.

Persistence testing checks a native storage probe before importing or resetting
the fixture. `native-storage-preflight.json` records immediate, delayed,
separate-command, and reload reads. Probe keys and values are unique to each
attempt. If native persistence fails, the runner may replace its own WebDriver
window once, then repeat the same persistence checks. It does not substitute
an in-memory storage implementation. Per-session reports and the full run
summary preserve the failed attempt and recovery outcome.

After the user restarted Safari on 2026-10-24, all 72 cases passed on application
commit `3435483`. Run ID `1792804341985462000` matches `results.json` and
`cleanup.json`; session closure and driver shutdown succeeded. That result
predates the top-toolbar update, which adds six responsive cases for a total
of 78. It does not verify the later source.

The follow-up found a real Tab escape from the starter textarea to the page
footer. Modal and mobile panels now explicitly cycle their visible, enabled
Tab stops, including native summary controls. The browser regression records
the trusted Tab keydown, requires it to be handled, and rejects any intervening
focus outside the starter panel. A task after event dispatch records the final
`defaultPrevented` value; the runner waits for that observation to settle before
checking it. The application fixes passed all 83 verification suites, the
production build, and release checks. Exported text and scrollable creation
feedback also expose a focus outline when Safari does not match
`:focus-visible`. Creation feedback stays between the measured toolbars and
supports native keyboard scrolling on short, enlarged-text editors.

Earlier attempts were blocked by the isolated Safari storage backend reporting
ENOENT for `SafariAutomation/<UUID>/Origins/.../LocalStorage/localstorage.sqlite3`.
Authorized Safari restarts and native persistence probes now record recovery
without substituting storage or modifying normal browser data or settings.
Only a matching completed 78-case run establishes the current browser result.

The full matrix passed on 2026-10-24: run `1792836256076948000` completed all 78
cases in the nine fixed stages (12/18/2/24/3/3/4/4/8). Its separate feedback
preflight also passed. Matching `cleanup.json` confirms WebDriver session closure
and owned driver shutdown. No transport recovery was needed in this final run.
The runner, runtime helper, and production-output fingerprint is
`12e8fa48a3ff12f9180deb5e68ea2e60d90ab491429267e2f10e283345824230`. All 21 native persistence probes passed, and all six
short-feedback cases passed native scrolling and visible final-line checks.
That source also passed 83 verification suites, 37 runner mocks,
18 restart-helper mocks, the production build, and release checks.

That completed run used a DOM KeyboardEvent fallback for Shift+ArrowDown in
three multi-selection variants because SafariDriver's standard Actions mapping
produced U+001F. It does not establish native delivery of that combination.

The updated runner removes that fallback. A capability probe tries native
WebDriver inputs and requires ordered, trusted ArrowDown keydown and keyup
with Shift and no other modifiers. A live probe passed using Actions Shift-down,
Element Send Keys U+F701, and Actions Shift-up. Safari reported `key: ArrowDown`
and `code: KeyA` for the character-input route; this verifies native logical
keyboard input, not physical ArrowDown scancode fidelity. Each real group case
must record its native events and pass the existing position, persistence, and
history assertions. The subsequent full run stopped with `no such window`;
the updated runner has not completed a new 78-case run. The updated sources
passed 83 verification suites, 42 runner mocks, 18 restart-helper mocks, and
1,630 policy checks without operating Safari. Live execution remains
suspended to avoid disrupting the user's work. Only matching completed-run
results establish the current verification status.

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
