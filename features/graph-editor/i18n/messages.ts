import type { LayoutDisabledReason, LayoutKind } from "../layouts";
import type { ImportFormatKind } from "../io/import-types";
import type { SampleGraphKind } from "../samples/sample-graphs";
import type { SampleGraphGroupKey } from "../samples/registry";
import type { Locale } from "./locale";
import { appLocaleMetadata } from "@/lib/site-metadata";

type GraphExportFormatLabel =
  | "edge-list"
  | "adjacency-list"
  | "adjacency-matrix";

type Messages = {
  app: {
    title: string;
    authorPrefix: string;
    description: string;
    documentTitle: string;
    documentDescription: string;
  };
  common: {
    close: string;
    delete: string;
    failed: string;
    copied: string;
    copying: string;
    saved: string;
    copy: string;
    lightMode: string;
    darkMode: string;
    switchLightMode: string;
    switchDarkMode: string;
  };
  appMenu: {
    label: string;
    open: string;
    github: string;
    reportIssue: string;
    shareOnX: string;
  };
  toolbar: {
    quickActions: string;
    openSidebar: string;
    closeSidebar: string;
    groups: {
      actions: string;
      layouts: string;
      edgeAppearance: string;
      history: string;
      settings: string;
    };
    modes: Record<
      "select" | "node" | "edge",
      { label: string; tooltip: string }
    >;
    moreLayouts: string;
    collapseLayouts: string;
    autoEdgeRouting: {
      label: string;
      tooltip: string;
    };
    undo: {
      label: string;
      tooltip: string;
    };
    redo: {
      label: string;
      tooltip: string;
    };
    clear: {
      label: string;
      armedLabel: string;
      tooltip: string;
      armedTooltip: string;
    };
  };
  settings: {
    direction: string;
    undirected: string;
    directed: string;
    weight: string;
    unweighted: string;
    weighted: string;
    indexBase: string;
    arrowSize: string;
    arrowSmall: string;
    arrowNormal: string;
    arrowLarge: string;
    snapToGrid: string;
    showNodeLabels: string;
    reverseAllEdges: string;
    language: string;
  };
  starter: {
    createGraph: string;
    dialogLabel: string;
    methodLabel: string;
    paste: string;
    sample: string;
    loadingSamples: string;
    autoDetectHelp: string;
    formatLabel: string;
    autoFormat: string;
    pastePlaceholder: string;
    apply: string;
    applyAs: (format: string) => string;
    applyWithWarnings: string;
    ambiguousTitle: string;
    ambiguousHelp: string;
    needsReview: string;
    detected: (format: string) => string;
    formats: Record<ImportFormatKind, string>;
    preview: string;
    previewEmpty: string;
    previewStats: (nodeCount: number, edgeCount: number) => string;
  };
  exportPanel: {
    title: string;
    formatAria: string;
    emptyPlaceholder: string;
    exportedAria: (label: string) => string;
    copyAria: (label: string, state: "idle" | "copied" | "blocked") => string;
    adjacencyLossWarning: string;
    formats: Record<GraphExportFormatLabel, string>;
  };
  screenshot: {
    title: string;
    openAria: string;
    titleIdle: string;
    copiedAria: string;
    savedAria: string;
    blockedAria: string;
    scope: string;
    viewport: string;
    fullGraph: string;
    background: string;
    imageSize: string;
    longEdgeCustom: string;
    padding: string;
    black: string;
    white: string;
    transparent: string;
    preview: string;
    previewAlt: string;
    previewEmpty: string;
    previewFailed: string;
    previewLoading: string;
    previewNoDimensions: string;
    copyFallbackSaved: string;
    copyFailed: string;
    download: string;
    downloadFailed: string;
    downloaded: string;
    downloading: string;
  };
  canvas: {
    fitGraph: string;
    fitGraphTitle: string;
    zoomOut: string;
    resetZoom: (zoomPercent: number) => string;
    zoomIn: string;
    editNodeLabel: string;
    nodeLabelPlaceholder: string;
    editEdgeWeight: string;
    editEdgeLabel: string;
    resetEdgeCurve: string;
    reverseEdges: string;
    reverseEdgesTitle: string;
    nodeColor: string;
    edgeColor: string;
    nodeColorTitle: string;
    edgeColorTitle: string;
    colorFor: (kind: "node" | "edge", color: string) => string;
    colors: Record<
      | "paper"
      | "white"
      | "black"
      | "red"
      | "yellow"
      | "blue"
      | "green"
      | "pink",
      string
    >;
  };
  contextMenu: {
    nodeMenu: string;
    edgeMenu: string;
    editNodeLabel: string;
    editEdgeLabel: string;
    editWeight: string;
  };
  layouts: Record<
    LayoutKind,
    { label: string; subtitle: string; tooltip: string }
  > & {
    disabled: Record<LayoutDisabledReason, string>;
  };
  chrome: {
    openStarter: string;
    load: string;
    toolbar: string;
    layouts: string;
    settings: string;
    menu: string;
    export: string;
    png: string;
    pngShort: string;
    theme: string;
    shortcuts: string;
    offsetEdges: string;
    graphType: string;
    display: string;
    clear: string;
    clearArmed: string;
    clearHint: string;
    clearArmedHint: string;
    saveTxt: string;
    copy: string;
    copied: string;
    copyFailed: string;
    pngScopeFull: string;
    pngScopeView: string;
    pngTransparent: string;
    pngSize: string;
    pngPadding: string;
    pngSave: string;
    pngSaving: string;
    pngCopy: string;
    pngCopying: string;
    pngCopied: string;
    pngSaved: string;
    pngFailed: string;
    starterTitle: string;
    starterHelp: string;
    starterWaiting: string;
    starterMeta: (nodeCount: number, edgeCount: number) => string;
    starterUseSample: string;
    starterBackToPaste: string;
    starterApply: string;
    starterSamplesTitle: string;
    emptyTagline: string;
    emptyCards: Record<
      "paste" | "sample" | "draw",
      { title: string; body: string }
    >;
    recentSamples: string;
    edgeHintStart: string;
    edgeHintTarget: (label: string) => string;
    selectHint: string;
    clearedToast: (shortcut: string) => string;
    selection: {
      node: (label: string) => string;
      nodes: (count: number) => string;
      edge: (source: string, target: string) => string;
      edges: (count: number) => string;
      mixed: (nodeCount: number, edgeCount: number) => string;
      label: string;
      weight: string;
    };
    shortcutGroups: Record<"modes" | "edit" | "view", string>;
    shortcutItems: Record<
      | "select"
      | "node"
      | "edge"
      | "escape"
      | "delete"
      | "undo"
      | "redo"
      | "selectAll"
      | "copy"
      | "cut"
      | "paste"
      | "color"
      | "nudge"
      | "editLabel"
      | "fit"
      | "resetZoom"
      | "layouts"
      | "settings"
      | "shortcuts",
      string
    >;
  };
  samples: {
    searchPlaceholder: string;
    searchAria: string;
    clearSearch: string;
    empty: string;
    sizedKindLabel: string;
    sizedNodeCountLabel: string;
    sizedNodeCountAria: string;
    sizedRowsLabel: string;
    sizedColumnsLabel: string;
    sizedKnightMoveLabel: string;
    sizedKnightMoves: Record<"standard" | "long" | "camel", string>;
    sizedCreate: string;
    group: Record<SampleGraphGroupKey, { label: string; note: string }>;
    item: Partial<
      Record<
        SampleGraphKind,
        {
          title?: string;
          subtitle: string;
        }
      >
    >;
    applyAria: (label: string) => string;
  };
};

const enSampleItems = {
  path: { subtitle: "6-node path P6" },
  cycle: { subtitle: "6-node cycle C6" },
  edgeless: { subtitle: "Edgeless graph E6" },
  complete: { subtitle: "Complete graph K5" },
  star: { subtitle: "Star graph K1,5" },
  tree: { subtitle: "Binary tree" },
  caterpillar: { subtitle: "A tree with a spine and leaves" },
  grid: { subtitle: "3x3 grid graph" },
  disconnected: { subtitle: "Two connected components" },
  bipartite: { subtitle: "Complete bipartite graph K3,3" },
  multipartite: { subtitle: "Complete 3-partite graph K1,2,3" },
  turan: { subtitle: "T3(8): balanced 3-partite graph" },
  crown: { subtitle: "Bipartite graph without matching pairs" },
  chain: { subtitle: "Bipartite graph with nested neighborhoods" },
  knight: { subtitle: "4x4 knight-move graph" },
  chordal: { subtitle: "No long induced cycles" },
  interval: { subtitle: "Intersection graph of intervals" },
  split: { subtitle: "Clique plus independent set" },
  cograph: { subtitle: "P4-free graph" },
  threshold: { subtitle: "Built from isolated and dominating vertices" },
  permutation: { subtitle: "Intersection graph of permutation segments" },
  comparability: { subtitle: "Comparability graph of a partial order" },
  line: { subtitle: "2x4 rook graph" },
  distanceHereditary: { subtitle: "Distances are preserved in induced paths" },
  planar: { subtitle: "Example with a planar embedding" },
  outerplanar: { subtitle: "All vertices lie on the outer face" },
  seriesParallel: { subtitle: "Series-parallel graph" },
  partialKTree: { subtitle: "Treewidth at most 3" },
  block: { subtitle: "Cliques joined at articulation vertices" },
  cactus: { subtitle: "Cycles share at most one vertex" },
  ladder: { subtitle: "Ladder graph" },
  wheel: { subtitle: "Wheel graph" },
  fan: { subtitle: "Fan graph" },
  friendship: { subtitle: "Bundle of triangles sharing one vertex" },
  dag: { subtitle: "Directed acyclic graph" },
  sccDemo: { subtitle: "Three strongly connected components" },
  flowNetwork: { subtitle: "s-t network with capacities" },
  weighted: { subtitle: "Weighted graph for shortest paths" },
  barbell: { subtitle: "Two cliques connected by a bridge" },
  circle: { subtitle: "Intersection graph of chords" },
  circularArc: { subtitle: "Intersection graph of circular arcs" },
  unitDisk: { subtitle: "Edges by a distance threshold" },
  cube: { subtitle: "Cube graph" },
  hypercube: { subtitle: "4-bit hypercube" },
  prism: { subtitle: "Triangular prism" },
  tetrahedral: { subtitle: "Tetrahedral graph" },
  octahedral: { subtitle: "Octahedral graph" },
  icosahedral: { subtitle: "Icosahedral graph" },
  dodecahedral: { subtitle: "Dodecahedral graph" },
  petersen: { subtitle: "3-regular nonplanar graph" },
  heawood: { subtitle: "Points and lines of the Fano plane" },
  clebsch: { subtitle: "4-bit vertices with antipodal edges" },
  mobiusLadder: { subtitle: "C8 plus antipodal edges" },
  generalizedPetersen: { subtitle: "G(7,2): outer cycle plus inner star" },
  kneser: { subtitle: "Disjoint 2-subsets of a 6-set" },
  johnson: { subtitle: "2-subsets meeting in one element" },
  paley: { subtitle: "Quadratic residues modulo 13" },
  house: { subtitle: "House-shaped graph" },
  houseX: { subtitle: "House graph with diagonals" },
  butterfly: { subtitle: "Two triangles sharing one vertex" },
  claw: { subtitle: "Claw graph K1,3" },
  diamond: { subtitle: "K4 with one edge removed" },
  paw: { subtitle: "Triangle with a pendant edge" },
  bull: { subtitle: "Triangle with two pendant edges" },
  gem: { subtitle: "P4 plus a dominating vertex" },
  mycielski: { subtitle: "Triangle-free graph requiring 3 colors" },
  grotzsch: { subtitle: "Triangle-free graph requiring 4 colors" },
  moserSpindle: { subtitle: "Unit-distance graph requiring 4 colors" },
} satisfies Messages["samples"]["item"];

const zhHansSampleItems = {
  path: { title: "路径", subtitle: "6 个顶点的路径 P6" },
  cycle: { title: "环", subtitle: "6 个顶点的环 C6" },
  edgeless: { title: "空图", subtitle: "6 个孤立点 E6" },
  complete: { title: "完全图", subtitle: "完全图 K5" },
  star: { title: "星图", subtitle: "星图 K1,5" },
  tree: { title: "树", subtitle: "二叉树" },
  caterpillar: { title: "毛虫树", subtitle: "带主干和叶子的树" },
  grid: { title: "网格图", subtitle: "3x3 网格图" },
  disconnected: { title: "非连通图", subtitle: "2 个连通分量" },
  bipartite: { title: "二分图", subtitle: "完全二分图 K3,3" },
  multipartite: { title: "多部图", subtitle: "完全 3 部图 K1,2,3" },
  turan: { title: "Turán 图", subtitle: "T3(8)：均衡 3 部图" },
  crown: { title: "冠图 H5", subtitle: "去掉对应匹配边的二分图" },
  chain: { title: "链图", subtitle: "邻域嵌套的二分图" },
  knight: { title: "骑士图", subtitle: "4x4 棋盘骑士移动图" },
  chordal: { title: "弦图", subtitle: "没有长诱导环" },
  interval: { title: "区间图", subtitle: "区间相交图" },
  split: { title: "分裂图", subtitle: "团和独立集" },
  cograph: { title: "Cograph", subtitle: "P4-free 图" },
  threshold: { title: "阈值图", subtitle: "由孤立点和支配点构造" },
  permutation: { title: "排列图", subtitle: "排列线段相交图" },
  comparability: { title: "可比图", subtitle: "偏序关系的可比图" },
  line: { title: "线图 L(K2,4)", subtitle: "2x4 车图" },
  distanceHereditary: { title: "距离遗传图", subtitle: "诱导路径保持距离" },
  planar: { title: "平面图", subtitle: "平面嵌入示例" },
  outerplanar: { title: "外平面图", subtitle: "所有顶点都在外部面上" },
  seriesParallel: { title: "串并联图", subtitle: "串并联结构" },
  partialKTree: { title: "部分 3-树", subtitle: "树宽至多为 3" },
  block: { title: "块图", subtitle: "团通过割点连接" },
  cactus: { title: "仙人掌图", subtitle: "任意两个环至多共享一个顶点" },
  ladder: { title: "梯图", subtitle: "梯形结构" },
  wheel: { title: "轮图", subtitle: "轮形结构" },
  fan: { title: "扇图", subtitle: "扇形结构" },
  friendship: { title: "友谊图", subtitle: "多个三角形共享一个顶点" },
  dag: { title: "DAG", subtitle: "有向无环图" },
  sccDemo: { title: "SCC 示例", subtitle: "3 个强连通分量" },
  flowNetwork: { title: "流网络", subtitle: "带容量的 s-t 网络" },
  weighted: { title: "带权图", subtitle: "最短路用边权示例" },
  barbell: { title: "杠铃图", subtitle: "两个团由一条桥连接" },
  circle: { title: "圆图", subtitle: "弦相交图" },
  circularArc: { title: "圆弧图", subtitle: "圆弧相交图" },
  unitDisk: { title: "单位圆盘图", subtitle: "按距离阈值连边" },
  cube: { title: "立方体图", subtitle: "立方体结构" },
  hypercube: { title: "超立方体 Q4", subtitle: "4-bit 超立方体" },
  prism: { title: "棱柱图", subtitle: "三棱柱" },
  tetrahedral: { title: "四面体图", subtitle: "四面体结构" },
  octahedral: { title: "八面体图", subtitle: "八面体结构" },
  icosahedral: { title: "二十面体图", subtitle: "二十面体结构" },
  dodecahedral: { title: "十二面体图", subtitle: "十二面体结构" },
  petersen: { title: "Petersen 图", subtitle: "3-正则非平面图" },
  heawood: { title: "Heawood 图", subtitle: "Fano 平面的点和直线" },
  clebsch: { title: "Clebsch 图", subtitle: "4-bit 顶点加对径边" },
  mobiusLadder: { title: "Möbius 梯图", subtitle: "C8 加对径边" },
  generalizedPetersen: {
    title: "广义 Petersen 图",
    subtitle: "G(7,2)：外环加内星",
  },
  kneser: {
    title: "Kneser 图 KG(6,2)",
    subtitle: "6 元集合中互不相交的 2-子集",
  },
  johnson: { title: "Johnson 图 J(5,2)", subtitle: "相交于 1 个元素的 2-子集" },
  paley: { title: "Paley 图(13)", subtitle: "模 13 的二次剩余" },
  house: { title: "房子图", subtitle: "房子形状的小图" },
  houseX: { title: "带对角线的房子图", subtitle: "加入对角线的房子图" },
  butterfly: { title: "蝴蝶图", subtitle: "两个三角形共享一个顶点" },
  claw: { title: "爪图", subtitle: "K1,3" },
  diamond: { title: "钻石图", subtitle: "K4 删除一条边" },
  paw: { title: "Paw 图", subtitle: "三角形加一条悬挂边" },
  bull: { title: "Bull 图", subtitle: "三角形加两条悬挂边" },
  gem: { title: "宝石图", subtitle: "P4 加一个支配点" },
  mycielski: { title: "Mycielski M(C4)", subtitle: "无三角形但需要 3 种颜色" },
  grotzsch: { title: "Grötzsch 图", subtitle: "无三角形但需要 4 种颜色" },
  moserSpindle: {
    title: "Moser 纺锤图",
    subtitle: "需要 4 种颜色的单位距离图",
  },
} satisfies Messages["samples"]["item"];

const ja = {
  app: {
    title: "Graph Editor",
    authorPrefix: "by",
    description: "グラフを作成・編集・書き出しできるブラウザアプリ",
    documentTitle: appLocaleMetadata.ja.title,
    documentDescription: appLocaleMetadata.ja.description,
  },
  common: {
    close: "閉じる",
    delete: "削除",
    failed: "失敗",
    copied: "コピー済み",
    copying: "コピー中",
    saved: "保存済み",
    copy: "コピー",
    lightMode: "ライト",
    darkMode: "ダーク",
    switchLightMode: "ライトモードに切り替え",
    switchDarkMode: "ダークモードに切り替え",
  },
  appMenu: {
    label: "アプリメニュー",
    open: "アプリメニューを開く",
    github: "GitHub",
    reportIssue: "GitHub Issue",
    shareOnX: "Xで共有",
  },
  toolbar: {
    quickActions: "クイック操作",
    openSidebar: "サイドバーを開く",
    closeSidebar: "サイドバーを閉じる",
    groups: {
      actions: "操作",
      layouts: "配置",
      edgeAppearance: "辺を見やすく",
      history: "履歴",
      settings: "設定",
    },
    modes: {
      select: { label: "選択", tooltip: "頂点や辺を選択・移動" },
      node: { label: "頂点", tooltip: "キャンバスに頂点を追加" },
      edge: { label: "辺", tooltip: "2つの頂点を辺で接続" },
    },
    moreLayouts: "さらに表示",
    collapseLayouts: "表示を減らす",
    autoEdgeRouting: {
      label: "辺をずらす",
      tooltip: "同じ場所を通る辺を少し曲げて、1本ずつ見分けやすくします",
    },
    undo: { label: "戻す", tooltip: "直前の操作を戻す" },
    redo: { label: "進む", tooltip: "戻した操作をやり直す" },
    clear: {
      label: "クリア",
      armedLabel: "もう一度でクリア",
      tooltip: "エディタを空にする",
      armedTooltip: "もう一度クリックすると空にします",
    },
  },
  settings: {
    direction: "向き",
    undirected: "無向",
    directed: "有向",
    weight: "重み",
    unweighted: "重みなし",
    weighted: "重みあり",
    indexBase: "番号",
    arrowSize: "矢印の大きさ",
    arrowSmall: "小",
    arrowNormal: "標準",
    arrowLarge: "大",
    snapToGrid: "ドラッグをグリッドに吸着",
    showNodeLabels: "頂点ラベルを表示",
    reverseAllEdges: "全辺を反転",
    language: "言語",
  },
  starter: {
    createGraph: "グラフを作成",
    dialogLabel: "グラフ作成スターター",
    methodLabel: "開始方法",
    paste: "貼り付け",
    sample: "サンプル",
    loadingSamples: "サンプルを読み込み中",
    autoDetectHelp: "対応形式を入力内容から判定します",
    formatLabel: "形式",
    autoFormat: "自動判定",
    pastePlaceholder:
      "辺リスト\n4 4\n1 2\n2 3\n2 4\n3 4\n\n隣接リスト\n1: 2\n2: 1 3 4\n3: 2 4\n4: 2 3\n\n隣接行列\n0 1 0 0\n1 0 1 1\n0 1 0 1\n0 1 1 0",
    apply: "グラフに反映",
    applyAs: (format: string) => `${format}として反映`,
    applyWithWarnings: "警告を確認して反映",
    ambiguousTitle: "複数の形式として解釈できます",
    ambiguousHelp: "反映する形式を選択してください。",
    needsReview: "要確認",
    detected: (format: string) => `${format} として認識`,
    formats: {
      "contest-edge-list": "頂点数・辺数つき辺リスト",
      "tree-edge-list": "木の辺リスト",
      "parent-list": "親配列",
      "weighted-parent-list": "重み付き親配列",
      "edge-pairs": "辺の組リスト",
      "adjacency-list": "隣接リスト",
      "adjacency-matrix": "隣接行列",
    },
    preview: "プレビュー",
    previewEmpty: "入力待ち",
    previewStats: (nodeCount: number, edgeCount: number) =>
      `${nodeCount} 頂点 / ${edgeCount} 辺`,
  },
  exportPanel: {
    title: "書き出し",
    formatAria: "書き出し形式",
    emptyPlaceholder: "グラフを入力すると、ここに出力が表示されます",
    exportedAria: (label: string) => `書き出した${label}`,
    copyAria: (label: string, state: "idle" | "copied" | "blocked") =>
      state === "copied"
        ? `${label}をコピーしました`
        : state === "blocked"
          ? `${label}をコピーできませんでした`
          : `${label}をコピー`,
    adjacencyLossWarning:
      "多重辺は隣接リスト・隣接行列では完全に表現できない場合があります。完全な書き出しには辺リストを使ってください。",
    formats: {
      "edge-list": "辺リスト",
      "adjacency-list": "隣接リスト",
      "adjacency-matrix": "隣接行列",
    },
  },
  screenshot: {
    title: "グラフを画像にする",
    openAria: "PNG書き出しを開く",
    titleIdle: "PNGとして保存 / コピー",
    copiedAria: "スクショをコピーしました",
    savedAria: "スクショを保存しました",
    blockedAria: "スクショをコピーできませんでした",
    scope: "範囲",
    viewport: "表示中",
    fullGraph: "グラフ全体",
    background: "背景",
    imageSize: "画像サイズ",
    longEdgeCustom: "カスタム",
    padding: "余白",
    black: "黒",
    white: "白",
    transparent: "透明",
    preview: "プレビュー",
    previewAlt: "書き出すPNGのプレビュー",
    previewEmpty: "グラフを作成するとプレビューが表示されます",
    previewFailed: "プレビューを作成できませんでした",
    previewLoading: "プレビューを作成中",
    previewNoDimensions: "-- px",
    copyFallbackSaved: "コピーできなかったためPNGとして保存しました",
    copyFailed: "スクショをクリップボードにコピーできませんでした",
    download: "ダウンロード",
    downloadFailed: "スクショをダウンロードできませんでした",
    downloaded: "ダウンロード済み",
    downloading: "ダウンロード中",
  },
  canvas: {
    fitGraph: "画面外にあるグラフを表示領域に戻す",
    fitGraphTitle: "グラフを表示領域に戻す",
    zoomOut: "表示を縮小",
    resetZoom: (zoomPercent: number) =>
      `表示倍率を100%に戻す。現在 ${zoomPercent}%`,
    zoomIn: "表示を拡大",
    editNodeLabel: "頂点ラベルを編集",
    nodeLabelPlaceholder: "空欄でラベルなし",
    editEdgeWeight: "辺の重みを編集",
    editEdgeLabel: "辺ラベルを編集",
    resetEdgeCurve: "自動配置に戻す",
    reverseEdges: "向き反転",
    reverseEdgesTitle: "始点と終点を入れ替え",
    nodeColor: "頂点の色",
    edgeColor: "辺の色",
    nodeColorTitle: "頂点の色を変更",
    edgeColorTitle: "辺の色を変更",
    colorFor: (kind: "node" | "edge", color: string) =>
      `${kind === "node" ? "頂点" : "辺"}の色: ${color}`,
    colors: {
      paper: "標準",
      white: "白",
      black: "黒",
      red: "赤",
      yellow: "黄",
      blue: "青",
      green: "緑",
      pink: "桃",
    },
  },
  contextMenu: {
    nodeMenu: "頂点メニュー",
    edgeMenu: "辺メニュー",
    editNodeLabel: "頂点ラベルを編集",
    editEdgeLabel: "辺ラベルを編集",
    editWeight: "重みを編集",
  },
  layouts: {
    force: {
      label: "自動配置",
      subtitle: "力学モデル",
      tooltip: "辺の接続関係に基づいて全体を自然に広げます",
    },
    circle: {
      label: "円形",
      subtitle: "円周上に配置",
      tooltip: "頂点を円周上に等間隔で並べます",
    },
    grid: {
      label: "格子",
      subtitle: "行と列に整列",
      tooltip: "頂点を行列状に並べます",
    },
    bfs: {
      label: "BFS層",
      subtitle: "距離で層分け",
      tooltip: "選択頂点からの距離で層に並べます。有向では辺の向きに沿います",
    },
    tree: {
      label: "木",
      subtitle: "根から下へ",
      tooltip: "木・森を根から下へ配置します。1頂点選択時はそこを根にします",
    },
    concentric: {
      label: "同心円",
      subtitle: "高次数を内側へ",
      tooltip: "次数の高い頂点を内側に置き、外側へ広げます",
    },
    dagLayer: {
      label: "DAG",
      subtitle: "有向辺の流れ",
      tooltip: "DAGの有向辺の向きに沿って層状に並べます",
    },
    bipartite: {
      label: "二部",
      subtitle: "二部集合を左右へ",
      tooltip: "二部グラフの2つの頂点集合を左右に並べます",
    },
    scc: {
      label: "SCC",
      subtitle: "強連結成分",
      tooltip: "強連結成分ごとにまとめ、成分間の流れを左から右へ並べます",
    },
    radial: {
      label: "放射",
      subtitle: "中心から外へ",
      tooltip: "1頂点選択時はそこを中心に、距離層を円状に広げます",
    },
    line: {
      label: "直線",
      subtitle: "順序を見る",
      tooltip: "道や入力順を一直線に並べます",
    },
    spread: {
      label: "重なり解消",
      subtitle: "頂点を少し離す",
      tooltip: "現在位置を起点に、近すぎる頂点を少し離して見やすくします",
    },
    disabled: {
      emptyGraph: "頂点がありません",
      tooLargeGraph: "大きいグラフでは重くなるため無効です",
      notForest: "木・森ではありません",
      dagRequiresDirected: "DAG層は有向グラフで使います",
      notDag: "DAGではないためSCCを先に確認してください",
      notBipartite: "二部グラフではありません",
      sccRequiresDirected: "有向グラフで強連結成分を確認します",
    },
  },
  chrome: {
    openStarter: "グラフを読み込む",
    load: "読み込み",
    toolbar: "ツールバー",
    layouts: "配置",
    settings: "設定",
    menu: "メニュー",
    export: "書き出し",
    png: "PNG 画像",
    pngShort: "PNG",
    theme: "テーマ",
    shortcuts: "キーボードショートカット",
    offsetEdges: "辺をずらして重なりを避ける",
    graphType: "グラフの種類",
    display: "表示",
    clear: "グラフをクリア",
    clearArmed: "本当にクリアする",
    clearHint: "2 回押して確定",
    clearArmedHint: "もう一度押す",
    saveTxt: ".txt で保存",
    copy: "コピー",
    copied: "コピーしました",
    copyFailed: "コピーできません",
    pngScopeFull: "全体",
    pngScopeView: "表示範囲",
    pngTransparent: "透過",
    pngSize: "長辺サイズ",
    pngPadding: "余白",
    pngSave: "保存",
    pngSaving: "保存中…",
    pngCopy: "コピー",
    pngCopying: "コピー中…",
    pngCopied: "コピーしました",
    pngSaved: "保存しました",
    pngFailed: "失敗",
    starterTitle: "グラフを読み込む",
    starterHelp: "辺リスト（先頭に N M 可）か隣接リスト（a: b c）を貼り付け",
    starterWaiting: "入力待ち",
    starterMeta: (nodeCount: number, edgeCount: number) =>
      `N=${nodeCount} M=${edgeCount}`,
    starterUseSample: "サンプルを使う",
    starterBackToPaste: "貼り付けに戻る",
    starterApply: "グラフに反映",
    starterSamplesTitle: "サンプル",
    emptyTagline: "辺リストを貼るか、サンプルから始めるか、直接描くか。",
    emptyCards: {
      paste: {
        title: "貼り付け",
        body: "辺リスト・隣接リスト。形式は自動判定。",
      },
      sample: { title: "サンプル", body: "閉路・木・格子などから選ぶ。" },
      draw: {
        title: "手で描く",
        body: "頂点モードでタップ。辺モードで 2 点を結ぶ。",
      },
    },
    recentSamples: "よく使うサンプル",
    edgeHintStart: "始点の頂点をクリック",
    edgeHintTarget: (label: string) =>
      `頂点 ${label} → 終点をクリック（Esc で解除）`,
    selectHint:
      "ドラッグで移動 · ダブルクリックでラベル · 右クリックでメニュー · Shift+ドラッグで範囲選択",
    clearedToast: (shortcut: string) =>
      `グラフをクリアしました（${shortcut} で戻す）`,
    selection: {
      node: (label: string) => `頂点 ${label}`,
      nodes: (count: number) => `${count} 頂点`,
      edge: (source: string, target: string) => `辺 ${source}–${target}`,
      edges: (count: number) => `${count} 辺`,
      mixed: (nodeCount: number, edgeCount: number) =>
        `${nodeCount} 頂点 · ${edgeCount} 辺`,
      label: "ラベル",
      weight: "重み",
    },
    shortcutGroups: { modes: "モード", edit: "編集", view: "表示・パネル" },
    shortcutItems: {
      select: "選択",
      node: "頂点を置く",
      edge: "辺を結ぶ",
      escape: "解除",
      delete: "削除",
      undo: "戻す",
      redo: "進む",
      selectAll: "すべて選択",
      copy: "コピー",
      cut: "切り取り",
      paste: "貼り付け",
      color: "色を切り替え",
      nudge: "選択を移動",
      editLabel: "ラベルを編集",
      fit: "全体表示",
      resetZoom: "100% に戻す",
      layouts: "配置",
      settings: "設定",
      shortcuts: "この一覧",
    },
  },
  samples: {
    searchPlaceholder: "サンプルを検索…",
    searchAria: "サンプルを名前で検索",
    clearSearch: "検索をクリア",
    empty: "該当するサンプルはありません",
    sizedKindLabel: "形",
    sizedNodeCountLabel: "頂点数",
    sizedNodeCountAria: "生成する頂点数",
    sizedRowsLabel: "行",
    sizedColumnsLabel: "列",
    sizedKnightMoveLabel: "移動",
    sizedKnightMoves: {
      standard: "標準 (1,2)",
      long: "長距離 (1,3)",
      camel: "キャメル (2,3)",
    },
    sizedCreate: "作成",
    group: {
      basics: {
        label: "基本的なグラフ族",
        note: "最初に触ることが多い基本形",
      },
      extremal: {
        label: "二部・多部・極値",
        note: "彩色・マッチング・極値で使う族",
      },
      structural: {
        label: "構造的グラフクラス",
        note: "認識問題や構造定理で出るクラス",
      },
      planar: { label: "平面・分解・構成", note: "埋め込みと低幅構造" },
      algorithmic: {
        label: "アルゴリズムで使う構造",
        note: "探索・DP・連結性で使う例",
      },
      geometric: {
        label: "交差グラフ・幾何表現",
        note: "円・弧・距離で表すクラス",
      },
      regular: {
        label: "正則・対称・多面体",
        note: "正則性や高い対称性を持つ例",
      },
      algebraic: {
        label: "集合・代数的構成",
        note: "集合族や有限体から作る例",
      },
      small: {
        label: "小さな名前付きグラフ・反例",
        note: "特徴付けや彩色で出る小例",
      },
    },
    item: {},
    applyAria: (label: string) => `${label} のサンプルを入力`,
  },
} satisfies Messages;

const en: Messages = {
  ...ja,
  app: {
    title: "Graph Editor",
    authorPrefix: "by",
    description: "Create, edit, and export graphs in the browser.",
    documentTitle: appLocaleMetadata.en.title,
    documentDescription: appLocaleMetadata.en.description,
  },
  common: {
    close: "Close",
    delete: "Delete",
    failed: "Failed",
    copied: "Copied",
    copying: "Copying",
    saved: "Saved",
    copy: "Copy",
    lightMode: "Light",
    darkMode: "Dark",
    switchLightMode: "Switch to light mode",
    switchDarkMode: "Switch to dark mode",
  },
  appMenu: {
    label: "App menu",
    open: "Open app menu",
    github: "GitHub",
    reportIssue: "GitHub Issue",
    shareOnX: "Share on X",
  },
  toolbar: {
    ...ja.toolbar,
    quickActions: "Quick actions",
    openSidebar: "Open sidebar",
    closeSidebar: "Close sidebar",
    groups: {
      actions: "Actions",
      layouts: "Layouts",
      edgeAppearance: "Readable edges",
      history: "History",
      settings: "Settings",
    },
    modes: {
      select: { label: "Select", tooltip: "Select and move nodes or edges" },
      node: { label: "Node", tooltip: "Add nodes on the canvas" },
      edge: { label: "Edge", tooltip: "Connect two nodes with an edge" },
    },
    moreLayouts: "Show more",
    collapseLayouts: "Show fewer",
    autoEdgeRouting: {
      label: "Offset edges",
      tooltip:
        "Slightly curve edges that share the same path so each edge is easier to tell apart",
    },
    undo: { label: "Undo", tooltip: "Undo the last action" },
    redo: { label: "Redo", tooltip: "Redo the last undone action" },
    clear: {
      label: "Clear",
      armedLabel: "Click again to clear",
      tooltip: "Clear the editor",
      armedTooltip: "Click again to empty the graph",
    },
  },
  settings: {
    direction: "Direction",
    undirected: "Undirected",
    directed: "Directed",
    weight: "Weights",
    unweighted: "Unweighted",
    weighted: "Weighted",
    indexBase: "Index",
    arrowSize: "Arrow size",
    arrowSmall: "Small",
    arrowNormal: "Normal",
    arrowLarge: "Large",
    snapToGrid: "Snap drags to grid",
    showNodeLabels: "Show node labels",
    reverseAllEdges: "Reverse all edges",
    language: "Language",
  },
  starter: {
    createGraph: "Create graph",
    dialogLabel: "Graph starter",
    methodLabel: "Start method",
    paste: "Paste",
    sample: "Samples",
    loadingSamples: "Loading samples",
    autoDetectHelp: "Detects the supported format from your input.",
    formatLabel: "Format",
    autoFormat: "Auto detect",
    pastePlaceholder:
      "Edge list\n4 4\n1 2\n2 3\n2 4\n3 4\n\nAdjacency list\n1: 2\n2: 1 3 4\n3: 2 4\n4: 2 3\n\nAdjacency matrix\n0 1 0 0\n1 0 1 1\n0 1 0 1\n0 1 1 0",
    apply: "Apply to graph",
    applyAs: (format: string) => `Apply as ${format}`,
    applyWithWarnings: "Apply after reviewing warnings",
    ambiguousTitle: "This input has multiple interpretations",
    ambiguousHelp: "Select the format you want to apply.",
    needsReview: "Review needed",
    detected: (format: string) => `Read as ${format}`,
    formats: {
      "contest-edge-list": "edge list with counts",
      "tree-edge-list": "tree edge list",
      "parent-list": "parent list",
      "weighted-parent-list": "weighted parent list",
      "edge-pairs": "edge pair list",
      "adjacency-list": "adjacency list",
      "adjacency-matrix": "adjacency matrix",
    },
    preview: "Preview",
    previewEmpty: "Waiting for input",
    previewStats: (nodeCount: number, edgeCount: number) =>
      `${nodeCount} nodes / ${edgeCount} edges`,
  },
  exportPanel: {
    title: "Export",
    formatAria: "Export format",
    emptyPlaceholder: "Graph output appears here after you create a graph.",
    exportedAria: (label: string) => `Exported ${label}`,
    copyAria: (label: string, state: "idle" | "copied" | "blocked") =>
      state === "copied"
        ? `${label} copied`
        : state === "blocked"
          ? `Could not copy ${label}`
          : `Copy ${label}`,
    adjacencyLossWarning:
      "Parallel edges may not be represented completely in adjacency lists or matrices. Use edge list for a lossless export.",
    formats: {
      "edge-list": "Edge list",
      "adjacency-list": "Adjacency list",
      "adjacency-matrix": "Adjacency matrix",
    },
  },
  screenshot: {
    title: "Export graph as image",
    openAria: "Open PNG export",
    titleIdle: "Save or copy as PNG",
    copiedAria: "Screenshot copied",
    savedAria: "Screenshot saved",
    blockedAria: "Could not copy screenshot",
    scope: "Scope",
    viewport: "Current view",
    fullGraph: "Full graph",
    background: "Background",
    imageSize: "Image size",
    longEdgeCustom: "Custom",
    padding: "Padding",
    black: "Black",
    white: "White",
    transparent: "Transparent",
    preview: "Preview",
    previewAlt: "Preview of the PNG export",
    previewEmpty: "Create a graph to preview the image.",
    previewFailed: "Could not create the preview.",
    previewLoading: "Creating preview",
    previewNoDimensions: "-- px",
    copyFallbackSaved: "Could not copy, so the PNG was saved instead.",
    copyFailed: "Could not copy the screenshot to the clipboard.",
    download: "Download",
    downloadFailed: "Could not download the screenshot.",
    downloaded: "Downloaded",
    downloading: "Downloading",
  },
  canvas: {
    fitGraph: "Bring off-screen graph back into view",
    fitGraphTitle: "Fit graph to view",
    zoomOut: "Zoom out",
    resetZoom: (zoomPercent: number) =>
      `Reset zoom to 100%. Current zoom is ${zoomPercent}%.`,
    zoomIn: "Zoom in",
    editNodeLabel: "Edit node label",
    nodeLabelPlaceholder: "Leave blank for no label",
    editEdgeWeight: "Edit edge weight",
    editEdgeLabel: "Edit edge label",
    resetEdgeCurve: "Return to automatic routing",
    reverseEdges: "Reverse",
    reverseEdgesTitle: "Swap source and target",
    nodeColor: "Node color",
    edgeColor: "Edge color",
    nodeColorTitle: "Change node color",
    edgeColorTitle: "Change edge color",
    colorFor: (kind: "node" | "edge", color: string) =>
      `${kind === "node" ? "Node" : "Edge"} color: ${color}`,
    colors: {
      paper: "Default",
      white: "White",
      black: "Black",
      red: "Red",
      yellow: "Yellow",
      blue: "Blue",
      green: "Green",
      pink: "Pink",
    },
  },
  contextMenu: {
    nodeMenu: "Node menu",
    edgeMenu: "Edge menu",
    editNodeLabel: "Edit node label",
    editEdgeLabel: "Edit edge label",
    editWeight: "Edit weight",
  },
  layouts: {
    force: {
      label: "Auto layout",
      subtitle: "Force-directed",
      tooltip: "Spread nodes using their edge relationships",
    },
    circle: {
      label: "Circle",
      subtitle: "Even ring",
      tooltip: "Place nodes at even intervals around a circle",
    },
    grid: {
      label: "Grid",
      subtitle: "Rows and columns",
      tooltip: "Align nodes into rows and columns",
    },
    bfs: {
      label: "BFS layers",
      subtitle: "By distance",
      tooltip: "Layer nodes by distance from the selected node",
    },
    tree: {
      label: "Tree",
      subtitle: "Root downward",
      tooltip: "Arrange a tree or forest from the root downward",
    },
    concentric: {
      label: "Concentric",
      subtitle: "High degree inside",
      tooltip: "Place high-degree nodes near the center",
    },
    dagLayer: {
      label: "DAG",
      subtitle: "Directed flow",
      tooltip: "Layer nodes along the directed edges of a DAG",
    },
    bipartite: {
      label: "Bipartite",
      subtitle: "Two parts",
      tooltip:
        "Place the two vertex sets of a bipartite graph on opposite sides",
    },
    scc: {
      label: "SCC",
      subtitle: "Strong components",
      tooltip: "Group strongly connected components from left to right",
    },
    radial: {
      label: "Radial",
      subtitle: "From center",
      tooltip: "Spread distance layers around a selected center node",
    },
    line: {
      label: "Line",
      subtitle: "Input order",
      tooltip: "Place path-like graphs or input order in a line",
    },
    spread: {
      label: "Resolve overlap",
      subtitle: "Move nodes apart",
      tooltip: "Move nearby nodes apart from their current positions",
    },
    disabled: {
      emptyGraph: "There are no nodes.",
      tooLargeGraph: "Disabled for large graphs to avoid slow layout.",
      notForest: "This is not a tree or forest.",
      dagRequiresDirected: "DAG layers require a directed graph.",
      notDag: "This graph is not a DAG. Check SCCs first.",
      notBipartite: "This graph is not bipartite.",
      sccRequiresDirected: "SCCs require a directed graph.",
    },
  },
  chrome: {
    openStarter: "Load a graph",
    load: "Load",
    toolbar: "Toolbar",
    layouts: "Layout",
    settings: "Settings",
    menu: "Menu",
    export: "Export",
    png: "PNG image",
    pngShort: "PNG",
    theme: "Theme",
    shortcuts: "Keyboard shortcuts",
    offsetEdges: "Offset overlapping edges",
    graphType: "Graph type",
    display: "Display",
    clear: "Clear graph",
    clearArmed: "Really clear",
    clearHint: "Press twice to confirm",
    clearArmedHint: "Press again",
    saveTxt: "Save as .txt",
    copy: "Copy",
    copied: "Copied",
    copyFailed: "Could not copy",
    pngScopeFull: "Full",
    pngScopeView: "Viewport",
    pngTransparent: "Clear",
    pngSize: "Long edge",
    pngPadding: "Padding",
    pngSave: "Save",
    pngSaving: "Saving…",
    pngCopy: "Copy",
    pngCopying: "Copying…",
    pngCopied: "Copied",
    pngSaved: "Saved",
    pngFailed: "Failed",
    starterTitle: "Load a graph",
    starterHelp:
      "Paste an edge list (N M header optional) or an adjacency list (a: b c)",
    starterWaiting: "Waiting for input",
    starterMeta: (nodeCount: number, edgeCount: number) =>
      `N=${nodeCount} M=${edgeCount}`,
    starterUseSample: "Use a sample",
    starterBackToPaste: "Back to paste",
    starterApply: "Apply to graph",
    starterSamplesTitle: "Samples",
    emptyTagline: "Paste an edge list, start from a sample, or draw directly.",
    emptyCards: {
      paste: {
        title: "Paste",
        body: "Edge list or adjacency list. Format is auto-detected.",
      },
      sample: { title: "Sample", body: "Pick a cycle, tree, grid, and more." },
      draw: {
        title: "Draw",
        body: "Tap in node mode. Connect two nodes in edge mode.",
      },
    },
    recentSamples: "Popular samples",
    edgeHintStart: "Click the source node",
    edgeHintTarget: (label: string) =>
      `Node ${label} → click the target (Esc to cancel)`,
    selectHint:
      "Drag to move · Double-click to edit the label · Right-click for the menu · Shift+drag to select many",
    clearedToast: (shortcut: string) => `Graph cleared (${shortcut} to undo)`,
    selection: {
      node: (label: string) => `Node ${label}`,
      nodes: (count: number) => `${count} nodes`,
      edge: (source: string, target: string) => `Edge ${source}–${target}`,
      edges: (count: number) => `${count} edges`,
      mixed: (nodeCount: number, edgeCount: number) =>
        `${nodeCount} nodes · ${edgeCount} edges`,
      label: "Label",
      weight: "Weight",
    },
    shortcutGroups: { modes: "Modes", edit: "Edit", view: "View & panels" },
    shortcutItems: {
      select: "Select",
      node: "Place node",
      edge: "Connect edge",
      escape: "Cancel",
      delete: "Delete",
      undo: "Undo",
      redo: "Redo",
      selectAll: "Select all",
      copy: "Copy",
      cut: "Cut",
      paste: "Paste",
      color: "Cycle color",
      nudge: "Nudge selection",
      editLabel: "Edit label",
      fit: "Fit to view",
      resetZoom: "Reset to 100%",
      layouts: "Layout",
      settings: "Settings",
      shortcuts: "This list",
    },
  },
  samples: {
    searchPlaceholder: "Search samples…",
    searchAria: "Search samples by name",
    clearSearch: "Clear search",
    empty: "No matching samples",
    sizedKindLabel: "Shape",
    sizedNodeCountLabel: "Nodes",
    sizedNodeCountAria: "Node count to generate",
    sizedRowsLabel: "Rows",
    sizedColumnsLabel: "Columns",
    sizedKnightMoveLabel: "Move",
    sizedKnightMoves: {
      standard: "Standard (1,2)",
      long: "Long (1,3)",
      camel: "Camel (2,3)",
    },
    sizedCreate: "Create",
    group: {
      basics: { label: "Basic families", note: "Common starting shapes" },
      extremal: {
        label: "Bipartite and extremal",
        note: "Coloring, matching, and extremal examples",
      },
      structural: {
        label: "Structural classes",
        note: "Classes used in recognition and structure theorems",
      },
      planar: {
        label: "Planar and decomposed",
        note: "Embeddings and low-width structures",
      },
      algorithmic: {
        label: "Algorithmic structures",
        note: "Traversal, DP, and connectivity examples",
      },
      geometric: {
        label: "Intersection and geometry",
        note: "Graphs represented by arcs, circles, or distance",
      },
      regular: {
        label: "Regular and symmetric",
        note: "Regular graphs and highly symmetric examples",
      },
      algebraic: {
        label: "Set and algebraic",
        note: "Examples from set systems and finite fields",
      },
      small: {
        label: "Small named graphs",
        note: "Small examples used for characterization and coloring",
      },
    },
    item: enSampleItems,
    applyAria: (label: string) => `Insert the ${label} sample`,
  },
};

const zhHans: Messages = {
  ...ja,
  app: {
    title: "Graph Editor",
    authorPrefix: "作者",
    description: "在浏览器中创建、编辑并导出图。",
    documentTitle: appLocaleMetadata["zh-Hans"].title,
    documentDescription: appLocaleMetadata["zh-Hans"].description,
  },
  common: {
    close: "关闭",
    delete: "删除",
    failed: "失败",
    copied: "已复制",
    copying: "复制中",
    saved: "已保存",
    copy: "复制",
    lightMode: "浅色",
    darkMode: "深色",
    switchLightMode: "切换到浅色模式",
    switchDarkMode: "切换到深色模式",
  },
  appMenu: {
    label: "应用菜单",
    open: "打开应用菜单",
    github: "GitHub",
    reportIssue: "GitHub Issue",
    shareOnX: "分享到 X",
  },
  toolbar: {
    ...en.toolbar,
    quickActions: "快速操作",
    openSidebar: "打开侧边栏",
    closeSidebar: "关闭侧边栏",
    groups: {
      actions: "操作",
      layouts: "布局",
      edgeAppearance: "边更易读",
      history: "历史",
      settings: "设置",
    },
    modes: {
      select: { label: "选择", tooltip: "选择并移动顶点或边" },
      node: { label: "顶点", tooltip: "在画布上添加顶点" },
      edge: { label: "边", tooltip: "连接两个顶点" },
    },
    moreLayouts: "再显示",
    collapseLayouts: "收起部分",
    autoEdgeRouting: {
      label: "错开边",
      tooltip: "将经过同一路径的边稍微弯曲，便于逐条区分",
    },
    undo: { label: "撤销", tooltip: "撤销上一步操作" },
    redo: { label: "重做", tooltip: "重做已撤销的操作" },
    clear: {
      label: "清空",
      armedLabel: "再次点击清空",
      tooltip: "清空编辑器",
      armedTooltip: "再次点击将清空图",
    },
  },
  settings: {
    direction: "方向",
    undirected: "无向",
    directed: "有向",
    weight: "权值",
    unweighted: "无权",
    weighted: "有权",
    indexBase: "编号",
    arrowSize: "箭头大小",
    arrowSmall: "小",
    arrowNormal: "标准",
    arrowLarge: "大",
    snapToGrid: "拖动吸附到网格",
    showNodeLabels: "显示顶点标签",
    reverseAllEdges: "反转全部边",
    language: "语言",
  },
  starter: {
    createGraph: "创建图",
    dialogLabel: "图创建面板",
    methodLabel: "开始方式",
    paste: "粘贴",
    sample: "示例",
    loadingSamples: "正在加载示例",
    autoDetectHelp: "根据输入内容检测支持的格式。",
    formatLabel: "格式",
    autoFormat: "自动检测",
    pastePlaceholder:
      "边列表\n4 4\n1 2\n2 3\n2 4\n3 4\n\n邻接表\n1: 2\n2: 1 3 4\n3: 2 4\n4: 2 3\n\n邻接矩阵\n0 1 0 0\n1 0 1 1\n0 1 0 1\n0 1 1 0",
    apply: "应用到图",
    applyAs: (format: string) => `按${format}应用`,
    applyWithWarnings: "确认警告后应用",
    ambiguousTitle: "此输入可按多种格式解释",
    ambiguousHelp: "请选择要应用的格式。",
    needsReview: "需要确认",
    detected: (format: string) => `按 ${format} 读取`,
    formats: {
      "contest-edge-list": "带顶点数和边数的边列表",
      "tree-edge-list": "树边列表",
      "parent-list": "父节点列表",
      "weighted-parent-list": "带权父节点列表",
      "edge-pairs": "边对列表",
      "adjacency-list": "邻接表",
      "adjacency-matrix": "邻接矩阵",
    },
    preview: "预览",
    previewEmpty: "等待输入",
    previewStats: (nodeCount: number, edgeCount: number) =>
      `${nodeCount} 个顶点 / ${edgeCount} 条边`,
  },
  exportPanel: {
    title: "导出",
    formatAria: "导出格式",
    emptyPlaceholder: "创建图后，输出会显示在这里。",
    exportedAria: (label: string) => `已导出的${label}`,
    copyAria: (label: string, state: "idle" | "copied" | "blocked") =>
      state === "copied"
        ? `已复制${label}`
        : state === "blocked"
          ? `无法复制${label}`
          : `复制${label}`,
    adjacencyLossWarning:
      "多重边可能无法在邻接表或邻接矩阵中完整表示。请使用边列表进行无损导出。",
    formats: {
      "edge-list": "边列表",
      "adjacency-list": "邻接表",
      "adjacency-matrix": "邻接矩阵",
    },
  },
  screenshot: {
    title: "导出图像",
    openAria: "打开 PNG 导出",
    titleIdle: "保存或复制为 PNG",
    copiedAria: "截图已复制",
    savedAria: "截图已保存",
    blockedAria: "无法复制截图",
    scope: "范围",
    viewport: "当前视图",
    fullGraph: "整个图",
    background: "背景",
    imageSize: "图像尺寸",
    longEdgeCustom: "自定义",
    padding: "留白",
    black: "黑色",
    white: "白色",
    transparent: "透明",
    preview: "预览",
    previewAlt: "导出 PNG 的预览",
    previewEmpty: "创建图表后会显示预览。",
    previewFailed: "无法创建预览。",
    previewLoading: "正在创建预览",
    previewNoDimensions: "-- px",
    copyFallbackSaved: "无法复制，已改为保存 PNG。",
    copyFailed: "无法将截图复制到剪贴板。",
    download: "下载",
    downloadFailed: "无法下载截图。",
    downloaded: "已下载",
    downloading: "下载中",
  },
  canvas: {
    ...en.canvas,
    fitGraph: "将画布外的图移回视图",
    fitGraphTitle: "适应视图",
    zoomOut: "缩小",
    resetZoom: (zoomPercent: number) => `重置为 100%。当前为 ${zoomPercent}%。`,
    zoomIn: "放大",
    editNodeLabel: "编辑顶点标签",
    nodeLabelPlaceholder: "留空则不显示标签",
    editEdgeWeight: "编辑边权值",
    editEdgeLabel: "编辑边标签",
    resetEdgeCurve: "恢复自动布线",
    reverseEdges: "反向",
    reverseEdgesTitle: "交换起点和终点",
    nodeColor: "顶点颜色",
    edgeColor: "边颜色",
    nodeColorTitle: "更改顶点颜色",
    edgeColorTitle: "更改边颜色",
    colorFor: (kind: "node" | "edge", color: string) =>
      `${kind === "node" ? "顶点" : "边"}颜色：${color}`,
    colors: {
      paper: "默认",
      white: "白色",
      black: "黑色",
      red: "红色",
      yellow: "黄色",
      blue: "蓝色",
      green: "绿色",
      pink: "粉色",
    },
  },
  contextMenu: {
    nodeMenu: "顶点菜单",
    edgeMenu: "边菜单",
    editNodeLabel: "编辑顶点标签",
    editEdgeLabel: "编辑边标签",
    editWeight: "编辑权值",
  },
  layouts: {
    ...en.layouts,
    force: {
      label: "自动布局",
      subtitle: "力导向布局",
      tooltip: "根据边的连接关系自然展开整体",
    },
    circle: {
      label: "圆形",
      subtitle: "等距圆环",
      tooltip: "将顶点等距排列在圆周上",
    },
    grid: { label: "网格", subtitle: "行和列", tooltip: "将顶点对齐到行列中" },
    bfs: {
      label: "BFS 分层",
      subtitle: "按距离",
      tooltip: "按到所选顶点的距离分层",
    },
    tree: {
      label: "树",
      subtitle: "从根向下",
      tooltip: "从根向下排列树或森林",
    },
    concentric: {
      label: "同心圆",
      subtitle: "高度数在内侧",
      tooltip: "将度数较高的顶点放在中心附近",
    },
    dagLayer: {
      label: "DAG",
      subtitle: "按有向边",
      tooltip: "沿 DAG 的有向边方向分层",
    },
    bipartite: {
      label: "二分图",
      subtitle: "两个点集",
      tooltip: "将二分图的两个顶点集合放在两侧",
    },
    scc: {
      label: "SCC",
      subtitle: "强连通分量",
      tooltip: "从左到右排列强连通分量",
    },
    radial: {
      label: "放射",
      subtitle: "从中心",
      tooltip: "围绕所选中心顶点展开距离层",
    },
    line: {
      label: "直线",
      subtitle: "输入顺序",
      tooltip: "按路径或输入顺序排成一线",
    },
    spread: {
      label: "消除重叠",
      subtitle: "稍微拉开顶点",
      tooltip: "从当前位置拉开过近的顶点",
    },
    disabled: {
      emptyGraph: "没有顶点。",
      tooLargeGraph: "大图布局较慢，已禁用。",
      notForest: "这不是树或森林。",
      dagRequiresDirected: "DAG 分层需要有向图。",
      notDag: "此图不是 DAG。请先检查 SCC。",
      notBipartite: "此图不是二分图。",
      sccRequiresDirected: "SCC 需要有向图。",
    },
  },
  chrome: {
    openStarter: "加载图",
    load: "加载",
    toolbar: "工具栏",
    layouts: "布局",
    settings: "设置",
    menu: "菜单",
    export: "导出",
    png: "PNG 图像",
    pngShort: "PNG",
    theme: "主题",
    shortcuts: "键盘快捷键",
    offsetEdges: "错开重叠的边",
    graphType: "图类型",
    display: "显示",
    clear: "清空图",
    clearArmed: "确认清空",
    clearHint: "点击两次确认",
    clearArmedHint: "再次点击",
    saveTxt: "保存为 .txt",
    copy: "复制",
    copied: "已复制",
    copyFailed: "无法复制",
    pngScopeFull: "整图",
    pngScopeView: "视图",
    pngTransparent: "透明",
    pngSize: "长边尺寸",
    pngPadding: "留白",
    pngSave: "保存",
    pngSaving: "保存中…",
    pngCopy: "复制",
    pngCopying: "复制中…",
    pngCopied: "已复制",
    pngSaved: "已保存",
    pngFailed: "失败",
    starterTitle: "加载图",
    starterHelp: "粘贴边列表（可带 N M 首行）或邻接表（a: b c）",
    starterWaiting: "等待输入",
    starterMeta: (nodeCount: number, edgeCount: number) =>
      `N=${nodeCount} M=${edgeCount}`,
    starterUseSample: "使用示例",
    starterBackToPaste: "返回粘贴",
    starterApply: "应用到图",
    starterSamplesTitle: "示例",
    emptyTagline: "粘贴边列表、从示例开始，或直接绘制。",
    emptyCards: {
      paste: { title: "粘贴", body: "边列表或邻接表，格式自动检测。" },
      sample: { title: "示例", body: "从环、树、网格等中选择。" },
      draw: { title: "手绘", body: "顶点模式下点击。边模式下连接两点。" },
    },
    recentSamples: "常用示例",
    edgeHintStart: "点击起点顶点",
    edgeHintTarget: (label: string) => `顶点 ${label} → 点击终点（Esc 取消）`,
    selectHint: "拖动移动 · 双击编辑标签 · 右键打开菜单 · Shift+拖动框选",
    clearedToast: (shortcut: string) => `已清空图（${shortcut} 撤销）`,
    selection: {
      node: (label: string) => `顶点 ${label}`,
      nodes: (count: number) => `${count} 个顶点`,
      edge: (source: string, target: string) => `边 ${source}–${target}`,
      edges: (count: number) => `${count} 条边`,
      mixed: (nodeCount: number, edgeCount: number) =>
        `${nodeCount} 个顶点 · ${edgeCount} 条边`,
      label: "标签",
      weight: "权值",
    },
    shortcutGroups: { modes: "模式", edit: "编辑", view: "视图与面板" },
    shortcutItems: {
      select: "选择",
      node: "放置顶点",
      edge: "连接边",
      escape: "取消",
      delete: "删除",
      undo: "撤销",
      redo: "重做",
      selectAll: "全选",
      copy: "复制",
      cut: "剪切",
      paste: "粘贴",
      color: "切换颜色",
      nudge: "移动选区",
      editLabel: "编辑标签",
      fit: "适应视图",
      resetZoom: "重置为 100%",
      layouts: "布局",
      settings: "设置",
      shortcuts: "此列表",
    },
  },
  samples: {
    ...en.samples,
    searchPlaceholder: "搜索示例…",
    searchAria: "按名称搜索示例",
    clearSearch: "清除搜索",
    empty: "没有匹配的示例",
    sizedKindLabel: "形状",
    sizedNodeCountLabel: "顶点数",
    sizedNodeCountAria: "要生成的顶点数",
    sizedRowsLabel: "行",
    sizedColumnsLabel: "列",
    sizedKnightMoveLabel: "移动",
    sizedKnightMoves: {
      standard: "标准 (1,2)",
      long: "长步 (1,3)",
      camel: "骆驼 (2,3)",
    },
    sizedCreate: "创建",
    group: {
      basics: { label: "基础图族", note: "常见的起始形状" },
      extremal: { label: "二分与极值", note: "染色、匹配和极值示例" },
      structural: { label: "结构图类", note: "识别问题和结构定理中的图类" },
      planar: { label: "平面与分解", note: "嵌入和低宽度结构" },
      algorithmic: { label: "算法结构", note: "遍历、DP 和连通性示例" },
      geometric: { label: "相交图与几何图", note: "由圆弧、圆或距离定义的图" },
      regular: { label: "正则与对称", note: "正则图和高对称示例" },
      algebraic: { label: "集合与代数", note: "来自集合系统和有限域的示例" },
      small: { label: "小型命名图", note: "用于刻画和染色的小例子" },
    },
    item: zhHansSampleItems,
    applyAria: (label: string) => `插入 ${label} 示例`,
  },
};

export const messagesByLocale: Record<Locale, Messages> = {
  ja,
  en,
  "zh-Hans": zhHans,
};

export type { Messages };
