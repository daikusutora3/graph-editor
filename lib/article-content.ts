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

export type ArticleSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
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
      "辺リストや隣接行列の読み方、木や二部グラフの配置、TikZ での書き出しを、具体的な入力例で説明します。どの例も Graph Editor でそのまま試せます。",
    heading: "グラフの読み方と描き方",
    indexIntro:
      "入力の読み方や、図を見やすくするコツを例と一緒にまとめています。エディタの操作は、各記事から使い方ガイドの該当箇所に移って確認できます。",
    articlesLink: "記事",
    skipToContent: "記事本文へ移動",
    input: guideExampleCopy.ja.input,
    result: guideExampleCopy.ja.result,
    copy: guideExampleCopy.ja.copy,
    copySuccess: guideExampleCopy.ja.copySuccess,
    copyFailure: guideExampleCopy.ja.copyFailure,
    exampleTitle: "入力例と図",
    operationGuideLabel: "操作方法",
    sameExampleGuideLabel: "ガイドで同じ例を見る",
    relatedTitle: "関連記事",
    allArticles: "記事一覧へ",
  },
  en: {
    title: "Reading and drawing graphs | Graph Editor",
    description:
      "How to read edge lists and adjacency matrices, lay out trees and bipartite graphs, and export diagrams to TikZ, with small examples you can try in Graph Editor.",
    heading: "Reading and drawing graphs",
    indexIntro:
      "Short articles on reading graph input and making diagrams easier to read. Each one links to the part of the user guide that covers the editor steps.",
    articlesLink: "Articles",
    skipToContent: "Skip to article content",
    input: guideExampleCopy.en.input,
    result: guideExampleCopy.en.result,
    copy: guideExampleCopy.en.copy,
    copySuccess: guideExampleCopy.en.copySuccess,
    copyFailure: guideExampleCopy.en.copyFailure,
    exampleTitle: "Input and diagram",
    operationGuideLabel: "Editor steps",
    sameExampleGuideLabel: "See this example in the guide",
    relatedTitle: "Related articles",
    allArticles: "All articles",
  },
  "zh-Hans": {
    title: "图的读法与画法 | Graph Editor",
    description:
      "用具体的输入示例讲解边列表和邻接矩阵的读法、树和二分图的布局，以及如何导出为 TikZ。每个示例都可以直接在 Graph Editor 中试用。",
    heading: "图的读法与画法",
    indexIntro:
      "这里整理了输入数据的读法和让图更易读的方法，每篇都配有示例。编辑器的具体操作可以从文章跳到使用指南的对应部分查看。",
    articlesLink: "文章",
    skipToContent: "跳转到文章正文",
    input: guideExampleCopy["zh-Hans"].input,
    result: guideExampleCopy["zh-Hans"].result,
    copy: guideExampleCopy["zh-Hans"].copy,
    copySuccess: guideExampleCopy["zh-Hans"].copySuccess,
    copyFailure: guideExampleCopy["zh-Hans"].copyFailure,
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
  const bipartiteResults: Record<AppLocale, string> = {
    ja: "左の A、B と右の 1、2、3 を結ぶ、5 頂点、4 辺の二部グラフです。",
    en: "A bipartite graph with 5 vertices and 4 edges, connecting A and B on the left to 1, 2, and 3 on the right.",
    "zh-Hans":
      "一个有 5 个顶点、4 条边的二分图，连接左侧的 A、B 与右侧的 1、2、3。",
  };
  const index = guideExamples.findIndex(
    (entry) => entry.id === example.guideExampleId,
  );
  return {
    ...example,
    result: example.guideExampleId
      ? guideExampleCopy[locale].examples[index]!.result
      : bipartiteResults[locale],
  };
}

type ArticleText = Omit<ArticleContent, "example" | "guide">;

const articleText: Record<AppLocale, readonly ArticleText[]> = {
  ja: [
    {
      slug: "edge-list",
      category: "入力と描画",
      title: "辺リストからグラフを描く",
      description:
        "先頭行の頂点数・辺数と、続く各行が表す辺を、4 頂点の例で読んでいきます。",
      introduction:
        "問題文に並んだ数字は、そのままだとグラフの形がつかみにくいものです。ガイドと同じ 4 頂点・4 辺の入力を図にして、各行がどの辺になるかを見ていきます。",
      sections: [
        {
          id: "article-header",
          title: "先頭行は頂点数と辺数",
          paragraphs: [
            "先頭行の「4 4」は、頂点が 4 個、辺が 4 本という意味です。頂点の番号は 1 から 4 で、続く 4 行がそれぞれ 1 本の辺を表します。",
            "ただし、この先頭行がない辺リストもあります。「1 2」で始まっていても、それが頂点数と辺数なのか最初の辺なのかは数字だけでは決まりません。問題文の入力形式を見て判断してください。",
          ],
        },
        {
          id: "article-connections",
          title: "1 行が 1 本の辺",
          paragraphs: [
            "「1 2」は頂点 1 と 2 を結ぶ辺です。「2 3」と「2 4」で頂点 2 は 3 と 4 にもつながり、最後の「3 4」で 2・3・4 が三角形になります。",
            "この例は無向グラフなので、「1 2」と「2 1」は同じ辺です。有向グラフの場合は、どちらが始点でどちらが終点かも問題文で確かめてください。",
          ],
          points: [
            "頂点 2 には辺が 3 本、頂点 1 には 1 本だけつながっています。",
            "頂点をドラッグして動かしても、どの頂点同士がつながっているかは変わりません。",
          ],
        },
        {
          id: "article-import-check",
          title: "反映する前にプレビューを見る",
          paragraphs: [
            "Graph Editor の読み込み画面では、反映する前に形式・頂点数・辺数がプレビューに出ます。この入力なら「頂点数・辺数つき辺リスト」、4 頂点、4 辺と出ていれば正しく読めています。",
            "番号が 0 始まりか 1 始まりか、有向か無向かもここで合わせておきます。入力を書き換えて試すときは、先頭行の辺数も実際の行数に合わせて直してください。",
          ],
        },
      ],
      relatedSlugs: ["adjacency-matrix", "tree-layout"],
    },
    {
      slug: "adjacency-matrix",
      category: "入力と描画",
      title: "隣接行列を図で読み解く",
      description:
        "0 と 1 の表から頂点のつながりを読み、対称な行列が無向グラフになる理由を図で確かめます。",
      introduction:
        "グラフは辺の一覧だけでなく、表の形でも書けます。ガイドと同じ 3 頂点の隣接行列を使って、表のどこが図のどの辺に当たるかを見ていきます。",
      sections: [
        {
          id: "article-rows-columns",
          title: "行と列は頂点を表す",
          paragraphs: [
            "この入力は 3 行 3 列の表で、行も列も頂点 1、2、3 に対応します。1 行 2 列が 1 なら頂点 1 と 2 の間に辺があり、0 なら辺はありません。",
            "左上から右下への対角線は、頂点とそれ自身の組です。この例では対角線がすべて 0 なので、自己ループはありません。",
          ],
        },
        {
          id: "article-symmetry",
          title: "1 が 6 個なのに辺が 3 本の理由",
          paragraphs: [
            "無向グラフでは、1 行 2 列と 2 行 1 列が同じ辺を指します。この例で対角線以外にある 6 個の 1 は、対称な位置どうしで 2 個ずつ組になるので、辺は 3 本です。",
            "その 3 本は 1–2、1–3、2–3 で、図は三角形になります。有向グラフの行列は対称とは限らず、1 行 2 列と 2 行 1 列は別々の辺として読みます。",
          ],
        },
        {
          id: "article-matrix-check",
          title: "表と図を見比べる",
          paragraphs: [
            "Graph Editor で試すときは、形式に「隣接行列」を選び、設定を無向・番号 1 始まりにします。プレビューが 3 頂点・3 辺になっていれば、各行にある 2 個の 1 が、その頂点から出ている 2 本の辺に対応しています。",
            "頂点の位置は配置方法によって変わります。三角形の向きや並び順ではなく、どの頂点同士がつながっているかを見てください。",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "bipartite-graph"],
    },
    {
      slug: "tree-layout",
      category: "図の作り方",
      title: "木を見やすく配置する",
      description:
        "根にする頂点を選んで、枝分かれと辺の重みが読み取りやすい木の図にします。",
      introduction:
        "同じ木でも、どの頂点を根にするかで見え方はかなり変わります。ガイドの重み付きの木を例に、つながりは変えずに読みやすい配置を選ぶ方法を紹介します。",
      sections: [
        {
          id: "article-tree-structure",
          title: "4 頂点の木と辺の重み",
          paragraphs: [
            "先頭行の「4 3」は 4 頂点・3 辺という意味で、辺は 1–2、1–3、3–4 です。すべての頂点がつながっていて閉路もないので、このグラフは木です。",
            "各行の 3 つ目の数字 5、2、7 は辺の重みです。距離やコストを表す値で、図の中での高さや階層の深さとは関係ありません。",
          ],
        },
        {
          id: "article-tree-root",
          title: "根を変えると枝分かれが変わる",
          paragraphs: [
            "頂点 1 を根にすると、その下に 2 と 3 が並び、4 は 3 の下に来ます。頂点 3 を根にすると、下に 1 と 4 が並び、2 は 1 の下に来ます。辺は同じでも、親子関係は根によって変わります。",
            "Graph Editor では、頂点を 1 つ選んでから「配置」の「木」を押すと、その頂点が根になります。根を何度変えても、辺のつながりと重みはそのままです。",
          ],
        },
        {
          id: "article-tree-spacing",
          title: "ラベルが重ならないように整える",
          paragraphs: [
            "自動で配置したあとは、頂点番号と辺の重みが重なっていないかを見ます。詰まっているところは頂点をドラッグして広げます。図を小さくして使うなら、その大きさでも文字が読めるかを確かめてください。",
            "閉路があるグラフでは「木」の配置は使えません。選べないときは表示される理由を読み、グラフに合った別の配置を選んでください。",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "tikz-export"],
    },
    {
      slug: "tikz-export",
      category: "資料づくり",
      title: "グラフの図を TikZ で書き出す",
      description:
        "図のラベルと余白を整えてから TikZ で書き出し、LaTeX のレポートや論文に入れる手順です。",
      introduction:
        "Graph Editor で整えた図は、TikZ のコードとして TeX 文書にそのまま入れられます。ガイドの辺リストを例に、図の準備から文書での仕上がりの確認までを順に説明します。",
      sections: [
        {
          id: "article-tikz-prepare",
          title: "書き出す前に図を整える",
          paragraphs: [
            "入力例を読み込んだら、頂点の位置、ラベル、辺の形を整えます。特定の頂点を目立たせたいときは、色だけでなくラベルや本文の説明でも区別できるようにしておくと、白黒で印刷しても伝わります。",
            "あとで図を直せるように、Graph Editor の JSON も保存しておきます。JSON には位置や色も残るので、同じ図を開き直して手直しできます。",
          ],
        },
        {
          id: "article-tikz-document",
          title: "コードとパッケージを文書に入れる",
          paragraphs: [
            "「書き出し」で形式を「TikZ (TeX)」にして、コードをコピーするか .tex ファイルを保存します。出力の先頭のコメントに必要なパッケージが書かれているので、文書のプリアンブルに追加します。",
            "コードは図を置きたい場所に貼り付けます。日本語のラベルを使うなら、ガイドにあるとおり LuaLaTeX と luatexja でコンパイルしてください。そのほかの Unicode 文字にも、対応したエンジンとフォントが必要です。",
          ],
        },
        {
          id: "article-tikz-check",
          title: "本文の幅と文字の大きさを確かめる",
          paragraphs: [
            "コンパイルしたら、図が本文の幅に収まっているか、頂点ラベルや重みが読める大きさかを見ます。図全体を縮小すると文字も一緒に小さくなるので、PDF で仕上がりを見ながら大きさを決めてください。",
            "ラベルが重なるときは、Graph Editor に戻って頂点の間隔を広げ、もう一度書き出します。書き出し画面の詳しい操作は、ガイドの「書き出しと保存」にあります。",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "tree-layout"],
    },
    {
      slug: "bipartite-graph",
      category: "グラフの基礎",
      title: "二部グラフを具体例で理解する",
      description:
        "2 つのグループの間だけを辺が結ぶグラフを例に、二部グラフの条件と配置を説明します。",
      introduction:
        "人と担当できる仕事のように、2 種類のものの対応関係を図にしたい場面があります。A・B と 1・2・3 の例を使って、二部グラフがどういうものかを見ていきます。",
      sections: [
        {
          id: "article-bipartite-groups",
          title: "頂点を 2 つのグループに分ける",
          paragraphs: [
            "この図では、左に A と B、右に 1、2、3 を置いています。A は 1 と 2 に、B は 2 と 3 につながっています。辺はすべて左右をまたいでいて、同じ側の頂点同士を結ぶ辺はありません。",
            "このように、どの辺も両端が別のグループになるよう頂点を 2 つに分けられるグラフを二部グラフと呼びます。2 つのグループの頂点数は違っていてもかまいません。",
          ],
        },
        {
          id: "article-bipartite-meaning",
          title: "辺が表す対応を読む",
          paragraphs: [
            "A と B を人、1、2、3 を仕事とすると、辺は「この人はこの仕事を担当できる」という組を表します。仕事 2 は両方の人とつながっているので、どちらでも担当できます。辺はあくまで候補で、実際に誰が何を担当するかまでは決めていません。",
            "左右に分けて並べると、こうした候補を比べやすくなります。左右がそれぞれ何を表しているかは、ラベルや説明文で書き添えてください。",
          ],
        },
        {
          id: "article-bipartite-layout",
          title: "配置で二部グラフかどうかを確かめる",
          paragraphs: [
            "Graph Editor では、この入力を「辺の組リスト」として読み込み、「配置」の「二部」を選びます。頂点をあとから動かしても、2 つに分けられるという性質は変わりません。",
            "三角形のように辺の数が奇数の閉路があると、どう分けても同じグループの中に辺が残ります。そういうグラフは二部グラフではないので、「二部」の配置は選べません。",
          ],
        },
      ],
      relatedSlugs: ["adjacency-matrix", "tree-layout"],
    },
  ],
  en: [
    {
      slug: "edge-list",
      category: "Input and drawing",
      title: "Draw a graph from an edge list",
      description:
        "What the count line at the top means, and how each following line becomes an edge, using a four-vertex example.",
      introduction:
        "A list of number pairs is hard to picture as a graph. This article draws the guide's four-vertex, four-edge input and walks through which line becomes which edge.",
      sections: [
        {
          id: "article-header",
          title: "The first line gives the counts",
          paragraphs: [
            "The first line, 4 4, means four vertices and four edges. The vertices are numbered 1 to 4, and each of the next four lines is one edge.",
            "Not every edge list has this line. If the input starts with 1 2, the numbers alone don't tell you whether that is a count or the first edge, so go by the input format in the problem statement.",
          ],
        },
        {
          id: "article-connections",
          title: "One line, one edge",
          paragraphs: [
            "1 2 is an edge between vertices 1 and 2. 2 3 and 2 4 connect vertex 2 to 3 and 4 as well, and the last line, 3 4, closes a triangle on 2, 3, and 4.",
            "The graph is undirected, so 1 2 and 2 1 are the same edge. For a directed graph, check in the problem statement which number is the start and which is the end.",
          ],
          points: [
            "Vertex 2 has three edges; vertex 1 has only one.",
            "Dragging a vertex somewhere else doesn't change which vertices it is connected to.",
          ],
        },
        {
          id: "article-import-check",
          title: "Check the preview before applying",
          paragraphs: [
            "When you load data in Graph Editor, the preview shows the detected format and the vertex and edge counts before anything is applied. For this input it should say edge list with counts, four vertices, and four edges.",
            "This is also the place to set whether numbering starts at 0 or 1 and whether the graph is directed. If you edit the input, remember to update the edge count on the first line too.",
          ],
        },
      ],
      relatedSlugs: ["adjacency-matrix", "tree-layout"],
    },
    {
      slug: "adjacency-matrix",
      category: "Input and drawing",
      title: "Read an adjacency matrix as a graph",
      description:
        "Read connections from a table of 0s and 1s, and see why a symmetric matrix describes an undirected graph.",
      introduction:
        "A graph can be written as a table instead of a list of edges. Using the guide's three-vertex matrix, this article shows which cell of the table becomes which edge.",
      sections: [
        {
          id: "article-rows-columns",
          title: "Rows and columns are vertices",
          paragraphs: [
            "The input is a 3 × 3 table, and both the rows and the columns stand for vertices 1, 2, and 3. A 1 in row 1, column 2 means there is an edge between vertices 1 and 2; a 0 means there isn't.",
            "The diagonal from top left to bottom right pairs each vertex with itself. It is all 0s here, so there are no self-loops.",
          ],
        },
        {
          id: "article-symmetry",
          title: "Six 1s, but only three edges",
          paragraphs: [
            "In an undirected graph, row 1, column 2 and row 2, column 1 describe the same edge. The six 1s off the diagonal pair up across it, so there are three edges.",
            "Those edges are 1–2, 1–3, and 2–3, which makes a triangle. A directed graph's matrix doesn't have to be symmetric, and the two cells are read as separate edges.",
          ],
        },
        {
          id: "article-matrix-check",
          title: "Compare the table and the diagram",
          paragraphs: [
            "To try it in Graph Editor, choose adjacency matrix as the format, and set the graph to Undirected with numbering starting at 1. The preview should show three vertices and three edges, and the two 1s in each row match the two edges at that vertex.",
            "Where the vertices end up depends on the layout. Look at which pairs are connected, not at which way the triangle points.",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "bipartite-graph"],
    },
    {
      slug: "tree-layout",
      category: "Making diagrams",
      title: "Arrange a tree for a readable diagram",
      description:
        "Pick a root and lay out a tree so its branches and edge weights are easy to read.",
      introduction:
        "The same tree can look quite different depending on which vertex is the root. Using the guide's weighted tree, this article shows how to pick a readable layout without changing any connections.",
      sections: [
        {
          id: "article-tree-structure",
          title: "A four-vertex tree with weights",
          paragraphs: [
            "The first line, 4 3, means four vertices and three edges, and the edges are 1–2, 1–3, and 3–4. Everything is connected and there are no cycles, so the graph is a tree.",
            "The third number on each line, 5, 2, and 7, is the edge weight. It stands for something like a distance or a cost, and has nothing to do with how high or deep a vertex sits in the drawing.",
          ],
        },
        {
          id: "article-tree-root",
          title: "A different root, different branches",
          paragraphs: [
            "With vertex 1 as the root, 2 and 3 hang below it and 4 hangs below 3. With vertex 3 as the root, 1 and 4 hang below it and 2 hangs below 1. The edges are the same; only the parent-child relationships change.",
            "In Graph Editor, select a vertex and then choose Tree under Layout to make it the root. You can switch roots as often as you like; the edges and weights stay the same.",
          ],
        },
        {
          id: "article-tree-spacing",
          title: "Keep labels from overlapping",
          paragraphs: [
            "After the automatic layout, look for vertex labels and weights that overlap and drag vertices apart where it's crowded. If the diagram will be shown small, make sure the text is still readable at that size.",
            "Tree layout isn't available for a graph with cycles. If it's disabled, the editor shows why; pick a layout that suits the graph instead.",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "tikz-export"],
    },
    {
      slug: "tikz-export",
      category: "Reports and documents",
      title: "Export a graph diagram as TikZ",
      description:
        "Tidy up labels and spacing, export to TikZ, and put the diagram in a LaTeX report or paper.",
      introduction:
        "A diagram you arrange in Graph Editor can go straight into a TeX document as TikZ code. Using the guide's edge list, this article goes from preparing the diagram to checking it in the compiled document.",
      sections: [
        {
          id: "article-tikz-prepare",
          title: "Tidy the diagram before exporting",
          paragraphs: [
            "Load the example and adjust vertex positions, labels, and edge shapes. If you want a vertex to stand out, mark it with a label or mention it in the text as well as giving it a colour, so it still works in black and white.",
            "Save a Graph Editor JSON file too. It keeps positions and colours, so you can reopen the same diagram later and make changes.",
          ],
        },
        {
          id: "article-tikz-document",
          title: "Add the code and packages to your document",
          paragraphs: [
            "In Export, choose TikZ (TeX), then copy the code or save a .tex file. The comments at the top of the output list the packages it needs; add them to your preamble.",
            "Paste the code where you want the diagram. Japanese labels need LuaLaTeX and luatexja, as the guide explains, and other Unicode text needs an engine and fonts that support it.",
          ],
        },
        {
          id: "article-tikz-check",
          title: "Check the width and text size",
          paragraphs: [
            "After compiling, check that the diagram fits within the text width and that labels and weights are large enough to read. Scaling the whole diagram scales the text with it, so settle on a size while looking at the PDF.",
            "If labels overlap, go back to Graph Editor, spread the vertices out, and export again. The guide's Export and save section covers the export options in detail.",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "tree-layout"],
    },
    {
      slug: "bipartite-graph",
      category: "Graph basics",
      title: "Understand bipartite graphs through an example",
      description:
        "What makes a graph bipartite and how to lay one out, using a graph whose edges only run between two groups.",
      introduction:
        "Sometimes you want to draw how two kinds of things match up, like people and the jobs they can do. This article uses A and B on one side and 1, 2, and 3 on the other to show what a bipartite graph is.",
      sections: [
        {
          id: "article-bipartite-groups",
          title: "Divide the vertices into two groups",
          paragraphs: [
            "A and B are on the left, and 1, 2, and 3 are on the right. A connects to 1 and 2, and B connects to 2 and 3. Every edge crosses from one side to the other; no edge joins two vertices on the same side.",
            "A graph is bipartite if you can split its vertices into two groups so that every edge has one end in each group. The two groups don't need to be the same size.",
          ],
        },
        {
          id: "article-bipartite-meaning",
          title: "What the edges mean",
          paragraphs: [
            "If A and B are people and 1, 2, and 3 are jobs, an edge means that person can do that job. Job 2 is connected to both people, so either of them can take it. The edges only show who could do what, not who actually does it.",
            "Putting the two groups on opposite sides makes these options easy to compare. Use labels or a caption to say what each side stands for.",
          ],
        },
        {
          id: "article-bipartite-layout",
          title: "Use the layout to check for two groups",
          paragraphs: [
            "In Graph Editor, load this input as an edge pair list, then choose Bipartite under Layout. Moving vertices around afterwards doesn't change whether the graph splits into two groups.",
            "If the graph has a cycle with an odd number of edges, such as a triangle, some edge always ends up inside one group no matter how you split it. Such a graph isn't bipartite, so the Bipartite layout can't be chosen.",
          ],
        },
      ],
      relatedSlugs: ["adjacency-matrix", "tree-layout"],
    },
  ],
  "zh-Hans": [
    {
      slug: "edge-list",
      category: "输入与绘图",
      title: "用边列表绘制图形",
      description:
        "用 4 个顶点的例子，看懂首行的顶点数、边数，以及后面每一行对应的边。",
      introduction:
        "题目里给出的一串数字，单看很难想象出图的样子。本文把指南中 4 个顶点、4 条边的输入画出来，逐行说明每一行对应哪条边。",
      sections: [
        {
          id: "article-header",
          title: "首行是顶点数和边数",
          paragraphs: [
            "首行的 4 4 表示有 4 个顶点、4 条边。顶点编号为 1 到 4，后面的 4 行各表示一条边。",
            "不过，也有边列表没有这一行。如果输入以 1 2 开头，光看数字无法判断它是顶点数和边数还是第一条边，需要以题目给出的输入格式为准。",
          ],
        },
        {
          id: "article-connections",
          title: "一行就是一条边",
          paragraphs: [
            "1 2 是连接顶点 1 和 2 的边。2 3 和 2 4 让顶点 2 也连到 3 和 4，最后的 3 4 使 2、3、4 构成一个三角形。",
            "这个例子是无向图，所以 1 2 和 2 1 是同一条边。如果是有向图，还要根据题目确认哪个是起点、哪个是终点。",
          ],
          points: [
            "顶点 2 连着 3 条边，顶点 1 只连着 1 条。",
            "把顶点拖到别处，它和哪些顶点相连并不会改变。",
          ],
        },
        {
          id: "article-import-check",
          title: "应用前先看预览",
          paragraphs: [
            "在 Graph Editor 中加载数据时，应用之前会在预览里显示识别出的格式、顶点数和边数。这个输入应显示为“带顶点数和边数的边列表”、4 个顶点、4 条边。",
            "编号从 0 还是从 1 开始、图是否有向，也在这里设置好。修改输入试验时，记得把首行的边数改成实际的行数。",
          ],
        },
      ],
      relatedSlugs: ["adjacency-matrix", "tree-layout"],
    },
    {
      slug: "adjacency-matrix",
      category: "输入与绘图",
      title: "用图形理解邻接矩阵",
      description:
        "从 0 和 1 组成的表格中读出连接关系，并看看为什么对称矩阵对应无向图。",
      introduction:
        "图除了写成边的列表，也可以写成表格。本文用指南中 3 个顶点的邻接矩阵，说明表格中的哪一格对应图中的哪条边。",
      sections: [
        {
          id: "article-rows-columns",
          title: "行和列都代表顶点",
          paragraphs: [
            "这个输入是 3 行 3 列的表格，行和列都对应顶点 1、2、3。第 1 行第 2 列是 1，表示顶点 1 和 2 之间有边；是 0 则表示没有边。",
            "从左上到右下的对角线是顶点与自身的组合。本例对角线全是 0，所以没有自环。",
          ],
        },
        {
          id: "article-symmetry",
          title: "6 个 1，为什么只有 3 条边",
          paragraphs: [
            "在无向图中，第 1 行第 2 列和第 2 行第 1 列表示同一条边。本例对角线以外的 6 个 1 关于对角线两两对称，所以一共是 3 条边。",
            "这 3 条边是 1–2、1–3、2–3，画出来是一个三角形。有向图的矩阵不一定对称，第 1 行第 2 列和第 2 行第 1 列要当作两条不同的边来读。",
          ],
        },
        {
          id: "article-matrix-check",
          title: "对照表格和图",
          paragraphs: [
            "在 Graph Editor 中试用时，格式选“邻接矩阵”，并设为无向、编号从 1 开始。预览应显示 3 个顶点、3 条边，每行的两个 1 正好对应该顶点的两条边。",
            "顶点的位置取决于布局方式。要看的是哪些顶点相连，而不是三角形朝哪个方向。",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "bipartite-graph"],
    },
    {
      slug: "tree-layout",
      category: "图形制作",
      title: "让树的布局更清晰",
      description: "选一个顶点作为根，把树排成分支和边权都容易看清的样子。",
      introduction:
        "同一棵树，选不同的顶点作根，看起来会很不一样。本文以指南中的带权树为例，介绍如何在不改变连接的前提下选出更易读的布局。",
      sections: [
        {
          id: "article-tree-structure",
          title: "4 个顶点的带权树",
          paragraphs: [
            "首行的 4 3 表示 4 个顶点、3 条边，边是 1–2、1–3、3–4。所有顶点连通且没有环，所以这个图是一棵树。",
            "每行的第三个数 5、2、7 是边权，表示距离或成本之类的值，与顶点在图中的高低或层次深度无关。",
          ],
        },
        {
          id: "article-tree-root",
          title: "换一个根，分支就不同",
          paragraphs: [
            "以顶点 1 为根时，2 和 3 在它下面，4 在 3 下面。以顶点 3 为根时，1 和 4 在它下面，2 在 1 下面。边没有变，变的只是父子关系。",
            "在 Graph Editor 中先选中一个顶点，再点“布局”里的“树”，这个顶点就会成为根。根可以随意更换，边和边权都保持不变。",
          ],
        },
        {
          id: "article-tree-spacing",
          title: "别让标签重叠",
          paragraphs: [
            "自动布局之后，看看顶点编号和边权有没有重叠，拥挤的地方可以拖动顶点拉开。如果图要缩小使用，也要确认在那个尺寸下文字仍然看得清。",
            "有环的图不能使用“树”布局。无法选择时，编辑器会显示原因，请改用适合这个图的其他布局。",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "tikz-export"],
    },
    {
      slug: "tikz-export",
      category: "报告与文档",
      title: "将图形导出为 TikZ",
      description: "整理好标签和间距后导出为 TikZ，放进 LaTeX 报告或论文。",
      introduction:
        "在 Graph Editor 中排好的图，可以作为 TikZ 代码直接放进 TeX 文档。本文以指南中的边列表为例，从整理图形一直讲到在编译后的文档里检查效果。",
      sections: [
        {
          id: "article-tikz-prepare",
          title: "导出前先整理图形",
          paragraphs: [
            "加载示例后，调整顶点位置、标签和边的形状。想突出某个顶点时，除了颜色，也用标签或正文说明加以区分，这样黑白打印时也能看明白。",
            "顺便保存一份 Graph Editor JSON。它会保留位置和颜色，以后可以重新打开同一张图继续修改。",
          ],
        },
        {
          id: "article-tikz-document",
          title: "把代码和宏包加入文档",
          paragraphs: [
            "在“导出”中选择“TikZ (TeX)”，复制代码或保存 .tex 文件。输出开头的注释列出了需要的宏包，把它们加到导言区。",
            "把代码粘贴到要放图的位置。日文标签需要按指南使用 LuaLaTeX 和 luatexja；中文等其他 Unicode 字符也需要支持它们的引擎和字体。",
          ],
        },
        {
          id: "article-tikz-check",
          title: "检查宽度和文字大小",
          paragraphs: [
            "编译后，看看图是否在正文宽度以内，顶点标签和边权是否足够大。整体缩放时文字也会一起变小，所以请对照 PDF 的效果决定尺寸。",
            "如果标签重叠，回到 Graph Editor 把顶点拉开，再导出一次。导出界面的详细操作见指南的“导出与保存”。",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "tree-layout"],
    },
    {
      slug: "bipartite-graph",
      category: "图论基础",
      title: "通过具体示例理解二分图",
      description: "以边只连接两组之间的图为例，说明什么是二分图以及如何布局。",
      introduction:
        "有时需要把两类事物之间的对应关系画成图，比如人和他们能做的工作。本文用一侧的 A、B 和另一侧的 1、2、3，说明二分图是什么。",
      sections: [
        {
          id: "article-bipartite-groups",
          title: "将顶点分成两组",
          paragraphs: [
            "左边是 A 和 B，右边是 1、2、3。A 连到 1 和 2，B 连到 2 和 3。每条边都跨越左右两侧，同一侧的顶点之间没有边。",
            "如果能把顶点分成两组，使每条边的两端分别在不同的组，这个图就叫二分图。两组的顶点数不必相同。",
          ],
        },
        {
          id: "article-bipartite-meaning",
          title: "边表示什么",
          paragraphs: [
            "把 A、B 看作人，1、2、3 看作工作，边就表示“这个人能做这项工作”。工作 2 和两个人都相连，所以谁都可以做。边只表示可能的人选，并没有决定实际由谁来做。",
            "把两组分在左右两侧，这些可能性就很容易比较。两侧分别代表什么，请用标签或说明文字写清楚。",
          ],
        },
        {
          id: "article-bipartite-layout",
          title: "用布局确认能否分成两组",
          paragraphs: [
            "在 Graph Editor 中把这个输入按“边对列表”加载，再选择“布局”里的“二分图”。之后再移动顶点，也不会改变它能否分成两组。",
            "如果图中有三角形这样边数为奇数的环，无论怎么分，总会有一条边落在同一组内。这样的图不是二分图，因此不能选择“二分图”布局。",
          ],
        },
      ],
      relatedSlugs: ["adjacency-matrix", "tree-layout"],
    },
  ],
};

const articleGuideAnchors: Record<ArticleSlug, ArticleGuideAnchor> = {
  "edge-list": "guide-import",
  "adjacency-matrix": "guide-import",
  "tree-layout": "guide-layouts",
  "tikz-export": "guide-export",
  "bipartite-graph": "guide-layouts",
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
  return getArticles(locale).find(
    (article) => article.example.guideExampleId === exampleId,
  );
}
