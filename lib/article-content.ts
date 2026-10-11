import {
  getArticleExample,
  type ArticleExample as ArticleExampleSeed,
  type ArticleSlug,
} from "./article-examples";
import { guideCopy, guideExampleCopy } from "./guide-content";
import { guideExamples } from "./guide-examples";
import { appGuidePaths, appLocalePaths, type AppLocale } from "./site-metadata";

export { articleSlugs, type ArticleSlug } from "./article-examples";
export type GuideExampleId = (typeof guideExamples)[number]["id"];
export type ArticleGuideAnchor =
  "guide-import" | "guide-layouts" | "guide-export";

export type ArticleSection = {
  id: string;
  title: string;
  paragraphs: readonly string[];
  points?: readonly string[];
};

export type ArticleExample = ArticleExampleSeed & {
  code: string;
  result: string;
  directed: false;
  indexBase: 0 | 1;
  preferredLayout: "circle" | "tree" | "bipartite";
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
    exampleId?: GuideExampleId;
  };
  guideAnchor: ArticleGuideAnchor;
  canonicalGuideExampleId?: GuideExampleId;
  relatedSlugs: readonly ArticleSlug[];
};

export type ArticleCopy = {
  title: string;
  description: string;
  heading: string;
  indexIntro: string;
  articlesLink: string;
  guideLink: string;
  onThisPage: string;
  skipToContent: string;
  readArticle: string;
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
  backToTop: string;
  languages: string;
};

export const articleCopy: Record<AppLocale, ArticleCopy> = {
  ja: {
    title: "グラフの読み方と図の作り方の記事 | Graph Editor",
    description:
      "辺リスト、隣接行列、木、二部グラフの読み方と、TikZ で図を使う手順を具体例で説明します。使い方ガイドと同じ入力例を Graph Editor で試せます。",
    heading: "グラフの読み方と描き方",
    indexIntro:
      "辺リストや隣接行列の読み方、木の配置、TikZ の書き出しを図と入力例で解説します。操作に迷ったら、各記事から使い方ガイドの手順を確認できます。",
    articlesLink: "記事",
    guideLink: guideCopy.ja.guideLink,
    onThisPage: "この記事の内容",
    skipToContent: "記事本文へ移動",
    readArticle: "記事を読む",
    input: guideExampleCopy.ja.input,
    result: guideExampleCopy.ja.result,
    copy: guideExampleCopy.ja.copy,
    copySuccess: guideExampleCopy.ja.copySuccess,
    copyFailure: guideExampleCopy.ja.copyFailure,
    exampleTitle: "入力例と図を見比べる",
    operationGuideLabel: "操作を確認する",
    sameExampleGuideLabel: "ガイドで同じ入力例を見る",
    relatedTitle: "あわせて読む",
    allArticles: "記事一覧に戻る",
    backToTop: "ページの先頭へ",
    languages: "記事の言語",
  },
  en: {
    title: "Learn to read and draw graphs | Graph Editor",
    description:
      "Read edge lists, adjacency matrices, trees, and bipartite graphs through worked examples. Learn to use TikZ diagrams and try the same inputs as the Graph Editor guide.",
    heading: "Understand a graph, then draw it",
    indexIntro:
      "Worked examples explain what graph input means and how to make a diagram readable. Each article links to the relevant steps in the guide.",
    articlesLink: "Articles",
    guideLink: guideCopy.en.guideLink,
    onThisPage: "In this article",
    skipToContent: "Skip to article content",
    readArticle: "Read article",
    input: guideExampleCopy.en.input,
    result: guideExampleCopy.en.result,
    copy: guideExampleCopy.en.copy,
    copySuccess: guideExampleCopy.en.copySuccess,
    copyFailure: guideExampleCopy.en.copyFailure,
    exampleTitle: "Compare the input and diagram",
    operationGuideLabel: "Check the editor steps",
    sameExampleGuideLabel: "See the same input in the guide",
    relatedTitle: "Related articles",
    allArticles: "Back to all articles",
    backToTop: "Back to top",
    languages: "Article language",
  },
  "zh-Hans": {
    title: "理解并绘制图论图形 | Graph Editor",
    description:
      "通过具体示例理解边列表、邻接矩阵、树和二分图，了解如何使用 TikZ 图形。可在 Graph Editor 中试用与使用指南相同的输入。",
    heading: "理解图的结构，再把它画出来",
    indexIntro:
      "通过具体示例解释输入的含义，以及如何让图形更清晰。每篇文章都链接到使用指南中的相关操作步骤。",
    articlesLink: "文章",
    guideLink: guideCopy["zh-Hans"].guideLink,
    onThisPage: "本文内容",
    skipToContent: "跳转到文章正文",
    readArticle: "阅读文章",
    input: guideExampleCopy["zh-Hans"].input,
    result: guideExampleCopy["zh-Hans"].result,
    copy: guideExampleCopy["zh-Hans"].copy,
    copySuccess: guideExampleCopy["zh-Hans"].copySuccess,
    copyFailure: guideExampleCopy["zh-Hans"].copyFailure,
    exampleTitle: "对照输入与图形",
    operationGuideLabel: "查看操作步骤",
    sameExampleGuideLabel: "在指南中查看相同输入",
    relatedTitle: "相关文章",
    allArticles: "返回文章列表",
    backToTop: "返回顶部",
    languages: "文章语言",
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
    code: example.input,
    result: example.guideExampleId
      ? guideExampleCopy[locale].examples[index]!.result
      : bipartiteResults[locale],
    directed: false,
    indexBase: example.guideExampleId ? 1 : 0,
    preferredLayout:
      slug === "tree-layout"
        ? "tree"
        : slug === "bipartite-graph"
          ? "bipartite"
          : "circle",
  };
}

type ArticleText = Omit<
  ArticleContent,
  "example" | "guide" | "guideAnchor" | "canonicalGuideExampleId"
>;

const articleText: Record<AppLocale, readonly ArticleText[]> = {
  ja: [
    {
      slug: "edge-list",
      category: "入力と描画",
      title: "辺リストからグラフを描く",
      description:
        "頂点数と辺数のヘッダー、その後の各行が表すつながりを、4 頂点の図で読み解きます。",
      introduction:
        "問題文に並んだ数値を図にすると、どの頂点がつながっているかを追いやすくなります。ガイドと同じ 4 頂点、4 辺の入力を使い、辺リストの各行と図の対応を確認しましょう。",
      sections: [
        {
          id: "article-header",
          title: "先頭行の頂点数と辺数",
          paragraphs: [
            "この例の先頭行「4 4」は、頂点が 4 個、辺が 4 本あることを表します。頂点番号は 1 から 4 です。その後に続く 4 行が、実際につながっている頂点の組を表します。",
            "ヘッダーの有無は入力形式によって変わります。「1 2」から始まるヘッダーなしの辺リストもあるため、先頭の 2 つの数値だけで判断せず、問題文の形式と合わせて読みます。",
          ],
        },
        {
          id: "article-connections",
          title: "各行を図の辺に対応させる",
          paragraphs: [
            "「1 2」は頂点 1 と 2 の間の辺です。次の「2 3」と「2 4」で、頂点 2 は 3 と 4 にもつながります。最後の「3 4」を加えると、2、3、4 の間に三角形ができます。",
            "この例は無向グラフなので、辺の両端の順番に方向の意味はありません。有向グラフを読むときは、出発点と到着点の順番も確認してください。",
          ],
          points: [
            "頂点 2 には 3 本の辺、頂点 1 には 1 本の辺が集まります。",
            "頂点の位置を動かしても、辺が結ぶ組は変わりません。",
          ],
        },
        {
          id: "article-import-check",
          title: "読み込み結果を確認する",
          paragraphs: [
            "Graph Editor の読み込みプレビューでは、形式、頂点数、辺数を確認できます。この入力では「頂点数・辺数つき辺リスト」、4 頂点、4 辺になっているかを見てから反映します。",
            "番号が 0 始まりか 1 始まりか、グラフが有向か無向かも図と合わせて確認します。入力例を変更して試すときは、ヘッダーの辺数も実際の行数に合わせてください。",
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
        "0 と 1 の表から頂点のつながりを読み取り、対称な行列と無向の辺を対応させます。",
      introduction:
        "頂点のつながりは、辺の一覧だけでなく表でも表せます。ガイドの 3 頂点の入力を使い、隣接行列の行と列が図のどこに対応するかを確認しましょう。",
      sections: [
        {
          id: "article-rows-columns",
          title: "行と列が表す頂点",
          paragraphs: [
            "この入力は 3 行、3 列の表です。行と列をそれぞれ頂点 1、2、3 に対応させます。1 行 2 列の値が 1 なら、頂点 1 と 2 がつながっています。0 は、その組に辺がないことを表します。",
            "左上から右下の対角線は、同じ頂点同士の組です。この例では対角線がすべて 0 なので、自分自身につながる辺はありません。",
          ],
        },
        {
          id: "article-symmetry",
          title: "6 個の 1 が 3 本の辺になる理由",
          paragraphs: [
            "無向グラフの行列では、1 行 2 列と 2 行 1 列の値が同じ辺を表します。この例では対角線の外側に 1 が 6 個ありますが、対称な 2 個ずつを組にすると、辺は 3 本です。",
            "その 3 本は 1–2、1–3、2–3 なので、図は三角形になります。有向グラフの行列では、反対向きの値は別々の辺として読みます。",
          ],
        },
        {
          id: "article-matrix-check",
          title: "図と表を照合する",
          paragraphs: [
            "Graph Editor でこの例を読むときは、形式を「隣接行列」、設定を無向と 1-indexed にします。3 頂点、3 辺のプレビューを確認し、各行に含まれる 2 個の 1 と、各頂点の 2 本の辺を見比べます。",
            "図の位置は配置方法によって変わります。三角形の向きや頂点の並び順よりも、行と列で指定した頂点同士がつながっているかを確認してください。",
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
        "根にする頂点を選び、枝分かれと重みが読み取れるように、木の図を整理します。",
      introduction:
        "木の図は、根をどこに置くかによって枝分かれの見え方が変わります。ガイドの重み付きの木を使い、接続関係を保ったまま読みやすい配置を選びましょう。",
      sections: [
        {
          id: "article-tree-structure",
          title: "4 頂点の木と辺の重み",
          paragraphs: [
            "入力の先頭行「4 3」は、4 頂点と 3 辺を表します。辺は 1–2、1–3、3–4 です。全頂点がつながっており、閉路がないので、このグラフは木です。",
            "各行の 3 列目にある 5、2、7 は辺の重みです。距離やコストなどを表す値であり、図の上下の位置や階層の深さを決める数値ではありません。",
          ],
        },
        {
          id: "article-tree-root",
          title: "根を選んで枝分かれを見る",
          paragraphs: [
            "頂点 1 を根にすると、2 と 3 がその下に並び、4 は 3 の下に置かれます。頂点 3 を根にすると、1 と 4 がその下になり、2 は 1 の下になります。同じ辺でも、根から見た親子関係が変わります。",
            "Graph Editor では頂点を 1 つ選び、「配置」の「木」を使うと、その頂点を根にできます。根を変えて比較しても、辺の接続と重みは保たれます。",
          ],
        },
        {
          id: "article-tree-spacing",
          title: "ラベルを読める余白に整える",
          paragraphs: [
            "自動配置の後は、頂点番号と辺の重みが重なっていないかを確認します。重なる部分は頂点を移動して調整し、図を縮めて使う場合もラベルが読めるかを見ます。",
            "閉路があるグラフには木の配置を使えません。配置が選べないときは表示される理由を確認し、接続関係に合った別の配置を選んでください。",
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
        "作った図のラベルと余白を整え、LaTeX のレポートや論文に取り込む手順を説明します。",
      introduction:
        "Graph Editor で整えた図は、TikZ のコードとして TeX 文書に入れられます。ガイドの辺リストを使い、図の準備から文書内での確認までを進めましょう。",
      sections: [
        {
          id: "article-tikz-prepare",
          title: "文書に入れる図を整える",
          paragraphs: [
            "入力例を読み込み、頂点の位置、ラベル、辺の形を整えます。本文中で強調したい頂点がある場合は、色だけに頼らず、ラベルや説明文でも識別できるようにします。",
            "後で図を修正するために、Graph Editor の JSON も保存しておきます。JSON には位置や色などの編集情報が残るため、元の図を読み込んで変更できます。",
          ],
        },
        {
          id: "article-tikz-document",
          title: "コードと必要なパッケージを入れる",
          paragraphs: [
            "「書き出し」で形式を「TikZ (TeX)」にし、コードをコピーするか .tex ファイルを保存します。出力の冒頭にあるコメントを読み、そこに記載されたパッケージを文書に追加します。",
            "コピーしたコードは文書の図を置きたい位置に入れます。日本語ラベルを使う場合は、ガイドに従って LuaLaTeX と luatexja を使ってください。ほかの Unicode 文字にも、対応するエンジンとフォントが必要です。",
          ],
        },
        {
          id: "article-tikz-check",
          title: "本文の幅と文字の大きさを確認する",
          paragraphs: [
            "TeX 文書をコンパイルし、図が本文の幅に収まるか、頂点ラベルと重みが読めるかを確認します。図全体を縮めると文字も小さくなるため、文書上の仕上がりを見ながら大きさを調整します。",
            "ラベルが重なる場合は、Graph Editor の図で頂点の間隔を広げ、もう一度書き出します。操作画面や保存方法は、ガイドの「書き出しと保存」から確認できます。",
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
        "2 つのグループの間を結ぶ関係を図にし、二部グラフの条件と配置を確認します。",
      introduction:
        "人と担当できる仕事のように、2 種類の対象の対応を図にしたいことがあります。A と B、1 と 2 と 3 の例を使い、二部グラフのつながりを見てみましょう。",
      sections: [
        {
          id: "article-bipartite-groups",
          title: "頂点を 2 つのグループに分ける",
          paragraphs: [
            "この図では、左のグループを A と B、右のグループを 1、2、3 にします。A は 1 と 2、B は 2 と 3 につながります。すべての辺が左右の間を結び、同じグループの頂点同士には辺がありません。",
            "このように、すべての辺の両端が異なるグループに属するように頂点を 2 つに分けられるグラフを、二部グラフと呼びます。グループの頂点数が等しい必要はありません。",
          ],
        },
        {
          id: "article-bipartite-meaning",
          title: "辺が表す対応を読む",
          paragraphs: [
            "A と B を人、1、2、3 を仕事と考えると、辺は担当できる組を表します。仕事 2 は両方の人とつながるので、どちらも担当できます。この図の辺だけで、実際の担当が決まったわけではありません。",
            "左右に分けた配置は、関係の候補を比較するのに役立ちます。頂点のラベルと説明文で、左右がそれぞれ何を表すかを伝えてください。",
          ],
        },
        {
          id: "article-bipartite-layout",
          title: "配置を変えて条件を確認する",
          paragraphs: [
            "Graph Editor ではこの入力を「辺の組リスト（ヘッダーなし）」として読み込み、「配置」の「二部」を選びます。頂点を移動しても、2 つのグループに分けられるという性質は変わりません。",
            "三角形のような奇数本の辺で閉じる閉路があると、どのように分けても同じグループ内に辺が残ります。その場合は二部グラフにならず、二部の配置は選べません。",
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
        "Read a vertex-and-edge count header and match each following edge to a diagram with four vertices.",
      introduction:
        "Turning a list of numbers into a diagram makes connections easier to follow. Use the guide's four-vertex, four-edge input to match each line of the edge list to the graph.",
      sections: [
        {
          id: "article-header",
          title: "The vertex-and-edge count header",
          paragraphs: [
            "The first line, 4 4, says that there are four vertices and four edges. The vertex labels run from 1 to 4. Each of the next four lines names a pair of connected vertices.",
            "Some edge lists omit this header and begin with a pair such as 1 2. Check the stated input format rather than deciding from the first two numbers alone.",
          ],
        },
        {
          id: "article-connections",
          title: "Match each line to an edge",
          paragraphs: [
            "The line 1 2 joins vertices 1 and 2. The next lines, 2 3 and 2 4, also connect vertex 2 to 3 and 4. Adding 3 4 completes a triangle among vertices 2, 3, and 4.",
            "This example is undirected, so the endpoint order does not give the edge a direction. For a directed graph, also check which endpoint is the source and which is the destination.",
          ],
          points: [
            "Three edges meet vertex 2, while one edge meets vertex 1.",
            "Moving a vertex changes its position, not the endpoints of its edges.",
          ],
        },
        {
          id: "article-import-check",
          title: "Check the import preview",
          paragraphs: [
            "Graph Editor's Load preview shows the format and vertex and edge counts. For this input, check that the format is edge list with counts and that the preview has four vertices and four edges before applying it.",
            "Also check whether labels start at 0 or 1 and whether the graph is directed or undirected. If you edit this input, update the header's edge count to match the number of edge lines.",
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
        "Read connections from a table of zeros and ones, and match a symmetric matrix to undirected edges.",
      introduction:
        "A table can describe the same connections as an edge list. Use the guide's three-vertex input to see how an adjacency matrix's rows and columns correspond to the diagram.",
      sections: [
        {
          id: "article-rows-columns",
          title: "The vertices behind rows and columns",
          paragraphs: [
            "This input has three rows and three columns, corresponding to vertices 1, 2, and 3. A 1 in row 1, column 2 means that vertices 1 and 2 are connected. A 0 means there is no edge for that pair.",
            "The main diagonal pairs each vertex with itself. Its entries are all 0 in this example, so there are no self-loops.",
          ],
        },
        {
          id: "article-symmetry",
          title: "Why six ones give three edges",
          paragraphs: [
            "For an undirected graph, row 1, column 2 and row 2, column 1 describe the same edge. This example has six ones outside the diagonal. Grouping them into symmetric pairs gives three edges.",
            "Those edges are 1–2, 1–3, and 2–3, forming a triangle. In a directed graph, entries in opposite directions describe separate edges.",
          ],
        },
        {
          id: "article-matrix-check",
          title: "Compare the table with the diagram",
          paragraphs: [
            "Choose adjacency matrix as the format and Undirected and 1-indexed in Settings. Check the three-vertex, three-edge preview, then match the two ones in each row to the two edges meeting that vertex.",
            "Positions depend on the layout. Check the connected vertex pairs rather than the triangle's orientation or the order of vertices on the page.",
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
        "Choose a root and arrange a tree so its branches and edge weights are easy to follow.",
      introduction:
        "Changing a tree's root changes how its branches appear. Use the guide's weighted tree to choose a readable layout while keeping the connections intact.",
      sections: [
        {
          id: "article-tree-structure",
          title: "Four vertices and weighted edges",
          paragraphs: [
            "The header 4 3 gives four vertices and three edges: 1–2, 1–3, and 3–4. Every vertex is connected and there is no cycle, so this graph is a tree.",
            "The third column contains the weights 5, 2, and 7. They can represent distances or costs. They do not specify a vertex's height or depth in the diagram.",
          ],
        },
        {
          id: "article-tree-root",
          title: "Choose a root to follow the branches",
          paragraphs: [
            "With vertex 1 as the root, 2 and 3 are its children and 4 sits below 3. With vertex 3 as the root, 1 and 4 are its children and 2 sits below 1. The parent-child relationships depend on the root.",
            "Select one vertex before choosing Tree in Layouts to use it as the root. Changing the root keeps all connections and edge weights intact.",
          ],
        },
        {
          id: "article-tree-spacing",
          title: "Leave room for labels and weights",
          paragraphs: [
            "After applying a layout, check that vertex labels and edge weights do not overlap. Move vertices to adjust tight areas and check that labels remain readable at the size you plan to use.",
            "Tree layout is unavailable for graphs with cycles. Read the displayed reason when a layout is disabled, then choose another layout suited to the graph's connections.",
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
        "Prepare labels and spacing, then include a graph diagram in a LaTeX report or paper.",
      introduction:
        "A diagram arranged in Graph Editor can be included in a TeX document as TikZ code. Use the guide's edge list to prepare the diagram and check it in the finished document.",
      sections: [
        {
          id: "article-tikz-prepare",
          title: "Prepare the diagram for the document",
          paragraphs: [
            "Import the example and adjust vertex positions, labels, and edge shapes. If a vertex needs emphasis, identify it with a label or description as well as colour.",
            "Also save a Graph Editor JSON file for future edits. It preserves positions, colours, and other editing information so you can reopen the original diagram and change it.",
          ],
        },
        {
          id: "article-tikz-document",
          title: "Include the code and required packages",
          paragraphs: [
            "Choose TikZ (TeX) in Export, then copy the code or save a .tex file. Read the opening comments in the output and add the listed packages to the document.",
            "Insert the copied code where the diagram belongs. Japanese labels need LuaLaTeX and luatexja as described in the guide. Other Unicode labels also need a compatible engine and fonts.",
          ],
        },
        {
          id: "article-tikz-check",
          title: "Check the width and text size",
          paragraphs: [
            "Compile the document and check that the diagram fits the text width and that vertex labels and weights are readable. Scaling the whole diagram also scales its text, so adjust the size while reviewing the final document.",
            "If labels overlap, increase spacing in Graph Editor and export again. The guide's export and save section explains the controls and file options.",
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
        "Draw relationships between two groups and check the defining condition and layout of a bipartite graph.",
      introduction:
        "A diagram can describe relationships between two kinds of objects, such as people and jobs they can do. Use A and B on one side and 1, 2, and 3 on the other to explore a bipartite graph.",
      sections: [
        {
          id: "article-bipartite-groups",
          title: "Divide the vertices into two groups",
          paragraphs: [
            "The left group contains A and B; the right group contains 1, 2, and 3. A connects to 1 and 2, while B connects to 2 and 3. Every edge goes between the groups, with none inside either group.",
            "A graph is bipartite when its vertices can be divided into two groups so that every edge joins different groups. The groups do not need to have the same number of vertices.",
          ],
        },
        {
          id: "article-bipartite-meaning",
          title: "Read the relationships represented by edges",
          paragraphs: [
            "If A and B are people and 1, 2, and 3 are jobs, an edge marks a job a person can do. Job 2 connects to both people, so either can do it. The edges show possible assignments; they do not select the actual assignments.",
            "Placing the groups on opposite sides makes these options easier to compare. Use labels and a description to explain what each side represents.",
          ],
        },
        {
          id: "article-bipartite-layout",
          title: "Use the layout to check the grouping",
          paragraphs: [
            "Load this input as edge pairs with no header, then choose Bipartite in Layouts. Moving vertices does not change whether the graph can be divided into two such groups.",
            "An odd-length cycle, such as a triangle, always leaves an edge inside one group however you divide its vertices. A graph with such a cycle is not bipartite, so Bipartite layout is unavailable.",
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
        "用一个有 4 个顶点的图，理解顶点数和边数首行，以及后续每行表示的连接。",
      introduction:
        "将一组数字画成图，更容易看清顶点之间的连接。使用与指南相同的 4 个顶点、4 条边的输入，将边列表的每一行与图形对应起来。",
      sections: [
        {
          id: "article-header",
          title: "首行的顶点数和边数",
          paragraphs: [
            "第一行 4 4 表示有 4 个顶点和 4 条边，顶点编号从 1 到 4。接下来的 4 行分别列出一对相连的顶点。",
            "有些边列表没有这一首行，直接从 1 2 这样的顶点对开始。应对照题目说明的输入格式，而不要仅凭最前面的两个数字判断。",
          ],
        },
        {
          id: "article-connections",
          title: "把每一行对应到一条边",
          paragraphs: [
            "1 2 连接顶点 1 和 2；接下来的 2 3 和 2 4 将顶点 2 与 3、4 相连。最后加上 3 4，顶点 2、3、4 之间就形成一个三角形。",
            "此示例是无向图，因此两个端点的顺序不表示方向。读取有向图时，还要确认哪个端点是起点，哪个是终点。",
          ],
          points: [
            "顶点 2 连接 3 条边，顶点 1 连接 1 条边。",
            "移动顶点会改变位置，不会改变每条边连接的端点。",
          ],
        },
        {
          id: "article-import-check",
          title: "确认导入预览",
          paragraphs: [
            "Graph Editor 的“加载”预览会显示格式、顶点数和边数。应用此输入前，确认格式为“带顶点数和边数的边列表”，并且预览包含 4 个顶点和 4 条边。",
            "还要结合图形确认编号从 0 还是 1 开始，以及图是否有向。修改输入进行尝试时，也要将首行中的边数更新为实际的边行数。",
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
        "从 0 和 1 组成的表格读取连接关系，将对称矩阵与无向边对应起来。",
      introduction:
        "顶点之间的连接除了用边列表，也可以用表格表示。使用指南中的 3 个顶点示例，看看邻接矩阵的行与列如何对应到图形。",
      sections: [
        {
          id: "article-rows-columns",
          title: "行与列代表的顶点",
          paragraphs: [
            "此输入包含 3 行和 3 列，分别对应顶点 1、2、3。第 1 行第 2 列的值为 1，表示顶点 1 和 2 相连；0 则表示这一对顶点之间没有边。",
            "从左上到右下的主对角线对应顶点与自身的组合。此示例的对角线全为 0，因此没有自环。",
          ],
        },
        {
          id: "article-symmetry",
          title: "6 个 1 为什么只对应 3 条边",
          paragraphs: [
            "在无向图中，第 1 行第 2 列与第 2 行第 1 列表示同一条边。此示例在对角线之外共有 6 个 1，每两个对称的 1 为一组，共得到 3 条边。",
            "这 3 条边是 1–2、1–3、2–3，因此图形为三角形。在有向图中，两个相反方向的矩阵值表示不同的边。",
          ],
        },
        {
          id: "article-matrix-check",
          title: "对照表格与图形",
          paragraphs: [
            "在 Graph Editor 中选择邻接矩阵格式，并在设置中选择“无向”和“1-indexed”。确认预览有 3 个顶点、3 条边，再将每行的两个 1 与该顶点连接的两条边对应起来。",
            "顶点位置取决于所选布局。应确认指定的顶点对是否相连，而不必要求三角形的朝向或顶点在页面上的排列顺序相同。",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "bipartite-graph"],
    },
    {
      slug: "tree-layout",
      category: "图形制作",
      title: "让树的布局更清晰",
      description: "选择根顶点并整理布局，让分支结构和边权更容易阅读。",
      introduction:
        "树的根选在哪里，会改变分支的呈现方式。使用指南中的带权树，在保留连接关系的同时，选择更清晰的布局。",
      sections: [
        {
          id: "article-tree-structure",
          title: "4 个顶点的树与边权",
          paragraphs: [
            "首行 4 3 表示 4 个顶点和 3 条边，分别为 1–2、1–3、3–4。所有顶点都连通且没有环，因此此图是一棵树。",
            "每行第三列中的 5、2、7 是边权，可以表示距离或成本。它们不决定顶点在图上的高度或层次深度。",
          ],
        },
        {
          id: "article-tree-root",
          title: "选择根顶点查看分支",
          paragraphs: [
            "以顶点 1 为根时，2 和 3 是它的子节点，4 位于 3 的下方。以顶点 3 为根时，1 和 4 是它的子节点，2 位于 1 的下方。同样的边，在不同根下有不同的父子关系。",
            "在 Graph Editor 中先选中一个顶点，再使用“布局”中的“树”，即可将它作为根。更换根时，边的连接关系和权重保持不变。",
          ],
        },
        {
          id: "article-tree-spacing",
          title: "为标签和边权留出空间",
          paragraphs: [
            "应用布局后，确认顶点编号与边权没有重叠。可移动顶点调整拥挤的位置，并在计划使用的尺寸下检查标签是否仍然清晰。",
            "有环的图无法使用树布局。布局不可选时，查看显示的原因，再选择适合当前连接关系的其他布局。",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "tikz-export"],
    },
    {
      slug: "tikz-export",
      category: "报告与文档",
      title: "将图形导出为 TikZ",
      description: "整理图形的标签和间距，再将其加入 LaTeX 报告或论文。",
      introduction:
        "在 Graph Editor 中整理好的图形可以用 TikZ 代码加入 TeX 文档。使用指南中的边列表示例，从准备图形到检查文档中的效果。",
      sections: [
        {
          id: "article-tikz-prepare",
          title: "整理要放进文档的图形",
          paragraphs: [
            "导入示例后，调整顶点位置、标签和边的形状。需要突出某个顶点时，除了颜色，也用标签或说明文字标识它。",
            "同时保存一份 Graph Editor JSON，以便以后修改。JSON 保留位置、颜色等编辑信息，可重新打开原图继续调整。",
          ],
        },
        {
          id: "article-tikz-document",
          title: "加入代码和所需宏包",
          paragraphs: [
            "在“导出”中选择“TikZ (TeX)”，复制代码或保存 .tex 文件。查看输出开头的注释，将列出的宏包添加到文档中。",
            "将复制的代码放在文档中需要插图的位置。日文标签按指南使用 LuaLaTeX 和 luatexja；中文等其他 Unicode 字符也需要支持相应字符的引擎和字体。",
          ],
        },
        {
          id: "article-tikz-check",
          title: "检查正文宽度与文字大小",
          paragraphs: [
            "编译 TeX 文档，确认图形没有超出正文宽度，顶点标签和边权可以读清。缩放整个图形时文字也会缩放，因此应结合文档的最终效果调整尺寸。",
            "如果标签重叠，可在 Graph Editor 中增大顶点间距，再次导出。界面操作与保存方式可在指南的导出与保存部分查看。",
          ],
        },
      ],
      relatedSlugs: ["edge-list", "tree-layout"],
    },
    {
      slug: "bipartite-graph",
      category: "图论基础",
      title: "通过具体示例理解二分图",
      description: "画出两个分组之间的关系，检查二分图的条件和布局。",
      introduction:
        "人与他们可以承担的工作等两类对象之间的关系，可以用图表示。将 A、B 放在一侧，1、2、3 放在另一侧，看看二分图如何表达这些连接。",
      sections: [
        {
          id: "article-bipartite-groups",
          title: "将顶点分成两组",
          paragraphs: [
            "左侧一组包含 A、B，右侧一组包含 1、2、3。A 连接 1 和 2，B 连接 2 和 3。所有边都连接左右两组，同一组的顶点之间没有边。",
            "如果能将顶点分成两组，使每条边的两个端点都属于不同组，这个图就是二分图。两组的顶点数量不必相等。",
          ],
        },
        {
          id: "article-bipartite-meaning",
          title: "读取边表示的对应关系",
          paragraphs: [
            "把 A、B 看作人，把 1、2、3 看作工作，则边表示某人能承担某项工作。工作 2 与两个人相连，表示两人都能承担它。这些边表示可选关系，还没有决定实际分配。",
            "左右分组的布局方便比较这些选择。通过顶点标签和说明文字，解释每一侧代表什么。",
          ],
        },
        {
          id: "article-bipartite-layout",
          title: "通过布局检查分组条件",
          paragraphs: [
            "在 Graph Editor 中用“边对列表（无首行）”导入此输入，再选择“布局”中的“二分”。移动顶点不会改变此图能否分成这样的两组。",
            "三角形等包含奇数条边的环，无论怎样分组，都会留下同组顶点之间的边。含有这种环的图不是二分图，因此无法使用二分布局。",
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
        exampleId: example.guideExampleId ?? undefined,
      },
      guideAnchor: anchor,
      canonicalGuideExampleId: example.guideExampleId ?? undefined,
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

export function articleGuidePath(
  locale: AppLocale,
  slug: ArticleSlug,
  target: "operation" | "example" = "operation",
): string {
  const exampleId = getArticleExample(slug)!.guideExampleId;
  const anchor =
    target === "example" && exampleId ? exampleId : articleGuideAnchors[slug];
  return `${appGuidePaths[locale]}#${anchor}`;
}

export function getArticlesForGuideSection(
  locale: AppLocale,
  sectionId: string,
): readonly ArticleContent[] {
  const anchor = sectionId.startsWith("guide-")
    ? sectionId
    : `guide-${sectionId}`;
  return getArticles(locale).filter(
    (article) => article.guideAnchor === anchor,
  );
}

export function getArticleForGuideExample(
  locale: AppLocale,
  exampleId: GuideExampleId,
): ArticleContent | undefined {
  // The reading article comes first; TikZ shares the edge-list input as well.
  return getArticles(locale).find(
    (article) => article.canonicalGuideExampleId === exampleId,
  );
}
