import type { AppLocale } from "./site-metadata";

export type GuideSection = {
  title: string;
  paragraphs?: string[];
  items?: string[];
  table?: { head: [string, string]; rows: [string, string][] };
};

export type GuideCopy = {
  title: string;
  description: string;
  heading: string;
  intro: string;
  openApp: string;
  breadcrumbHome: string;
  sections: GuideSection[];
  faqTitle: string;
  faq: { question: string; answer: string }[];
};

const formatRows: Record<AppLocale, [string, string][]> = {
  ja: [
    ["N M 付き辺リスト", "4 4 / 1 2 / 2 3 / 2 4 / 3 4"],
    ["辺の組リスト（ヘッダーなし）", "1 2 / 2 3"],
    ["木の辺リスト（N のあと N−1 本）", "4 / 1 2 / 1 3 / 3 4"],
    ["親配列", "4 / 1 1 3"],
    ["重み付き親配列", "4 / 1 5 / 1 3 / 3 2"],
    ["隣接リスト", "1: 2 3 / 2: 4"],
    ["隣接行列", "0 1 1 / 1 0 1 / 1 1 0"],
    ["Graph Editor JSON", '{ "version": 1, "nodes": [...], "edges": [...] }'],
  ],
  en: [
    ["Edge list with N M header", "4 4 / 1 2 / 2 3 / 2 4 / 3 4"],
    ["Edge pairs (no header)", "1 2 / 2 3"],
    ["Tree edge list (N, then N−1 edges)", "4 / 1 2 / 1 3 / 3 4"],
    ["Parent array", "4 / 1 1 3"],
    ["Weighted parent array", "4 / 1 5 / 1 3 / 3 2"],
    ["Adjacency list", "1: 2 3 / 2: 4"],
    ["Adjacency matrix", "0 1 1 / 1 0 1 / 1 1 0"],
    ["Graph Editor JSON", '{ "version": 1, "nodes": [...], "edges": [...] }'],
  ],
  "zh-Hans": [
    ["带 N M 首行的边列表", "4 4 / 1 2 / 2 3 / 2 4 / 3 4"],
    ["边对列表（无首行）", "1 2 / 2 3"],
    ["树的边列表（N 之后 N−1 条边）", "4 / 1 2 / 1 3 / 3 4"],
    ["父数组", "4 / 1 1 3"],
    ["带权父数组", "4 / 1 5 / 1 3 / 3 2"],
    ["邻接表", "1: 2 3 / 2: 4"],
    ["邻接矩阵", "0 1 1 / 1 0 1 / 1 1 0"],
    ["Graph Editor JSON", '{ "version": 1, "nodes": [...], "edges": [...] }'],
  ],
};

export const guideCopy: Record<AppLocale, GuideCopy> = {
  ja: {
    title: "使い方ガイド | Graph Editor",
    description:
      "Graph Editor の使い方。対応する入力形式、自動配置、辺の曲げ方、書き出し、キーボードショートカット、よくある質問をまとめました。",
    heading: "Graph Editor の使い方",
    intro:
      "Graph Editor は、辺リストや隣接行列を貼るだけでグラフ理論の図を描けるブラウザアプリです。このページでは入力形式から書き出しまでの流れを説明します。",
    openApp: "エディタを開く",
    breadcrumbHome: "Graph Editor",
    sections: [
      {
        title: "グラフを読み込む",
        paragraphs: [
          "画面右上の「読み込み」からテキストを貼り付けるか、ファイルを開きます。形式は自動判定されますが、セレクトで明示することもできます。頂点番号が 0 始まりか 1 始まりかは自動で推定します。",
        ],
        table: { head: ["形式", "例（/ は改行）"], rows: formatRows.ja },
      },
      {
        title: "手で描く",
        items: [
          "頂点モード（N）で空いている場所をタップすると頂点を置けます。",
          "辺モード（E）で始点、終点の順にクリックすると辺を結べます。",
          "選択モード（V）で頂点をドラッグして移動、辺をドラッグして曲げられます。曲線はカーソルの位置を通ります。",
          "ダブルクリックでラベルや重みを編集、右クリックでメニューを開きます。",
        ],
      },
      {
        title: "自動配置",
        paragraphs: [
          "「配置」パネルから木、DAG、二部グラフ、SCC、放射、円形、格子、直線、同心円、BFS 層、自動配置、重なり解消を選べます。グラフの構造に合わない配置は無効になります。「辺をずらして重なりを避ける」を有効にすると、多重辺を扇状に広げ、頂点の上を通る辺を曲げて避けます。",
        ],
      },
      {
        title: "書き出し",
        items: [
          "PNG 画像: 全体または表示範囲を、長辺サイズと余白を指定して保存・コピー。",
          "辺リスト・隣接リスト・隣接行列: 競技プログラミングの入力形式として貼り付け可能。",
          "JSON: 位置、色、曲げまで含めて保存。読み込むと完全に復元されます。",
        ],
      },
      {
        title: "キーボードショートカット",
        items: [
          "V / N / E: 選択・頂点・辺モード",
          "Delete: 削除、⌘Z / ⌘⇧Z: 戻す・進む",
          "⌘A: すべて選択、⌘C / ⌘X / ⌘V: コピー・切り取り・貼り付け",
          "Enter: ラベル編集、矢印キー: 選択を移動",
          "⇧1: 全体表示、⌘0: 100% に戻す、L: 配置、,: 設定、?: ショートカット一覧",
        ],
      },
    ],
    faqTitle: "よくある質問",
    faq: [
      {
        question: "データはどこに保存されますか？",
        answer:
          "ブラウザのローカルストレージにだけ保存されます。サーバーには一切送信されません。別の端末で使う場合は JSON で書き出してください。",
      },
      {
        question: "有向グラフや重み付きグラフは扱えますか？",
        answer:
          "設定パネルで有向／無向、重みあり／なし、0-indexed／1-indexed を切り替えられます。重み付き辺リストを貼ると自動で重みありになります。",
      },
      {
        question: "大きなグラフは扱えますか？",
        answer:
          "読み込みは 1,000 頂点・5,000 辺までです。頂点回避などの自動ルーティングは計算量に上限があり、大きなグラフでは一部の辺が直線のままになります。",
      },
      {
        question: "スマートフォンでも使えますか？",
        answer:
          "使えます。2 本指でズーム、ドラッグで辺を曲げるなど、タッチ操作に対応しています。",
      },
      {
        question: "無料ですか？",
        answer:
          "無料で、アカウント登録も不要です。ソースコードは GitHub で公開しています。",
      },
    ],
  },
  en: {
    title: "User guide | Graph Editor",
    description:
      "How to use Graph Editor: supported input formats, automatic layouts, bending edges, exporting, keyboard shortcuts, and frequently asked questions.",
    heading: "How to use Graph Editor",
    intro:
      "Graph Editor turns an edge list or adjacency matrix into a graph theory diagram in the browser. This page walks through the flow from input to export.",
    openApp: "Open the editor",
    breadcrumbHome: "Graph Editor",
    sections: [
      {
        title: "Loading a graph",
        paragraphs: [
          "Use “Load” in the top-right rail to paste text or open a file. The format is detected automatically, or pick it explicitly. Whether labels start at 0 or 1 is inferred.",
        ],
        table: {
          head: ["Format", "Example (/ = new line)"],
          rows: formatRows.en,
        },
      },
      {
        title: "Drawing by hand",
        items: [
          "In node mode (N), tap an empty spot to place a node.",
          "In edge mode (E), click the source and then the target to connect them.",
          "In select mode (V), drag nodes to move them and drag an edge to bend it; the curve passes through the cursor.",
          "Double-click to edit a label or weight; right-click for the menu.",
        ],
      },
      {
        title: "Automatic layouts",
        paragraphs: [
          "The Layouts panel offers tree, DAG, bipartite, SCC, radial, circle, grid, line, concentric, BFS layers, auto (force), and overlap resolution. Layouts that do not fit the graph’s structure are disabled. “Offset edges to avoid overlaps” fans out parallel edges and bends edges that would cross nodes.",
        ],
      },
      {
        title: "Exporting",
        items: [
          "PNG: the whole graph or the current view, with a chosen long edge and padding; save or copy.",
          "Edge list, adjacency list, adjacency matrix: paste straight into competitive programming input.",
          "JSON: keeps positions, colours, and bends; importing restores the graph exactly.",
        ],
      },
      {
        title: "Keyboard shortcuts",
        items: [
          "V / N / E: select, node, and edge modes",
          "Delete: remove; ⌘Z / ⌘⇧Z: undo and redo",
          "⌘A: select all; ⌘C / ⌘X / ⌘V: copy, cut, paste",
          "Enter: edit label; arrow keys: nudge the selection",
          "⇧1: fit to view; ⌘0: reset zoom; L: layouts; ,: settings; ?: shortcut list",
        ],
      },
    ],
    faqTitle: "Frequently asked questions",
    faq: [
      {
        question: "Where is my data stored?",
        answer:
          "Only in your browser’s local storage. Nothing is sent to a server. To move a graph between devices, export it as JSON.",
      },
      {
        question: "Does it support directed or weighted graphs?",
        answer:
          "Yes. The Settings panel switches directed/undirected, weighted/unweighted, and 0-/1-indexed labels. Pasting a weighted edge list switches weights on automatically.",
      },
      {
        question: "How large can a graph be?",
        answer:
          "Import accepts up to 1,000 nodes and 5,000 edges. Automatic routing has a work budget, so on very large graphs some edges stay straight.",
      },
      {
        question: "Does it work on phones?",
        answer:
          "Yes. Pinch to zoom, drag edges to bend them, and every control meets touch target sizes.",
      },
      {
        question: "Is it free?",
        answer: "Free, no account needed. The source code is on GitHub.",
      },
    ],
  },
  "zh-Hans": {
    title: "使用指南 | Graph Editor",
    description:
      "Graph Editor 使用方法：支持的输入格式、自动布局、边的弯曲、导出、键盘快捷键以及常见问题。",
    heading: "Graph Editor 使用指南",
    intro:
      "Graph Editor 可以在浏览器中把边列表或邻接矩阵变成图论图形。本页介绍从输入到导出的完整流程。",
    openApp: "打开编辑器",
    breadcrumbHome: "Graph Editor",
    sections: [
      {
        title: "载入图",
        paragraphs: [
          "点击右上角的“载入”粘贴文本或打开文件。格式会自动识别，也可以手动指定。顶点编号从 0 还是 1 开始会自动推断。",
        ],
        table: {
          head: ["格式", "示例（/ 表示换行）"],
          rows: formatRows["zh-Hans"],
        },
      },
      {
        title: "手动绘制",
        items: [
          "顶点模式（N）下点击空白处放置顶点。",
          "边模式（E）下依次点击起点和终点即可连边。",
          "选择模式（V）下拖动顶点移动，拖动边即可弯曲；曲线会经过光标位置。",
          "双击编辑标签或权重，右键打开菜单。",
        ],
      },
      {
        title: "自动布局",
        paragraphs: [
          "布局面板提供树、DAG、二分图、SCC、放射、圆形、网格、直线、同心圆、BFS 分层、自动布局和重叠消除。与图结构不匹配的布局会被禁用。开启“错开边以避免重叠”后，多重边会扇形展开，穿过顶点的边会自动弯曲避开。",
        ],
      },
      {
        title: "导出",
        items: [
          "PNG：导出整张图或当前视图，可指定长边尺寸和留白，支持保存或复制。",
          "边列表、邻接表、邻接矩阵：可直接作为算法竞赛的输入格式。",
          "JSON：保留位置、颜色和弯曲，导入后可完整还原。",
        ],
      },
      {
        title: "键盘快捷键",
        items: [
          "V / N / E：选择、顶点、边模式",
          "Delete：删除；⌘Z / ⌘⇧Z：撤销与重做",
          "⌘A：全选；⌘C / ⌘X / ⌘V：复制、剪切、粘贴",
          "Enter：编辑标签；方向键：微移所选",
          "⇧1：适应视图；⌘0：恢复 100%；L：布局；,：设置；?：快捷键列表",
        ],
      },
    ],
    faqTitle: "常见问题",
    faq: [
      {
        question: "数据保存在哪里？",
        answer:
          "只保存在浏览器的本地存储中，不会发送到任何服务器。跨设备使用请导出为 JSON。",
      },
      {
        question: "支持有向图或带权图吗？",
        answer:
          "支持。在设置面板中可以切换有向/无向、带权/无权、0/1 起始编号。粘贴带权边列表会自动开启权重。",
      },
      {
        question: "图可以有多大？",
        answer:
          "导入最多支持 1,000 个顶点和 5,000 条边。自动布线有计算量上限，超大图中部分边会保持直线。",
      },
      {
        question: "手机上能用吗？",
        answer: "可以。支持双指缩放、拖动边弯曲等触控操作。",
      },
      {
        question: "是免费的吗？",
        answer: "免费且无需注册。源代码托管在 GitHub。",
      },
    ],
  },
};
