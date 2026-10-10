# Dependency review

Review of `8576ffe290575db6cc7ea4492075ba5a33fc875e` on 2026-10-10.
Application code, dependencies, lockfile and configuration are unchanged.

This records the review baseline. The following
[implementation and validation](./dependency-update-2026-10-10.md) is documented
separately.

Keep the current React, Jotai, Cytoscape and small utility libraries. The first
concrete improvements are aligning the toolchain and correcting the Tailwind
formatter configuration. Next.js and the graph renderer deserve isolated
comparisons before choosing a replacement.

## Inventory and update candidates

All 18 direct dependencies have matching manifest, lockfile and installed
versions. All have an active use in the application or its development scripts.
The installed lockfile contains 156 package entries, including optional platform
packages; that count is not the number of packages shipped to the browser.

The latest column is a live npm registry snapshot from this review, using each
package's `https://registry.npmjs.org/<encoded-name>/latest` endpoint. Seven
packages have a newer release. None of the direct packages is marked deprecated
in that response. An update alone is not evidence of a performance improvement.

| Package                     | Installed | Latest on 2026-10-10 | Recommendation                                                  |
| --------------------------- | --------- | -------------------- | --------------------------------------------------------------- |
| clsx                        | 2.1.1     | 2.1.1                | Keep; very small and preserves the `cn` contract.               |
| cytoscape                   | 3.34.3    | 3.34.3               | Keep; improve adapter work first, compare renderers separately. |
| jotai                       | 3.0.1     | 3.0.1                | Keep; existing subscriptions already isolate frequent updates.  |
| lucide-react                | 1.50.0    | 1.55.0               | Keep; review the update separately.                             |
| nanoid                      | 6.0.1     | 6.0.2                | Keep; review the patch update.                                  |
| next                        | 16.3.8    | 16.4.0               | Keep initially; compare a smaller static-site architecture.     |
| react                       | 19.3.0    | 19.3.0               | Keep; no measured benefit from a UI-runtime replacement.        |
| react-dom                   | 19.3.0    | 19.3.0               | Keep aligned with React.                                        |
| @tailwindcss/postcss        | 4.3.3     | 4.3.3                | Keep aligned with Tailwind.                                     |
| @types/node                 | 26.6.4    | 26.6.5               | Choose the supported runtime major before updating types.       |
| @types/react                | 19.3.0    | 19.3.0               | Keep.                                                           |
| @types/react-dom            | 19.3.0    | 19.3.0               | Keep.                                                           |
| oxlint                      | 1.86.0    | 1.87.0               | Keep; review the update separately.                             |
| playwright                  | 1.63.0    | 1.64.0               | Keep; update its corresponding browser binaries together.       |
| prettier                    | 3.9.9     | 3.9.10               | Keep initially; review the patch update.                        |
| prettier-plugin-tailwindcss | 0.8.1     | 0.8.1                | Correct its v4 configuration.                                   |
| tailwindcss                 | 4.3.3     | 4.3.3                | Keep; current PostCSS integration is appropriate.               |
| typescript                  | 7.0.2     | 7.0.2                | Keep; the current compiler uses native platform binaries.       |

`bun audit --json` exited successfully with `{}`: its current advisory check
reported no known vulnerabilities in the resolved dependency graph. This is an
advisory-database result, rather than a complete security assessment.

## First priority: consistent tooling

`package.json` and `docs/development.md` specify Bun 1.4.2, but the executable on
PATH is Bun 1.3.14. Use the specified version and make a mismatch visible before
installing or running checks. Bun supports version-specific installation.
[Bun installation](https://bun.sh/docs/installation)

Node is 24.15.0, while `@types/node` targets major 26. If Node 24 is the project
baseline, align the type package with that major. Otherwise explicitly move the
runtime baseline as well. This prevents newer APIs from being accepted by types
while absent from the intended runtime. No failure caused by this mismatch was
reproduced in this review.

The Rust launcher selects pinned Rust/Cargo 1.99.0 correctly. `graph-kernels` has
no third-party Cargo dependencies. Keep this reproducible setup.

`bunfig.toml` already uses a seven-day minimum release age, and the lockfile is
checked in. Preserve both. The age setting controls new resolution and does not
retroactively change locked versions.
[Bun install](https://bun.sh/docs/pm/cli/install)

## Tailwind formatting: a confirmed configuration gap

`prettier.config.mjs` currently only loads the plugin. The application uses
Tailwind v4 with custom theme values and a `touch` variant in `app/globals.css`.
The plugin requires the CSS entry point for v4 and can sort strings in utility
function calls with `tailwindFunctions`.
[Tailwind Prettier plugin configuration](https://github.com/tailwindlabs/prettier-plugin-tailwindcss/blob/main/README.md)

The proposed configuration is:

```js
export default {
  plugins: ["prettier-plugin-tailwindcss"],
  tailwindStylesheet: "./app/globals.css",
  tailwindFunctions: ["cn", "clsx"],
};
```

A read-only `prettier.format()` probe currently produces
`text-control touch:h-11 h-8 p-3`; with the stylesheet it produces
`h-8 p-3 text-control touch:h-11`. Adding the function configuration also sorts
`cn(...)` strings outside JSX attributes, a pattern used in toolbar and menu
class definitions. This improves consistent formatting, rather than browser
rendering speed.

Oxfmt is a reasonable development-workflow comparison: it has built-in Tailwind
sorting and supports the repository's TSX, CSS, JSONC, Markdown and TOML files.
It could replace Prettier plus its Tailwind plugin. Before migration, align
print width, ignore rules and package-key sorting, then compare representative
output and the complete formatting diff. No Oxfmt installation or timing
comparison was performed here.
[Oxfmt](https://oxc.rs/docs/guide/usage/formatter),
[sorting configuration](https://oxc.rs/docs/guide/usage/formatter/sorting.html),
[unsupported features](https://oxc.rs/docs/guide/usage/formatter/unsupported-features.html)

## Small runtime libraries: removal has little value

Temporary browser-target Bun bundles included only the exports used by this
application, with minification and React external. These are isolated library
measurements, not changes to the actual Next.js bundle.

| Library export set                          | Minified bytes | Gzip bytes |
| ------------------------------------------- | -------------: | ---------: |
| clsx                                        |            377 |        242 |
| clsx/lite, comparison only                  |            141 |        136 |
| nanoid                                      |            199 |        209 |
| All 42 used Lucide icons and shared runtime |         14,202 |      5,374 |

`cn` has 56 calls. Its implementation passes an array to `clsx(inputs)`;
switching only the import to `clsx/lite` would drop those classes because lite
ignores non-string inputs. Revising the implementation and type contract to
save approximately 106 gzip bytes has low value.
[clsx/lite behavior](https://github.com/lukeed/clsx#clsxlite)

Nano ID has four call sites in two files for node/edge creation and paste.
Replacing its 21-character IDs with 36-character UUIDs adds 15 characters per
occurrence. A graph with 1,000 nodes and 5,000 edges whose IDs are all generated
randomly has 16,000 ID/source/target occurrences, adding 240,000 JSON characters.
That is a size calculation, not a measured runtime slowdown, but it outweighs
the roughly 200-byte JavaScript removal as a reason to migrate.
[Nano ID comparison](https://github.com/ai/nanoid#comparison-with-uuid)

Lucide uses named imports across 18 files, with no dynamic all-icon loader.
The installed Next.js configuration already optimizes `lucide-react` imports.
Hand-maintaining 42 SVG icons or changing to internal import paths has no
demonstrated benefit here.
[Lucide React](https://lucide.dev/guide/react),
[Next import optimization](https://nextjs.org/docs/app/api-reference/config/next-config-js/optimizePackageImports)

## Next.js: the main architecture comparison

The app is configured to export static assets; `wrangler.jsonc` serves `out`
with the existing 404 behavior, without a Next server in that deployment
configuration. Next.js static export generates
HTML per route and executes Server Components during the build.
[Next static export](https://nextjs.org/docs/app/guides/static-exports)

Runtime Next imports are concentrated in `next/dynamic` for the editor canvas,
Link and unoptimized Image in guides, and localized-page `notFound` handling.
The remaining integration mainly concerns metadata and static generation.
A React + Vite/static-page setup or Astro with a React editor is therefore
structurally plausible, but has not been implemented or benchmarked.

`bun run benchmark:bundle` on the existing `out/index.html` reports 769,060 bytes
of modern initial JavaScript, or 240,877 bytes gzip. It excludes the legacy
nomodule chunk and later dynamic downloads. This includes framework, React and
application code; it is not a measurement of Next.js overhead alone. The
artifact was built for `d491ffc`; application code is identical at `8576ffe`,
whose only intervening change is the performance audit document. A new build
was not run for this dependency review.

First inspect initial imports and preserve the existing canvas/panel lazy
loading. If a framework comparison follows, it must provide the same:

1. Six localized home/guide HTML pages, prerendered guide content, clean URLs,
   canonical/hreflang/OG/JSON-LD, manifest, robots and Git-dated sitemap.
2. Theme application before paint and page-specific CSP hashes within
   Cloudflare header limits.
3. Worker bundling through `new URL(..., import.meta.url)`, hashed Wasm assets,
   CSS and lazy chunks, and output-specific immutable cache rules.
4. Static `out` output, 404 and redirect contracts, and release assertions.

If these output contracts remain, a framework replacement does not inherently
require changing Cloudflare to a server runtime. Compare initial bytes, actual
load and interaction timings, build time and maintenance effort using identical
fixtures before deciding.

## Cytoscape, Jotai and React: preserve behavior before migration

Cytoscape currently owns drawing, viewport transforms, rendered geometry,
selection integration and PNG export. The existing audit found repeated work
in the application's hitbox/geometry adapter. Improve that measured work first.
[Current implementation audit](./performance-audit-2026-10-10.md)

WebGL deserves a separate rendering comparison. In installed Cytoscape 3.34.3,
its curve evaluation differs from the Canvas renderer for a multi-segment
self-loop: a pure geometry probe gives Canvas midpoint
`(-32.4368, -32.4368)` versus WebGL `t = 0.5` point
`(-30.1199, -30.1199)`, a 3.2766px difference at zoom 1. This inspects internal
curve calculations; it does not establish the final GPU-rendered appearance.
The probe is `/tmp/graph-editor-webgl-geometry-review.ts`; the relevant installed
sources are `edge-projection.mjs:33` and
`drawing-elements-webgl.mjs:1026–1065` under Cytoscape's renderer directory.

Sigma v4 is also a valid candidate. Its current release supports parallel
edges, self-loops and node dragging, so those features alone do not exclude it.
Its WebGL2 requirement and the application's capsule labels, manual bends with
multiple control points, weighted-label editing, hitboxes and PNG behavior
still require a feature-equivalent prototype and browser comparison.
[Sigma releases](https://github.com/jacomyal/sigma.js/releases/)

Jotai already uses derived atoms and conditional chrome subscriptions.
`bun tests/verification/chrome-subscriptions.ts` passed in this review: 100
position updates produce zero irrelevant chrome subscriber notifications.
This counts store notifications, rather than React component renders. Replacing
it with another store would require preserving history, revisions and update
semantics, without a measured benefit. Keep React as well: the app already uses
memoization, external-store integration and lazy/chunked preview work.

Oxlint, TypeScript, Tailwind/PostCSS and Playwright are actively used. Playwright
supports audit, regression and benchmark runners even though no browser runner
was executed for this review. Its presence is justified.
[Playwright browser version alignment](https://playwright.dev/docs/browsers)

## Recommended sequence and verification

1. Align Bun and the Node/type baseline; correct Tailwind formatting settings.
2. Review the seven newer releases in separate, bounded updates. For application
   updates, run `check:all` and verify affected UI in the approved in-app preview.
3. Integrate measured adapter improvements from the implementation audit.
4. Compare Oxfmt for development time; compare framework/renderer replacements
   only with preserved behavior and measured gains.

This review used installed-source inspection, live registry metadata,
`bun audit --json`, the existing bundle benchmark, isolated library bundles,
the chrome-subscription verification and read-only formatting/geometry probes.
No dependency installation, application
changes, framework migration, browser rendering comparison or deployment was
performed. Temporary measurement results are in
`/tmp/graph-editor-dependency-versions.json` and
`/tmp/graph-editor-dependency-mini-audit/report.json`.
