import type { GraphColor, GraphModel } from "../core/graph/model";
import { estimateNodeWidth, NODE_SIZE_PX } from "../core/graph/node-size";
import { computeEdgeRouting } from "../core/layout/edge-routing";
import {
  edgeCurveSegments,
  type EdgeCurvePoint,
} from "../core/layout/edge-route-geometry";

// Fixed, print-friendly colours independent of the editor's light/dark theme.
const COLORS: Record<GraphColor, { fill: string; stroke: string }> = {
  paper: { fill: "FFFFFF", stroke: "334155" },
  white: { fill: "FFFFFF", stroke: "334155" },
  black: { fill: "111827", stroke: "111827" },
  red: { fill: "FEE2E2", stroke: "B91C1C" },
  yellow: { fill: "FEF3C7", stroke: "92400E" },
  blue: { fill: "DBEAFE", stroke: "1D4ED8" },
  green: { fill: "DCFCE7", stroke: "15803D" },
  pink: { fill: "FCE7F3", stroke: "BE185D" },
};

const TEX_ESCAPES: Record<string, string> = {
  "\\": "\\textbackslash{}",
  "{": "\\{",
  "}": "\\}",
  $: "\\$",
  "&": "\\&",
  "#": "\\#",
  "%": "\\%",
  _: "\\_",
  "~": "\\textasciitilde{}",
  "^": "\\textasciicircum{}",
};

function escapeTex(text: string) {
  return (
    text
      .replace(/[\\{}$&#%_~^]/g, (character) => TEX_ESCAPES[character]!)
      // Control characters have no printable representation in a TeX label.
      // oxlint-disable-next-line no-control-regex
      .replace(/[\u0000-\u001f\u007f]+/g, " ")
  );
}

function number(value: number) {
  return String(Math.round(value * 10000) / 10000);
}

function borderAnchor(
  name: string,
  center: EdgeCurvePoint,
  control: EdgeCurvePoint,
  fallback: EdgeCurvePoint,
) {
  const toward =
    control.x === center.x && control.y === center.y ? fallback : control;
  // Explicit angular anchors also work in previews that resolve bare node
  // names to their centres instead of TikZ's automatic border intersection.
  const angle =
    (Math.atan2(center.y - toward.y, toward.x - center.x) * 180) / Math.PI;
  // Integer degrees avoid the ambiguous second dot in names such as v0.30.5
  // for lightweight TikZ parsers (at most half a degree of rounding).
  return `(${name}.${(Math.round(angle) + 360) % 360})`;
}

/** A pasteable picture, also usable as \input{graph.tex} inside a document. */
export function exportTikz(model: GraphModel): string {
  if (model.nodes.length === 0) return "";

  // Normalize translation and bound the drawing to 12 cm on its longest axis.
  // In particular, large valid model coordinates must not exceed TeX dimensions.
  const minX = Math.min(...model.nodes.map((node) => node.x));
  const minY = Math.min(...model.nodes.map((node) => node.y));
  const span = Math.max(
    ...model.nodes.map((node) => Math.max(node.x - minX, node.y - minY)),
  );
  const scale = Math.min(1 / 80, 12 / (span || 1));
  const coordinate = (point: EdgeCurvePoint) =>
    `(${number((point.x - minX) * scale)},${number(-(point.y - minY) * scale)})`;
  const nodes = new Map(
    model.nodes.map((node, index) => [node.id, { node, name: `v${index}` }]),
  );
  const routes = computeEdgeRouting(model, {
    mode: model.settings.autoEdgeRouting ? "quality" : "simple",
  });
  const lines = [
    "% Graph Editor: TikZ picture (labels are literal text, not TeX commands).",
    "% Add to your document preamble:",
    "% \\usepackage{tikz}",
    "% \\usetikzlibrary{arrows.meta,shapes.misc}",
    "% Then paste this picture or use \\input{graph.tex} inside the document.",
    "% For Japanese labels, use LuaLaTeX with \\usepackage{luatexja}.",
    "% Other Unicode characters require an engine and fonts that support them.",
    "\\begingroup",
    ...Object.entries(COLORS).flatMap(([name, color]) => [
      `\\definecolor{ge-${name}-fill}{HTML}{${color.fill}}`,
      `\\definecolor{ge-${name}-stroke}{HTML}{${color.stroke}}`,
    ]),
    "\\begin{tikzpicture}[x=1cm,y=1cm,",
    "  ge vertex/.style={draw,line width=0.6pt,inner sep=2pt,outer sep=0.3pt,font=\\small},",
    "  ge edge/.style={line width=0.6pt},",
    "  ge label/.style={fill=white,text=black,inner sep=1.5pt,font=\\small}]",
  ];

  for (const { node, name } of nodes.values()) {
    const label = model.settings.showNodeLabels ? node.label : "";
    const color = node.color ?? "paper";
    const width = estimateNodeWidth(label);
    const shape = width > NODE_SIZE_PX ? "rounded rectangle" : "circle";
    lines.push(
      `  \\node[ge vertex,${shape},minimum width=${number(width / 80)}cm,minimum height=0.6cm,fill=ge-${color}-fill,draw=ge-${color}-stroke,text=${color === "black" ? "white" : "black"}] (${name}) at ${coordinate(node)} {${escapeTex(label)}};`,
    );
  }

  for (const edge of model.edges) {
    const source = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    const route = routes.get(edge.id);
    if (!source || !target || !route) continue;
    const arrow = model.settings.directed
      ? `,-{Stealth[scale=${number(model.settings.arrowScale)}]}`
      : "";
    const style = `ge edge,draw=ge-${edge.color ?? "paper"}-stroke${arrow}`;
    const text =
      edge.label ?? (model.settings.weighted ? (edge.weight ?? "1") : "");
    const label = text ? ` node[ge label,midway] {${escapeTex(text)}}` : "";
    if (edge.source === edge.target) {
      // Cytoscape measures clockwise from up; TikZ measures CCW from right.
      const direction = 90 - route.loopDirectionDeg;
      lines.push(
        `  \\draw[${style}] (${source.name}) to[loop,out=${number(direction + route.loopSweepDeg / 2)},in=${number(direction - route.loopSweepDeg / 2)},min distance=10mm]${label} (${target.name});`,
      );
      continue;
    }

    const segments = edgeCurveSegments(source.node, target.node, route);
    const start = borderAnchor(
      source.name,
      source.node,
      segments[0]?.control ?? target.node,
      target.node,
    );
    const targetAnchor = borderAnchor(
      target.name,
      target.node,
      segments.at(-1)?.control ?? source.node,
      source.node,
    );
    const path = segments
      .map((segment, index) => {
        // TikZ uses cubic Beziers; convert the editor's quadratic exactly.
        const control = (end: EdgeCurvePoint) => ({
          x: end.x + (2 / 3) * (segment.control.x - end.x),
          y: end.y + (2 / 3) * (segment.control.y - end.y),
        });
        const end =
          index === segments.length - 1
            ? targetAnchor
            : coordinate(segment.end);
        return `.. controls ${coordinate(control(segment.start))} and ${coordinate(control(segment.end))} .. ${end}`;
      })
      .join(" ");
    lines.push(
      `  \\draw[${style}] ${start} ${path || `-- ${targetAnchor}`}${label};`,
    );
  }

  lines.push("\\end{tikzpicture}", "\\endgroup", "");
  return lines.join("\n");
}
