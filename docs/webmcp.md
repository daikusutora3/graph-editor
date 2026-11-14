# WebMCP

WebMCP は、Web ページが AI エージェント向けに操作をツールとして公開するための、策定中の Web 標準です。ツールの実行は開いているページ内で行われるため、エージェントと利用者が同じエディターの状態を扱えます。通常の画面操作は、WebMCP に対応していないブラウザーでも引き続き利用できます。

## Chrome で試す

Chrome の WebMCP は実験段階です。ローカルで試すには、Chrome で `chrome://flags/#enable-webmcp-testing` を開き、Enabled にして再起動します。ページを開いた後、DevTools の **Application → WebMCP** で登録済みツールの確認と手動実行ができます。localhost 以外では HTTPS が必要です。

WebMCP はツールを公開する仕組みであり、それ自体が AI エージェントではありません。自然言語で操作するには、WebMCP に対応したエージェントや拡張機能が別途必要です。DevTools の手動実行はエージェントを使わずにツールを確認できます。

## エディターのツール

エディターを開いて保存済みのグラフの読み込みが完了すると、次のツールが登録されます。ページを離れると登録は解除されます。

- `get_graph_summary`: 件数、設定、現在の選択、Undo／Redo の可否と対象の操作名、保存状態、更新確認用の `revision` を取得します。`section` に `nodes` または `edges` を指定すると要素を最大10件ずつ取得でき、続きがあれば `nextOffset` が返ります。応答が大きくなる場合は1ページの件数がさらに減ります。選択 ID は一部のみ表示する場合があり、`nodeIdsTruncated` / `edgeIdsTruncated` で判別できます。後続ページに最初の `revision` を `expectedRevision` として渡すと、途中の編集を検知できます。選択、履歴と保存状態はグラフの revision とは独立に変わります。
- `find_graph_elements`: ID・ラベル・両端または色・重み・隣接関係の条件で要素を探し、該当件数とページを返します。画面の選択は変更しません。重複ラベルや平行辺は候補を返し、対象を勝手に選びません。各応答は最大12,000文字です。
- `get_incident_edges`: 指定した頂点につながる辺と相手の頂点を取得します。有向グラフでは入辺・出辺を指定でき、平行辺は別々に、自己ループは1件として返します。ページングと revision の照合に対応し、応答は最大12,000文字です。
- `get_graph`: グラフ全体をテキストで取得します。`format` は省略時 `json`、ほかに `edge-list`、`adjacency-list`、`adjacency-matrix`、`tikz` を指定できます。JSON は座標や色などを保持します。数値形式に変換した結果、元の頂点ラベルが連番に置き換わる場合は `nodeLabelsRenumbered` が `true` になります。通常の応答が16,000文字を超える場合は全文を返さず、完全な書き出しが必要なときに `allowLargeOutput: true` で明示的に取得できます。
- `replace_graph`: グラフ全体を入力データで置き換えます。`input`、入力形式の `format`、最新の `revision` を渡す `expectedRevision` が必要です。形式は `json`、`contest-edge-list`、`tree-edge-list`、`parent-list`、`weighted-parent-list`、`edge-pairs`、`adjacency-list`、`adjacency-matrix` から明示します。テキスト形式では `directed`、`weighted`、`indexBase` も指定できます。
- `add_node`: 既存の頂点を動かさずに頂点を追加します。ラベルや座標を指定でき、座標を省略した場合は他の頂点と重ならない位置を探します。
- `add_graph_elements`: 複数の頂点と辺を一度に追加します。新しく作る頂点も一意なラベルで辺の端点に指定できます。全対象と制約が有効な場合に1回の操作として追加します。
- `add_edge`: 両端を頂点の `id` または一意な `label` で指定して辺を追加します。重み付きグラフでは数値または文字列の `weight` も指定できます。
- `update_graph_elements`: 1つまたは複数の頂点や辺のラベル・色・重みや頂点の座標を一度に変更します。頂点や辺ごとに異なる変更を指定でき、共通色を指定することもできます。`allNodes` と `nodeColor`、`allEdges` と `edgeColor` で全頂点・全辺の色をまとめて変更できます。`selectedNodes` または `selectedEdges` と共通色で現在選択中の全件も対象にできます。`nodeFilter` または `edgeFilter` に条件を指定すると、画面の選択を変えずに一致した要素の色を変更します。
- 条件には、頂点の色・指定頂点との隣接関係、辺の色・数値重みの範囲を指定できます。同じ対象の条件はすべて満たす必要があります。重みの上下限は境界を含み、十進数として丸めずに比較します。桁の大きい整数や高精度の小数を境界に指定する場合は、JSON の数値ではなく文字列を使います。十進表記でない重みや、256文字を超える値、指数の絶対値が 10,000 を超える値は比較対象から除外し、その件数を返します。重みのない辺は 1 として扱います。隣接先の基準頂点は自己ループがあっても含めません。有向グラフでは入辺・出辺・両方向を選べます。空の条件は拒否します。
- `select_graph_elements`: 条件に合う頂点・辺で、現在の画面の選択を置き換えます。条件を指定しなかった種類も含めて以前の選択を置き換えます。選択の変更自体はグラフの編集履歴や保存対象には入りません。
- `arrange_graph_nodes`: 指定した頂点、条件に合う頂点、選択中の頂点、または全頂点を相対的に配置します。平行移動、水平・垂直整列、基準頂点から指定した距離への配置に対応します。座標と移動量はグラフ座標で、右と下が正です。整列の基準頂点を省略すると対象の平均座標に揃えます。選択中の頂点を対象にする場合は選択の revision も必要です。
- `delete_graph_elements`: 1つまたは複数の頂点や辺を一度に削除します。ID・ラベル・両端や条件による指定のほか、`selectedNodes` / `selectedEdges` で現在の選択全体も指定できます。頂点に接続する辺も削除され、結果には実際に削除した数が返ります。
- `reverse_edges`: 指定した辺、条件に合う辺、選択中の辺、またはすべての辺の向きを一度に反転します。有向グラフ専用で、自己ループは変更しません。反転が制約に違反する場合は全体を拒否します。
- `update_graph_settings`: 有向・重み付き・番号の開始値・グリッド吸着・頂点ラベル表示を変更します。開始値の変更では数値の頂点ラベルも変わる場合があり、重みを有効にすると未設定の重みに 1 が入ります。
- `edit_history`: `undo` または `redo` を実行します。画面から人が行った操作も履歴の対象です。履歴は現在のセッション中のみ利用できます。
- `apply_layout`: `kind` でレイアウトを選んで適用します。`bfs`・`tree`・`radial` では `rootNodeId` も指定できます。省略時はレイアウトの既定の根を使います。画面の選択を根にしたい場合は概要の選択から ID を確認して明示します。適用条件は画面と同じです。

変更ツールには、直前のグラフ取得で返された `revision` を `expectedRevision` として渡します。取得後にグラフが変わった場合、再取得が必要です。変更は画面に反映され、同じセッション中は元に戻せます。ローカル保存は通常のエディターと同じく非同期で行われるため、ツールの成功応答は保存完了の保証ではありません。変更の成功応答と `get_graph_summary` の `storage.status` で現在の `saved`・`pending`・`failed`・`conflict`・`unavailable`・`invalid` を確認でき、`storage.scope` は通常のグラフか独立した記事の例かを表します。テキストからの置き換えは既存設定を引き継ぎ、入力の一部しか読み込めない場合は置き換えません。JSON 以外はグラフの見た目を完全には保持しません。

`get_graph_summary` の応答は16,000文字以内です。要素1件だけで上限を超える場合は、その内容や ID を途中で切り詰めずエラーを返します。全文が必要な場合は明示的な大容量書き出しを使ってください。上限はエージェントに返す内容の制限であり、エディター内での保存・Undo 用シリアライズを省くものではありません。

たとえば「4 頂点の木を作り、頂点 1 を赤にして、木の形に並べる」場合は、`get_graph_summary` で revision を確認し、`replace_graph`、`update_graph_elements`、`apply_layout` を順に使います。それぞれの成功結果に次の revision が返ります。ツールを通した実行時の画面への反映も確認してください。

一括編集と一括削除は、指定された対象を変更前のグラフで解決し、すべてが有効な場合に1回の操作として確定します。存在しない対象、重複した対象、同名の頂点や平行辺による曖昧な指定が含まれると、全体を変更せずにエラーを返します。人が行った他の編集と同じように Undo／Redo を使えます。画面の選択全体を対象にする場合は、概要の `selection.revision` を `expectedSelectionRevision` として渡す必要があります。グラフ本体の `expectedRevision` とは別に選択の変更も検知し、古い選択に対する操作を拒否します。選択 ID をすべてエージェントへ送る必要はありません。

Chrome は Chrome 149 から Origin Trial も提供していますが、このアプリでは本番用の Origin Trial 登録やトークンの設定は行っていません。したがって、コードの対応だけで通常の Chrome で自動的に利用できるとは限りません。

開発時の自動確認には、`127.0.0.1:3323` でアプリを起動した状態で `bun tests/browser/webmcp.mjs` を実行します。Playwright の隔離 Chromium でネイティブ WebMCP を有効にし、登録、操作、画面への反映、Undo／Redo を確認します。通常の `bun run check` には、ブラウザーを起動しないツールの検証も含まれます。

自然言語から Codex がツールを選ぶ探索的評価と再実行方法は [WebMCP の操作評価](verification/webmcp-agent-evaluation.md) に記録しています。

## 実装とプライバシー

現行の Imperative API は `document.modelContext.registerTool()` を使い、ページ内の操作を JSON Schema 付きで登録します。未対応の環境では機能検出によって登録を省略します。仕様とブラウザー実装は変更される可能性があります。古い資料の `navigator.modelContext` は現行 API とは異なるため、変更時は公式資料を確認してください。

ツールに渡した入力やツールが返すグラフの内容は、利用するエージェントに渡ります。外部の AI サービスを使うエージェントでは、そのサービスに送信される可能性があります。利用前にエージェントのデータの取り扱いを確認してください。ツールの説明や JSON Schema は実行時の入力検証に代わるものではありません。

## 参考資料

- [Chrome: WebMCP](https://developer.chrome.com/docs/ai/webmcp)
- [Chrome: Imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
- [Chrome DevTools: Debug WebMCP tools](https://developer.chrome.com/docs/devtools/application/webmcp)
- [Chrome: WebMCP tool security](https://developer.chrome.com/docs/ai/webmcp/secure-tools)
- [WebMCP explainer](https://github.com/webmachinelearning/webmcp/blob/main/README.md)
