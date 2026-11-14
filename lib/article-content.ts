import {
  getArticleExample,
  type ArticleExample as ArticleExampleSeed,
  type ArticleSlug,
  type GuideExampleId,
} from "./article-examples";
import { guideCopy, guideExampleCopy } from "./guide-content";
import { guideExamples } from "./guide-examples";
import { appLocalePaths, type AppLocale } from "./site-metadata";

export { articleSlugs, type ArticleSlug } from "./article-examples";
export type ArticleGuideAnchor =
  "guide-import" | "guide-layouts" | "guide-export";

/** A labelled block of input or code that readers can copy. */
export type ArticleSample = {
  title: string;
  code: string;
  note?: string;
};

export type ArticleSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  samples?: readonly ArticleSample[];
  points?: readonly string[];
};

export type ArticleExample = ArticleExampleSeed & {
  result: string;
};

export type ArticleContent = {
  slug: ArticleSlug;
  category: string;
  title: string;
  description: string;
  introduction: string;
  sections: readonly ArticleSection[];
  example: ArticleExample;
  guide: {
    sectionId: ArticleGuideAnchor;
    label: string;
  };
  relatedSlugs: readonly ArticleSlug[];
};

export type ArticleCopy = {
  title: string;
  description: string;
  heading: string;
  indexIntro: string;
  articlesLink: string;
  skipToContent: string;
  input: string;
  result: string;
  copy: string;
  copySuccess: string;
  copyFailure: string;
  /** Visible label of the copy button on code and format samples. */
  copySample: string;
  exampleTitle: string;
  operationGuideLabel: string;
  sameExampleGuideLabel: string;
  relatedTitle: string;
  allArticles: string;
};

export const articleCopy: Record<AppLocale, ArticleCopy> = {
  ja: {
    title: "グラフの読み方と描き方 | Graph Editor",
    description:
      "競プロの入力を貼り付けてグラフにする方法と、TikZ で LaTeX 文書に図を入れる方法を、試せる例つきで説明します。",
    heading: "記事",
    indexIntro:
      "Graph Editor を使った作業の進め方を、試せる例つきで説明しています。ボタンの場所など操作の詳細は、使い方ガイドにあります。",
    articlesLink: "記事",
    skipToContent: "記事本文へ移動",
    input: guideExampleCopy.ja.input,
    result: guideExampleCopy.ja.result,
    copy: guideExampleCopy.ja.copy,
    copySuccess: guideExampleCopy.ja.copySuccess,
    copyFailure: guideExampleCopy.ja.copyFailure,
    copySample: "コピー",
    exampleTitle: "入力例と図",
    operationGuideLabel: "操作方法",
    sameExampleGuideLabel: "ガイドで同じ例を見る",
    relatedTitle: "関連記事",
    allArticles: "すべての記事",
  },
  en: {
    title: "Reading and drawing graphs | Graph Editor",
    description:
      "How to draw a graph from competitive programming input, and how to put a graph diagram in a LaTeX document with TikZ, with examples you can try.",
    heading: "Articles",
    indexIntro:
      "Walkthroughs of common tasks in Graph Editor, with examples you can try. For where each control is, see the user guide.",
    articlesLink: "Articles",
    skipToContent: "Skip to article content",
    input: guideExampleCopy.en.input,
    result: guideExampleCopy.en.result,
    copy: guideExampleCopy.en.copy,
    copySuccess: guideExampleCopy.en.copySuccess,
    copyFailure: guideExampleCopy.en.copyFailure,
    copySample: "Copy",
    exampleTitle: "Input and diagram",
    operationGuideLabel: "Editor steps",
    sameExampleGuideLabel: "See this example in the guide",
    relatedTitle: "Related articles",
    allArticles: "All articles",
  },
  "zh-Hans": {
    title: "图的读法与画法 | Graph Editor",
    description:
      "介绍如何粘贴竞赛题的输入直接画出图，以及如何用 TikZ 把图放进 LaTeX 文档，并附有可以试用的示例。",
    heading: "文章",
    indexIntro:
      "这里用可以试用的示例介绍 Graph Editor 的常见用法。各个按钮的位置等操作细节，请查看使用指南。",
    articlesLink: "文章",
    skipToContent: "跳转到文章正文",
    input: guideExampleCopy["zh-Hans"].input,
    result: guideExampleCopy["zh-Hans"].result,
    copy: guideExampleCopy["zh-Hans"].copy,
    copySuccess: guideExampleCopy["zh-Hans"].copySuccess,
    copyFailure: guideExampleCopy["zh-Hans"].copyFailure,
    copySample: "复制",
    exampleTitle: "输入示例与图",
    operationGuideLabel: "操作方法",
    sameExampleGuideLabel: "在指南中查看这个示例",
    relatedTitle: "相关文章",
    allArticles: "全部文章",
  },
};

function localizedExample(
  locale: AppLocale,
  slug: ArticleSlug,
): ArticleExample {
  const example = getArticleExample(slug)!;
  const index = guideExamples.findIndex(
    (entry) => entry.id === example.guideExampleId,
  );
  return {
    ...example,
    result: guideExampleCopy[locale].examples[index]!.result,
  };
}

/** Inputs shown in the format list. Every one is checked against the importer. */
const formatSamples = {
  contest: "4 4\n1 2\n2 3\n2 4\n3 4",
  pairs: "1 2\n2 3\n2 4\n3 4",
  tree: "4\n1 2\n1 3\n3 4",
  parents: "5\n1 1 2 2",
  adjacencyList: "1: 2 3\n2: 3",
  matrix: "0 1 1\n1 0 1\n1 1 0",
} as const;

/** TeX snippets shown in the TikZ article. Every one is compiled in a test document. */
const texSamples = {
  preamble: "\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta,shapes.misc}",
  figure: (caption: string) =>
    `\\begin{figure}[htbp]\n  \\centering\n  \\input{graph.tex}\n  \\caption{${caption}}\n  \\label{fig:graph}\n\\end{figure}`,
  standalone:
    "\\documentclass[tikz,border=2pt]{standalone}\n\\usetikzlibrary{arrows.meta,shapes.misc}\n\\begin{document}\n\\input{graph.tex}\n\\end{document}",
  spacing: "\\begin{tikzpicture}[x=0.8cm,y=0.8cm,",
  resize:
    "\\usepackage{graphicx} % preamble\n\\resizebox{0.6\\linewidth}{!}{\\input{graph.tex}}",
  styles:
    "\\begin{tikzpicture}[x=1cm,y=1cm,\n  ge vertex/.style={draw,line width=0.6pt,inner sep=2pt,outer sep=0.3pt,font=\\small},\n  ge edge/.style={line width=0.6pt},\n  ge label/.style={fill=white,text=black,inner sep=1.5pt,font=\\small}]",
  japanese:
    "\\usepackage{luatexja}\n\\usepackage{tikz}\n\\usetikzlibrary{arrows.meta,shapes.misc}",
} as const;

export const articleSamples = { formatSamples, texSamples };

type ArticleText = Omit<ArticleContent, "example" | "guide">;

const articleText: Record<AppLocale, readonly ArticleText[]> = {
  ja: [
    {
      slug: "edge-list",
      category: "入力と描画",
      title: "競プロの入力を貼り付けてグラフにする",
      description:
        "競技プログラミングの問題に出てくるグラフの入力を、貼り付けるだけで図にする方法です。読み込める形式と、うまく読めないときの直し方もまとめました。",
      introduction:
        "グラフの問題で入力例を図にしたいときは、入力をそのまま Graph Editor に貼り付けてください。辺リスト・木・親配列・隣接リスト・隣接行列のどれでも、形式と頂点番号の始まりを自動で判定して図にします。",
      sections: [
        {
          id: "article-paste",
          title: "貼り付けて反映するまで",
          paragraphs: [
            "エディタの「読み込み」を開いて、問題の入力例を貼り付けます。形式は自動で判定され、右側のプレビューに図と頂点数・辺数が表示されます。合っていれば「グラフに反映」を押します。",
            "頂点番号が 0 始まりか 1 始まりかも、入力に出てくる番号から判断します。4 頂点の入力に「4」があれば 1 始まり、「0」があれば 0 始まりです。どちらもないとき（番号の大きい頂点が孤立しているときなど）は、「設定」の「番号」に従います。",
          ],
        },
        {
          id: "article-formats",
          title: "読み込める形式",
          paragraphs: [
            "次の形式を読み込めます。例はどれも 1 始まりです。どの形式でも、多重辺や自己ループはそのまま読み込みます。",
          ],
          samples: [
            {
              title: "頂点数・辺数つき辺リスト",
              note: "1 行目が「N M」、続く M 行が辺です。3 列目に数を書くと重みになります。",
              code: formatSamples.contest,
            },
            {
              title: "辺の組リスト",
              note: "頂点数の行がない辺リストです。頂点は「A B」のように文字で書いてもかまいません。",
              code: formatSamples.pairs,
            },
            {
              title: "木の辺リスト",
              note: "1 行目が頂点数 N、続く N−1 行が辺です。重み付き親配列と同じ形にも見えるため、「形式」で選び直すことがあります。",
              code: formatSamples.tree,
            },
            {
              title: "親配列",
              note: "1 行目が頂点数、2 行目が頂点 2, 3, … の親です。根から子へ向かう有向の木として読み込みます。",
              code: formatSamples.parents,
            },
            {
              title: "隣接リスト",
              note: "「頂点: つながる頂点 …」を 1 行に 1 頂点ずつ書きます。",
              code: formatSamples.adjacencyList,
            },
            {
              title: "隣接行列",
              note: "N 行 N 列で書きます。番号が書かれていないので、頂点番号は「設定」の「番号」に従います。",
              code: formatSamples.matrix,
            },
          ],
        },
        {
          id: "article-settings",
          title: "向きと重みを合わせる",
          paragraphs: [
            "辺リストは無向グラフとして読み込みます。有向グラフの問題なら「設定」で「有向」に切り替えてください。親配列と、対称でない隣接行列は自動で有向になります。",
            "辺リストの 3 列目や、隣接行列の 1 以外の値は重みとして読み込み、辺の上に表示します。",
          ],
        },
        {
          id: "article-troubleshooting",
          title: "うまく読めないとき",
          paragraphs: [
            "読み込めない、または図がおかしいときは、次の点を確かめてください。",
          ],
          points: [
            "入力全体ではなく、グラフの部分だけを貼り付けます。先頭にテストケースの数がある入力や、辺のあとにクエリが続く入力は、そのままでは形式を判定できません。",
            "先頭行に頂点数と辺数以外の値（「N M K」の K など）があると、辺の組リストとして読まれてしまいます。K を消して「N M」にしてください。",
            "読み方が 1 つに決まらないときは「反映する形式を選択してください」と表示されます。「形式」で正しい形式を選びます。",
            "読み込めるのは 1,000 頂点・5,000 辺までです。",
          ],
        },
      ],
      relatedSlugs: ["tikz-export"],
    },
    {
      slug: "tikz-export",
      category: "資料づくり",
      title: "グラフの図を TikZ で LaTeX 文書に入れる",
      description:
        "Graph Editor で描いたグラフを TikZ のコードで書き出し、レポートや論文に入れる手順です。大きさの調整、日本語のラベル、よくあるエラーもまとめました。",
      introduction:
        "Graph Editor の図は TikZ のコードとして書き出せます。画像と違って文書のフォントで組まれ、拡大しても粗くなりません。重み付きの木を例に、書き出してから文書に入れるまでを説明します。",
      sections: [
        {
          id: "article-tikz-export",
          title: "TikZ で書き出す",
          paragraphs: [
            "図を整えたら「書き出し」を開き、形式で「TikZ (TeX)」を選びます。コードをコピーするか、「.tex で保存」でファイルにします。",
            "書き出されるのは `tikzpicture` 環境だけで、`\\documentclass` などは含みません。頂点の位置・色・ラベル、辺の曲がり方、重み、有向グラフの矢印が入り、図の幅と高さはおよそ 12 cm 以内に収まるように縮められます。",
            "TikZ のコードは Graph Editor に読み込み直せません。あとで図を直すなら、JSON も一緒に保存しておいてください。",
          ],
        },
        {
          id: "article-tikz-document",
          title: "文書に入れる",
          paragraphs: [
            "必要なパッケージはコードの先頭のコメントに書いてあります。プリアンブルに次の 2 行を加えたうえで、コードを本文に貼り付けるか、保存した .tex ファイルを `\\input` で読み込みます。",
          ],
          samples: [
            { title: "プリアンブル", code: texSamples.preamble },
            {
              title: "本文（graph.tex として保存した場合）",
              note: "キャプションを付けるときは figure 環境に入れます。",
              code: texSamples.figure("重み付きの木"),
            },
            {
              title: "図だけを PDF にする",
              note: "スライドなどほかのソフトで使うときは、standalone クラスで図だけの PDF を作れます。",
              code: texSamples.standalone,
            },
          ],
        },
        {
          id: "article-tikz-size",
          title: "大きさと見た目を調整する",
          paragraphs: [
            "頂点の間隔だけを狭めたいときは、コード冒頭の `x=1cm,y=1cm` を小さくします。縮むのは座標だけなので、頂点の円や文字の大きさは変わりません。",
            "本文の幅に合わせるなら `\\resizebox` で包みます。この方法では文字も一緒に縮むので、小さくしすぎないようにしてください。",
            "見た目はコード冒頭の 3 つのスタイルで決まっています。`ge vertex` が頂点、`ge edge` が辺、`ge label` が重みです。たとえば `ge vertex` の `font=\\small` を `font=\\footnotesize` にすると、すべての頂点の文字が小さくなります。",
          ],
          samples: [
            { title: "間隔だけを狭める", code: texSamples.spacing },
            { title: "幅に合わせて縮める", code: texSamples.resize },
            { title: "冒頭のスタイル", code: texSamples.styles },
          ],
        },
        {
          id: "article-tikz-japanese",
          title: "日本語のラベルを使う",
          paragraphs: [
            "頂点や重みに日本語を使うときは、LuaLaTeX でコンパイルし、プリアンブルに `luatexja` を加えます。`ltjsarticle` など LuaTeX-ja 用のクラスなら、追加は要りません。",
            "ラベルは文字としてそのまま出力され、`\\` や `$` などの記号は自動でエスケープされます。ラベルに `$x_1$` と書いても数式にはなりません。",
          ],
          samples: [
            { title: "LuaLaTeX のプリアンブル", code: texSamples.japanese },
          ],
        },
        {
          id: "article-tikz-errors",
          title: "よくあるエラー",
          paragraphs: [
            "コンパイルが止まったら、まずプリアンブルの 2 行がそろっているかを確かめてください。よく出るエラーと原因は次のとおりです。",
          ],
          points: [
            "`Unknown arrow tip kind 'Stealth'`：`\\usetikzlibrary` に `arrows.meta` がありません。有向グラフの矢印に使います。",
            "`I do not know the key '/tikz/rounded rectangle'`：`shapes.misc` がありません。ラベルの長い頂点に使います。",
            "beamer で `\\usetikzlibrary` の行が `Undefined control sequence` になる：beamer は tikz を読み込まないので、`\\usepackage{tikz}` も書きます。",
            "`Unicode character … not set up for use with LaTeX`：pdfLaTeX で日本語をコンパイルしています。LuaLaTeX と `luatexja` を使ってください。",
          ],
        },
      ],
      relatedSlugs: ["edge-list"],
    },
  ],
  en: [
    {
      slug: "edge-list",
      category: "Input and drawing",
      title: "Paste competitive programming input to draw a graph",
      description:
        "Turn the graph input from a competitive programming problem into a diagram by pasting it. Covers the supported formats and what to do when the input isn't read correctly.",
      introduction:
        "When you want to see what a problem's sample graph looks like, paste the input into Graph Editor as it is. Edge lists, trees, parent arrays, adjacency lists, and adjacency matrices are all detected automatically, along with whether vertices are numbered from 0 or 1.",
      sections: [
        {
          id: "article-paste",
          title: "From pasting to applying",
          paragraphs: [
            "Open Load in the editor and paste the sample input. The format is detected automatically, and the preview on the right shows the graph with its vertex and edge counts. If it looks right, press Apply to graph.",
            "Whether vertices start at 0 or 1 is also worked out from the numbers in the input. If a four-vertex input contains 4, it is 1-based; if it contains 0, it is 0-based. If neither appears, for example when the highest-numbered vertex is isolated, the Index setting is used.",
          ],
        },
        {
          id: "article-formats",
          title: "Supported formats",
          paragraphs: [
            "These formats can be loaded. All examples are 1-based. Multiple edges and self-loops are kept as they are in every format.",
          ],
          samples: [
            {
              title: "Edge list with counts",
              note: "The first line is N M, followed by M edges. A third number on a line becomes the edge weight.",
              code: formatSamples.contest,
            },
            {
              title: "Edge pair list",
              note: "An edge list without the count line. Vertices can also be names, such as A B.",
              code: formatSamples.pairs,
            },
            {
              title: "Tree edge list",
              note: "The first line is the vertex count N, followed by N−1 edges. It can look the same as a weighted parent list, so you may need to choose the format yourself.",
              code: formatSamples.tree,
            },
            {
              title: "Parent list",
              note: "The first line is the vertex count, and the second gives the parents of vertices 2, 3, and so on. It is loaded as a directed tree from the root to the children.",
              code: formatSamples.parents,
            },
            {
              title: "Adjacency list",
              note: "One vertex per line, written as vertex: neighbours.",
              code: formatSamples.adjacencyList,
            },
            {
              title: "Adjacency matrix",
              note: "N rows and N columns. Because the matrix has no vertex numbers, numbering follows the Index setting.",
              code: formatSamples.matrix,
            },
          ],
        },
        {
          id: "article-settings",
          title: "Direction and weights",
          paragraphs: [
            "Edge lists are loaded as undirected graphs. For a directed problem, switch to Directed in Settings. Parent lists and asymmetric adjacency matrices become directed automatically.",
            "A third number in an edge list, or a value other than 1 in an adjacency matrix, is loaded as a weight and shown on the edge.",
          ],
        },
        {
          id: "article-troubleshooting",
          title: "When the input isn't read correctly",
          paragraphs: [
            "If the input can't be loaded or the graph looks wrong, check the following.",
          ],
          points: [
            "Paste only the graph, not the whole input. Input that starts with a number of test cases, or has queries after the edges, can't be detected as it is.",
            "If the first line has more than the vertex and edge counts, such as N M K, it is read as an edge pair list. Remove K so the line is just N M.",
            "If the input can be read in more than one way, the editor asks you to choose a format. Pick the right one under Format.",
            "Up to 1,000 vertices and 5,000 edges can be loaded.",
          ],
        },
      ],
      relatedSlugs: ["tikz-export"],
    },
    {
      slug: "tikz-export",
      category: "Reports and documents",
      title: "Put a graph diagram in a LaTeX document with TikZ",
      description:
        "Export a graph from Graph Editor as TikZ code and include it in a report or paper, with notes on sizing, Japanese labels, and common errors.",
      introduction:
        "Graph Editor can export a diagram as TikZ code. Unlike an image, it is typeset in your document's font and stays sharp at any size. Using a weighted tree as the example, this article goes from exporting to placing the diagram in a document.",
      sections: [
        {
          id: "article-tikz-export",
          title: "Export as TikZ",
          paragraphs: [
            "When the diagram is ready, open Export and choose TikZ (TeX) as the format. Copy the code, or use Save as .tex to get a file.",
            "Only the `tikzpicture` environment is exported, without `\\documentclass` or other setup. It includes vertex positions, colours, and labels, edge curves, weights, and arrows for directed graphs, and the drawing is scaled to fit within roughly 12 cm.",
            "TikZ code can't be loaded back into Graph Editor. If you might change the diagram later, save a JSON file as well.",
          ],
        },
        {
          id: "article-tikz-document",
          title: "Add it to your document",
          paragraphs: [
            "The packages the code needs are listed in its opening comments. Add these two lines to your preamble, then paste the code into the document or load the saved .tex file with `\\input`.",
          ],
          samples: [
            { title: "Preamble", code: texSamples.preamble },
            {
              title: "Document body (saved as graph.tex)",
              note: "Put it in a figure environment if you want a caption.",
              code: texSamples.figure("A weighted tree"),
            },
            {
              title: "Make a PDF of just the diagram",
              note: "To use the diagram in slides or other software, the standalone class produces a PDF containing only the diagram.",
              code: texSamples.standalone,
            },
          ],
        },
        {
          id: "article-tikz-size",
          title: "Adjust size and style",
          paragraphs: [
            "To bring vertices closer together, reduce `x=1cm,y=1cm` at the start of the code. Only the coordinates shrink; vertex circles and text keep their size.",
            "To fit the text width, wrap the diagram in `\\resizebox`. This scales the text too, so don't shrink it too far.",
            "The look comes from three styles at the start of the code: `ge vertex` for vertices, `ge edge` for edges, and `ge label` for weights. For example, changing `font=\\small` to `font=\\footnotesize` in `ge vertex` makes every vertex label smaller.",
          ],
          samples: [
            { title: "Reduce spacing only", code: texSamples.spacing },
            { title: "Scale to a width", code: texSamples.resize },
            { title: "Styles at the start", code: texSamples.styles },
          ],
        },
        {
          id: "article-tikz-japanese",
          title: "Japanese labels",
          paragraphs: [
            "For Japanese vertex labels or weights, compile with LuaLaTeX and add `luatexja` to the preamble. LuaTeX-ja classes such as `ltjsarticle` need nothing extra.",
            "Labels are exported as plain text, and characters such as `\\` and `$` are escaped automatically. Writing `$x_1$` in a label will not produce maths.",
          ],
          samples: [{ title: "LuaLaTeX preamble", code: texSamples.japanese }],
        },
        {
          id: "article-tikz-errors",
          title: "Common errors",
          paragraphs: [
            "If compilation stops, first check that both preamble lines are there. These are the errors you are most likely to see.",
          ],
          points: [
            "`Unknown arrow tip kind 'Stealth'`: `arrows.meta` is missing from `\\usetikzlibrary`. It draws the arrows of directed graphs.",
            "`I do not know the key '/tikz/rounded rectangle'`: `shapes.misc` is missing. It is used for vertices with long labels.",
            "`Undefined control sequence` on the `\\usetikzlibrary` line in beamer: beamer doesn't load tikz, so add `\\usepackage{tikz}` as well.",
            "`Unicode character … not set up for use with LaTeX`: the document has Japanese text and is compiled with pdfLaTeX. Use LuaLaTeX with `luatexja`.",
          ],
        },
      ],
      relatedSlugs: ["edge-list"],
    },
  ],
  "zh-Hans": [
    {
      slug: "edge-list",
      category: "输入与绘图",
      title: "粘贴竞赛题的输入，直接画出图",
      description:
        "把竞赛编程题目中的图输入粘贴进来就能画成图。本文还整理了支持的格式，以及读取不正确时的处理方法。",
      introduction:
        "想看看题目样例中的图长什么样时，把输入原样粘贴到 Graph Editor 即可。边列表、树、父节点列表、邻接表和邻接矩阵都能自动识别，编号从 0 还是从 1 开始也会自动判断。",
      sections: [
        {
          id: "article-paste",
          title: "从粘贴到应用",
          paragraphs: [
            "在编辑器中打开“加载”，粘贴题目的样例输入。格式会自动识别，右侧预览会显示图以及顶点数和边数。确认无误后点击“应用到图”。",
            "编号从 0 还是从 1 开始，也会根据输入中出现的编号来判断。4 个顶点的输入中出现 4 就是从 1 开始，出现 0 就是从 0 开始。两者都没有出现时（例如编号最大的顶点是孤立点），按“设置”中的“编号”处理。",
          ],
        },
        {
          id: "article-formats",
          title: "支持的格式",
          paragraphs: [
            "可以读取以下格式，示例均从 1 开始编号。所有格式都会原样保留重边和自环。",
          ],
          samples: [
            {
              title: "带顶点数和边数的边列表",
              note: "第一行是 N M，后面 M 行是边。写第三个数时作为边权。",
              code: formatSamples.contest,
            },
            {
              title: "边对列表",
              note: "没有顶点数那一行的边列表。顶点也可以用 A B 这样的名称。",
              code: formatSamples.pairs,
            },
            {
              title: "树边列表",
              note: "第一行是顶点数 N，后面 N−1 行是边。它和带权父节点列表看起来可能一样，有时需要在“格式”中手动选择。",
              code: formatSamples.tree,
            },
            {
              title: "父节点列表",
              note: "第一行是顶点数，第二行依次是顶点 2、3……的父节点。会读取为从根指向子节点的有向树。",
              code: formatSamples.parents,
            },
            {
              title: "邻接表",
              note: "每行一个顶点，写成“顶点: 相邻顶点……”。",
              code: formatSamples.adjacencyList,
            },
            {
              title: "邻接矩阵",
              note: "N 行 N 列。矩阵里没有顶点编号，因此编号按“设置”中的“编号”处理。",
              code: formatSamples.matrix,
            },
          ],
        },
        {
          id: "article-settings",
          title: "方向和边权",
          paragraphs: [
            "边列表按无向图读取。如果题目是有向图，请在“设置”中切换为“有向”。父节点列表和不对称的邻接矩阵会自动成为有向图。",
            "边列表的第三列，以及邻接矩阵中不为 1 的值，会作为边权读取并显示在边上。",
          ],
        },
        {
          id: "article-troubleshooting",
          title: "读取不正确时",
          paragraphs: ["无法加载或图看起来不对时，请检查以下几点。"],
          points: [
            "只粘贴图的部分，而不是整个输入。开头带测试用例数的输入，或边后面还有查询的输入，原样粘贴无法识别格式。",
            "如果第一行除了顶点数和边数还有别的值（例如 N M K 中的 K），会被当作边对列表读取。请删掉 K，只保留 N M。",
            "输入有多种读法时，编辑器会提示选择格式。请在“格式”中选择正确的一项。",
            "最多可以读取 1,000 个顶点和 5,000 条边。",
          ],
        },
      ],
      relatedSlugs: ["tikz-export"],
    },
    {
      slug: "tikz-export",
      category: "报告与文档",
      title: "用 TikZ 把图放进 LaTeX 文档",
      description:
        "把 Graph Editor 中画好的图导出为 TikZ 代码，放进报告或论文。也介绍了尺寸调整、日文标签和常见错误。",
      introduction:
        "Graph Editor 可以把图导出为 TikZ 代码。和图片不同，它会使用文档的字体排版，放大也不会模糊。本文以带权树为例，从导出一直讲到放进文档。",
      sections: [
        {
          id: "article-tikz-export",
          title: "导出为 TikZ",
          paragraphs: [
            "图整理好后，打开“导出”，格式选择“TikZ (TeX)”。可以复制代码，也可以用“保存为 .tex”保存成文件。",
            "导出的只有 `tikzpicture` 环境，不包含 `\\documentclass` 等内容。顶点的位置、颜色和标签，边的弯曲、边权以及有向图的箭头都会保留，整张图会缩放到大约 12 cm 以内。",
            "TikZ 代码无法重新加载到 Graph Editor。如果以后还要修改，请同时保存一份 JSON。",
          ],
        },
        {
          id: "article-tikz-document",
          title: "放进文档",
          paragraphs: [
            "代码开头的注释列出了需要的宏包。在导言区加上下面两行，然后把代码粘贴到正文，或用 `\\input` 读取保存的 .tex 文件。",
          ],
          samples: [
            { title: "导言区", code: texSamples.preamble },
            {
              title: "正文（保存为 graph.tex 时）",
              note: "需要标题时，放进 figure 环境。",
              code: texSamples.figure("带权树"),
            },
            {
              title: "只把图做成 PDF",
              note: "要在幻灯片等其他软件中使用时，可以用 standalone 文档类生成只包含图的 PDF。",
              code: texSamples.standalone,
            },
          ],
        },
        {
          id: "article-tikz-size",
          title: "调整尺寸和样式",
          paragraphs: [
            "只想缩小顶点间距时，把代码开头的 `x=1cm,y=1cm` 改小。缩小的只是坐标，顶点的圆和文字大小不变。",
            "要适应正文宽度，可以用 `\\resizebox` 包起来。这种方法会连文字一起缩小，请不要缩得太小。",
            "外观由代码开头的三个样式决定：`ge vertex` 是顶点，`ge edge` 是边，`ge label` 是边权。例如把 `ge vertex` 中的 `font=\\small` 改为 `font=\\footnotesize`，所有顶点的文字都会变小。",
          ],
          samples: [
            { title: "只缩小间距", code: texSamples.spacing },
            { title: "按宽度缩放", code: texSamples.resize },
            { title: "开头的样式", code: texSamples.styles },
          ],
        },
        {
          id: "article-tikz-japanese",
          title: "使用中日文标签",
          paragraphs: [
            "顶点或边权中有日文时，用 LuaLaTeX 编译，并在导言区加上 `luatexja`。使用 `ltjsarticle` 等 LuaTeX-ja 文档类时不需要另外添加。中文等其他字符同样需要支持它们的引擎和字体。",
            "标签按普通文字原样导出，`\\`、`$` 等符号会自动转义。在标签里写 `$x_1$` 不会变成公式。",
          ],
          samples: [{ title: "LuaLaTeX 导言区", code: texSamples.japanese }],
        },
        {
          id: "article-tikz-errors",
          title: "常见错误",
          paragraphs: [
            "编译中断时，先确认导言区的两行是否都在。常见的错误和原因如下。",
          ],
          points: [
            "`Unknown arrow tip kind 'Stealth'`：`\\usetikzlibrary` 中缺少 `arrows.meta`。它用于有向图的箭头。",
            "`I do not know the key '/tikz/rounded rectangle'`：缺少 `shapes.misc`。它用于标签较长的顶点。",
            "在 beamer 中 `\\usetikzlibrary` 那一行报 `Undefined control sequence`：beamer 不会加载 tikz，需要再写上 `\\usepackage{tikz}`。",
            "`Unicode character … not set up for use with LaTeX`：正在用 pdfLaTeX 编译含有中日文的文档。请改用 LuaLaTeX 等支持这些字符的引擎。",
          ],
        },
      ],
      relatedSlugs: ["edge-list"],
    },
  ],
};

const articleGuideAnchors: Record<ArticleSlug, ArticleGuideAnchor> = {
  "edge-list": "guide-import",
  "tikz-export": "guide-export",
};

/** Which article each guide example points readers to. */
const guideExampleArticles: Record<GuideExampleId, ArticleSlug> = {
  "edge-list": "edge-list",
  "adjacency-matrix": "edge-list",
  "weighted-tree": "tikz-export",
};

function articlesForLocale(locale: AppLocale): readonly ArticleContent[] {
  return articleText[locale].map((text) => {
    const anchor = articleGuideAnchors[text.slug];
    const example = localizedExample(locale, text.slug);
    const guideSectionId = anchor.replace("guide-", "");
    const guideSection = guideCopy[locale].sections.find(
      (section) => section.id === guideSectionId,
    )!;
    return {
      ...text,
      example,
      guide: {
        sectionId: anchor,
        label: guideSection.navTitle,
      },
    };
  });
}

export const articlesByLocale: Record<AppLocale, readonly ArticleContent[]> = {
  ja: articlesForLocale("ja"),
  en: articlesForLocale("en"),
  "zh-Hans": articlesForLocale("zh-Hans"),
};

export function getArticles(locale: AppLocale): readonly ArticleContent[] {
  return articlesByLocale[locale];
}

export function getArticle(
  locale: AppLocale,
  slug: string,
): ArticleContent | undefined {
  return articlesByLocale[locale].find((article) => article.slug === slug);
}

export function articleIndexPath(locale: AppLocale): string {
  const prefix = appLocalePaths[locale].replace(/\/$/, "");
  return `${prefix}/articles`;
}

export function articlePath(locale: AppLocale, slug: ArticleSlug): string {
  return `${articleIndexPath(locale)}/${slug}`;
}

export function getArticlesForGuideSection(
  locale: AppLocale,
  sectionId: string,
): readonly ArticleContent[] {
  const anchor = sectionId.startsWith("guide-")
    ? sectionId
    : `guide-${sectionId}`;
  return getArticles(locale).filter(
    (article) => article.guide.sectionId === anchor,
  );
}

export function getArticleForGuideExample(
  locale: AppLocale,
  exampleId: GuideExampleId,
): ArticleContent | undefined {
  return getArticle(locale, guideExampleArticles[exampleId]);
}
