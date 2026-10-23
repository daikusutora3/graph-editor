import type { Locale } from "./locale";

type NodeCreationCopy = {
  add: string;
  description: string;
  added: (label: string) => string;
  unavailable: string;
};

export const nodeCreationCopy: Record<Locale, NodeCreationCopy> = {
  ja: {
    add: "中央付近に頂点を追加",
    description: "画面の中央付近に追加します。戻す操作で取り消せます。",
    added: (label) => `頂点 ${label} を追加しました。`,
    unavailable:
      "頂点を追加できません。表示領域を広げるか、グラフの上限を確認してください。",
  },
  en: {
    add: "Add node near center",
    description: "Adds a node near the center of the view. You can undo this.",
    added: (label) => `Node ${label} added.`,
    unavailable:
      "Could not add a node. Enlarge the view or check the graph limits.",
  },
  "zh-Hans": {
    add: "在中央附近添加顶点",
    description: "在视图中央附近添加顶点。可以使用撤销取消。",
    added: (label) => `已添加顶点 ${label}。`,
    unavailable: "无法添加顶点。请扩大视图或检查图的数量上限。",
  },
};
