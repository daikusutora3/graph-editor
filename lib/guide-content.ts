import type { AppLocale } from "./site-metadata";

export type GuideSection = {
  id: string;
  navTitle: string;
  title: string;
  description?: string;
  paragraphs?: string[];
  steps?: { title: string; description: string }[];
  items?: string[];
  table?: { title: string; head: [string, string]; rows: [string, string][] };
  shortcuts?: { action: string; keys: string[] }[];
  note?: { title: string; text: string };
};

export type GuideCopy = {
  title: string;
  guideLink: string;
  description: string;
  heading: string;
  openApp: string;
  breadcrumbHome: string;
  languages: string;
  languageName: string;
  skipToContent: string;
  backToTop: string;
  footerTitle: string;
  footerDescription: string;
  githubLink: string;
  quickStartNavTitle: string;
  quickStartTitle: string;
  quickStartIntro: string;
  quickStartCards: {
    id: "data" | "sample" | "draw";
    title: string;
    description: string;
    targetId: string;
  }[];
  sections: GuideSection[];
  shortcutsNote: string;
  faqTitle: string;
  faqIntro: string;
  faq: { question: string; answer: string }[];
};

const formatRows: Record<AppLocale, [string, string][]> = {
  ja: [
    ["頂点数と辺数つき辺リスト", "4 4\n1 2\n2 3\n2 4\n3 4"],
    ["辺の組リスト（ヘッダーなし）", "1 2\n2 3"],
    ["木の辺リスト（N のあと N−1 本）", "4\n1 2\n1 3\n3 4"],
    ["親配列", "4\n1 1 3"],
    ["重み付き親配列", "4\n1 5\n1 3\n3 2"],
    ["隣接リスト", "1: 2 3\n2: 4"],
    ["隣接行列", "0 1 1\n1 0 1\n1 1 0"],
    [
      "Graph Editor JSON（空のグラフ）",
      '{\n  "version": 1,\n  "nodes": [],\n  "edges": [],\n  "settings": {}\n}',
    ],
  ],
  en: [
    ["Edge list with N M header", "4 4\n1 2\n2 3\n2 4\n3 4"],
    ["Edge pairs (no header)", "1 2\n2 3"],
    ["Tree edge list (N, then N−1 edges)", "4\n1 2\n1 3\n3 4"],
    ["Parent list", "4\n1 1 3"],
    ["Weighted parent list", "4\n1 5\n1 3\n3 2"],
    ["Adjacency list", "1: 2 3\n2: 4"],
    ["Adjacency matrix", "0 1 1\n1 0 1\n1 1 0"],
    [
      "Graph Editor JSON (empty graph)",
      '{\n  "version": 1,\n  "nodes": [],\n  "edges": [],\n  "settings": {}\n}',
    ],
  ],
  "zh-Hans": [
    ["带 N M 首行的边列表", "4 4\n1 2\n2 3\n2 4\n3 4"],
    ["边对列表（无首行）", "1 2\n2 3"],
    ["树的边列表（N 之后 N−1 条边）", "4\n1 2\n1 3\n3 4"],
    ["父数组", "4\n1 1 3"],
    ["带权父数组", "4\n1 5\n1 3\n3 2"],
    ["邻接表", "1: 2 3\n2: 4"],
    ["邻接矩阵", "0 1 1\n1 0 1\n1 1 0"],
    [
      "Graph Editor JSON（空图）",
      '{\n  "version": 1,\n  "nodes": [],\n  "edges": [],\n  "settings": {}\n}',
    ],
  ],
};

export const guideCopy: Record<AppLocale, GuideCopy> = {
  ja: {
    title: "辺リスト・隣接行列からグラフを描画する方法 | Graph Editor",
    guideLink: "使い方ガイド",
    description:
      "Graph Editor の使い方。辺リストと隣接行列の入力例、手描き、自動配置、PNG と JSON の保存、キーボード操作、トラブルの対処を説明します。",
    heading: "使い方ガイド",
    openApp: "エディタに戻る",
    breadcrumbHome: "Graph Editor",
    languages: "ガイドの言語",
    languageName: "日本語",
    skipToContent: "ガイド本文へ移動",
    backToTop: "ページの先頭へ",
    footerTitle: "エディタで試す",
    footerDescription: "入力例かサンプルを読み込めば、すぐに試せます。",
    githubLink: "GitHub でソースコードを見る",
    quickStartNavTitle: "はじめ方",
    quickStartTitle: "最初のグラフを作る",
    quickStartIntro: "始め方は 3 通りあります。",
    quickStartCards: [
      {
        id: "data",
        title: "データから作る",
        description: "問題文の入力や辺リストを貼り付けて図にします。",
        targetId: "examples",
      },
      {
        id: "sample",
        title: "サンプルから選ぶ",
        description: "木や閉路などのサンプルから始めます。",
        targetId: "layouts",
      },
      {
        id: "draw",
        title: "自分で描く",
        description: "キャンバスに頂点を置き、辺でつないで描きます。",
        targetId: "draw",
      },
    ],
    sections: [
      {
        id: "import",
        navTitle: "データの読み込み",
        title: "テキストやファイルを読み込む",
        description:
          "貼り付けたテキストやファイルを、プレビューで確かめてから図にします。",
        steps: [
          {
            title: "「読み込み」を開く",
            description:
              "テキストを貼り付けるか、「ファイルを開く」でテキストファイルか Graph Editor の JSON を選びます。",
          },
          {
            title: "形式とプレビューを確認する",
            description:
              "形式は自動で判定されます。複数の形式として読めるときは「形式」で選び直します。頂点番号が 0 始まりか 1 始まりかも推定するので、プレビューのラベルで確かめてください。",
          },
          {
            title: "「グラフに反映」を押す",
            description:
              "今のグラフが読み込んだ内容に置き換わります。警告が出ているときは、内容を確かめてから反映します。間違えても「戻す」で元に戻せます。",
          },
        ],
        table: {
          title: "対応する入力形式",
          head: ["対応する形式", "入力例"],
          rows: formatRows.ja,
        },
        note: {
          title: "重みと向き",
          text: "辺リストの 3 列目に数値や文字を書くと、重みとして読み込み、重みありに切り替わります。文字ラベル付きで先頭行が N M K の入力は、M 本の辺がそろっていれば K を除いて読み込みます。有向グラフにするときは「設定」で「有向」を選びます。",
        },
      },
      {
        id: "draw",
        navTitle: "頂点と辺の編集",
        title: "頂点を置いて辺でつなぐ",
        description: "ツールバーのモードを切り替えながら描きます。",
        steps: [
          {
            title: "「頂点」で頂点を置く",
            description:
              "キャンバスの空いている場所をクリック（スマートフォンではタップ）します。N キーでもこのモードになります。",
          },
          {
            title: "「辺」で 2 つの頂点をつなぐ",
            description:
              "始点、終点の順に頂点を選びます。有向グラフでは始点から終点へ矢印が付きます。やめるときは空白をクリックするか、Esc を押します。",
          },
          {
            title: "「選択」で位置を整える",
            description:
              "頂点はドラッグで移動、辺はドラッグで曲がります。選んだ頂点や辺は、画面下の操作バーから編集や削除ができます。",
          },
        ],
        items: [
          "まとめて選ぶときは、選択モードで Shift を押しながらドラッグします。「選択」の横の ⌄ で、範囲選択の対象を「すべて」「頂点だけ」「辺だけ」から選べます。",
          "Ctrl（Mac は ⌘）+ Shift + ドラッグで頂点だけ、Ctrl（Mac は ⌘）+ Alt + ドラッグで辺だけを範囲選択します。",
          "ラベルや重みは、ダブルクリックするか、選んで Enter を押すとその場で書き換えられます。右クリックのメニューからも編集できます。",
        ],
      },
      {
        id: "appearance",
        navTitle: "色とグラフ設定",
        title: "色、ラベル、グラフの種類を変える",
        description:
          "色で一部を目立たせたり、有向・重み付きに切り替えたりします。",
        items: [
          "頂点や辺を選び、操作バーの色を押すと色が変わります。複数まとめても変えられ、C キーを押すたびに次の色になります。",
          "「設定」では、有向か無向か、重みの有無、0-indexed か 1-indexed かを選びます。矢印の大きさと頂点ラベルの表示もここで変えます。",
          "有向グラフでは、辺を選んで「向き反転」を押すと向きが逆になります。すべての辺を逆にするなら「設定」の「全辺を反転」を使います。",
          "手で曲げた辺は「自動配置に戻す」で元の経路に戻ります。右クリックメニューの「左へ曲げる」「右へ曲げる」でも曲げられます。",
          "「ドラッグをグリッドに吸着」をオンにすると、頂点を動かしたときに位置がそろいます。",
        ],
      },
      {
        id: "layouts",
        navTitle: "サンプルと配置",
        title: "サンプルを試して配置を選ぶ",
        description: "つながりはそのままで、頂点の並べ方だけを変えます。",
        paragraphs: [
          "「読み込み」の「サンプルを使う」から、木・閉路・格子などのグラフを選べます。名前やカテゴリで絞り込めて、頂点数などを変えてから作成することもできます。",
          "並べ直すときは「配置」（L）を開きます。迷ったら「自動配置」、形を見比べたいときは「円形」や「格子」を試してみてください。",
        ],
        items: [
          "木や森には「木」、有向非巡回グラフには「DAG」、二部グラフには「二部」が向いています。グラフが条件を満たさない配置は押せず、理由が表示されます。",
          "「BFS層」は始点からの距離ごとに段に、「放射」は距離ごとに同心円状に並べます。先に頂点を 1 つ選んでおくと、その頂点が始点（「木」では根）になります。",
          "「SCC」は有向グラフの頂点を強連結成分ごとにまとめます。ほかに「直線」「同心円」「重なり解消」があります。",
          "「辺をずらして重なりを避ける」をオンにすると、頂点の上を通る辺などを自動で曲げます。それでも重なるときは、頂点を動かすか辺を手で曲げてください。",
        ],
        note: {
          title: "元の配置に戻すには",
          text: "「戻す」で直前の配置に戻ります。大きなグラフでは使えない配置があります。",
        },
      },
      {
        id: "export",
        navTitle: "書き出しと保存",
        title: "形式を選んで書き出す",
        description:
          "続きを編集するなら JSON、図として共有するなら PNG が基本です。",
        steps: [
          {
            title: "あとで編集するなら JSON",
            description:
              "「書き出し」で「JSON」を選び、.json ファイルとして保存します。頂点・辺・ラベル・位置・色・辺の曲げ・設定がすべて残り、続きは「読み込み」から開けます。",
          },
          {
            title: "図を共有するなら PNG",
            description:
              "「PNG」で範囲（全体か表示範囲）、背景、余白を決めます。画像サイズは長辺の長さ・今の倍率・固定サイズから選び、プレビューを見てから保存かコピーをします。",
          },
          {
            title: "つながりだけ書き出すならテキスト",
            description:
              "「書き出し」で辺リスト・隣接リスト・隣接行列を選びます。位置・色・辺の曲げは含まれず、独自のラベルは番号に置き換わることがあります。その形式で表せない辺や重みがあるときは、JSON か対応する辺リストを使ってください。",
          },
          {
            title: "TeX 文書に入れるなら TikZ",
            description:
              "「TikZ (TeX)」を選び、コードをコピーするか .tex ファイルで保存します。必要なパッケージはコード冒頭のコメントに書いてあります。日本語のラベルは LuaLaTeX と luatexja で組版してください。",
          },
        ],
        note: {
          title: "自動保存とバックアップ",
          text: "編集内容はこのブラウザのローカルストレージに自動で保存されます。保存に失敗したときや別のタブと内容がぶつかったときは、JSON に書き出して手元に残してください。JSON に操作履歴と表示倍率は含まれません。",
        },
      },
      {
        id: "shortcuts",
        navTitle: "キーボード操作",
        title: "キーボードで操作する",
        description: "入力欄で文字を打っていないときに使えます。",
        shortcuts: [
          { action: "選択 / 頂点 / 辺モード", keys: ["V", "N", "E"] },
          { action: "選択や辺の作成を解除", keys: ["Esc"] },
          { action: "選択した要素を削除", keys: ["Delete", "Backspace"] },
          { action: "戻す", keys: ["Ctrl+Z", "⌘Z"] },
          { action: "進む", keys: ["Ctrl+Shift+Z", "⌘⇧Z", "Ctrl+Y"] },
          { action: "すべて選択", keys: ["Ctrl+A", "⌘A"] },
          {
            action: "選択をコピー / 切り取り / 貼り付け",
            keys: ["Ctrl / ⌘ + C / X / V"],
          },
          { action: "ラベルや重みを編集", keys: ["Enter"] },
          { action: "選択した要素の色を変更", keys: ["C"] },
          { action: "選択した頂点を少し移動", keys: ["← ↑ → ↓"] },
          { action: "選択した頂点を大きく移動", keys: ["Shift + ← ↑ → ↓"] },
          { action: "グラフ全体を表示", keys: ["Shift+1"] },
          { action: "表示倍率を 100% に戻す", keys: ["Ctrl+0", "⌘0"] },
          { action: "配置 / 設定 / ショートカット一覧", keys: ["L", ",", "?"] },
        ],
        note: {
          title: "コピーと貼り付けについて",
          text: "Ctrl / ⌘ + C・X・V は、エディタ内で選んだ頂点や辺のコピー・切り取り・貼り付けです。問題文などのテキストは「読み込み」に貼り付けます。",
        },
      },
      {
        id: "touch",
        navTitle: "画面移動とタッチ",
        title: "表示の移動とスマートフォンでの操作",
        description: "表示を動かしても、頂点の位置は変わりません。",
        items: [
          "キャンバスの空白をドラッグすると表示が動きます。スマートフォンでは 2 本指で拡大・縮小と移動ができます。",
          "頂点は「頂点」で空白をタップ、辺は「辺」で 2 つの頂点を順にタップして追加します。",
          "「選択」で頂点や辺をタップすると操作バーが出て、色・ラベル・削除を選べます。ドラッグすれば頂点の移動や辺の曲げもできます。",
          "グラフが画面の外に出たら「グラフを表示領域に戻す」を押します。キーボードなら Shift+1 です。",
        ],
      },
    ],
    shortcutsNote: "Windows と Linux では Ctrl、Mac では ⌘ を使います。",
    faqTitle: "困ったときは",
    faqIntro: "よくある質問と対処法です。",
    faq: [
      {
        question: "読み込み結果が思ったものと違うときは？",
        answer:
          "「形式」を明示的に選んでから、先頭行の頂点数と辺数、各行の列数、頂点番号が 0 始まりか 1 始まりかを確かめてください。反映する前に警告とプレビューも見ておくと確実です。有向・無向は「設定」で切り替えます。",
      },
      {
        question: "データはどこに保存されますか？",
        answer:
          "このブラウザのローカルストレージに保存されます。サーバーには送られず、ほかのブラウザや端末とも同期しません。サイトデータを消すとグラフも消えるので、大事なものは JSON で書き出しておいてください。",
      },
      {
        question: "自動保存に失敗したり、別タブと競合したりしたときは？",
        answer:
          "作業中の内容は画面に残っています。まず「今のグラフを保存」で手元に保存してください。保存の失敗なら「再試行」、別タブとの競合なら内容を見比べて「別タブの内容を使う」を選べます。自動保存が使えない環境では、JSON で保存しながら作業してください。",
      },
      {
        question: "グラフの大きさに上限はありますか？",
        answer:
          "1,000 頂点、5,000 辺までです。ラベルなどの文字列は 256 文字、テキスト入力は 1,000,000 文字、JSON は 2,000,000 文字まで扱えます。大きなグラフでは一部の配置が使えず、辺の回避や重なり解消をしても重なりが残ることがあります。",
      },
      {
        question: "画像やテキストをコピーできないときは？",
        answer:
          "ブラウザのクリップボード権限によってはコピーできません。PNG は「保存」、テキストはファイルとして保存してください。選んだ形式でグラフを表せないときは、JSON など別の形式にします。",
      },
      {
        question: "グラフが表示されないときは？",
        answer:
          "画面の外にあるだけなら、全体表示で戻ります。表示エラーが出ているときは、JSON で保存してから「再試行」を押してください。サンプルの読み込みに失敗したときも再試行でき、貼り付け画面に戻って続けることもできます。",
      },
      {
        question: "利用に料金や登録は必要ですか？",
        answer:
          "無料で、登録もいりません。ソースコードは GitHub で公開しています。",
      },
    ],
  },
  en: {
    title: "Draw graphs from edge lists and adjacency matrices | Graph Editor",
    guideLink: "User guide",
    description:
      "Learn Graph Editor with edge-list and matrix examples, manual editing, automatic layouts, PNG and JSON exports, keyboard shortcuts, and troubleshooting.",
    heading: "User guide",
    openApp: "Back to editor",
    breadcrumbHome: "Graph Editor",
    languages: "Guide language",
    languageName: "English",
    skipToContent: "Skip to guide content",
    backToTop: "Back to top",
    footerTitle: "Try it in the editor",
    footerDescription: "Load an example or a sample to try it right away.",
    githubLink: "View source on GitHub",
    quickStartNavTitle: "Getting started",
    quickStartTitle: "Make your first graph",
    quickStartIntro: "There are three ways to start.",
    quickStartCards: [
      {
        id: "data",
        title: "Start from data",
        description: "Paste input from a problem or an edge list.",
        targetId: "examples",
      },
      {
        id: "sample",
        title: "Choose a sample",
        description: "Start from a tree, a cycle, or another sample.",
        targetId: "layouts",
      },
      {
        id: "draw",
        title: "Draw your own",
        description: "Place nodes on the canvas and connect them.",
        targetId: "draw",
      },
    ],
    sections: [
      {
        id: "import",
        navTitle: "Load data",
        title: "Load text or a file",
        description:
          "Paste text or open a file, check the preview, then apply it.",
        steps: [
          {
            title: "Open Load",
            description:
              "Paste text, or use Open file to pick a text file or a Graph Editor JSON file.",
          },
          {
            title: "Check the format and preview",
            description:
              "The format is detected for you. If the input fits more than one format, pick one in Format. Numbering from 0 or 1 is guessed too, so check the labels in the preview.",
          },
          {
            title: "Choose Apply to graph",
            description:
              "Your current graph is replaced by the preview. If there are warnings, read them first. Undo brings the previous graph back.",
          },
        ],
        table: {
          title: "All supported input formats",
          head: ["Supported format", "Example input"],
          rows: formatRows.en,
        },
        note: {
          title: "Weights and direction",
          text: "A third column in an edge list is read as a weight (a number or text) and turns weights on. For text-labeled input with an N M K header, K is ignored as long as all M edge rows are present. For a directed graph, choose Directed in Settings.",
        },
      },
      {
        id: "draw",
        navTitle: "Edit nodes and edges",
        title: "Place nodes and connect them",
        description: "Switch between the toolbar modes as you draw.",
        steps: [
          {
            title: "Add nodes with Node",
            description:
              "Click (or tap) an empty spot on the canvas. N switches to this mode.",
          },
          {
            title: "Connect nodes with Edge",
            description:
              "Pick the source, then the target. In a directed graph the arrow points from source to target. Click empty space or press Esc to stop.",
          },
          {
            title: "Arrange with Select",
            description:
              "Drag a node to move it, or an edge to bend it. Selecting either shows the action bar at the bottom, where you can edit or delete it.",
          },
        ],
        items: [
          "To select several items, hold Shift and drag in Select mode. The ⌄ next to Select sets whether box selection picks everything, nodes only, or edges only.",
          "Ctrl (⌘ on Mac) + Shift + drag selects only nodes; Ctrl (⌘ on Mac) + Alt + drag selects only edges.",
          "To rename a node or change a weight, double-click it, or select it and press Enter. The right-click menu has the same options.",
        ],
      },
      {
        id: "appearance",
        navTitle: "Colors and settings",
        title: "Change colors, labels, and graph settings",
        description:
          "Color parts of the graph, or switch it to directed or weighted.",
        items: [
          "Select nodes or edges and pick a color in the action bar. It works on several items at once, and C cycles through the colors.",
          "In Settings, choose directed or undirected, weighted or unweighted, and 0-indexed or 1-indexed. Arrow size and node labels are set there too.",
          "In a directed graph, select an edge and choose Reverse to flip it. Reverse all edges in Settings flips every edge.",
          "Return to automatic routing undoes a manual bend. You can also bend an edge with Bend left and Bend right in the right-click menu.",
          "Turn on Snap drags to grid to line nodes up as you move them.",
        ],
      },
      {
        id: "layouts",
        navTitle: "Samples and layouts",
        title: "Try a sample and choose a layout",
        description: "Rearrange nodes without changing how they connect.",
        paragraphs: [
          "In Load, Use a sample offers trees, cycles, grids, and more. Search by name or category, and adjust values such as the node count before creating one.",
          "Open Layout (L) to rearrange. Auto layout is a good default; Circle and Grid are handy for comparing shapes.",
        ],
        items: [
          "Tree suits trees and forests, DAG suits directed acyclic graphs, and Bipartite suits bipartite graphs. A layout that does not fit the graph is disabled, with the reason shown.",
          "BFS layers puts nodes in rows by distance from a start node; Radial puts those rows on circles. Select a node first to make it the start (or the root, for Tree).",
          "SCC groups a directed graph by strongly connected component. Line, Concentric, and Resolve overlap are also available.",
          "With Offset overlapping edges on, edges that would cross a node are bent around it where possible. If something still overlaps, move a node or bend the edge by hand.",
        ],
        note: {
          title: "Going back",
          text: "Undo returns to the previous layout. Some layouts are unavailable for large graphs.",
        },
      },
      {
        id: "export",
        navTitle: "Export and save",
        title: "Export your graph",
        description:
          "Use JSON to keep editing later, and PNG to share a picture.",
        steps: [
          {
            title: "JSON to keep editing",
            description:
              "In Export, choose JSON and save the .json file. It keeps nodes, edges, labels, positions, colors, bends, and settings; open it with Load to continue.",
          },
          {
            title: "PNG to share a picture",
            description:
              "In PNG, choose the whole graph or the current view, then the background and padding. Size the image by its long edge, the current zoom, or a fixed canvas, check the preview, and save or copy it.",
          },
          {
            title: "Text for the connections only",
            description:
              "In Export, choose Edge list, Adjacency list, or Adjacency matrix. Positions, colors, and bends are left out, and custom labels may become numbers. If a format can't express your edges or weights, use JSON or a matching edge list.",
          },
          {
            title: "TikZ for TeX documents",
            description:
              "Choose TikZ (TeX), then copy the code or save a .tex file. The packages you need are listed in the comments at the top. Japanese labels need LuaLaTeX with luatexja; other Unicode labels need a suitable engine and fonts.",
          },
        ],
        note: {
          title: "Autosave and backups",
          text: "Your work is saved automatically in this browser's local storage. If saving fails or another tab changes the graph, export it as JSON to keep a copy. JSON does not include undo history or the current zoom.",
        },
      },
      {
        id: "shortcuts",
        navTitle: "Keyboard shortcuts",
        title: "Work with the keyboard",
        description: "These work whenever you are not typing in a field.",
        shortcuts: [
          { action: "Select / Node / Edge mode", keys: ["V", "N", "E"] },
          {
            action: "Clear selection or cancel drawing an edge",
            keys: ["Esc"],
          },
          { action: "Delete selected elements", keys: ["Delete", "Backspace"] },
          { action: "Undo", keys: ["Ctrl+Z", "⌘Z"] },
          { action: "Redo", keys: ["Ctrl+Shift+Z", "⌘⇧Z", "Ctrl+Y"] },
          { action: "Select all", keys: ["Ctrl+A", "⌘A"] },
          {
            action: "Copy / cut / paste a selection",
            keys: ["Ctrl / ⌘ + C / X / V"],
          },
          { action: "Edit a label or weight", keys: ["Enter"] },
          { action: "Cycle selected colors", keys: ["C"] },
          { action: "Nudge selected nodes", keys: ["← ↑ → ↓"] },
          {
            action: "Move selected nodes by a larger step",
            keys: ["Shift + ← ↑ → ↓"],
          },
          { action: "Fit the whole graph to view", keys: ["Shift+1"] },
          { action: "Reset zoom to 100%", keys: ["Ctrl+0", "⌘0"] },
          {
            action: "Layout / Settings / shortcut list",
            keys: ["L", ",", "?"],
          },
        ],
        note: {
          title: "About copy and paste",
          text: "Ctrl / ⌘ + C, X, and V copy, cut, and paste nodes and edges inside the editor. To bring in text from elsewhere, paste it into Load.",
        },
      },
      {
        id: "touch",
        navTitle: "View and touch controls",
        title: "Move the view and work on a phone",
        description: "Moving the view never moves your nodes.",
        items: [
          "Drag empty canvas to pan. On a phone, use two fingers to zoom and pan.",
          "In Node, tap empty space to add a node; in Edge, tap two nodes in turn to connect them.",
          "In Select, tap a node or edge to bring up the action bar for color, label, and delete. Drag to move nodes or bend edges.",
          "If the graph drifts off screen, use Fit graph to view, or press Shift+1.",
        ],
      },
    ],
    shortcutsNote: "Use Ctrl on Windows and Linux, and ⌘ on Mac.",
    faqTitle: "Troubleshooting",
    faqIntro: "Common questions and fixes.",
    faq: [
      {
        question: "Why does my input produce a different graph?",
        answer:
          "Pick the format yourself, then check the counts on the first line, the number of columns, and whether numbering starts at 0 or 1. Look at the warnings and preview before applying. Directed or undirected is set in Settings.",
      },
      {
        question: "Where is my graph saved?",
        answer:
          "In this browser's local storage. Nothing is sent to a server, and it doesn't sync to other browsers or devices. Clearing this site's data deletes it, so export anything important as JSON.",
      },
      {
        question:
          "What should I do if autosave fails or another tab changes the graph?",
        answer:
          "Your work stays on screen. Choose Save my graph first to download a JSON copy. Then use Retry for a failed save, or compare and choose Use the other tab's graph for a conflict. Where autosave isn't available, save JSON files as you go.",
      },
      {
        question: "How large can a graph be?",
        answer:
          "Up to 1,000 nodes and 5,000 edges. Labels and other text fields hold up to 256 characters; pasted text up to 1,000,000 characters and JSON up to 2,000,000. Large graphs can't use some layouts, and a few overlaps may remain after automatic routing.",
      },
      {
        question: "What if copying an image or text fails?",
        answer:
          "Your browser's clipboard permissions may block it. Save the PNG, or download the text as a file instead. If the chosen format can't express the graph, switch to one that can, such as JSON.",
      },
      {
        question: "What if I cannot see the graph?",
        answer:
          "If it's just off screen, fit it to view. If a display error appears, save a JSON copy and choose Retry. A sample that fails to load can be retried too, or you can go back to pasting.",
      },
      {
        question: "Do I need to pay or create an account?",
        answer: "It's free and needs no account. The source code is on GitHub.",
      },
    ],
  },
  "zh-Hans": {
    title: "用边列表和邻接矩阵绘制图形 | Graph Editor",
    guideLink: "使用指南",
    description:
      "Graph Editor 使用方法：边列表和矩阵输入示例、手动编辑、自动布局、PNG 与 JSON 保存、键盘操作及常见问题处理。",
    heading: "使用指南",
    openApp: "返回编辑器",
    breadcrumbHome: "Graph Editor",
    languages: "指南语言",
    languageName: "简体中文",
    skipToContent: "跳转到指南正文",
    backToTop: "返回顶部",
    footerTitle: "在编辑器中试一试",
    footerDescription: "加载输入示例或预设示例，马上就能试用。",
    githubLink: "在 GitHub 查看源代码",
    quickStartNavTitle: "开始使用",
    quickStartTitle: "创建第一张图",
    quickStartIntro: "有三种开始方式。",
    quickStartCards: [
      {
        id: "data",
        title: "从数据创建",
        description: "粘贴题目中的输入或边列表。",
        targetId: "examples",
      },
      {
        id: "sample",
        title: "选择示例",
        description: "从树、环等预设示例开始。",
        targetId: "layouts",
      },
      {
        id: "draw",
        title: "自己绘制",
        description: "在画布上放置顶点，再用边连接。",
        targetId: "draw",
      },
    ],
    sections: [
      {
        id: "import",
        navTitle: "加载数据",
        title: "加载文本或文件",
        description: "粘贴文本或打开文件，确认预览后再应用。",
        steps: [
          {
            title: "打开“加载”",
            description:
              "粘贴文本，或用“打开文件”选择文本文件或 Graph Editor 的 JSON。",
          },
          {
            title: "检查格式和预览",
            description:
              "格式会自动识别；如果输入符合多种格式，在“格式”中重新选择。编号从 0 还是 1 开始也会自动推断，请在预览里核对标签。",
          },
          {
            title: "点击“应用到图”",
            description:
              "当前的图会被预览内容替换。有警告时先看清内容再应用；应用后也能用“撤销”恢复。",
          },
        ],
        table: {
          title: "支持的输入格式",
          head: ["支持的格式", "输入示例"],
          rows: formatRows["zh-Hans"],
        },
        note: {
          title: "权重与方向",
          text: "边列表第三列的数字或文字会作为权重读入，并自动切换为带权。首行为 N M K 的文字标签输入，只要 M 行边都在，就会忽略 K 读入。需要有向图时，在“设置”中选“有向”。",
        },
      },
      {
        id: "draw",
        navTitle: "编辑顶点和边",
        title: "放置顶点，再用边连接",
        description: "切换工具栏上的模式来绘制。",
        steps: [
          {
            title: "用“顶点”添加顶点",
            description:
              "点击（手机上轻触）画布空白处。按 N 也能切换到这个模式。",
          },
          {
            title: "用“边”连接两个顶点",
            description:
              "依次选择起点和终点，有向图会画出从起点指向终点的箭头。点空白处或按 Esc 可以取消。",
          },
          {
            title: "用“选择”调整位置",
            description:
              "拖动顶点可以移动，拖动边可以弯曲。选中后，在屏幕下方的操作栏里编辑或删除。",
          },
        ],
        items: [
          "选择模式下按住 Shift 拖动即可框选多个元素。“选择”旁的 ⌄ 用来切换框选范围：全部、仅顶点或仅边。",
          "Ctrl（Mac 为 ⌘）+ Shift + 拖动仅选择顶点；Ctrl（Mac 为 ⌘）+ Alt + 拖动仅选择边。",
          "双击，或选中后按 Enter，就能直接修改标签或权重。右键菜单里也有编辑项。",
        ],
      },
      {
        id: "appearance",
        navTitle: "颜色与设置",
        title: "修改颜色、标签和图设置",
        description: "给部分元素上色，或切换成有向图、带权图。",
        items: [
          "选中顶点或边，点操作栏里的颜色即可更改，多选时也一样。每按一次 C 换一种颜色。",
          "在“设置”中选择有向或无向、带权或无权、0-indexed 或 1-indexed。箭头大小和顶点标签也在这里设置。",
          "有向图中选中一条边即可反转方向；要反转所有边，用“设置”里的“反转全部边”。",
          "“恢复自动布线”可以撤销手动弯曲。右键菜单的“向左弯曲”“向右弯曲”也能弯曲边。",
          "开启“拖动吸附到网格”后，移动顶点时会自动对齐。",
        ],
      },
      {
        id: "layouts",
        navTitle: "示例与布局",
        title: "试用示例并选择布局",
        description: "连接关系不变，只改变顶点的排列。",
        paragraphs: [
          "在“加载”中点“使用示例”，可以选树、环、网格等。支持按名称或类别查找，也能先调整顶点数等参数再创建。",
          "重新排列时打开“布局”（L）。拿不准就用“自动布局”，想比较形状可以试“圆形”“网格”。",
        ],
        items: [
          "树或森林用“树”，有向无环图用“DAG”，二分图用“二分图”。不满足条件的布局无法选择，并会显示原因。",
          "“BFS 分层”按到起点的距离分层排列，“放射”把各层排成同心圆。先选中一个顶点，它就会作为起点（在“树”中作为根）。",
          "“SCC”把有向图按强连通分量分组。另外还有“直线”“同心圆”“消除重叠”。",
          "开启“错开重叠的边”后，穿过顶点的边会尽量自动绕开。仍有重叠时，移动顶点或手动弯曲边即可。",
        ],
        note: {
          title: "恢复原来的布局",
          text: "“撤销”可回到上一次的布局。大型图无法使用部分布局。",
        },
      },
      {
        id: "export",
        navTitle: "导出与保存",
        title: "选择格式导出",
        description: "以后还要编辑就用 JSON，作为图片分享就用 PNG。",
        steps: [
          {
            title: "用 JSON 保存以便再编辑",
            description:
              "在“导出”中选择“JSON”，保存为 .json 文件。顶点、边、标签、位置、颜色、弯曲和设置都会保留，之后从“加载”打开即可继续。",
          },
          {
            title: "用 PNG 分享图像",
            description:
              "在“PNG”中选择范围（整张图或当前视图）、背景和留白。图片尺寸可按长边、当前缩放或固定画布设置，看过预览后保存或复制。",
          },
          {
            title: "只导出连接关系时用文本",
            description:
              "在“导出”中选择边列表、邻接表或邻接矩阵。位置、颜色和弯曲不会导出，自定义标签可能变成编号。若该格式表示不了某些边或权重，请改用 JSON 或对应的边列表。",
          },
          {
            title: "放进 TeX 文档时用 TikZ",
            description:
              "选择“TikZ (TeX)”，复制代码或保存为 .tex 文件。需要的宏包写在代码开头的注释里。中文等标签需要支持这些字符的引擎和字体。",
          },
        ],
        note: {
          title: "自动保存和备份",
          text: "编辑内容会自动保存在当前浏览器的本地存储中。保存失败或与其他标签页冲突时，请导出 JSON 留一份副本。JSON 不包含撤销历史和缩放状态。",
        },
      },
      {
        id: "shortcuts",
        navTitle: "键盘快捷键",
        title: "使用键盘操作",
        description: "不在输入框中打字时可以使用。",
        shortcuts: [
          { action: "选择 / 顶点 / 边模式", keys: ["V", "N", "E"] },
          { action: "清除选择或取消创建边", keys: ["Esc"] },
          { action: "删除所选元素", keys: ["Delete", "Backspace"] },
          { action: "撤销", keys: ["Ctrl+Z", "⌘Z"] },
          { action: "重做", keys: ["Ctrl+Shift+Z", "⌘⇧Z", "Ctrl+Y"] },
          { action: "全选", keys: ["Ctrl+A", "⌘A"] },
          {
            action: "复制 / 剪切 / 粘贴所选内容",
            keys: ["Ctrl / ⌘ + C / X / V"],
          },
          { action: "编辑标签或权重", keys: ["Enter"] },
          { action: "切换所选颜色", keys: ["C"] },
          { action: "微移所选顶点", keys: ["← ↑ → ↓"] },
          { action: "以较大步长移动所选顶点", keys: ["Shift + ← ↑ → ↓"] },
          { action: "完整显示图", keys: ["Shift+1"] },
          { action: "恢复 100% 缩放", keys: ["Ctrl+0", "⌘0"] },
          { action: "布局 / 设置 / 快捷键列表", keys: ["L", ",", "?"] },
        ],
        note: {
          title: "关于复制与粘贴",
          text: "Ctrl / ⌘ + C、X、V 用于在编辑器内复制、剪切、粘贴顶点和边。题目等外部文本请粘贴到“加载”。",
        },
      },
      {
        id: "touch",
        navTitle: "视图与触控",
        title: "移动视图并在手机上编辑",
        description: "移动视图不会改变顶点的位置。",
        items: [
          "拖动画布空白处即可平移。手机上用双指缩放和平移。",
          "“顶点”模式下轻触空白处添加顶点，“边”模式下依次轻触两个顶点来连接。",
          "“选择”模式下轻触顶点或边会出现操作栏，可以改颜色、改标签或删除。拖动可移动顶点或弯曲边。",
          "图跑出屏幕时，用“适应视图”找回，或按 Shift+1。",
        ],
      },
    ],
    shortcutsNote: "Windows 和 Linux 使用 Ctrl，Mac 使用 ⌘。",
    faqTitle: "常见问题",
    faqIntro: "常见的问题和解决办法。",
    faq: [
      {
        question: "为什么加载结果与预期不同？",
        answer:
          "先手动选定格式，再检查首行的顶点数和边数、每行的列数，以及编号从 0 还是 1 开始。应用前看一下警告和预览。有向或无向在“设置”中切换。",
      },
      {
        question: "图保存在哪里？",
        answer:
          "保存在当前浏览器的本地存储中。不会上传到服务器，也不会同步到其他浏览器或设备。清除本站数据会一并删除，重要的图请导出 JSON。",
      },
      {
        question: "自动保存失败或与另一个标签页冲突怎么办？",
        answer:
          "当前内容仍在屏幕上。先用“保存当前的图”下载一份。保存失败可点重试；与其他标签页冲突时，比较内容后再选“使用另一个标签页的图”。无法自动保存时，边编辑边保存 JSON 文件。",
      },
      {
        question: "图的大小有上限吗？",
        answer:
          "最多 1,000 个顶点、5,000 条边。标签等文本最多 256 个字符，粘贴的文本最多 1,000,000 个字符，JSON 最多 2,000,000 个字符。大型图无法使用部分布局，自动布线后也可能残留少量重叠。",
      },
      {
        question: "无法复制图像或文本怎么办？",
        answer:
          "可能是浏览器的剪贴板权限限制了复制。请改为保存 PNG，或把文本下载为文件。如果所选格式表示不了这张图，换成 JSON 等格式。",
      },
      {
        question: "看不到图怎么办？",
        answer:
          "只是跑出屏幕的话，用适应视图即可找回。出现显示错误时，先保存 JSON 再重试。示例加载失败也能重试，或回到粘贴界面继续。",
      },
      {
        question: "需要付费或注册吗？",
        answer: "免费，无需注册。源代码在 GitHub 上公开。",
      },
    ],
  },
};

export const guideExampleCopy: Record<
  AppLocale,
  {
    heading: string;
    navTitle: string;
    copy: string;
    copySuccess: string;
    copyFailure: string;
    input: string;
    result: string;
    examples: readonly {
      navTitle: string;
      title: string;
      description: string;
      result: string;
    }[];
  }
> = {
  ja: {
    heading: "入力例と描画結果",
    navTitle: "入力例と図",
    copy: "入力例をコピー",
    copySuccess: "コピーしました",
    copyFailure: "コピーできません。入力例を選択してコピーしてください。",
    input: "入力例",
    result: "描画結果",
    examples: [
      {
        navTitle: "辺リスト",
        title: "辺リストから図を作る",
        description:
          "形式は「頂点数・辺数つき辺リスト」です。1 行目の 4 4 が頂点数と辺数で、2 行目以降の各行がつなぐ 2 頂点です。",
        result: "4 頂点、4 辺のグラフです。1–2、2–3、2–4、3–4 を結びます。",
      },
      {
        navTitle: "隣接行列",
        title: "隣接行列をグラフに変換する",
        description:
          "形式は「隣接行列」です。行と列がそれぞれの頂点で、1 なら辺あり、0 なら辺なしです。対称な行列なので無向グラフになります。",
        result:
          "3 頂点、3 辺のグラフです。すべての頂点同士がつながる三角形になります。",
      },
      {
        navTitle: "重み付きの木",
        title: "重み付きの木を描く",
        description:
          "形式は「頂点数・辺数つき辺リスト」で、各行の 3 列目が重みです。読み込んだら「配置」で「木」を選ぶと、階層がはっきりします。",
        result:
          "4 頂点、3 辺の木です。1–2 の重みが 5、1–3 が 2、3–4 が 7 です。",
      },
    ],
  },
  en: {
    heading: "Example inputs",
    navTitle: "Inputs and diagrams",
    copy: "Copy input",
    copySuccess: "Input copied",
    copyFailure: "Could not copy. Select the input and copy it manually.",
    input: "Input",
    result: "Result",
    examples: [
      {
        navTitle: "Edge list",
        title: "Draw a graph from an edge list",
        description:
          "Format: edge list with counts. The first line, 4 4, gives the number of vertices and edges; each line after that is one edge.",
        result: "4 vertices and 4 edges: 1–2, 2–3, 2–4, and 3–4.",
      },
      {
        navTitle: "Adjacency matrix",
        title: "Convert an adjacency matrix to a graph",
        description:
          "Format: adjacency matrix. Each row and column is a vertex; 1 means connected and 0 means not. The matrix is symmetric, so the graph is undirected.",
        result:
          "3 vertices and 3 edges form a triangle, with every pair connected.",
      },
      {
        navTitle: "Weighted tree",
        title: "Draw a weighted tree",
        description:
          "Format: edge list with counts, with the weight in the third column. After loading, choose Tree in Layout to show the hierarchy.",
        result:
          "A tree with 4 vertices and 3 edges: 1–2 has weight 5, 1–3 has weight 2, and 3–4 has weight 7.",
      },
    ],
  },
  "zh-Hans": {
    heading: "输入示例",
    navTitle: "输入示例与图形",
    copy: "复制输入",
    copySuccess: "已复制输入",
    copyFailure: "无法复制。请选中输入内容后手动复制。",
    input: "输入",
    result: "绘图结果",
    examples: [
      {
        navTitle: "边列表",
        title: "用边列表绘制图形",
        description:
          "格式为“带顶点数和边数的边列表”。第一行 4 4 是顶点数和边数，之后每行是一条边。",
        result: "4 个顶点、4 条边：1–2、2–3、2–4 和 3–4。",
      },
      {
        navTitle: "邻接矩阵",
        title: "将邻接矩阵转换为图形",
        description:
          "格式为邻接矩阵。每行每列对应一个顶点，1 表示相连，0 表示不相连。矩阵对称，所以是无向图。",
        result: "3 个顶点、3 条边组成三角形，每对顶点之间都有连接。",
      },
      {
        navTitle: "带权树",
        title: "绘制带权树",
        description:
          "格式为“带顶点数和边数的边列表”，第三列是权重。加载后在“布局”中选“树”，层次会更清楚。",
        result: "4 个顶点、3 条边的树：1–2 的权重为 5，1–3 为 2，3–4 为 7。",
      },
    ],
  },
};
