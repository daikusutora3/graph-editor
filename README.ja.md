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

使い方ガイド: <https://graph-editor.daikusutora3.workers.dev/guide>

## 特徴

- **すばやい入力**: 辺リスト、隣接リスト、隣接行列を貼り付けられます。よくある形式は自動検出します。
- **グラフ理論向けの設定**: 有向/無向、重み付き/重みなし、0-index/1-index、自己ループ、multi-edge を扱えます。
- **79種類のサンプル**: 基本的なグラフ族に加え、0–1 BFS、負閉路、マッチング、橋・関節点、Functional graph などをすぐ試せます。21種類でサイズや構成を調整でき、乱数シードから木・DAG・連結グラフを再現できます。アルゴリズム名での検索、カテゴリ絞り込み、競プロ用の辺リストコピーにも対応しています。
- **レイアウト機能**: 自動配置、BFS、木、DAG、二部、SCC、放射、円形、格子、直線、同心円、重なり解消レイアウトを使えます。
- **書き出し**: 辺リスト、隣接リスト、隣接行列、JSON、TikZ（TeX）、PNG 画像をコピーまたは保存できます。
- **多言語UI**: 日本語、英語、簡体字中国語に対応しています。

頂点ラベルと辺の重みは、それぞれ Unicode コードポイントで256文字まで使えます。
テキスト入力が超過した場合は対象と行番号を表示し、切り捨てずに入力全体を拒否します。
JSONの頂点座標は有限な ±1,000,000,000 の範囲に限ります。
範囲外のデータを読み込んでも、現在のグラフは変更しません。

## TeX 文書への取り込み

「書き出し → TikZ (TeX)」でコピー、または `graph.tex` として保存できます。
プリアンブルに次を追加し、本文中に `\input{graph.tex}` を置いてください。

```tex
\usepackage{tikz}
\usetikzlibrary{arrows.meta,shapes.misc}
```

日本語ラベルを使う場合は LuaLaTeX と `\usepackage{luatexja}` が必要です。
ラベルは通常の文字として扱い、TeX 特殊文字をエスケープします（`$x$` もそのまま表示します）。
位置・表示中のラベル・色・矢印・重み・多重辺・自己ループ・曲げを出力します。
印刷向けの配色と TeX のフォントを使うため、文字幅や自動経路は画面と異なる場合があります。
大きい図は座標の範囲を最大 12 cm に縮めます。TikZ は文書に取り込むための形式です。
エディタで再編集するための保存には JSON を使ってください。

## クイックスタート

Node **24.15.0** と Bun **1.4.2** を
[開発環境の設定手順](docs/development.md#local-setup)に従って用意してください。
ランチャーは、このチェックアウト専用の `.local-bin/bun` にも対応しています。

```bash
node scripts/toolchain.mjs install --frozen-lockfile
node scripts/toolchain.mjs run dev
```

Next.js が表示するローカルURLを開きます。通常は `http://localhost:3000` です。

## 技術スタック

- Next.js 16
- React 19
- TypeScript
- Cytoscape.js
- Jotai
- Tailwind CSS
- Bun

## 開発ドキュメント

[ドキュメント一覧](docs/README.md)から、[開発ガイド](docs/development.md)、
変更内容に応じた検証手順、ブラウザ監査、過去の設計記録を参照できます。
公開ビルドの準備には `node scripts/toolchain.mjs run check:all` を実行してください。

## ライセンス

MIT License です。
