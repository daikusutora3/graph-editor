# Dependency and toolchain update

Implementation following the [dependency review](./dependency-review-2026-10-10.md),
starting from `8576ffe290575db6cc7ea4492075ba5a33fc875e` on 2026-10-10.

## Runtime alignment

Node is pinned to 24.15.0 in `.node-version` and `engines`. Its type definitions
now target major 24. Bun remains pinned to 1.4.2 in `packageManager` and also has
an exact engine declaration. The official Bun 1.4.2 executable is installed at
the ignored `.local-bin/bun` path for this checkout.

`node scripts/toolchain.mjs` validates Node and selects the pinned local Bun
before starting a command. It preserves arguments and puts the local binary on
the child PATH, including nested `bun` commands. Install/dev/build/check lifecycle
hooks inspect the actual invoking Bun through `npm_execpath`; an incorrect
global Bun is rejected even when the correct local binary exists. Git privacy
hooks now use this launcher as well. The repository policy hook remains enabled
and unchanged.

Bun may resolve/write a lockfile before `preinstall` runs, so the documented
installation entry point is the Node launcher. A normal frozen installation
through it passed, including both `preinstall` and `prepare`.

## Updated packages

| Package      | Before | After   |
| ------------ | ------ | ------- |
| @types/node  | 26.6.4 | 24.19.1 |
| lucide-react | 1.50.0 | 1.55.0  |
| nanoid       | 6.0.1  | 6.0.2   |
| next         | 16.3.8 | 16.4.0  |
| oxlint       | 1.86.0 | 1.87.0  |
| playwright   | 1.63.0 | 1.64.0  |
| prettier     | 3.9.9  | 3.9.10  |

The selected Node type version is the newest major-24 release satisfying the
existing seven-day age gate at update time. The newer 24.19.2 was published on
October 9; using 26.6.5 would retain the runtime/type mismatch.

The six explicitly requested library releases are less than seven days old.
A temporary `/tmp/graph-editor-update-bunfig.toml` excluded just those packages
and their required matching-version Next/Oxlint/Playwright companions during
this update. The checked-in seven-day policy is unchanged. All 18 direct
dependencies have matching manifest and installed versions, and the frozen
lockfile installation succeeds with the ordinary configuration.
[Bun release-age behavior](https://bun.sh/docs/pm/cli/install)

Playwright's matching Chromium and headless-shell revision 1248 are installed
for the existing development runners. Browser verification for this change used
the in-app browser.

Next.js retains static export, the existing Cloudflare configuration, and
Worker/Wasm integration. No new experimental framework option was enabled.
[Next.js 16.4](https://nextjs.org/blog/next-16-4)

## Tailwind formatting

`prettier.config.mjs` now declares `tailwindStylesheet: "./app/globals.css"` and
`tailwindFunctions: ["cn", "clsx"]`. The plugin therefore knows the custom theme
and `touch` variant and also sorts classes in helper calls outside attributes.
[Plugin configuration](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/blob/main/README.md)

Formatting changes 43 class strings in 18 TSX files. Independent comparison
against HEAD found identical class tokens and duplicate counts; ASTs differ
only in their order inside those strings. Each file matches the current
Prettier 3.9.10/plugin 0.8.1 output. No application logic changed.

## Verification

- `node scripts/toolchain.mjs run check:all` passes in the final state.
- Both TypeScript checks, Oxlint and formatting pass.
- Repository policy self-test passes all 60 permitted/rejected-call cases.
- All 39 verification suites pass, including seven toolchain assertions for
  argument preservation, local/nested Bun selection and incorrect runtime
  rejection.
- All 18 native Rust tests pass; the checked-in Wasm artifact is current.
- Next.js 16.4 static build and release assertions pass, including localized
  pages, Worker/Wasm assets and page-specific CSP headers.
- Ordinary frozen installation succeeds without changing the lockfile.
- `bun audit --json` returns `{}` with exit 0: no known advisory was reported.

The initial restricted Turbopack build could not bind an internal port and
cached that failure. Clearing only its generated `.next/cache/turbopack` cache
and rebuilding with the needed local execution permission resolved it. No
framework configuration workaround was added.

The actual updated static build was served from this checkout on
`http://127.0.0.1:3324/en`, with its freshly generated CSP rules. In-app browser
checks covered 320×720 and 1280×900 viewports:

- Selection menu, load panel and detected `N=4 M=5` weighted input.
- Applying the input, parallel edges and a self-loop, and PNG preview rendering.
- Node creation, keyboard Undo, force-directed layout, and fit-to-view.
- Settings, the empty-state icons, clear/Undo recovery, light/dark themes, and
  graph/theme restoration after reload.

The viewport override was reset afterward. Screenshots are under
`/tmp/graph-editor-ui-review/`, including
`before-320-load-dependency-update.jpg`,
`after-320-load-dependency-update.jpg`, `after-320-png-dependency-update.jpg`,
`after-1280-editor-dependency-update.jpg` and
`after-1280-empty-dependency-update.jpg`. These are expert checks of a local preview; physical
device behavior and user first-use observation were not tested.

## Bundle result

The existing entry-page benchmark counts referenced modern initial chunks and
preloads, excluding the legacy nomodule chunk and later dynamic downloads.

| Initial modern JavaScript |  Before |   After | Difference |
| ------------------------- | ------: | ------: | ---------: |
| Raw bytes                 | 769,060 | 761,135 |     −7,925 |
| Gzip bytes                | 240,877 | 239,652 |     −1,225 |

The baseline is the existing `d491ffc` static artifact; its application source
matches the starting `8576ffe` audit commit. The after build uses the combined
toolchain/dependency/formatting update. The small gzip reduction is about 0.5%.
It does not establish faster interaction, FPS or a Next.js-only improvement.

Temporary evidence includes `/tmp/graph-editor-dependency-check-all-final.log`,
`/tmp/graph-editor-dependency-build.log`,
`/tmp/graph-editor-dependency-bundle-after.json`,
`/tmp/graph-editor-tailwind-format-review-2026-10-10.json` and the update registry
metadata files under `/tmp/graph-editor-update-*.json`.
