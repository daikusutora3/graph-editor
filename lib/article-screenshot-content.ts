import type { ArticleSlug } from "./article-examples";
import type { AppLocale } from "./site-metadata";

export const articleScreenshotCaptions: Record<
  AppLocale,
  Record<ArticleSlug, string>
> = {
  ja: {
    "edge-list":
      "「読み込み」に辺リストを貼り付けると、右側に図が出ます。N=4、M=4 と辺のつながりを確認してから「グラフに反映」を押します。",
    "tikz-export":
      "「書き出し」の形式で「TikZ (TeX)」を選びます。生成されたコードをコピーするか、「.tex で保存」でファイルにできます。",
  },
  en: {
    "edge-list":
      "Paste the edge list into Load and the graph appears on the right. Check N=4, M=4 and the connections, then apply it.",
    "tikz-export":
      "Choose TikZ (TeX) in Export. Copy the generated code or save it as a .tex file.",
  },
  "zh-Hans": {
    "edge-list":
      "在“加载”中粘贴边列表，右侧会显示图。确认 N=4、M=4 和连边后再应用。",
    "tikz-export":
      "在“导出”中选择“TikZ (TeX)”。可以复制生成的代码，也可以保存为 .tex 文件。",
  },
};

export const articleScreenshotInterfaceNotes: Record<AppLocale, string> = {
  ja: "",
  en: " (Japanese interface.)",
  "zh-Hans": "（截图为日语界面。）",
};
