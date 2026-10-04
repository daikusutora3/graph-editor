import type { SampleGraphKind } from "./sample-graphs";

type CatalogSampleKind = Exclude<SampleGraphKind, "empty">;

type SampleCopy = {
  label: string;
  subtitle: string;
  searchTerms?: string;
};

export type SampleGraphItem = {
  kind: SampleGraphKind;
  label: string;
  subtitle: string;
  searchTerms?: string;
};

export type SampleGraphGroupKey =
  | "basics"
  | "extremal"
  | "structural"
  | "planar"
  | "algorithmic"
  | "geometric"
  | "regular"
  | "algebraic"
  | "small";

export type SampleGraphGroup = {
  key: SampleGraphGroupKey;
  label: string;
  note: string;
  samples: SampleGraphItem[];
};

export type SampleGraphDefinition = SampleGraphItem & {
  groupKey: SampleGraphGroupKey;
};

type SampleGraphDefinitionGroup = {
  key: SampleGraphGroupKey;
  label: string;
  note: string;
  samples: CatalogSampleKind[];
};

const sampleCopyByKind = {
  barbell: {
    label: "Barbell",
    subtitle: "2つのクリークを橋で接続",
    searchTerms: "バーベル 橋 関節点 bridge articulation point lowlink",
  },
  bipartite: {
    label: "Bipartite",
    subtitle: "完全二部グラフ",
    searchTerms: "完全二部グラフ 二部 マッチング matching complete bipartite",
  },
  bipartiteMatching: {
    label: "Bipartite matching",
    subtitle: "増加路を試せる疎な二部グラフ",
    searchTerms:
      "二部マッチング 最大マッチング 増加路 augmenting path maximum matching Kuhn Hopcroft Karp",
  },
  bridges: {
    label: "Bridges & articulation points",
    subtitle: "2つの閉路を3本の橋で接続",
    searchTerms:
      "橋 関節点 連結性 bridge articulation point cut vertex lowlink Tarjan DFS",
  },
  block: { label: "Block graph", subtitle: "クリークを関節点で接続" },
  bull: { label: "Bull", subtitle: "角つき三角形" },
  butterfly: { label: "Butterfly", subtitle: "蝶の形" },
  cactus: {
    label: "Cactus",
    subtitle: "閉路は高々1頂点共有",
    searchTerms: "カクタス サボテン 動的計画法 DP",
  },
  caterpillar: {
    label: "Caterpillar",
    subtitle: "背骨と葉の木",
    searchTerms: "毛虫木 キャタピラー spine leaves tree",
  },
  chain: { label: "Chain graph", subtitle: "入れ子近傍の二部" },
  chordal: { label: "Chordal", subtitle: "長い誘導閉路なし" },
  circle: { label: "Circle graph", subtitle: "弦交差から生成" },
  circularArc: { label: "Circular-arc graph", subtitle: "円弧交差から生成" },
  claw: { label: "Claw", subtitle: "爪の形" },
  clebsch: { label: "Clebsch", subtitle: "4-bit + 対蹠辺" },
  cograph: { label: "Cograph", subtitle: "P4-free" },
  comparability: { label: "Comparability", subtitle: "半順序の比較関係" },
  complete: {
    label: "Complete",
    subtitle: "すべての頂点対を接続",
    searchTerms: "完全グラフ クリーク clique complete graph",
  },
  crown: {
    label: "Crown",
    subtitle: "対応ペアを除く完全二部",
    searchTerms: "クラウングラフ 王冠 二部 matching",
  },
  cube: { label: "Cube", subtitle: "立方体" },
  cycle: {
    label: "Cycle",
    subtitle: "頂点を輪につないだ閉路",
    searchTerms: "閉路 サイクル cycle circuit",
  },
  dag: {
    label: "DAG",
    subtitle: "有向非巡回",
    searchTerms:
      "有向非巡回グラフ トポロジカルソート 動的計画法 DP topological sort directed acyclic longest path 最長路",
  },
  diamond: { label: "Diamond", subtitle: "K4から1辺削除" },
  disconnected: {
    label: "Disconnected",
    subtitle: "2つの成分",
    searchTerms: "非連結 連結成分 connected components DSU Union Find",
  },
  distanceHereditary: {
    label: "Distance-hereditary",
    subtitle: "誘導部分で距離維持",
  },
  dodecahedral: { label: "Dodecahedral", subtitle: "十二面体" },
  edgeless: {
    label: "Edgeless",
    subtitle: "独立した頂点・辺なし",
    searchTerms: "辺なし 空グラフ 独立集合 isolated independent set",
  },
  eulerTrail: {
    label: "Euler trail",
    subtitle: "奇数次数の頂点が2つ・一筆書き",
    searchTerms: "オイラー路 オイラーパス 一筆書き Eulerian trail Hierholzer",
  },
  fan: { label: "Fan", subtitle: "扇形" },
  flowNetwork: {
    label: "Flow network",
    subtitle: "s-t と容量",
    searchTerms:
      "フローネットワーク 最大流 最小カット 容量 max flow min cut Dinic Ford Fulkerson Edmonds Karp",
  },
  functional: {
    label: "Functional graph",
    subtitle: "各頂点の出次数が1・閉路と流入する木",
    searchTerms:
      "関数グラフ functional successor graph ダブリング doubling binary lifting 周期検出 cycle detection",
  },
  friendship: { label: "Friendship", subtitle: "三角形の束" },
  gem: { label: "Gem", subtitle: "P4+支配点" },
  generalizedPetersen: {
    label: "Generalized Petersen",
    subtitle: "外周と間隔を指定した内側の辺",
    searchTerms: "一般化ピーターセングラフ generalized petersen star",
  },
  grid: {
    label: "Grid",
    subtitle: "行と列を指定する格子",
    searchTerms: "格子 グリッド 迷路 幅優先探索 BFS DFS maze grid search",
  },
  grotzsch: { label: "Grötzsch graph", subtitle: "三角形なし4色必要" },
  heawood: { label: "Heawood", subtitle: "Fano平面の点と直線" },
  house: { label: "House", subtitle: "家の形" },
  houseX: { label: "House with diagonals", subtitle: "対角線つきの家" },
  hypercube: {
    label: "Hypercube",
    subtitle: "1ビット違いの頂点を接続",
    searchTerms: "超立方体 ハイパーキューブ bit ビット hypercube",
  },
  icosahedral: { label: "Icosahedral", subtitle: "二十面体" },
  interval: { label: "Interval", subtitle: "区間の交わり" },
  johnson: { label: "Johnson J(5,2)", subtitle: "2集合が1点で交わる" },
  knight: {
    label: "Knight graph",
    subtitle: "盤面と移動幅を指定",
    searchTerms: "ナイト 騎士 チェス 幅優先探索 BFS chess knight",
  },
  kneser: { label: "Kneser KG(6,2)", subtitle: "互いに素な2集合" },
  ladder: { label: "Ladder", subtitle: "はしご" },
  line: { label: "Line graph L(K₂,₄)", subtitle: "2×4 rook graph" },
  mobiusLadder: { label: "Möbius ladder", subtitle: "C₈ + 対蹠辺" },
  moserSpindle: { label: "Moser spindle", subtitle: "単位距離で4色必要" },
  multigraph: {
    label: "Multigraph",
    subtitle: "平行辺と自己ループを含む例",
    searchTerms:
      "多重グラフ 平行辺 自己ループ parallel edges self loop pseudograph",
  },
  multipartite: { label: "Multipartite", subtitle: "完全3部 K₁,₂,₃" },
  mycielski: { label: "Mycielski M(C4)", subtitle: "三角形なし3色必要" },
  negativeCycle: {
    label: "Negative cycle",
    subtitle: "始点から到達できる負閉路",
    searchTerms:
      "負閉路 負の閉路 ベルマンフォード Bellman Ford Bellman-Ford SPFA negative cycle",
  },
  negativeEdges: {
    label: "Negative edges",
    subtitle: "負辺あり・負閉路なしの最短路",
    searchTerms:
      "負辺 負の辺 最短路 ベルマンフォード Bellman Ford Bellman-Ford SPFA negative weights shortest path",
  },
  octahedral: { label: "Octahedral", subtitle: "八面体" },
  outerplanar: { label: "Outerplanar", subtitle: "外面に全頂点" },
  paley: { label: "Paley(13)", subtitle: "平方剰余 mod 13" },
  partialKTree: { label: "Partial 3-tree", subtitle: "木幅 ≤ 3" },
  path: {
    label: "Path",
    subtitle: "頂点を一列につないだ道",
    searchTerms: "道 パス path line BFS DFS",
  },
  paw: { label: "Paw", subtitle: "足つき三角形" },
  permutation: { label: "Permutation", subtitle: "順列線分の交差グラフ" },
  petersen: { label: "Petersen", subtitle: "3正則・非平面的" },
  planar: { label: "Planar", subtitle: "平面埋め込み例" },
  prism: { label: "Prism", subtitle: "三角柱" },
  randomConnected: {
    label: "Random connected graph",
    subtitle: "頂点・辺数とシードで再現できる連結グラフ",
    searchTerms:
      "ランダム 乱数 連結 テストケース seed reproducible random connected BFS DFS MST",
  },
  randomDag: {
    label: "Random DAG",
    subtitle: "頂点・辺数とシードで再現できる有向非巡回グラフ",
    searchTerms:
      "ランダム 乱数 有向非巡回 テストケース seed reproducible topological sort DP",
  },
  randomTree: {
    label: "Random tree",
    subtitle: "頂点数とシードで再現できる木",
    searchTerms:
      "ランダム 乱数 木 テストケース seed reproducible tree DP LCA DFS",
  },
  sccDemo: {
    label: "SCC example",
    subtitle: "3つの強連結成分",
    searchTerms:
      "強連結成分 強連結分解 SCC Tarjan Kosaraju strongly connected components",
  },
  seriesParallel: { label: "Series-parallel", subtitle: "直列並列" },
  split: { label: "Split", subtitle: "クリークと独立集合" },
  star: {
    label: "Star",
    subtitle: "中心から葉を接続する木",
    searchTerms: "星 スター 星型 木 葉 star leaves",
  },
  tetrahedral: { label: "Tetrahedral", subtitle: "四面体" },
  threshold: { label: "Threshold", subtitle: "孤立点と支配点" },
  tree: {
    label: "Tree",
    subtitle: "二分木",
    searchTerms:
      "木 二分木 探索 幅優先探索 深さ優先探索 木DP 動的計画法 BFS DFS DP LCA 最小共通祖先 binary tree lowest common ancestor diameter 直径",
  },
  turan: {
    label: "Turán",
    subtitle: "部数を指定する均等な完全多部",
    searchTerms:
      "トゥラーン チュラン 極値 均等多部 extremal balanced multipartite",
  },
  unitDisk: { label: "Unit disk graph", subtitle: "距離しきい値で接続" },
  weighted: {
    label: "Weighted graph",
    subtitle: "最短路の重み",
    searchTerms:
      "重み付き 最短路 ダイクストラ 最小全域木 Dijkstra shortest path MST Prim Kruskal",
  },
  wheel: { label: "Wheel", subtitle: "車輪" },
  zeroOne: {
    label: "0–1 BFS",
    subtitle: "重みが0か1の最短路",
    searchTerms:
      "0-1 BFS 01 BFS zero one breadth first search 幅優先探索 最短路 deque デック",
  },
} satisfies Record<CatalogSampleKind, SampleCopy>;

const sampleDefinitionGroups: SampleGraphDefinitionGroup[] = [
  {
    key: "basics",
    label: "基本的なグラフ族",
    note: "最初に触ることが多い基本形",
    samples: [
      "path",
      "cycle",
      "edgeless",
      "complete",
      "star",
      "tree",
      "caterpillar",
      "grid",
      "disconnected",
    ],
  },
  {
    key: "extremal",
    label: "二部・多部・極値",
    note: "彩色・マッチング・極値で使う族",
    samples: ["bipartite", "multipartite", "turan", "crown", "chain", "knight"],
  },
  {
    key: "structural",
    label: "構造的グラフクラス",
    note: "認識問題や構造定理で出るクラス",
    samples: [
      "chordal",
      "interval",
      "split",
      "cograph",
      "threshold",
      "permutation",
      "comparability",
      "line",
      "distanceHereditary",
    ],
  },
  {
    key: "planar",
    label: "平面・分解・構成",
    note: "埋め込みと低幅構造",
    samples: [
      "planar",
      "outerplanar",
      "seriesParallel",
      "partialKTree",
      "block",
      "cactus",
      "ladder",
      "wheel",
      "fan",
      "friendship",
    ],
  },
  {
    key: "algorithmic",
    label: "アルゴリズムで使う構造",
    note: "最短路・マッチング・連結性・テストデータ",
    samples: [
      "weighted",
      "zeroOne",
      "negativeEdges",
      "negativeCycle",
      "dag",
      "sccDemo",
      "flowNetwork",
      "bipartiteMatching",
      "bridges",
      "eulerTrail",
      "functional",
      "multigraph",
      "barbell",
      "randomTree",
      "randomDag",
      "randomConnected",
    ],
  },
  {
    key: "geometric",
    label: "交差グラフ・幾何表現",
    note: "円・弧・距離で表すクラス",
    samples: ["circle", "circularArc", "unitDisk"],
  },
  {
    key: "regular",
    label: "正則・対称・多面体",
    note: "正則性や高い対称性を持つ例",
    samples: [
      "cube",
      "hypercube",
      "prism",
      "tetrahedral",
      "octahedral",
      "icosahedral",
      "dodecahedral",
      "petersen",
      "heawood",
      "clebsch",
      "mobiusLadder",
      "generalizedPetersen",
    ],
  },
  {
    key: "algebraic",
    label: "集合・代数的構成",
    note: "集合族や有限体から作る例",
    samples: ["kneser", "johnson", "paley"],
  },
  {
    key: "small",
    label: "小さな名前付きグラフ・反例",
    note: "特徴付けや彩色で出る小例",
    samples: [
      "house",
      "houseX",
      "butterfly",
      "claw",
      "diamond",
      "paw",
      "bull",
      "gem",
      "mycielski",
      "grotzsch",
      "moserSpindle",
    ],
  },
];

function sample(kind: CatalogSampleKind): SampleGraphItem {
  return { kind, ...sampleCopyByKind[kind] };
}

export const sampleGraphDefinitions: SampleGraphDefinition[] =
  sampleDefinitionGroups.flatMap((group) =>
    group.samples.map((kind) => ({
      ...sample(kind),
      groupKey: group.key,
    })),
  );

export const sampleGraphGroups: SampleGraphGroup[] = sampleDefinitionGroups.map(
  (group) => ({
    key: group.key,
    label: group.label,
    note: group.note,
    samples: group.samples.map(sample),
  }),
);

export const sampleGraphCount = sampleGraphDefinitions.length;

export function sampleDefaultNodeCount(kind: SampleGraphKind) {
  const defaults: Partial<Record<SampleGraphKind, number>> = {
    path: 6,
    cycle: 6,
    edgeless: 6,
    complete: 5,
    star: 6,
    tree: 7,
    grid: 9,
    bipartite: 6,
    crown: 10,
    knight: 16,
    zeroOne: 7,
    negativeEdges: 6,
    negativeCycle: 5,
    multigraph: 4,
    bridges: 8,
    bipartiteMatching: 8,
    eulerTrail: 6,
    functional: 8,
    randomTree: 12,
    randomDag: 12,
    randomConnected: 12,
  };
  return defaults[kind] ?? 6;
}
