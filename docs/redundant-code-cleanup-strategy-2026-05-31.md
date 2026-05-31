# 冗長コード整理戦略

作成日: 2026-05-31

## 目的

Graph Editor の保守性を上げるために、確認済みの冗長コードを削り、投機的な抽象化を増やさない。整理の対象は、現在の import/export、Canvas 操作、スクリーンショット出力、履歴と storage の安全性、静的リリースの保証を壊さない範囲に限定する。

この計画は保守的に進める。未使用または挙動に影響しないと確認できたものだけを削り、壊れやすい挙動に触る前には characterization test を足す。見た目の複雑さを消して、隠れたリスクを増やす整理はしない。

## 実装状況

2026-05-31 時点で、延期対象を除く整理は実装済み。

- Phase 1 の安全削除は `9d77b3b` で完了。
- history/storage、Cytoscape isolated state、screenshot preview state の characterization を追加。
- isolated-node の no-op class/data/style を削除。
- starter parse cache、screenshot state helper 分割、command label 整理、key-first sample catalog 整理を実装。
- Phase 3 の危険な再設計は引き続き別タスク扱い。

## 信頼度ポリシー

整理対象は、次の3条件を満たしたときだけ高信頼として扱う。

1. 静的確認で未使用または挙動に影響しないと分かっている。
2. 変更範囲が1つの境界に閉じていて、無関係な責務をまとめて崩さない。
3. 退行しうる挙動に対応した検証がある。

どれかが欠ける場合は、「先に characterization が必要」または「今回は保留」に回す。

## Phase 0: 先にガードを足す

壊れやすい領域を単純化する前に、まずここを整える。

### Import / Parser

対象ファイル:

- `features/graph-editor/io/import-graph.ts`
- `features/graph-editor/io/import-edge-list.ts`
- `features/graph-editor/io/import-loose-edge-list.ts`
- `tests/verification/io-contracts.ts`

必須チェック:

- `bun run tests/verification/io-contracts.ts`
- `bun run tests/verification/graph-core.ts`

守るべき golden case:

- `0 1\n1 0` は auto mode で adjacency matrix のまま。
- `2 1\n0 1` は structured `N M` edge-list を優先する。
- headerless edge-pairs は loose edge-list に fallback する。
- plausible な incomplete `N M` input は warning 付きで structured 扱いを維持する。
- weighted と malformed row が混ざる input は weighted interpretation を維持する。
- oversized import は大きな allocation の前に拒否する。
- structured edge-list の index base は sidebar 設定だけでなく endpoint から推定する。

### History / Storage

対象ファイル:

- `features/graph-editor/shell/state/graph-atoms.ts`
- `features/graph-editor/shell/state/history-atoms.ts`
- `features/graph-editor/workflows/editing/graph-editor-hooks.ts`
- `tests/verification/editor-state.ts`
- `tests/verification/storage.ts`

必須チェック:

- `bun run tests/verification/editor-state.ts`
- `bun run tests/verification/storage.ts`

再設計前に足すべき characterization:

- 通常の local command に undo/redo が効く。
- revision mismatch で stale な history/future が消える。
- local command の後に external storage sync が来ても、古い patch を undo/redo で再生しない。
- history cap の挙動が安定している。
- import と sample apply の後も reload/persistence smoke が通る。

### Canvas / Cytoscape

対象ファイル:

- `features/graph-editor/canvas/GraphCanvas.tsx`
- `features/graph-editor/canvas/GraphCanvasHitboxOverlays.tsx`
- `features/graph-editor/canvas/graph-canvas-html-node-drag.ts`
- `features/graph-editor/canvas/graph-canvas-rendered-hitboxes.ts`
- `features/graph-editor/adapters/cytoscape/cytoscape-adapter.ts`
- `features/graph-editor/adapters/cytoscape/graph-canvas-elements-sync.ts`

必須チェック:

- `bun run tests/verification/cytoscape-adapter.ts`
- `bun run tests/verification/editor-state.ts`
- desktop と narrow viewport の browser smoke

手動またはブラウザで確認するシナリオ:

- node 追加、node drag、edge draw、range select、Shift toggle selection
- node/edge context menu
- node label と edge label/weight の inline edit
- zoom、fit、resize、side rail interaction
- edge hitbox が Cytoscape の rendered geometry に追従すること

### Screenshot / Export

対象ファイル:

- `features/graph-editor/ui/graph-io-screenshot.ts`
- `features/graph-editor/ui/GraphScreenshotPanel.tsx`
- `features/graph-editor/ui/GraphIOControls.tsx`
- `features/graph-editor/io/export-graph.ts`

必須チェック:

- `bun run tests/verification/io-contracts.ts`
- `bun run tests/verification/cytoscape-adapter.ts`
- PNG preview、copy、download の browser smoke

維持すべき characterization:

- preview は empty/loading/ready/failed/stale を取りうる。
- 新しい preview request が古い request に勝つ。
- object URL が revoke される。
- copy/download は stale preview blob を信用せず、毎回 fresh output を生成する。
- long-edge size、padding、background が preview と output に反映される。

### Static Release

必須 release gate:

- `bun run build && bun run tests/verification/release.ts`

release に影響する広い変更では追加で実行する:

- `bun run check:all`
- `python3 -m http.server 4173 --directory out` で static smoke

release verification は必ず fresh build 後の `out/` に対して実行する。stale な `out/` を読んで通った結果は信頼しない。

## Phase 1: 安全削除

最初に着手する候補。

### 未使用の zoom setter を削る

対象ファイル:

- `features/graph-editor/canvas/graph-canvas-viewport-actions.ts`
- `features/graph-editor/canvas/GraphCanvas.tsx`

`setCanvasZoomPercent` は returned actions にあるが、現状では利用されていない。削る。ただし Cytoscape 変更後の表示倍率を同期する `setZoomPercent` は残す。

検証:

- `bun run tests/verification/cytoscape-adapter.ts`
- zoom in/out、reset、fit、表示倍率の browser smoke

### context-menu 専用の edge endpoint payload を削る

対象ファイル:

- `features/graph-editor/canvas/graph-canvas-types.ts`
- `features/graph-editor/canvas/graph-canvas-context-actions.ts`

`GraphContextMenuTarget` から `sourceX`、`sourceY`、`targetX`、`targetY` だけを削る。同名でも `EdgeLabelHitbox` 側の field は削らない。透明な edge hitbox line と hitbox equality で使われている。

検証:

- `bun run tests/verification/editor-state.ts`
- edge context menu、edge selection、double-click edit、range selection の browser smoke

### 未使用の graph selector を削る

対象ファイル:

- `features/graph-editor/core/graph/selectors.ts`

`rg hasEdgeBetween` が定義箇所だけを返す状態なら `hasEdgeBetween` を削る。`canUseEdgeEndpoints` などの endpoint validation helper とは混同しない。

検証:

- `bun run tests/verification/graph-core.ts`
- `bun run typecheck`

### isolated-node の no-op styling は一体で削る

対象ファイル:

- `features/graph-editor/adapters/cytoscape/cytoscape-adapter.ts`
- `features/graph-editor/adapters/cytoscape/graph-canvas-elements-sync.ts`
- `app/globals.css`

現状の isolated node style は base node background を繰り返しているだけに見える。ただし isolated flag は Cytoscape class/data として出力され、sync churn に影響する可能性がある。非視覚の sync characterization ができてから削る。

検証:

- `bun run tests/verification/cytoscape-adapter.ts`
- isolated node、connected node、sample preview、graph update の browser smoke

### sample edge-list handoff を削る

対象ファイル:

- `features/graph-editor/ui/SampleGalleryPane.tsx`
- `features/graph-editor/ui/GraphStarterCard.tsx`

sample selection は生成した model を直接 apply している。現状の callback は閉じる直前に exported edge-list を隠れた starter input へ戻しているだけなので、visible behavior に依存がなければ close-only signal に置き換える。

`exportEdgeList` 自体は export 機能で使うため残す。

検証:

- `bun run tests/verification/samples.ts`
- `bun run tests/verification/layouts.ts`
- sample apply、starter close、paste tab reopen、selection clear、canvas fit の browser smoke

### 確認済み unused i18n leaf を削る

対象ファイル:

- `features/graph-editor/i18n/messages.ts`

候補:

- `app.logoAlt`
- `common.saving`
- `common.save`
- `common.standard`
- `appMenu.reportIssueHelp`
- `appMenu.shareOnXHelp`
- `starter.createGraphHelp`
- `starter.formatAuto`
- `exportPanel.downloadAria`
- `screenshot.previewReady`
- `canvas.zoomLevel`
- `canvas.edgeDrawingLayer`

各 key は `Messages` type と全 locale object から同時に削る。sample item copy、layout copy、group copy のような dynamic map は単純な文字列検索で削らない。

検証:

- `bun run typecheck`
- `bun run test`

## Phase 2: 挙動保存の単純化

ここは Phase 0 のガードが揃ってから進める。

### starter parse result を cache する

double parse を避ける場合は、次の key による cache に限定する。

- input text
- import format
- parsing に影響する graph settings

auto-detection order や warning は変えない。

### screenshot helper を分割する

分割候補:

- preview state と request-id handling
- PNG blob generation と padding
- clipboard/download fallback
- dimension reading

copy/download が fresh output を生成する挙動は維持する。

### command constructor と label を整理する

`GraphIntent` の constructor と label 周りの小整理は可能。ただしこの整理で `GraphIntent`、`GraphPatch`、`GraphTransaction`、revision check は削らない。

### sample catalog の形を整える

key-first な sample catalog は重複削減になりうる。ただし次を守る。

- localized search haystack
- fallback title/subtitle behavior
- 既存の sample order と group count
- preview/layout expectations

## Phase 3: 今は保留

次は今回の整理では触らない。

- Shift range selection
- HTML node drag layer
- Cytoscape rendered hitbox source
- edge routing cache と persisted edge routing overrides
- patch-based history から snapshot history への置き換え
- release verifier の縮小
- 小さな繰り返し control の generic UI primitive 化
- `messages.ts` の大規模分割
- theme initialization consolidation
- route/i18n metadata deletion

これらは実際の product behavior または release safety を守っている。削除による cleanup ではなく、別の redesign task として扱う。

## 実行順序

1. history/storage と screenshot race の missing characterization を足す。
2. 小さな安全削除から進める: zoom setter、`hasEdgeBetween`、context-menu endpoint payload。
3. `bun run typecheck` と近い verification scripts を実行する。
4. sample handoff と confirmed-unused i18n leaves を削る。
5. `bun run test` を実行する。
6. isolated-node cleanup は sync characterization が揃ってから行う。
7. release-facing change では `bun run build && bun run tests/verification/release.ts` を実行する。
8. cleanup PR 完了前に `bun run check:all` と browser smoke を行う。

## 判断ルール

迷ったら境界は残し、その周辺の未使用 surface だけを削る。目標は最小のコードベースではなく、挙動を信頼しやすい一番単純なコードベースにすること。
