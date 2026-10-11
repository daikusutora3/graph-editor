import Image from "next/image";
import type { ArticleSlug } from "@/lib/article-examples";
import type { AppLocale } from "@/lib/site-metadata";

export const articleScreenshotSections: Record<ArticleSlug, string> = {
  "edge-list": "article-import-check",
  "adjacency-matrix": "article-matrix-check",
  "tree-layout": "article-tree-root",
  "tikz-export": "article-tikz-document",
  "bipartite-graph": "article-bipartite-layout",
};

const captions: Record<AppLocale, Record<ArticleSlug, string>> = {
  ja: {
    "edge-list":
      "「読み込み」に辺リストを貼り付けると、右側に図が出ます。N=4、M=4 と辺のつながりを確認してから「グラフに反映」を押します。",
    "adjacency-matrix":
      "行列を貼り付けると、この例は N=3、M=3 の三角形になります。右側のプレビューで、行列と辺の対応を確かめられます。",
    "tree-layout":
      "「配置」で「木」を選んだ結果です。頂点 1 を根にすると、2 と 3 がその下に並び、4 は 3 の下に置かれます。辺の重みも残ります。",
    "tikz-export":
      "「書き出し」の形式で「TikZ (TeX)」を選びます。生成されたコードをコピーするか、「.tex で保存」でファイルにできます。",
    "bipartite-graph":
      "「配置」で「二部」を選んだ結果です。A・B と 1・2・3 が左右に分かれ、どの頂点がつながっているかを追いやすくなります。",
  },
  en: {
    "edge-list":
      "Paste the edge list into Load. Check N=4, M=4 and the connections in the preview, then apply the graph.",
    "adjacency-matrix":
      "Pasting this matrix produces a triangle with N=3 and M=3. Compare the preview with the entries in the matrix.",
    "tree-layout":
      "The Tree layout places root 1 above vertices 2 and 3, with vertex 4 below 3. Edge weights are preserved.",
    "tikz-export":
      "Choose TikZ (TeX) in Export. Copy the generated code or save it as a .tex file.",
    "bipartite-graph":
      "The Bipartite layout separates A and B from 1, 2 and 3, making the connections between the groups easier to follow.",
  },
  "zh-Hans": {
    "edge-list":
      "在“导入”中粘贴边列表。确认 N=4、M=4 和预览中的连边，再应用到画布。",
    "adjacency-matrix":
      "粘贴此矩阵后，会得到 N=3、M=3 的三角形。可在预览中检查矩阵与边的对应关系。",
    "tree-layout":
      "选择“树”布局后的结果：以顶点 1 为根，2 和 3 位于下方，4 位于 3 的下方。边权仍然保留。",
    "tikz-export":
      "在“导出”中选择“TikZ (TeX)”。可以复制生成的代码，也可以保存为 .tex 文件。",
    "bipartite-graph":
      "选择“二分”布局后的结果。A、B 与 1、2、3 分别排列在左右两侧，便于查看两组之间的连边。",
  },
};

export function ArticleScreenshot({
  slug,
  locale,
}: {
  slug: ArticleSlug;
  locale: AppLocale;
}) {
  const caption = captions[locale][slug];
  return (
    <figure className="mt-5 space-y-3">
      <Image
        unoptimized
        src={`/articles/screenshots/${slug}.png`}
        alt={caption}
        width={853}
        height={954}
        sizes="(max-width: 768px) 100vw, 672px"
        className="h-auto w-full rounded-xl border border-[var(--line)]"
      />
      <figcaption className="text-[15px] leading-7 text-[var(--text-2)]">
        {caption}
        {locale === "en"
          ? " (Japanese interface.)"
          : locale === "zh-Hans"
            ? "（截图为日语界面。）"
            : ""}
      </figcaption>
    </figure>
  );
}
