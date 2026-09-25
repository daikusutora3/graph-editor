import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  exportGraph,
  getGraphExportFormat,
  graphExportProblem,
  hasLossyAdjacencyExport,
} from "../../features/graph-editor/io/export-graph";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("TikZ export");
const model: GraphModel = {
  ...createEmptyGraphModel({
    directed: true,
    weighted: true,
    autoEdgeRouting: false,
  }),
  nodes: [
    { id: "unsafe) id", label: "A_1", order: 0, x: -80, y: -40, color: "blue" },
    { id: "b", label: "B", order: 1, x: 80, y: 40, color: "black" },
    { id: "isolated", label: "", order: 2, x: 0, y: 120 },
  ],
  edges: [
    {
      id: "ab",
      source: "unsafe) id",
      target: "b",
      weight: "a b",
      routing: { bowPx: 40, bowT: 0.25 },
    },
    {
      id: "ba",
      source: "b",
      target: "unsafe) id",
      label: "custom",
      weight: "hidden",
      color: "red",
    },
    {
      id: "loop1",
      source: "b",
      target: "b",
      routing: { loopDirectionDeg: -90, loopSweepDeg: 80 },
    },
    { id: "loop2", source: "b", target: "b" },
  ],
};
const before = JSON.stringify(model);
const text = exportGraph(model, "tikz");
expect(JSON.stringify(model) === before, "export must not mutate the graph");
expect(!text.includes("unsafe) id"), "model IDs must not enter TeX syntax");
expect(
  text.includes("(v0) at (0,0) {A\\_1}"),
  "escape labels and translate the origin",
);
expect(text.includes("(v1) at (2,-1) {B}"), "invert the canvas Y axis");
expect(text.includes("(v2) at (1,-2) {}"), "retain isolated, blank nodes");
expect(
  text.includes("text=white") && text.includes("draw=ge-red-stroke"),
  "retain colours and contrasting labels",
);
expect(text.includes("-{Stealth[scale=1]}"), "directed edges need arrows");
expect(
  text.includes("{a b}") &&
    text.includes("{custom}") &&
    !text.includes("hidden"),
  "weights allow spaces and custom labels take precedence",
);
expect(
  text.includes(
    ".. controls (0.1843,-0.4648) and (0.8509,-0.7981) .. (v1.170)",
  ),
  "convert an off-centre quadratic bend to cubic controls",
);
const straight = exportGraph(
  {
    ...createEmptyGraphModel({ autoEdgeRouting: false }),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 160, y: 0 },
    ],
    edges: [{ id: "ab", source: "a", target: "b" }],
  },
  "tikz",
);
expect(
  straight.includes("(v0.0) .. controls") && straight.includes(".. (v1.180)"),
  "straight edges must explicitly connect the facing borders, not node centres",
);
expect(
  text.includes("(v0.292) .. controls") && text.includes(".. (v1.170)"),
  "curved endpoints follow control-point directions with integer degree anchors",
);
expect(
  text.includes("loop,out=220,in=140"),
  "preserve manual loop direction and sweep",
);
expect(
  (text.match(/to\[loop/g) ?? []).length === 2,
  "preserve multiple self-loops",
);
expect(
  graphExportProblem(model, "tikz") === null &&
    !hasLossyAdjacencyExport(model, "tikz"),
  "TeX does not inherit adjacency or weight-token restrictions",
);
expect(
  getGraphExportFormat("tikz").extension === "tex",
  "download as a .tex file",
);
expect(
  exportGraph(createEmptyGraphModel(), "tikz") === "",
  "empty graph keeps copy and save disabled",
);

const literal = String.raw`\input{bad} $ & # % _ ~ ^`;
const escaped = exportGraph(
  {
    ...model,
    nodes: [{ ...model.nodes[0]!, label: literal + "\n日本語" }],
    edges: [],
  },
  "tikz",
);
expect(
  escaped.includes(
    String.raw`\textbackslash{}input\{bad\} \$ \& \# \% \_ \textasciitilde{} \textasciicircum{} ` +
      "日本語",
  ),
  "escape every TeX metacharacter once and preserve Unicode",
);

const hidden = exportGraph(
  {
    ...model,
    settings: {
      ...model.settings,
      directed: false,
      weighted: false,
      showNodeLabels: false,
    },
  },
  "tikz",
);
expect(
  !hidden.includes("A\\_1") &&
    !hidden.includes("{a b}") &&
    !hidden.includes("Stealth"),
  "honour hidden labels and undirected/unweighted settings",
);
expect(
  hidden.includes("{custom}"),
  "explicit edge labels remain visible in unweighted mode",
);

const parallel = exportGraph(
  {
    ...model,
    settings: { ...model.settings, autoEdgeRouting: true },
    edges: [
      { id: "a", source: "unsafe) id", target: "b" },
      { id: "b", source: "unsafe) id", target: "b" },
    ],
  },
  "tikz",
)
  .split("\n")
  .filter((line) => line.includes("\\draw["));
expect(
  parallel.length === 2 && parallel[0] !== parallel[1],
  "automatic parallel edges get distinct paths",
);

const huge = exportGraph(
  {
    ...model,
    nodes: model.nodes.map((node, index) => ({
      ...node,
      x: 1e9 + index * 1e6,
      y: 1e9,
    })),
    edges: [],
  },
  "tikz",
);
expect(
  huge.includes("(v2) at (12,0)"),
  "large coordinates stay within TeX dimension limits",
);
finish();
