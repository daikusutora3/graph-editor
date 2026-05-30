import type { SampleGraphKind } from "./sample-graphs";

export type SampleGraphItem = {
  kind: SampleGraphKind;
  label: string;
  title: string;
  subtitle: string;
  ariaLabel: string;
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

type SampleGraphDefinitionEntry = SampleGraphItem;

export type SampleGraphDefinition = SampleGraphDefinitionEntry & {
  groupKey: SampleGraphGroupKey;
  groupLabel: string;
  groupNote: string;
};

type SampleGraphDefinitionGroup = {
  key: SampleGraphGroupKey;
  label: string;
  note: string;
  samples: SampleGraphDefinitionEntry[];
};

function sample(
  kind: SampleGraphKind,
  label: string,
  subtitle: string,
): SampleGraphDefinitionEntry {
  return {
    kind,
    label,
    title: label,
    subtitle,
    ariaLabel: `${label} のサンプルを入力`,
  };
}

const sampleDefinitionGroups: SampleGraphDefinitionGroup[] = [
  {
    key: "basics",
    label: "基本的なグラフ族",
    note: "最初に触ることが多い基本形",
    samples: [
      sample("path", "Path", "6頂点の道 P6"),
      sample("cycle", "Cycle", "6頂点の閉路 C6"),
      sample("edgeless", "Edgeless", "辺なし E6"),
      sample("complete", "Complete", "完全グラフ K5"),
      sample("star", "Star", "星 K₁,₅"),
      sample("tree", "Tree", "二分木"),
      sample("caterpillar", "Caterpillar", "背骨と葉の木"),
      sample("grid", "Grid", "格子 3×3"),
      sample("disconnected", "Disconnected", "2つの成分"),
    ],
  },
  {
    key: "extremal",
    label: "二部・多部・極値",
    note: "彩色・マッチング・極値で使う族",
    samples: [
      sample("bipartite", "Bipartite", "完全二部 K₃,₃"),
      sample("multipartite", "Multipartite", "完全3部 K₁,₂,₃"),
      sample("turan", "Turán", "T₃(8): 均等な3部"),
      sample("crown", "Crown H5", "対応ペアを除く二部"),
      sample("chain", "Chain graph", "入れ子近傍の二部"),
      sample("knight", "Knight graph", "4×4 ナイト移動"),
    ],
  },
  {
    key: "structural",
    label: "構造的グラフクラス",
    note: "認識問題や構造定理で出るクラス",
    samples: [
      sample("chordal", "Chordal", "長い誘導閉路なし"),
      sample("interval", "Interval", "区間の交わり"),
      sample("split", "Split", "クリークと独立集合"),
      sample("cograph", "Cograph", "P4-free"),
      sample("threshold", "Threshold", "孤立点と支配点"),
      sample("permutation", "Permutation", "順列線分の交差グラフ"),
      sample("comparability", "Comparability", "半順序の比較関係"),
      sample("line", "Line graph L(K₂,₄)", "2×4 rook graph"),
      sample("distanceHereditary", "Distance-hereditary", "誘導部分で距離維持"),
    ],
  },
  {
    key: "planar",
    label: "平面・分解・構成",
    note: "埋め込みと低幅構造",
    samples: [
      sample("planar", "Planar", "平面埋め込み例"),
      sample("outerplanar", "Outerplanar", "外面に全頂点"),
      sample("seriesParallel", "Series-parallel", "直列並列"),
      sample("partialKTree", "Partial 3-tree", "木幅 ≤ 3"),
      sample("block", "Block graph", "クリークを関節点で接続"),
      sample("cactus", "Cactus", "閉路は高々1頂点共有"),
      sample("ladder", "Ladder", "はしご"),
      sample("wheel", "Wheel", "車輪"),
      sample("fan", "Fan", "扇形"),
      sample("friendship", "Friendship", "三角形の束"),
    ],
  },
  {
    key: "algorithmic",
    label: "アルゴリズムで使う構造",
    note: "探索・DP・連結性で使う例",
    samples: [
      sample("dag", "DAG", "有向非巡回"),
      sample("sccDemo", "SCC example", "3つの強連結成分"),
      sample("flowNetwork", "Flow network", "s-t と容量"),
      sample("weighted", "Weighted graph", "最短路の重み"),
      sample("barbell", "Barbell", "2つのクリークを橋で接続"),
    ],
  },
  {
    key: "geometric",
    label: "交差グラフ・幾何表現",
    note: "円・弧・距離で表すクラス",
    samples: [
      sample("circle", "Circle graph", "弦交差から生成"),
      sample("circularArc", "Circular-arc graph", "円弧交差から生成"),
      sample("unitDisk", "Unit disk graph", "距離しきい値で接続"),
    ],
  },
  {
    key: "regular",
    label: "正則・対称・多面体",
    note: "正則性や高い対称性を持つ例",
    samples: [
      sample("cube", "Cube", "立方体"),
      sample("hypercube", "Hypercube Q₄", "4-bit立方体"),
      sample("prism", "Prism", "三角柱"),
      sample("tetrahedral", "Tetrahedral", "四面体"),
      sample("octahedral", "Octahedral", "八面体"),
      sample("icosahedral", "Icosahedral", "二十面体"),
      sample("dodecahedral", "Dodecahedral", "十二面体"),
      sample("petersen", "Petersen", "3正則・非平面的"),
      sample("heawood", "Heawood", "Fano平面の点と直線"),
      sample("clebsch", "Clebsch", "4-bit + 対蹠辺"),
      sample("mobiusLadder", "Möbius ladder", "C₈ + 対蹠辺"),
      sample(
        "generalizedPetersen",
        "Generalized Petersen",
        "G(7,2): 外周+星形",
      ),
    ],
  },
  {
    key: "algebraic",
    label: "集合・代数的構成",
    note: "集合族や有限体から作る例",
    samples: [
      sample("kneser", "Kneser KG(6,2)", "互いに素な2集合"),
      sample("johnson", "Johnson J(5,2)", "2集合が1点で交わる"),
      sample("paley", "Paley(13)", "平方剰余 mod 13"),
    ],
  },
  {
    key: "small",
    label: "小さな名前付きグラフ・反例",
    note: "特徴付けや彩色で出る小例",
    samples: [
      sample("house", "House", "家の形"),
      sample("houseX", "House with diagonals", "対角線つきの家"),
      sample("butterfly", "Butterfly", "蝶の形"),
      sample("claw", "Claw", "爪の形"),
      sample("diamond", "Diamond", "K4から1辺削除"),
      sample("paw", "Paw", "足つき三角形"),
      sample("bull", "Bull", "角つき三角形"),
      sample("gem", "Gem", "P4+支配点"),
      sample("mycielski", "Mycielski M(C4)", "三角形なし3色必要"),
      sample("grotzsch", "Grötzsch graph", "三角形なし4色必要"),
      sample("moserSpindle", "Moser spindle", "単位距離で4色必要"),
    ],
  },
];

export const sampleGraphDefinitions: SampleGraphDefinition[] =
  sampleDefinitionGroups.flatMap((group) =>
    group.samples.map((sampleItem) => ({
      ...sampleItem,
      groupKey: group.key,
      groupLabel: group.label,
      groupNote: group.note,
    })),
  );

export const sampleGraphGroups: SampleGraphGroup[] = sampleDefinitionGroups.map(
  (group) => ({
    key: group.key,
    label: group.label,
    note: group.note,
    samples: group.samples,
  }),
);

export const sampleGraphCount = sampleGraphDefinitions.length;
