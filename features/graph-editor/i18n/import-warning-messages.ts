import type { ImportWarning } from "../io/import-types";
import { describeImportWarning } from "../io/import-warning-text";
import type { Locale } from "./locale";
import { messagesByLocale } from "./messages";

/** Renders a structured import warning in the given locale. */
export function formatImportWarning(warning: ImportWarning, locale: Locale) {
  return (formatters[locale] ?? formatters.en)(warning);
}

const count = (value: number) => value.toLocaleString("en-US");

const formatters: Record<Locale, (warning: ImportWarning) => string> = {
  en: describeImportWarning,
  ja: (w) => {
    const at = "line" in w ? `${w.line} 行目: ` : "";

    switch (w.code) {
      case "empty-input":
        return "入力が空です。";
      case "too-large":
        return `入力が大きすぎます: ${count(w.count)} ${
          w.kind === "input" ? "文字" : w.kind === "nodes" ? "頂点" : "辺"
        }、上限は ${count(w.limit)} です。`;
      case "invalid-format":
        return `${messagesByLocale.ja.starter.formats[w.formatKind]}として読み取れません。`;
      case "unsupported-format":
        return "対応しているグラフ形式として読み取れません。";
      case "ambiguous-formats":
        return "複数の形式として解釈できます。反映する形式を選択してください。";
      case "maybe-weighted-parent-list":
        return "重み付き親配列の可能性があります。各行の2つ目の値が辺の重みなら、形式で「重み付き親配列」を選択してください。";
      case "missing-edges":
        return `辺は ${w.expected} 本必要ですが、${w.found} 本しかありません。`;
      case "extra-edge-lines":
        return `余分な辺の行 ${w.count} 行を無視しました。`;
      case "expected-integers":
        return `${at}${w.expected} 個の整数（${w.shape}）が必要ですが、${w.got} 個でした。`;
      case "node-out-of-range":
        return `${at}頂点番号 ${w.source} または ${w.target} が範囲外です（${w.min}, ${w.max}）。`;
      case "weight-not-numeric":
        return `${at}重みは数値で入力してください。`;
      case "missing-source":
        return `${at}始点がありません。`;
      case "missing-target":
        return `${at}終点がありません。`;
      case "expected-header":
        return `${at}"N M" 形式のヘッダーが必要です（現在: "${w.got}"）。`;
      case "invalid-node-count":
        return `${at}頂点数が不正です。`;
      case "invalid-edge-count":
        return `${at}辺数が不正です。`;
    }
  },
  "zh-Hans": (w) => {
    const at = "line" in w ? `第 ${w.line} 行: ` : "";

    switch (w.code) {
      case "empty-input":
        return "输入为空。";
      case "too-large":
        return `输入过大: ${count(w.count)} ${
          w.kind === "input" ? "字符" : w.kind === "nodes" ? "顶点" : "边"
        }，上限是 ${count(w.limit)}。`;
      case "invalid-format":
        return `无法按${messagesByLocale["zh-Hans"].starter.formats[w.formatKind]}读取。`;
      case "unsupported-format":
        return "无法识别为支持的图格式。";
      case "ambiguous-formats":
        return "输入可按多种图格式解释。应用前请选择一种格式。";
      case "maybe-weighted-parent-list":
        return "输入可能是带权父节点列表。如果每行的第二个值是边权，请手动选择“带权父节点列表”格式。";
      case "missing-edges":
        return `需要 ${w.expected} 条边，但只找到 ${w.found} 条。`;
      case "extra-edge-lines":
        return `已忽略 ${w.count} 行多余的边。`;
      case "expected-integers":
        return `${at}需要 ${w.expected} 个整数（${w.shape}），但得到 ${w.got} 个。`;
      case "node-out-of-range":
        return `${at}顶点编号 ${w.source} 或 ${w.target} 超出范围（${w.min}, ${w.max}）。`;
      case "weight-not-numeric":
        return `${at}权值必须是数字。`;
      case "missing-source":
        return `${at}缺少起点。`;
      case "missing-target":
        return `${at}缺少终点。`;
      case "expected-header":
        return `${at}需要 "N M" 形式的表头（当前: "${w.got}"）。`;
      case "invalid-node-count":
        return `${at}顶点数无效。`;
      case "invalid-edge-count":
        return `${at}边数无效。`;
    }
  },
};
