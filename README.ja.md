# Graph Editor

<p align="center">
  <img src="./public/brand/graph-editor-logo.webp" alt="Graph Editor logo" width="112" height="112" />
</p>

<p align="center">
  ブラウザ上でグラフ理論の図を作成・編集・配置・書き出しできるアプリです。
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.ja.md">日本語</a> ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

Graph Editor は、グラフのアイデアをすばやく見える形にするための
local-first なブラウザアプリです。問題文の辺リストを貼り付ける、サンプルから始める、レイアウトを整える、テキスト形式や PNG として書き出す、という流れを一つの画面で扱えます。

公開URL: <https://graph-editor.daikusutora3.workers.dev>

## 特徴

- **すばやい入力**: 辺リスト、隣接リスト、隣接行列を貼り付けられます。よくある形式は自動検出します。
- **グラフ理論向けの設定**: 有向/無向、重み付き/重みなし、0-index/1-index、自己ループ、multi-edge を扱えます。
- **69種類のサンプル**: path、cycle、tree、planar graph、Petersen 系、DAG、SCC、flow network などをすぐ試せます。
- **レイアウト機能**: force、連結成分、BFS、木、DAG、二部、SCC、放射、円形、格子、直線、重なり解消レイアウトを使えます。
- **書き出し**: 辺リスト、隣接リスト、隣接行列、PNG 画像をコピーまたは保存できます。
- **多言語UI**: 日本語、英語、簡体字中国語に対応しています。

## クイックスタート

```bash
bun install
bun run dev
```

Next.js が表示するローカルURLを開きます。通常は `http://localhost:3000` です。

## よく使うスクリプト

```bash
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run check
bun run check:all
bun run build
```

## 技術スタック

- Next.js 16
- React 19
- TypeScript
- Cytoscape.js
- Jotai
- Tailwind CSS
- Bun

## ディレクトリ構成

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

## ビルド

```bash
bun run build
```

Next.js の `output: "export"` を使った静的書き出しに対応しています。
公開前は `bun run check:all` を実行してください。型チェック、lint、
フォーマット確認、グラフモデル・サンプル・レイアウト・エディタ状態・IO の検証、
本番ビルドまでまとめて実行します。Cloudflare の静的
アセット配信には `wrangler.jsonc` と `public/_headers` を使います。

## ライセンス

MIT License です。
