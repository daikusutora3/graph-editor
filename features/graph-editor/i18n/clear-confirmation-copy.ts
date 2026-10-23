import type { Locale } from "./locale";

type ClearConfirmationCopy = {
  title: string;
  description: string;
  cancel: string;
  confirm: string;
};

export const clearConfirmationCopy = {
  ja: {
    title: "グラフをクリアしますか？",
    description:
      "すべての頂点と辺をクリアします。クリア後は「戻す」で復元できます。",
    cancel: "キャンセル",
    confirm: "すべてクリア",
  },
  en: {
    title: "Clear this graph?",
    description: "Clears all nodes and edges. You can restore them with Undo.",
    cancel: "Cancel",
    confirm: "Clear all",
  },
  "zh-Hans": {
    title: "要清空此图吗？",
    description: "将清空所有顶点和边。清空后可通过“撤销”恢复。",
    cancel: "取消",
    confirm: "全部清空",
  },
} satisfies Record<Locale, ClearConfirmationCopy>;
