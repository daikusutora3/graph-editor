import type { Locale } from "./locale";

export function formatImportWarning(message: string, locale: Locale) {
  const format = warningFormatters[locale] ?? warningFormatters.en;

  return format(message);
}

const warningFormatters: Record<Locale, (message: string) => string> = {
  en: (message) => message,
  ja: (message) => translateImportWarningToJapanese(message),
  "zh-Hans": (message) => translateImportWarningToChinese(message),
};

function translateImportWarningToJapanese(message: string) {
  const linePrefix = matchLinePrefix(message);
  const text = linePrefix?.text ?? message;
  const prefix = linePrefix ? `${linePrefix.line} 行目: ` : "";

  if (message === "Empty input.") {
    return "入力が空です。";
  }
  if (
    message ===
    "Input may be a weighted parent list. If the second value on each row is an edge weight, select Weighted parent list manually."
  ) {
    return "重み付き親配列の可能性があります。各行の2つ目の値が辺の重みなら、形式で「重み付き親配列」を選択してください。";
  }

  const invalidFormat = text.match(/^Input is not a valid (.+)\.$/);
  if (invalidFormat) {
    return `${formatNameJa(invalidFormat[1] ?? "")}として読み取れません。`;
  }

  const limit = text.match(
    /^Import is too large: ([\d,]+) (input characters|nodes|edges), maximum is ([\d,]+)\.$/,
  );
  if (limit) {
    return `入力が大きすぎます: ${limit[1]} ${limitKindJa(limit[2] ?? "")}、上限は ${limit[3]} です。`;
  }

  const expectedHeader = text.match(/^expected "N M", got "([^"]*)"$/);
  if (expectedHeader) {
    return `${prefix}"N M" 形式のヘッダーが必要です（現在: "${expectedHeader[1] ?? ""}"）。`;
  }

  if (text === "invalid node count.") {
    return `${prefix}頂点数が不正です。`;
  }
  if (text === "invalid edge count.") {
    return `${prefix}辺数が不正です。`;
  }

  const missingEdges = text.match(/^Expected (\d+) edges, found (\d+)\.$/);
  if (missingEdges) {
    return `辺は ${missingEdges[1]} 本必要ですが、${missingEdges[2]} 本しかありません。`;
  }

  const extraEdges = text.match(/^Ignored (\d+) extra edge line\(s\)\.$/);
  if (extraEdges) {
    return `余分な辺の行 ${extraEdges[1]} 行を無視しました。`;
  }

  const expectedIntegers = text.match(
    /^expected (\d+) integers \(([^)]*)\), got (\d+)$/,
  );
  if (expectedIntegers) {
    return `${prefix}${expectedIntegers[1]} 個の整数（${expectedIntegers[2]}）が必要ですが、${expectedIntegers[3]} 個でした。`;
  }

  const outOfRange = text.match(
    /^node id (.+) or (.+) out of range \[([^\]]+)\]$/,
  );
  if (outOfRange) {
    return `${prefix}頂点番号 ${outOfRange[1]} または ${outOfRange[2]} が範囲外です（${outOfRange[3]}）。`;
  }

  if (text === "weight must be numeric.") {
    return `${prefix}重みは数値で入力してください。`;
  }
  if (text === "missing source node.") {
    return `${prefix}始点がありません。`;
  }
  if (text === "missing target node.") {
    return `${prefix}終点がありません。`;
  }

  return message;
}

function translateImportWarningToChinese(message: string) {
  const linePrefix = matchLinePrefix(message);
  const text = linePrefix?.text ?? message;
  const prefix = linePrefix ? `第 ${linePrefix.line} 行: ` : "";

  if (message === "Empty input.") {
    return "输入为空。";
  }
  if (
    message ===
    "Input may be a weighted parent list. If the second value on each row is an edge weight, select Weighted parent list manually."
  ) {
    return "输入可能是带权父节点列表。如果每行的第二个值是边权，请手动选择“带权父节点列表”格式。";
  }

  const invalidFormat = text.match(/^Input is not a valid (.+)\.$/);
  if (invalidFormat) {
    return `无法按${formatNameZh(invalidFormat[1] ?? "")}读取。`;
  }

  const limit = text.match(
    /^Import is too large: ([\d,]+) (input characters|nodes|edges), maximum is ([\d,]+)\.$/,
  );
  if (limit) {
    return `输入过大: ${limit[1]} ${limitKindZh(limit[2] ?? "")}，上限是 ${limit[3]}。`;
  }

  const expectedHeader = text.match(/^expected "N M", got "([^"]*)"$/);
  if (expectedHeader) {
    return `${prefix}需要 "N M" 形式的表头（当前: "${expectedHeader[1] ?? ""}"）。`;
  }

  if (text === "invalid node count.") {
    return `${prefix}顶点数无效。`;
  }
  if (text === "invalid edge count.") {
    return `${prefix}边数无效。`;
  }

  const missingEdges = text.match(/^Expected (\d+) edges, found (\d+)\.$/);
  if (missingEdges) {
    return `需要 ${missingEdges[1]} 条边，但只找到 ${missingEdges[2]} 条。`;
  }

  const extraEdges = text.match(/^Ignored (\d+) extra edge line\(s\)\.$/);
  if (extraEdges) {
    return `已忽略 ${extraEdges[1]} 行多余的边。`;
  }

  const expectedIntegers = text.match(
    /^expected (\d+) integers \(([^)]*)\), got (\d+)$/,
  );
  if (expectedIntegers) {
    return `${prefix}需要 ${expectedIntegers[1]} 个整数（${expectedIntegers[2]}），但得到 ${expectedIntegers[3]} 个。`;
  }

  const outOfRange = text.match(
    /^node id (.+) or (.+) out of range \[([^\]]+)\]$/,
  );
  if (outOfRange) {
    return `${prefix}顶点编号 ${outOfRange[1]} 或 ${outOfRange[2]} 超出范围（${outOfRange[3]}）。`;
  }

  if (text === "weight must be numeric.") {
    return `${prefix}权值必须是数字。`;
  }
  if (text === "missing source node.") {
    return `${prefix}缺少起点。`;
  }
  if (text === "missing target node.") {
    return `${prefix}缺少终点。`;
  }

  return message;
}

function matchLinePrefix(message: string) {
  const match = message.match(/^line (\d+): (.*)$/);

  if (!match) {
    return null;
  }

  return { line: match[1] ?? "", text: match[2] ?? "" };
}

function formatNameJa(name: string) {
  return (
    {
      "adjacency matrix": "隣接行列",
      "adjacency list": "隣接リスト",
      "edge pair list": "辺の組リスト",
      "tree edge list": "木の辺リスト",
      "parent list": "親配列",
      "weighted parent list": "重み付き親配列",
    }[name] ?? name
  );
}

function formatNameZh(name: string) {
  return (
    {
      "adjacency matrix": "邻接矩阵",
      "adjacency list": "邻接表",
      "edge pair list": "边的二元组列表",
      "tree edge list": "树边列表",
      "parent list": "父节点数组",
      "weighted parent list": "带权父节点列表",
    }[name] ?? name
  );
}

function limitKindJa(kind: string) {
  return (
    {
      "input characters": "文字",
      nodes: "頂点",
      edges: "辺",
    }[kind] ?? kind
  );
}

function limitKindZh(kind: string) {
  return (
    {
      "input characters": "字符",
      nodes: "顶点",
      edges: "边",
    }[kind] ?? kind
  );
}
