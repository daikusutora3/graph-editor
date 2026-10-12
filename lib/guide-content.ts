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
  intro: string;
  openApp: string;
  breadcrumbHome: string;
  onThisPage: string;
  languages: string;
  languageName: string;
  skipToContent: string;
  backToTop: string;
  footerTitle: string;
  footerDescription: string;
  githubLink: string;
  examplesLink: string;
  quickStartNavTitle: string;
  quickStartTitle: string;
  quickStartIntro: string;
  quickStartAction: string;
  quickStartCards: {
    id: "data" | "sample" | "draw";
    title: string;
    description: string;
    steps: string[];
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
    heading: "グラフを作って見やすく整える",
    intro:
      "Graph Editor で辺リストや隣接行列から図を作る方法、サンプルの使い方、空白から描く方法を紹介します。基本操作と、作ったグラフの保存方法も説明します。",
    openApp: "エディタに戻る",
    breadcrumbHome: "Graph Editor",
    onThisPage: "目的から探す",
    languages: "ガイドの言語",
    languageName: "日本語",
    skipToContent: "ガイド本文へ移動",
    backToTop: "ページの先頭へ",
    footerTitle: "エディタで試してみる",
    footerDescription: "入力例やサンプルから、最初のグラフを作ってみましょう。",
    githubLink: "GitHub でソースコードを見る",
    examplesLink: "入力例を試す",
    quickStartNavTitle: "はじめ方",
    quickStartTitle: "最初のグラフを作る",
    quickStartIntro:
      "手元のデータや描きたい図に合わせて、始め方を選んでください。",
    quickStartAction: "操作を詳しく見る",
    quickStartCards: [
      {
        id: "data",
        title: "データから作る",
        description: "問題文や手元の辺リストを図にしたいとき。",
        steps: [
          "「データから作る」または「読み込み」を開く。",
          "テキストを貼り付け、プレビューを確認する。",
          "「グラフに反映」でキャンバスに読み込む。",
        ],
        targetId: "examples",
      },
      {
        id: "sample",
        title: "サンプルから選ぶ",
        description:
          "まず試してみたいときや、木・閉路などの形から始めたいとき。",
        steps: [
          "「サンプルから選ぶ」を開く。",
          "サンプルを選び、必要なら頂点数などを変える。",
          "キャンバスに反映し、頂点や辺を編集する。",
        ],
        targetId: "layouts",
      },
      {
        id: "draw",
        title: "自分で描く",
        description: "小さな図をその場で作りたいとき。",
        steps: [
          "「自分で描く」で頂点モードを開く。",
          "空いている場所をクリックして頂点を置く。",
          "辺モードで 2 つの頂点を順に選んで結ぶ。",
        ],
        targetId: "draw",
      },
    ],
    sections: [
      {
        id: "import",
        navTitle: "データの読み込み",
        title: "テキストやファイルを読み込む",
        description: "反映する前に、形式と頂点数を確認できます。",
        steps: [
          {
            title: "「読み込み」を開く",
            description:
              "テキストを貼り付けるか、「ファイルを開く」でテキストまたは Graph Editor の JSON ファイルを選びます。",
          },
          {
            title: "形式とプレビューを確認する",
            description:
              "形式は自動判定されます。複数の形式に当てはまる場合は「形式」で読み込み形式を選んでください。頂点番号の 0 始まり・1 始まりも自動で推定されるため、頂点ラベルを確認します。",
          },
          {
            title: "「グラフに反映」を押す",
            description:
              "現在のグラフを読み込み結果に置き換えます。警告がある場合は内容を確認してから反映してください。反映した操作は「戻す」で取り消せます。",
          },
        ],
        table: {
          title: "対応する入力形式",
          head: ["対応する形式", "入力例"],
          rows: formatRows.ja,
        },
        note: {
          title: "重みや矢印を使う場合",
          text: "辺リストの 3 列目には数値の重みや文字ラベルを指定できます。読み込むと自動で重みありになります。文字ラベル付きで先頭行が N M K の入力は、M 行の辺が揃っていれば K を除いて読み込みます。有向グラフは「設定」で「有向」に切り替えてください。",
        },
      },
      {
        id: "draw",
        navTitle: "頂点と辺の編集",
        title: "頂点を置いて辺でつなぐ",
        description: "ツールバーの 3 つのモードを使い分けます。",
        steps: [
          {
            title: "「頂点」で点を置く",
            description:
              "キャンバスの空いている場所をクリックまたはタップすると、頂点を追加できます。N キーでも頂点モードに切り替えられます。",
          },
          {
            title: "「辺」で 2 点をつなぐ",
            description:
              "始点、終点の順に頂点を選びます。有向グラフでは、矢印は始点から終点に向きます。途中でやめるには、キャンバスの空白をクリックまたはタップするか、Esc を押します。",
          },
          {
            title: "「選択」で位置を整える",
            description:
              "頂点をドラッグして移動し、辺をドラッグして曲げます。選んだ頂点や辺は、表示される操作バーから編集または削除できます。",
          },
        ],
        items: [
          "複数の頂点や辺を選ぶには、選択モードで Shift を押しながらドラッグします。「選択」横の矢印で、範囲選択の対象をすべて、頂点だけ、辺だけに切り替えられます。",
          "Ctrl（Mac は ⌘）+ Shift + ドラッグで頂点だけを範囲選択します。Ctrl（Mac は ⌘）+ Alt + ドラッグで辺だけを範囲選択します。",
          "ダブルクリックまたは選択後の Enter で、頂点ラベルや辺のラベル、重みを編集します。右クリックからも編集メニューを開けます。",
        ],
      },
      {
        id: "appearance",
        navTitle: "色とグラフ設定",
        title: "色、ラベル、グラフの種類を変える",
        description: "一部を強調したり、番号や矢印の表示を整えたりできます。",
        items: [
          "頂点や辺を選んで操作バーの色を押すと、選択した要素の色を変更できます。複数の要素をまとめて変更することもできます。C キーでは選択した要素の色を順に切り替えます。",
          "「設定」で有向か無向、重みありかなし、0-indexed か 1-indexed を選びます。矢印の大きさや頂点ラベルの表示も変更できます。",
          "有向グラフの辺を選ぶと「向き反転」が使えます。「設定」の「全辺を反転」は、すべての辺の向きを反転します。",
          "辺を手で曲げた後は「自動配置に戻す」で自動の経路に戻せます。右クリックメニューには「左へ曲げる」「右へ曲げる」もあります。",
          "「ドラッグをグリッドに吸着」を有効にすると、頂点の移動時に位置をそろえやすくなります。",
        ],
      },
      {
        id: "layouts",
        navTitle: "サンプルと配置",
        title: "サンプルを試して配置を選ぶ",
        description: "頂点のつながりを保ったまま、並び方を変えます。",
        paragraphs: [
          "「読み込み」で「サンプルを使う」を押すと、木、閉路、格子などのグラフを選べます。名前やカテゴリで探し、パラメータがあるサンプルは頂点数などを調整してから反映できます。",
          "作成したグラフは「配置」（L）で並べ直せます。迷ったら「自動配置」、形を比較したいときは「円形」や「格子」を試してください。",
        ],
        items: [
          "木や森には「木」、有向非巡回グラフには「DAG」、二部グラフには「二部」を選びます。条件に合わない配置は無効になり、理由が表示されます。",
          "「BFS層」は始点からの距離ごとに頂点を並べ、「放射」は距離の層を円状に並べます。頂点を 1 つ選んでから使うと、その頂点を始点にできます。「木」では根になります。",
          "有向グラフの「SCC」は強連結成分ごとに頂点をまとめます。そのほか「直線」「同心円」「重なり解消」も選べます。",
          "「辺をずらして重なりを避ける」で、頂点を通る辺などを自動で曲げます。回避できない辺や頂点の重なりが残る場合は、頂点を動かすか辺を手で曲げて調整してください。",
        ],
        note: {
          title: "配置をやり直すには",
          text: "「戻す」で前の配置に戻れます。計算中は完了を待ってから結果を確認してください。大きなグラフでは一部の配置が無効になります。",
        },
      },
      {
        id: "export",
        navTitle: "書き出しと保存",
        title: "用途に合わせて書き出す",
        description:
          "編集を続けるための保存には JSON、図の共有には PNG を使います。",
        steps: [
          {
            title: "あとで編集するなら JSON",
            description:
              "「書き出し」の形式で「JSON」を選び、.json ファイルを保存します。頂点、辺、ラベル、位置、色、曲げ方、グラフ設定を保てます。再開するときは「読み込み」から開いてください。",
          },
          {
            title: "図を共有するなら PNG",
            description:
              "「PNG」で全体または表示範囲を選び、背景と余白を設定します。長辺サイズ、現在の倍率、固定キャンバスから画像サイズを選び、プレビューを確認して保存またはコピーします。",
          },
          {
            title: "頂点のつながりを書き出すならテキスト",
            description:
              "「書き出し」で辺リスト、隣接リスト、隣接行列を選びます。位置、色、手で曲げた辺の形は含まれず、独自のラベルは連番に置き換わる場合があります。形式で表せない辺や重みがある場合は、JSON または対応する辺リストを選んでください。",
          },
          {
            title: "TeX 文書に入れるなら TikZ",
            description:
              "書き出し形式を「TikZ (TeX)」にして、コードをコピーするか .tex ファイルを保存します。必要なパッケージは、書き出したコードの冒頭のコメントに記載しています。日本語ラベルは LuaLaTeX と luatexja を使用してください。",
          },
        ],
        note: {
          title: "自動保存とバックアップ",
          text: "作業内容は同じブラウザのローカルストレージに自動保存されます。保存状態を確認し、保存の失敗や別タブとの競合が表示されたら、現在の内容を JSON で保存してください。JSON に操作履歴や表示倍率は含まれません。",
        },
      },
      {
        id: "shortcuts",
        navTitle: "キーボード操作",
        title: "キーボードで操作する",
        description:
          "文字を入力していないときは、キーボードでキャンバスを操作できます。",
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
          title: "グラフの貼り付けとテキストの読み込み",
          text: "Ctrl / ⌘ + C、X、V は、アプリ内で選んだ頂点や辺のコピー、切り取り、貼り付けに使います。問題文などの外部テキストは「読み込み」に貼り付けてください。",
        },
      },
      {
        id: "touch",
        navTitle: "画面移動とタッチ",
        title: "表示の移動とスマートフォンでの操作",
        description: "頂点の位置を変えずに、表示範囲を動かせます。",
        items: [
          "キャンバスの空白をドラッグすると表示範囲が移動します。スマートフォンでは 2 本指で拡大、縮小や表示の移動ができます。",
          "頂点を追加するには「頂点」で空白をタップします。辺を追加するには「辺」で 2 頂点を順にタップします。",
          "「選択」で頂点や辺をタップし、表示された操作バーから色、ラベル、削除を選びます。ドラッグで頂点の移動や辺の曲げもできます。",
          "グラフが画面外に出たら「グラフを表示領域に戻す」を使います。キーボードでは Shift+1 で全体表示できます。",
        ],
      },
    ],
    shortcutsNote: "Windows と Linux では Ctrl、Mac では ⌘ を使います。",
    faqTitle: "困ったときは",
    faqIntro: "読み込み・保存・表示で困ったときの確認方法です。",
    faq: [
      {
        question: "読み込み結果が思ったものと違うときは？",
        answer:
          "「形式」を選び、先頭行の頂点数と辺数、各行の列数、頂点番号が 0 始まりか 1 始まりかを確認してください。警告やプレビューを確認してから反映します。有向と無向は「設定」で変更できます。",
      },
      {
        question: "データはどこに保存されますか？",
        answer:
          "グラフはこのブラウザのローカルストレージに保存されます。内容はサーバーに送信されず、別のブラウザや端末にも同期されません。サイトデータを消すと保存内容も消えるため、大切なグラフは JSON でバックアップしてください。",
      },
      {
        question: "自動保存に失敗したり、別タブと競合したりしたときは？",
        answer:
          "現在の作業内容は画面に残っています。まず「今のグラフを保存」で現在の内容を保存してください。保存に失敗した場合は「再試行」を使えます。別タブと競合した場合は、内容を確認して「別タブの内容を使う」を選べます。自動保存を使えない環境では JSON ファイルで保存してください。",
      },
      {
        question: "グラフの大きさに上限はありますか？",
        answer:
          "グラフの上限は 1,000 頂点、5,000 辺です。ラベルなどの文字列は 256 文字までです。テキスト入力は 1,000,000 文字、JSON は 2,000,000 文字までです。大きなグラフでは一部の配置が無効になり、辺の自動回避や重なり解消を使っても、一部の重なりが残ることがあります。",
      },
      {
        question: "画像やテキストをコピーできないときは？",
        answer:
          "ブラウザのクリップボード権限などでコピーできない場合があります。PNG は「保存」、テキストはファイル保存を使ってください。選んだ形式でグラフを表せない場合は、JSON など対応する形式に変えます。",
      },
      {
        question: "グラフが表示されないときは？",
        answer:
          "グラフが画面外にある場合は、全体表示で戻せます。表示エラーが出ている場合は、JSON で保存してから「再試行」を使ってください。サンプルの読み込みに失敗した場合も再試行でき、テキストの貼り付けに戻って作業を続けられます。",
      },
      {
        question: "利用に料金や登録は必要ですか？",
        answer:
          "無料で、アカウント登録は不要です。ソースコードは GitHub で公開しています。",
      },
    ],
  },
  en: {
    title: "Draw graphs from edge lists and adjacency matrices | Graph Editor",
    guideLink: "User guide",
    description:
      "Learn Graph Editor with edge-list and matrix examples, manual editing, automatic layouts, PNG and JSON exports, keyboard shortcuts, and troubleshooting.",
    heading: "Create, edit, and save your graph",
    intro:
      "Turn an edge list or adjacency matrix into a diagram, try a sample, or draw from scratch. Learn the everyday controls and how to save your work.",
    openApp: "Back to editor",
    breadcrumbHome: "Graph Editor",
    onThisPage: "Find what you need",
    languages: "Guide language",
    languageName: "English",
    skipToContent: "Skip to guide content",
    backToTop: "Back to top",
    footerTitle: "Try it in the editor",
    footerDescription:
      "Create your first graph from an input example or a sample.",
    githubLink: "View source on GitHub",
    examplesLink: "Try an example",
    quickStartNavTitle: "Getting started",
    quickStartTitle: "Make your first graph",
    quickStartIntro: "Choose a starting point that fits what you have.",
    quickStartAction: "See the steps",
    quickStartCards: [
      {
        id: "data",
        title: "Start from data",
        description:
          "Turn input from a problem or an existing edge list into a diagram.",
        steps: [
          "Open Start from data or Load.",
          "Paste the text and check the preview.",
          "Choose Apply to graph to load it onto the canvas.",
        ],
        targetId: "examples",
      },
      {
        id: "sample",
        title: "Choose a sample",
        description: "Explore the editor with a familiar graph shape.",
        steps: [
          "Open Choose a sample.",
          "Pick a graph and adjust its parameters, if available.",
          "Apply it, then edit its nodes and edges.",
        ],
        targetId: "layouts",
      },
      {
        id: "draw",
        title: "Draw your own",
        description: "Build a small diagram directly on the canvas.",
        steps: [
          "Choose Draw your own to enter Node mode.",
          "Click empty spots to place nodes.",
          "Switch to Edge and select two nodes in order.",
        ],
        targetId: "draw",
      },
    ],
    sections: [
      {
        id: "import",
        navTitle: "Load data",
        title: "Load text or a file",
        description:
          "Check the format and node count before replacing your graph.",
        steps: [
          {
            title: "Open Load",
            description:
              "Paste your text, or choose Open file to select a text file or a Graph Editor JSON document.",
          },
          {
            title: "Check the format and preview",
            description:
              "The editor detects the format. If several interpretations are possible, choose one in Format. It also infers whether numbering starts at 0 or 1, so check the node labels.",
          },
          {
            title: "Choose Apply to graph",
            description:
              "This replaces the current graph with the previewed result. Review any warnings before applying. Undo restores the graph from before the import.",
          },
        ],
        table: {
          title: "All supported input formats",
          head: ["Supported format", "Example input"],
          rows: formatRows.en,
        },
        note: {
          title: "Weights and arrows",
          text: "The third column in an edge list can contain a numeric weight or a text label, and turns weights on automatically. Text-labeled input with an N M K header is imported without K when all M edge rows are present. For a directed graph, choose Directed in Settings.",
        },
      },
      {
        id: "draw",
        navTitle: "Edit nodes and edges",
        title: "Place nodes and connect them",
        description: "Use the three toolbar modes for different tasks.",
        steps: [
          {
            title: "Place a node with Node",
            description:
              "Click or tap an empty spot on the canvas to add a node. Press N to switch to this mode.",
          },
          {
            title: "Connect two nodes with Edge",
            description:
              "Select the source, then the target. In a directed graph, the arrow follows that order. Click empty space or press Esc to cancel a connection in progress.",
          },
          {
            title: "Adjust positions with Select",
            description:
              "Drag a node to move it or an edge to bend it. Select a node or edge to open the action bar for editing or deleting it.",
          },
        ],
        items: [
          "To select a group, hold Shift and drag in Select mode. The arrow beside Select chooses All, Nodes only, or Edges only for box selection.",
          "Ctrl (⌘ on Mac) + Shift + drag selects nodes only. Ctrl (⌘ on Mac) + Alt + drag selects edges only.",
          "Double-click or select an element and press Enter to edit its label or weight. Right-click opens its edit menu.",
        ],
      },
      {
        id: "appearance",
        navTitle: "Colors and settings",
        title: "Change colors, labels, and graph settings",
        description:
          "Highlight part of the graph and adjust its numbering and arrows.",
        items: [
          "Select nodes or edges, then choose a color in the action bar. This also works with multiple elements selected. Press C to cycle their colors.",
          "Settings switches between directed and undirected graphs, weighted and unweighted edges, and 0-indexed and 1-indexed numbering. It also controls arrow size and node-label visibility.",
          "Select directed edges to Reverse their direction, or use Reverse all edges in Settings to change the whole graph.",
          "After bending an edge, choose Return to automatic routing to restore its automatic path. The right-click menu also offers Bend left and Bend right.",
          "Enable Snap drags to grid in Settings to align nodes while moving them.",
        ],
      },
      {
        id: "layouts",
        navTitle: "Samples and layouts",
        title: "Try a sample and choose a layout",
        description: "Change where nodes sit while keeping their connections.",
        paragraphs: [
          "In Load, choose Use a sample to pick a tree, cycle, grid, or another graph. Search by name or filter by category. For samples with parameters, adjust values such as the node count before applying.",
          "Open Layout (L) to rearrange a graph. Start with Auto layout, or try Circle and Grid to compare simple arrangements.",
        ],
        items: [
          "Use Tree for a tree or forest, DAG for a directed acyclic graph, and Bipartite for a bipartite graph. A layout is disabled when its requirements are not met; its tooltip explains why.",
          "BFS layers groups nodes by distance from a starting node; Radial arranges distance layers in circles. Select one node first to use it as the starting node, or as the root for Tree.",
          "SCC groups nodes of a directed graph by strongly connected component. Line, Concentric, and Resolve overlap offer other arrangements.",
          "Offset overlapping edges bends edges automatically to avoid nodes where possible. If overlaps remain, move the nodes or bend individual edges by hand.",
        ],
        note: {
          title: "Trying another arrangement",
          text: "Undo returns to the previous layout. When a calculation is in progress, wait for it to finish before reviewing the result. Some layouts are disabled for large graphs.",
        },
      },
      {
        id: "export",
        navTitle: "Export and save",
        title: "Choose an export for your next step",
        description:
          "Use JSON to keep editing your graph and PNG to share a diagram.",
        steps: [
          {
            title: "Save for editing with JSON",
            description:
              "In Export, choose JSON as the format and save the .json file. It preserves nodes, edges, labels, positions, colors, bends, and graph settings. Open it through Load to resume editing.",
          },
          {
            title: "Share an image with PNG",
            description:
              "Open PNG, choose the whole graph or current view, and set the background and padding. For the whole graph, choose a long-edge size, the current zoom, or a fixed canvas. Check the preview, then save or copy.",
          },
          {
            title: "Use connection data as text",
            description:
              "In Export, choose Edge list, Adjacency list, or Adjacency matrix. These formats omit positions, colors, and manual bends; custom labels may be replaced with consecutive numbers. If a format cannot represent your edges or weights, choose JSON or a compatible edge list.",
          },
          {
            title: "Include a diagram in TeX with TikZ",
            description:
              "Choose TikZ (TeX), then copy the code or save a .tex file. Add the packages listed in the opening comments. Japanese labels need LuaLaTeX and luatexja; other Unicode labels need an appropriate engine and fonts.",
          },
        ],
        note: {
          title: "Autosave and backups",
          text: "The editor autosaves to local storage in this browser. Check the save status; if saving fails or another tab changes the document, back up your current work as JSON. JSON does not include undo history or the current pan and zoom.",
        },
      },
      {
        id: "shortcuts",
        navTitle: "Keyboard shortcuts",
        title: "Work with the keyboard",
        description:
          "These shortcuts control the canvas when you are not typing into a field.",
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
          title: "Graph paste and text import",
          text: "Ctrl / ⌘ + C, X, and V copy, cut, and paste selected graph elements within the editor. To import text from a problem or another application, paste it into Load instead.",
        },
      },
      {
        id: "touch",
        navTitle: "View and touch controls",
        title: "Move the view and work on a phone",
        description: "Move the visible area without changing node positions.",
        items: [
          "Drag empty canvas to pan the view. On a phone, use two fingers to zoom and move the view.",
          "In Node, tap empty space to add a node. In Edge, tap two nodes in order to connect them.",
          "In Select, tap a node or edge and use the action bar to change its color, edit its label, or delete it. Drag nodes to move them and edges to bend them.",
          "If your graph moves off screen, use Fit graph to view. With a keyboard, Shift+1 fits the whole graph.",
        ],
      },
    ],
    shortcutsNote: "Use Ctrl on Windows and Linux, and ⌘ on Mac.",
    faqTitle: "When something does not work",
    faqIntro: "Check these points for input, saving, and display problems.",
    faq: [
      {
        question: "Why does my input produce a different graph?",
        answer:
          "Choose the format explicitly, then check the counts in the first line, the number of columns, and whether numbering starts at 0 or 1. Review warnings and the preview before applying. Change directed or undirected in Settings if needed.",
      },
      {
        question: "Where is my graph saved?",
        answer:
          "The graph is stored locally in this browser; its contents are not sent to a server. It does not sync to another browser or device. Clearing this site's data removes the saved graph, so export important work as JSON for backup.",
      },
      {
        question:
          "What should I do if autosave fails or another tab changes the graph?",
        answer:
          "Your current work stays on screen. First choose Save my graph to download a JSON backup. For a failed save, choose Retry; for a conflict, review the other document before choosing Use the other tab's graph. If autosave is unavailable, keep saving JSON files.",
      },
      {
        question: "How large can a graph be?",
        answer:
          "The limit is 1,000 nodes and 5,000 edges, with up to 256 characters per label or other text field. Text input accepts up to 1,000,000 characters and JSON up to 2,000,000. Some layouts are disabled for large graphs, and automatic routing or overlap resolution may leave overlaps to adjust by hand.",
      },
      {
        question: "What if copying an image or text fails?",
        answer:
          "Browser clipboard permissions can prevent copying. Save the PNG or download the text as a file instead. If an export format cannot represent the graph, choose a compatible format such as JSON.",
      },
      {
        question: "What if I cannot see the graph?",
        answer:
          "If it is off screen, fit the graph to view. If a display error appears, save a JSON backup and choose Retry. A failed sample load can also be retried, or you can return to Paste and continue working.",
      },
      {
        question: "Do I need to pay or create an account?",
        answer:
          "It is free and requires no account. The source code is available on GitHub.",
      },
    ],
  },
  "zh-Hans": {
    title: "用边列表和邻接矩阵绘制图形 | Graph Editor",
    guideLink: "使用指南",
    description:
      "Graph Editor 使用方法：边列表和矩阵输入示例、手动编辑、自动布局、PNG 与 JSON 保存、键盘操作及常见问题处理。",
    heading: "创建、编辑与保存图",
    intro:
      "把边列表或邻接矩阵变成图形，试用示例，或从空白开始绘制。了解常用操作，以及如何保存自己的图。",
    openApp: "返回编辑器",
    breadcrumbHome: "Graph Editor",
    onThisPage: "按需查找",
    languages: "指南语言",
    languageName: "简体中文",
    skipToContent: "跳转到指南正文",
    backToTop: "返回顶部",
    footerTitle: "在编辑器中试一试",
    footerDescription: "使用输入示例或预设示例，创建你的第一张图。",
    githubLink: "在 GitHub 查看源代码",
    examplesLink: "试用输入示例",
    quickStartNavTitle: "开始使用",
    quickStartTitle: "创建第一张图",
    quickStartIntro: "根据手头的内容选择开始方式。",
    quickStartAction: "查看操作步骤",
    quickStartCards: [
      {
        id: "data",
        title: "从数据创建",
        description: "把题目中的输入或已有边列表转换成图形。",
        steps: [
          "打开“从数据创建”或“加载”。",
          "粘贴文本并检查预览。",
          "点击“应用到图”将结果加载到画布。",
        ],
        targetId: "examples",
      },
      {
        id: "sample",
        title: "选择示例",
        description: "用常见的图结构体验编辑器。",
        steps: [
          "打开“选择示例”。",
          "选择图形，如有参数可调整顶点数等。",
          "应用到画布，再编辑顶点和边。",
        ],
        targetId: "layouts",
      },
      {
        id: "draw",
        title: "自己绘制",
        description: "直接在画布上绘制小型图。",
        steps: [
          "点击“自己绘制”进入顶点模式。",
          "点击空白处放置顶点。",
          "切换到边模式，依次选择两个顶点。",
        ],
        targetId: "draw",
      },
    ],
    sections: [
      {
        id: "import",
        navTitle: "加载数据",
        title: "加载文本或文件",
        description: "替换当前图之前，可以检查格式和顶点数。",
        steps: [
          {
            title: "打开“加载”",
            description:
              "粘贴文本，或点击“打开文件”选择文本文件或 Graph Editor JSON 文档。",
          },
          {
            title: "检查格式和预览",
            description:
              "编辑器会自动识别格式。若存在多种解释，请在“格式”中选择。顶点编号从 0 还是 1 开始也会自动推断，因此请检查顶点标签。",
          },
          {
            title: "点击“应用到图”",
            description:
              "预览结果会替换当前图。如有警告，请先检查内容再应用。使用撤销可以恢复加载前的图。",
          },
        ],
        table: {
          title: "支持的输入格式",
          head: ["支持的格式", "输入示例"],
          rows: formatRows["zh-Hans"],
        },
        note: {
          title: "权重和箭头",
          text: "边列表的第三列可以是数值权重或文字标签，编辑器会自动开启权重。对于以 N M K 开头的文字标签输入，如果 M 行边数据完整，将忽略 K 后导入。有向图需要在“设置”中选择“有向”。",
        },
      },
      {
        id: "draw",
        navTitle: "编辑顶点和边",
        title: "放置顶点，再用边连接",
        description: "通过工具栏的三种模式完成不同操作。",
        steps: [
          {
            title: "用“顶点”添加顶点",
            description: "点击或轻触画布空白处添加顶点。按 N 可切换到此模式。",
          },
          {
            title: "用“边”连接两个顶点",
            description:
              "依次选择起点和终点。有向图的箭头与此顺序一致。点击空白处或按 Esc 可取消正在创建的边。",
          },
          {
            title: "用“选择”调整位置",
            description:
              "拖动顶点来移动，拖动边来弯曲。选择顶点或边后，可通过显示的操作栏编辑或删除。",
          },
        ],
        items: [
          "在选择模式下按住 Shift 拖动，可以框选多个元素。“选择”旁的箭头可切换框选目标：全部、仅顶点或仅边。",
          "Ctrl（Mac 为 ⌘）+ Shift + 拖动仅选择顶点；Ctrl（Mac 为 ⌘）+ Alt + 拖动仅选择边。",
          "双击元素，或选中后按 Enter，可以编辑标签或权重。右键也能打开编辑菜单。",
        ],
      },
      {
        id: "appearance",
        navTitle: "颜色与设置",
        title: "修改颜色、标签和图设置",
        description: "突出图中的一部分，并调整编号与箭头。",
        items: [
          "选择顶点或边后，点击操作栏中的颜色即可修改，也支持多选。按 C 可依次切换所选元素的颜色。",
          "“设置”可切换有向或无向、带权或无权，以及 0-indexed 或 1-indexed 编号。还可以修改箭头大小和顶点标签显示。",
          "选择有向边后可以反转方向。“设置”中的“反转全部边”可修改整张图的方向。",
          "手动弯曲边后，可用“恢复自动布线”还原自动路径。右键菜单也提供“向左弯曲”和“向右弯曲”。",
          "在设置中开启“拖动吸附到网格”，便于对齐顶点位置。",
        ],
      },
      {
        id: "layouts",
        navTitle: "示例与布局",
        title: "试用示例并选择布局",
        description: "保持连接关系，改变顶点的排列方式。",
        paragraphs: [
          "在“加载”中点击“使用示例”，可以选择树、环、网格等图形。可以按名称搜索或按类别筛选。有参数的示例可以先调整顶点数等，再应用到画布。",
          "打开“布局”（L）可以重新排列图形。不确定时可先试“自动布局”，或用“圆形”和“网格”比较简单排列。",
        ],
        items: [
          "树或森林适合“树”布局，有向无环图适合“DAG”，二分图适合“二分图”。不符合条件的布局会被禁用，并显示原因。",
          "“BFS 分层”按起点距离排列，“放射”把距离层排成圆环。先选择一个顶点，可将其作为起点；“树”布局会将其作为根。",
          "有向图的“SCC”按强连通分量分组。还可选择“直线”“同心圆”和“消除重叠”。",
          "开启“错开重叠的边”后，编辑器会尽量自动弯曲边来避开顶点。若仍有重叠，可移动顶点或手动弯曲边。",
        ],
        note: {
          title: "重新调整布局",
          text: "撤销可以恢复之前的布局。计算中请等待完成后再检查结果。大型图的部分布局会被禁用。",
        },
      },
      {
        id: "export",
        navTitle: "导出与保存",
        title: "按用途选择导出格式",
        description: "继续编辑时保存 JSON，分享图形时使用 PNG。",
        steps: [
          {
            title: "用 JSON 保存以便再编辑",
            description:
              "在“导出”的格式中选择“JSON”，保存 .json 文件。它保留顶点、边、标签、位置、颜色、弯曲和图设置。再次编辑时从“加载”打开。",
          },
          {
            title: "用 PNG 分享图像",
            description:
              "打开“PNG”，选择整张图或当前视图，设置背景和留白。整张图可以选择长边尺寸、当前缩放或固定画布。检查预览后保存或复制。",
          },
          {
            title: "用文本导出连接数据",
            description:
              "在“导出”中选择边列表、邻接表或邻接矩阵。这些格式不包含位置、颜色或手动弯曲，自定义标签可能变为连续编号。若格式无法表示某些边或权重，请选择 JSON 或兼容的边列表。",
          },
          {
            title: "用 TikZ 将图形加入 TeX 文档",
            description:
              "选择“TikZ (TeX)”，复制代码或保存 .tex 文件。所需宏包列在输出开头的注释中。中文等 Unicode 标签需要支持相应字符的引擎和字体。",
          },
        ],
        note: {
          title: "自动保存和备份",
          text: "编辑器自动保存到当前浏览器的本地存储。请检查保存状态；如保存失败或另一个标签页修改了文档，先将当前内容备份为 JSON。JSON 不包含撤销历史或当前平移、缩放状态。",
        },
      },
      {
        id: "shortcuts",
        navTitle: "键盘快捷键",
        title: "使用键盘操作",
        description: "未在输入框中输入时，可用这些快捷键控制画布。",
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
          title: "图的粘贴与文本导入",
          text: "Ctrl / ⌘ + C、X、V 用于在编辑器内复制、剪切和粘贴选中的顶点与边。题目或其他应用中的文本请粘贴到“加载”。",
        },
      },
      {
        id: "touch",
        navTitle: "视图与触控",
        title: "移动视图并在手机上编辑",
        description: "移动显示区域，同时保持顶点位置不变。",
        items: [
          "拖动画布空白处可平移视图。手机上可用双指缩放并移动视图。",
          "在“顶点”模式轻触空白处添加顶点；在“边”模式依次轻触两个顶点以连接。",
          "在“选择”模式轻触顶点或边，使用操作栏修改颜色、编辑标签或删除。也可拖动顶点移动，拖动边弯曲。",
          "如果图移出屏幕，使用“适应视图”找回。使用键盘时，Shift+1 可完整显示图。",
        ],
      },
    ],
    shortcutsNote: "Windows 和 Linux 使用 Ctrl，Mac 使用 ⌘。",
    faqTitle: "遇到问题时",
    faqIntro: "输入、保存或显示异常时，可检查以下内容。",
    faq: [
      {
        question: "为什么加载结果与预期不同？",
        answer:
          "请明确选择格式，检查首行的顶点数和边数、每行列数，以及编号从 0 还是 1 开始。确认警告和预览后再应用。有向或无向可在“设置”中修改。",
      },
      {
        question: "图保存在哪里？",
        answer:
          "图保存在当前浏览器的本地存储中，图内容不会发送到服务器，也不会同步到其他浏览器或设备。清除此站点的数据会删除已保存的图，因此请将重要内容导出为 JSON 备份。",
      },
      {
        question: "自动保存失败或与另一个标签页冲突怎么办？",
        answer:
          "当前工作仍保留在屏幕上。请先选择“保存当前的图”备份。保存失败时可重试；发生冲突时，确认内容后再选择“使用另一个标签页的图”。无法自动保存时，请持续保存 JSON 文件。",
      },
      {
        question: "图的大小有上限吗？",
        answer:
          "最多 1,000 个顶点、5,000 条边，每个标签等文本字段最多 256 个字符。文本输入最多 1,000,000 个字符，JSON 最多 2,000,000 个字符。大型图的部分布局会禁用，自动布线和消除重叠可能仍留有需要手动调整的部分。",
      },
      {
        question: "无法复制图像或文本怎么办？",
        answer:
          "浏览器剪贴板权限等原因可能阻止复制。请改为保存 PNG 或将文本下载为文件。如果导出格式无法表示当前图，请改用 JSON 等兼容格式。",
      },
      {
        question: "看不到图怎么办？",
        answer:
          "如果图移出了屏幕，请使图适应视图。如果出现显示错误，请保存 JSON 备份后重试。示例加载失败时也可以重试，或返回粘贴继续操作。",
      },
      {
        question: "需要付费或注册吗？",
        answer: "免费且无需注册。源代码公开在 GitHub。",
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
    instruction: string;
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
    instruction:
      "「設定」で「無向」と「1-indexed」を選び、コード全体を「読み込み」に貼り付けて反映します。図は頂点のつながりを示しています。実際の配置は選んだレイアウトによって変わります。",
    input: "入力例",
    result: "描画結果",
    examples: [
      {
        navTitle: "辺リスト",
        title: "辺リストから図を作る",
        description:
          "入力形式は「頂点数・辺数つき辺リスト」です。先頭行の 4 4 は頂点数と辺数を表し、その後の各行は接続する 2 頂点を表します。",
        result: "4 頂点、4 辺のグラフです。1–2、2–3、2–4、3–4 を結びます。",
      },
      {
        navTitle: "隣接行列",
        title: "隣接行列をグラフに変換する",
        description:
          "入力形式は「隣接行列」です。行と列が頂点に対応し、1 は辺あり、0 は辺なしを表します。この対称行列は無向グラフの例です。",
        result:
          "3 頂点、3 辺のグラフです。すべての頂点同士がつながる三角形になります。",
      },
      {
        navTitle: "重み付きの木",
        title: "重み付きの木を描く",
        description:
          "入力形式は「頂点数・辺数つき辺リスト」です。各行の 3 列目が重みです。読み込み後に「配置」から木の配置を選ぶと階層が見やすくなります。",
        result:
          "4 頂点、3 辺の木です。1–2 の重みが 5、1–3 が 2、3–4 が 7 です。",
      },
    ],
  },
  en: {
    heading: "See how your input becomes a graph",
    navTitle: "Inputs and diagrams",
    copy: "Copy input",
    copySuccess: "Input copied",
    copyFailure: "Could not copy. Select the input and copy it manually.",
    instruction:
      "Choose Undirected and 1-indexed in Settings, copy a complete code block into Load, then choose Apply to graph. The diagrams show connectivity; positions depend on the layout you select.",
    input: "Input to copy",
    result: "Graph diagram",
    examples: [
      {
        navTitle: "Edge list",
        title: "Draw a graph from an edge list",
        description:
          "Choose “edge list with counts” in Format. The first line, 4 4, gives the vertex and edge counts. Each following line connects two vertices.",
        result: "4 vertices and 4 edges: 1–2, 2–3, 2–4, and 3–4.",
      },
      {
        navTitle: "Adjacency matrix",
        title: "Convert an adjacency matrix to a graph",
        description:
          "Choose adjacency matrix. Rows and columns represent vertices; 1 means an edge and 0 means no edge. This symmetric matrix describes an undirected graph.",
        result:
          "3 vertices and 3 edges form a triangle, with every pair connected.",
      },
      {
        navTitle: "Weighted tree",
        title: "Visualize a weighted tree",
        description:
          "Choose “edge list with counts” in Format. The third column is the edge weight. After importing, select the tree layout to see the hierarchy.",
        result:
          "A tree with 4 vertices and 3 edges: 1–2 has weight 5, 1–3 has weight 2, and 3–4 has weight 7.",
      },
    ],
  },
  "zh-Hans": {
    heading: "看看输入如何变成图",
    navTitle: "输入示例与图形",
    copy: "复制输入",
    copySuccess: "已复制输入",
    copyFailure: "无法复制。请选中输入内容后手动复制。",
    instruction:
      "在“设置”中选择“无向”和“1-indexed”，将完整代码块粘贴到“加载”，再点击“应用到图”。图示表示连接关系，实际位置取决于所选布局。",
    input: "可复制的输入",
    result: "绘图结果",
    examples: [
      {
        navTitle: "边列表",
        title: "用边列表绘制图形",
        description:
          "在“格式”中选择“带顶点数和边数的边列表”。第一行 4 4 表示顶点数和边数，后续每行表示两个顶点之间的连接。",
        result: "4 个顶点、4 条边：1–2、2–3、2–4 和 3–4。",
      },
      {
        navTitle: "邻接矩阵",
        title: "将邻接矩阵转换为图形",
        description:
          "选择邻接矩阵格式。行和列对应顶点，1 表示有边，0 表示无边。此对称矩阵表示无向图。",
        result: "3 个顶点、3 条边组成三角形，每对顶点之间都有连接。",
      },
      {
        navTitle: "带权树",
        title: "可视化带权树",
        description:
          "在“格式”中选择“带顶点数和边数的边列表”。第三列为边权。导入后选择树布局，可以更清楚地查看层次关系。",
        result: "4 个顶点、3 条边的树：1–2 的权重为 5，1–3 为 2，3–4 为 7。",
      },
    ],
  },
};
