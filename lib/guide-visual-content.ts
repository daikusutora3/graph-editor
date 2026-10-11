import type { AppLocale } from "./site-metadata";

export const guideVisualCopy: Record<
  AppLocale,
  {
    intro: string;
    exampleInstruction: string;
    details: string;
    captions: Record<string, readonly string[]>;
  }
> = {
  ja: {
    intro: "入力・編集・配置・保存の手順を図で確認できます。",
    exampleInstruction:
      "「無向」と「1-indexed」を選び、入力例をコピーして「読み込み」に貼り付け、「グラフに反映」を押します。",
    details: "操作手順と注意点",
    captions: {
      import: ["入力を貼り付ける", "プレビューを確認", "グラフに反映"],
      draw: [
        "頂点モードで頂点を置く",
        "辺モードで2頂点を選ぶ",
        "選択モードで頂点を動かす",
      ],
      appearance: [
        "選んだ頂点の色を変える",
        "ダブルクリックでラベル編集",
        "設定で有向に切り替える",
      ],
      layouts: ["サンプルを選ぶ", "配置を選ぶ", "つながりを保って並べ直す"],
      export: [
        "JSON：あとで編集",
        "PNG：図を共有",
        "テキスト：頂点のつながり",
        "TikZ：TeX文書に挿入",
      ],
      touch: [
        "空白をドラッグして表示を移動",
        "2本指で拡大・縮小",
        "全体表示で図を画面に収める",
      ],
    },
  },
  en: {
    intro: "Follow the diagrams to import, edit, arrange, and save a graph.",
    exampleInstruction:
      "Set Undirected and 1-indexed. Copy an example, paste it into Load, then apply.",
    details: "Detailed steps and notes",
    captions: {
      import: ["Paste the input", "Check the preview", "Apply to the graph"],
      draw: [
        "Place points in Node mode",
        "Choose two points in Edge mode",
        "Drag in Select mode",
      ],
      appearance: [
        "Change a selected node's color",
        "Double-click to edit a label",
        "Choose Directed in Settings",
      ],
      layouts: [
        "Choose a sample",
        "Choose a layout",
        "Rearrange the same connections",
      ],
      export: [
        "JSON: edit again later",
        "PNG: share the diagram",
        "Text: connection data",
        "TikZ: use in TeX",
      ],
      touch: [
        "Drag empty space to pan",
        "Pinch with two fingers to zoom",
        "Fit the graph back into view",
      ],
    },
  },
  "zh-Hans": {
    intro: "通过图示查看导入、编辑、布局和保存的操作。",
    exampleInstruction:
      "设为无向、1-indexed，然后复制输入例 → 导入 → 应用到图。",
    details: "详细步骤与注意事项",
    captions: {
      import: ["粘贴输入", "检查预览", "应用到图"],
      draw: ["在顶点模式中放置点", "在边模式中选择两个点", "在选择模式中拖动"],
      appearance: [
        "更改所选顶点的颜色",
        "双击编辑标签",
        "在设置中切换为有向图",
      ],
      layouts: ["选择示例", "选择布局", "保持连接关系重新排列"],
      export: [
        "JSON：稍后编辑",
        "PNG：分享图像",
        "文本：连接数据",
        "TikZ：插入 TeX 文档",
      ],
      touch: ["拖动空白处移动视图", "双指缩放", "将整个图放回视野"],
    },
  },
};
