import type { SampleGraphKind } from "./sample-graphs";

type CatalogSampleKind = Exclude<SampleGraphKind, "empty">;

type SampleCopy = {
  label: string;
  subtitle: string;
};

export type SampleGraphItem = {
  kind: SampleGraphKind;
  label: string;
  subtitle: string;
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
  barbell: { label: "Barbell", subtitle: "2つのクリークを橋で接続" },
  bipartite: { label: "Bipartite", subtitle: "完全二部 K₃,₃" },
  block: { label: "Block graph", subtitle: "クリークを関節点で接続" },
  bull: { label: "Bull", subtitle: "角つき三角形" },
  butterfly: { label: "Butterfly", subtitle: "蝶の形" },
  cactus: { label: "Cactus", subtitle: "閉路は高々1頂点共有" },
  caterpillar: { label: "Caterpillar", subtitle: "背骨と葉の木" },
  chain: { label: "Chain graph", subtitle: "入れ子近傍の二部" },
  chordal: { label: "Chordal", subtitle: "長い誘導閉路なし" },
  circle: { label: "Circle graph", subtitle: "弦交差から生成" },
  circularArc: { label: "Circular-arc graph", subtitle: "円弧交差から生成" },
  claw: { label: "Claw", subtitle: "爪の形" },
  clebsch: { label: "Clebsch", subtitle: "4-bit + 対蹠辺" },
  cograph: { label: "Cograph", subtitle: "P4-free" },
  comparability: { label: "Comparability", subtitle: "半順序の比較関係" },
  complete: { label: "Complete", subtitle: "完全グラフ K5" },
  crown: { label: "Crown H5", subtitle: "対応ペアを除く二部" },
  cube: { label: "Cube", subtitle: "立方体" },
  cycle: { label: "Cycle", subtitle: "6頂点の閉路 C6" },
  dag: { label: "DAG", subtitle: "有向非巡回" },
  diamond: { label: "Diamond", subtitle: "K4から1辺削除" },
  disconnected: { label: "Disconnected", subtitle: "2つの成分" },
  distanceHereditary: {
    label: "Distance-hereditary",
    subtitle: "誘導部分で距離維持",
  },
  dodecahedral: { label: "Dodecahedral", subtitle: "十二面体" },
  edgeless: { label: "Edgeless", subtitle: "辺なし E6" },
  fan: { label: "Fan", subtitle: "扇形" },
  flowNetwork: { label: "Flow network", subtitle: "s-t と容量" },
  friendship: { label: "Friendship", subtitle: "三角形の束" },
  gem: { label: "Gem", subtitle: "P4+支配点" },
  generalizedPetersen: {
    label: "Generalized Petersen",
    subtitle: "G(7,2): 外周+星形",
  },
  grid: { label: "Grid", subtitle: "格子 3×3" },
  grotzsch: { label: "Grötzsch graph", subtitle: "三角形なし4色必要" },
  heawood: { label: "Heawood", subtitle: "Fano平面の点と直線" },
  house: { label: "House", subtitle: "家の形" },
  houseX: { label: "House with diagonals", subtitle: "対角線つきの家" },
  hypercube: { label: "Hypercube Q₄", subtitle: "4-bit立方体" },
  icosahedral: { label: "Icosahedral", subtitle: "二十面体" },
  interval: { label: "Interval", subtitle: "区間の交わり" },
  johnson: { label: "Johnson J(5,2)", subtitle: "2集合が1点で交わる" },
  knight: { label: "Knight graph", subtitle: "4×4 ナイト移動" },
  kneser: { label: "Kneser KG(6,2)", subtitle: "互いに素な2集合" },
  ladder: { label: "Ladder", subtitle: "はしご" },
  line: { label: "Line graph L(K₂,₄)", subtitle: "2×4 rook graph" },
  mobiusLadder: { label: "Möbius ladder", subtitle: "C₈ + 対蹠辺" },
  moserSpindle: { label: "Moser spindle", subtitle: "単位距離で4色必要" },
  multipartite: { label: "Multipartite", subtitle: "完全3部 K₁,₂,₃" },
  mycielski: { label: "Mycielski M(C4)", subtitle: "三角形なし3色必要" },
  octahedral: { label: "Octahedral", subtitle: "八面体" },
  outerplanar: { label: "Outerplanar", subtitle: "外面に全頂点" },
  paley: { label: "Paley(13)", subtitle: "平方剰余 mod 13" },
  partialKTree: { label: "Partial 3-tree", subtitle: "木幅 ≤ 3" },
  path: { label: "Path", subtitle: "6頂点の道 P6" },
  paw: { label: "Paw", subtitle: "足つき三角形" },
  permutation: { label: "Permutation", subtitle: "順列線分の交差グラフ" },
  petersen: { label: "Petersen", subtitle: "3正則・非平面的" },
  planar: { label: "Planar", subtitle: "平面埋め込み例" },
  prism: { label: "Prism", subtitle: "三角柱" },
  sccDemo: { label: "SCC example", subtitle: "3つの強連結成分" },
  seriesParallel: { label: "Series-parallel", subtitle: "直列並列" },
  split: { label: "Split", subtitle: "クリークと独立集合" },
  star: { label: "Star", subtitle: "星 K₁,₅" },
  tetrahedral: { label: "Tetrahedral", subtitle: "四面体" },
  threshold: { label: "Threshold", subtitle: "孤立点と支配点" },
  tree: { label: "Tree", subtitle: "二分木" },
  turan: { label: "Turán", subtitle: "T₃(8): 均等な3部" },
  unitDisk: { label: "Unit disk graph", subtitle: "距離しきい値で接続" },
  weighted: { label: "Weighted graph", subtitle: "最短路の重み" },
  wheel: { label: "Wheel", subtitle: "車輪" },
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
    note: "探索・DP・連結性で使う例",
    samples: ["dag", "sccDemo", "flowNetwork", "weighted", "barbell"],
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
