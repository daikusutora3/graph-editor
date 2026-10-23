import type { Locale } from "./locale";

type InputGuidanceCopy = {
  example: string;
  exampleAction: string;
  exampleHelp: string;
  copySuccess: string;
  copyFailure: string;
};

export const inputGuidanceCopy = {
  ja: {
    example: "入力例",
    exampleAction: "この例を入力",
    exampleHelp: "形式に合う例を確認できます。入力中も開いて参照できます。",
    copySuccess: "クリップボードにコピーしました。",
    copyFailure:
      "コピーできませんでした。上の出力を選択してコピーするか、ファイルとして保存してください。",
  },
  en: {
    example: "Input example",
    exampleAction: "Use this example",
    exampleHelp: "View an example for this format, including while you type.",
    copySuccess: "Copied to the clipboard.",
    copyFailure:
      "Could not copy. Select and copy the output above, or save it as a file.",
  },
  "zh-Hans": {
    example: "输入示例",
    exampleAction: "填入此示例",
    exampleHelp: "查看此格式的示例。输入时也可以展开参考。",
    copySuccess: "已复制到剪贴板。",
    copyFailure: "无法复制。请选中并复制上方的输出，或保存为文件。",
  },
} satisfies Record<Locale, InputGuidanceCopy>;
