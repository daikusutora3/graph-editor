import type { Locale } from "./locale";
import { GRAPH_MAX_ABS_COORDINATE } from "../core/graph/graph-coordinates";

type IntegrityMessages = {
  pending: string;
  saved: string;
  failed: string;
  conflict: string;
  unavailable: string;
  invalid: string;
  retry: string;
  backup: string;
  raw: string;
  load: string;
  fresh: string;
  rejected: string;
  coordinatesRejected: string;
  exportBlocked: string;
  textNote: string;
  unresolved: (count: number) => string;
  partial: (count: number) => string;
  pendingRoutes: (count: number) => string;
  unresolvedRoutes: (count: number) => string;
  loading: string;
  renderFailed: string;
};

const coordinateLimit = GRAPH_MAX_ABS_COORDINATE.toLocaleString("en-US");

export const integrityCopy = {
  ja: {
    pending: "保存待ち",
    saved: "保存済み",
    failed: "自動保存に失敗しました。現在の作業は保持されています。",
    conflict:
      "別タブの保存内容が変わりました。現在の作業と履歴を保持しています。旧版のタブは再読み込みしてください。",
    unavailable:
      "自動保存を利用できません。現在の内容をJSONで保存してください。",
    invalid:
      "保存データを読み込めません。原文を退避してから新規作業を開始できます。",
    retry: "再試行",
    backup: "現在の内容をJSONで保存",
    raw: "保存データの原文を退避",
    load: "別タブの内容を読み込む",
    fresh: "新規作業を開始",
    rejected:
      "変更を適用できません。頂点1,000個・辺5,000本・文字列256文字・JSON 2,000,000文字の上限と入力値を確認してください。",
    coordinatesRejected: `座標が有効な範囲を超えるため変更できません。各頂点のX・Y座標を −${coordinateLimit} から ${coordinateLimit} の範囲にしてください。現在のグラフは保持されています。`,
    exportBlocked:
      "この形式では辺・重みを保持できないか、入力上限を超えます。JSON形式を選んでください。",
    textNote: "テキスト形式には位置・色・手動の曲がりは含まれません。",
    unresolved: (count: number) => `重なりが${count}組残っています。`,
    partial: (count: number) => `警告を確認して有効な${count}辺を取り込む`,
    pendingRoutes: (count: number) => `経路を計算中：残り${count}辺`,
    unresolvedRoutes: (count: number) =>
      `${count}辺は探索範囲内で頂点を回避できませんでした`,
    loading: "グラフを準備しています",
    renderFailed:
      "グラフを表示できませんでした。JSONで退避するか再試行してください。",
  },
  en: {
    pending: "Saving…",
    saved: "Saved",
    failed: "Autosave failed. Your current work is retained.",
    conflict:
      "Another tab changed the saved document. Your work and history are retained. Reload older app tabs.",
    unavailable: "Autosave is unavailable. Save your current work as JSON.",
    invalid:
      "The saved document is invalid. Back up the original before starting a new document.",
    retry: "Retry",
    backup: "Save current work as JSON",
    raw: "Back up original saved data",
    load: "Load the other tab's document",
    fresh: "Start a new document",
    rejected:
      "Change rejected. Check input values and limits: 1,000 nodes, 5,000 edges, 256 characters per label, 2,000,000 JSON characters.",
    coordinatesRejected: `Change rejected because a coordinate is outside the supported range. Keep each node's X and Y between −${coordinateLimit} and ${coordinateLimit}. Your current graph is retained.`,
    exportBlocked:
      "This format cannot preserve the edges or weights, or exceeds the input limit. Choose JSON.",
    textNote: "Text formats do not include positions, colors, or manual bends.",
    unresolved: (count: number) => `${count} overlapping pairs remain.`,
    partial: (count: number) =>
      `Accept warnings and import ${count} valid edges`,
    pendingRoutes: (count: number) => `Routing ${count} remaining edges`,
    unresolvedRoutes: (count: number) =>
      `${count} edges could not avoid nodes within the search limits`,
    loading: "Preparing graph",
    renderFailed: "The graph could not be displayed. Save JSON or retry.",
  },
  "zh-Hans": {
    pending: "正在保存…",
    saved: "已保存",
    failed: "自动保存失败。当前工作内容已保留。",
    conflict:
      "另一个标签页更改了已保存的文档。当前工作内容和历史记录已保留。请重新加载旧版本的标签页。",
    unavailable: "无法自动保存。请将当前内容保存为 JSON。",
    invalid: "无法读取已保存的文档。请先备份原始数据，再开始新文档。",
    retry: "重试",
    backup: "将当前内容保存为 JSON",
    raw: "备份已保存的原始数据",
    load: "加载另一个标签页的文档",
    fresh: "开始新文档",
    rejected:
      "无法应用更改。请检查输入值和上限：1,000 个顶点、5,000 条边、每个文本 256 个字符、JSON 2,000,000 个字符。",
    coordinatesRejected: `坐标超出有效范围，无法应用更改。请将每个顶点的 X、Y 坐标保持在 −${coordinateLimit} 到 ${coordinateLimit} 之间。当前图已保留。`,
    exportBlocked:
      "此格式无法保留边或权重，或超出了输入上限。请选择 JSON 格式。",
    textNote: "文本格式不包含位置、颜色或手动弯曲。",
    unresolved: (count: number) => `仍有 ${count} 对顶点重叠。`,
    partial: (count: number) => `确认警告并导入 ${count} 条有效边`,
    pendingRoutes: (count: number) => `正在计算路径：剩余 ${count} 条边`,
    unresolvedRoutes: (count: number) =>
      `${count} 条边无法在搜索范围内避开顶点`,
    loading: "正在准备图",
    renderFailed: "无法显示图。请保存为 JSON 以备份，或重试。",
  },
} satisfies Record<Locale, IntegrityMessages>;
