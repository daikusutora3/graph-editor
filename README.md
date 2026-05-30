# Graph Editor

<p align="center">
  <img src="./public/brand/graph-editor-logo.webp" alt="Graph Editor logo" width="112" height="112" />
</p>

<p align="center">
  Create, edit, arrange, and export graph theory diagrams directly in the browser.
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

Graph Editor is a local-first browser app for turning graph ideas into clean,
editable diagrams. Paste an edge list from a problem statement, start from a
curated sample, adjust the layout, and export the graph as text data or a PNG.

Public app: <https://graph-editor.daikusutora3.workers.dev>

## Highlights

- **Fast graph input**: paste edge lists, adjacency lists, adjacency matrices,
  or the app's JSON format. The importer auto-detects common formats.
- **Built for graph theory**: switch between directed/undirected and
  weighted/unweighted modes, change the index base, allow self-loops, and keep
  multi-edges readable.
- **69 ready-made samples**: explore paths, cycles, trees, planar graphs,
  Petersen-style examples, DAGs, SCC demos, flow networks, and more.
- **Layout tools**: apply force, component, BFS, tree, DAG, bipartite, SCC,
  radial, circular, grid, line, and spread layouts.
- **Export options**: copy or save edge lists, adjacency lists, adjacency
  matrices, JSON, and PNG images with background and padding controls.
- **Multilingual UI**: Japanese, English, and Simplified Chinese are supported
  in the app.

## Quick Start

```bash
bun install
bun run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000`.

## Useful Scripts

```bash
bun run typecheck
bun run lint
bun run format:check
bun run verify
bun run check
bun run check:all
bun run build
```

To run specific verification suites:

```bash
bun run verify core samples layouts cytoscape editor io
```

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- Cytoscape.js
- Jotai
- Tailwind CSS
- Bun

## Project Shape

```text
app/                    Next.js app entry points
features/graph-editor/  Graph editor feature modules
  adapters/             Browser and Cytoscape integration
  canvas/               Interactive graph canvas
  core/                 Graph model, reducers, validation, layouts
  io/                   Import, export, clipboard, and file actions
  samples/              Curated sample graph catalog
  shell/                Editor state and top-level UI shell
  ui/                   Panels, toolbar, starter dialog, screenshot controls
tests/verification/     Graph, IO, layout, adapter, and release checks
public/brand/           App icons and logo assets
```

## Build

```bash
bun run build
```

The app is configured for static export with Next.js `output: "export"`.
Before publishing a public build, run `bun run check:all`. This covers
type-checking, linting, formatting, graph model verification, sample/layout
guards, editor-state and IO checks, and a production build.
Cloudflare static asset deploys use `wrangler.jsonc` and `public/_headers`.

## License

MIT License.
