import type { Locale } from "./locale";

type InputGuidanceCopy = {
  copySuccess: string;
  copyFailure: string;
};

export const inputGuidanceCopy = {
  ja: {
    copySuccess: "クリップボードにコピーしました。",
    copyFailure:
      "コピーできませんでした。上の出力を選択してコピーするか、ファイルとして保存してください。",
  },
  en: {
    copySuccess: "Copied to the clipboard.",
    copyFailure:
      "Could not copy. Select and copy the output above, or save it as a file.",
  },
  "zh-Hans": {
    copySuccess: "已复制到剪贴板。",
    copyFailure: "无法复制。请选中并复制上方的输出，或保存为文件。",
  },
} satisfies Record<Locale, InputGuidanceCopy>;
