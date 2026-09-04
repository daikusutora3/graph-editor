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

- **Fast graph input**: paste edge lists, adjacency lists, or adjacency
  matrices. The importer auto-detects common formats.
- **Built for graph theory**: switch between directed/undirected and
  weighted/unweighted modes, change the index base, allow self-loops, and keep
  multi-edges readable.
- **68 ready-made samples**: explore paths, cycles, trees, planar graphs,
  Petersen-style examples, DAGs, SCC demos, flow networks, and more.
- **Layout tools**: apply force-directed, BFS, tree, DAG, bipartite, SCC,
  radial, circular, grid, line, concentric, and spread layouts.
- **Export options**: copy or save edge lists, adjacency lists, adjacency
  matrices, PNG images with background and padding controls, and lossless
  JSON that keeps positions, colours, and edge bends.
- **User guide**: `/guide` (also `/en/guide`, `/zh-hans/guide`) documents the
  formats, layouts, shortcuts, and FAQ; `/llms.txt` summarises the app for
  AI assistants.
- **Multilingual UI**: Japanese, English, and Simplified Chinese are supported
  in the app.

## Input and Output Formats

The paste box auto-detects these text formats (or pick one explicitly):

| Format                                | Example                                            |
| ------------------------------------- | -------------------------------------------------- |
| Edge list with `N M` header           | `4 4` / `1 2` / `2 3` / `2 4` / `3 4`              |
| Edge pairs (no header)                | `1 2` / `2 3`                                      |
| Tree edge list (`N` then `N-1` edges) | `4` / `1 2` / `1 3` / `3 4`                        |
| Parent array                          | `4` / `1 1 3`                                      |
| Weighted parent array                 | `4` / `1 5` / `1 3` / `3 2`                        |
| Adjacency list                        | `1: 2 3` / `2: 4`                                  |
| Adjacency matrix                      | `0 1 1` / `1 0 1` / `1 1 0`                        |
| Graph Editor JSON                     | `{ "version": 1, "nodes": [...], "edges": [...] }` |

Export offers the edge list, adjacency list, adjacency matrix and JSON. Only
JSON is lossless: it keeps node positions, colours and manual edge bends, and
importing it restores the graph exactly. The text formats carry structure and
weights only.

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
bun run test
bun run check
bun run check:all
bun run build
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
`bun run build` turns the `public/_headers` template into `out/_headers`, with
one Content-Security-Policy rule per page that allow-lists that page's inline
scripts (Cloudflare caps each `_headers` line at 2,000 characters).

## License

MIT License.
