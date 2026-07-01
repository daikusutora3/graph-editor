import type { Core, Css, ElementDefinition, StylesheetJson } from "cytoscape";

import {
  computeEdgeRouting,
  defaultEdgeRoutingMeta,
  type EdgeRoutingMeta,
  type EdgeRoutingOptions,
} from "../../core/layout/edge-routing";
import type {
  EdgeId,
  GraphColor,
  GraphEdge,
  GraphModel,
  GraphNode,
  NodeId,
} from "../../core/graph/model";

type CytoscapeNodeData = {
  id: NodeId;
  label: string;
  order: number;
  color: GraphColor;
};

type CytoscapeEdgeData = {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  label: string;
  weight?: string;
  color: GraphColor;
  bow: number;
  duplicate: boolean;
  loopDirection: string;
  loopSweep: string;
};

export type GraphCanvasPalette = {
  selectionBoxBorder: string;
  selectionBoxFill: string;
  node: string;
  nodeBorder: string;
  nodeText: string;
  nodeWhite: string;
  nodeBlack: string;
  nodeRed: string;
  nodeYellow: string;
  nodeBlue: string;
  nodeGreen: string;
  nodePink: string;
  edge: string;
  edgeWhite: string;
  edgeBlack: string;
  edgeRed: string;
  edgeYellow: string;
  edgeBlue: string;
  edgeGreen: string;
  edgePink: string;
  labelBg: string;
  labelBorder: string;
  active: string;
  activeOpacity: number;
  fontFamily: string;
  nodeSize: number;
  nodeFontSize: number;
  edgeFontSize: number;
  labelPadding: number;
};

export type CytoscapeElementOptions = {
  edgeRoutingMeta?: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
  edgeRoutingOptions?: EdgeRoutingOptions;
};

const EDGE_WIDTH = 3.2;
const SELECTED_EDGE_WIDTH = 4;
const SELECTED_EDGE_ARROW_SCALE = EDGE_WIDTH / SELECTED_EDGE_WIDTH;
const MULTI_EDGE_WIDTH = EDGE_WIDTH;
const SELECTED_EDGE_SELECTORS = [
  "edge:selected",
  "edge.color-yellow:selected",
  "edge.color-white:selected",
  "edge.color-black:selected",
  "edge.color-red:selected",
  "edge.color-blue:selected",
  "edge.color-green:selected",
  "edge.color-pink:selected",
];

export function graphModelToCytoscapeElements(
  model: GraphModel,
  options: CytoscapeElementOptions = {},
): ElementDefinition[] {
  const edgeMeta =
    options.edgeRoutingMeta ??
    computeCytoscapeEdgeRoutingMeta(model, options.edgeRoutingOptions);

  return [
    ...model.nodes.map((node) => nodeToCytoscapeElement(node)),
    ...model.edges.map((edge) =>
      edgeToCytoscapeElement(
        edge,
        model.settings.directed,
        model.settings.weighted,
        edgeMeta.get(edge.id) ?? defaultEdgeRoutingMeta,
      ),
    ),
  ];
}

export function computeCytoscapeEdgeRoutingMeta(
  model: GraphModel,
  edgeRoutingOptions?: EdgeRoutingOptions,
) {
  return computeEdgeRouting(model, edgeRoutingOptions);
}

export function syncCytoscapeEdgeRoutingData(
  cy: Core,
  model: GraphModel,
  edgeRoutingOptions?: EdgeRoutingOptions,
) {
  const edgeRoutingMeta = computeCytoscapeEdgeRoutingMeta(
    graphModelWithCytoscapeNodePositions(cy, model),
    edgeRoutingOptions,
  );

  cy.edges().forEach((edge) => {
    const meta = edgeRoutingMeta.get(edge.id());

    if (!meta || !edgeRoutingDataChanged(edge.data(), meta)) {
      return;
    }

    edge.data({
      bow: meta.bowPx,
      duplicate: meta.duplicate,
      loopDirection: `${meta.loopDirectionDeg}deg`,
      loopSweep: `${meta.loopSweepDeg}deg`,
    });
  });
}

function graphModelWithCytoscapeNodePositions(
  cy: Core,
  model: GraphModel,
): GraphModel {
  return {
    ...model,
    nodes: model.nodes.map((node) => {
      const cyNode = cy.getElementById(node.id);

      if (cyNode.empty() || !cyNode.isNode()) {
        return node;
      }

      const position = cyNode.position();

      return {
        ...node,
        x: position.x,
        y: position.y,
      };
    }),
  };
}

function edgeRoutingDataChanged(
  data: Record<string, unknown>,
  meta: EdgeRoutingMeta,
) {
  return (
    data.bow !== meta.bowPx ||
    data.duplicate !== meta.duplicate ||
    data.loopDirection !== `${meta.loopDirectionDeg}deg` ||
    data.loopSweep !== `${meta.loopSweepDeg}deg`
  );
}

function nodeToCytoscapeElement(node: GraphNode): ElementDefinition {
  return {
    group: "nodes",
    classes: [nodeColorClass(node.color)].filter(Boolean).join(" "),
    data: {
      id: node.id,
      label: node.label,
      order: node.order,
      color: node.color ?? "paper",
    } satisfies CytoscapeNodeData,
    position: {
      x: node.x,
      y: node.y,
    },
  };
}

function edgeToCytoscapeElement(
  edge: GraphEdge,
  directed = false,
  weighted = false,
  routingMeta: EdgeRoutingMeta = defaultEdgeRoutingMeta,
): ElementDefinition {
  return {
    group: "edges",
    classes: [
      directed ? "directed" : "",
      routingMeta.duplicate ? "multi" : "",
      edgeColorClass(edge.color),
    ]
      .filter(Boolean)
      .join(" "),
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.label ?? (weighted ? (edge.weight ?? "1") : ""),
      weight: edge.weight,
      color: edge.color ?? "paper",
      bow: routingMeta.bowPx,
      duplicate: routingMeta.duplicate,
      loopDirection: `${routingMeta.loopDirectionDeg}deg`,
      loopSweep: `${routingMeta.loopSweepDeg}deg`,
    } satisfies CytoscapeEdgeData,
  };
}

export function createGraphCanvasStylesheet(
  palette: GraphCanvasPalette,
  arrowScale = 1,
): StylesheetJson {
  const normalArrowScale = clampArrowScale(arrowScale);
  const selectedArrowScale = normalArrowScale * SELECTED_EDGE_ARROW_SCALE;

  return [
    {
      selector: "core",
      style: cytoscapeStyle({
        "active-bg-opacity": 0,
        "selection-box-border-color": palette.selectionBoxBorder,
        "selection-box-color": palette.selectionBoxFill,
        "selection-box-opacity": 0.28,
      }),
    },
    {
      selector: ":active",
      style: cytoscapeStyle({
        "overlay-opacity": 0,
        "overlay-padding": 0,
      }),
    },
    {
      selector: "node",
      style: cytoscapeStyle({
        width: palette.nodeSize,
        height: palette.nodeSize,
        "background-color": palette.node,
        "background-opacity": 1,
        "border-color": palette.nodeBorder,
        "border-width": 2.2,
        color: palette.nodeText,
        content: "data(label)",
        "box-selection": "contain",
        "font-family": palette.fontFamily,
        "font-size": palette.nodeFontSize,
        "font-weight": 800,
        "text-halign": "center",
        "text-valign": "center",
        "text-outline-color": palette.node,
        "text-outline-width": 1,
      }),
    },
    {
      selector: "node.label-editing",
      style: cytoscapeStyle({
        content: "",
      }),
    },
    {
      selector: "node.color-white",
      style: cytoscapeStyle({
        "background-color": palette.nodeWhite,
        "border-color": palette.edge,
        "text-outline-color": palette.nodeWhite,
        color: "#111827",
      }),
    },
    {
      selector: "node.color-black",
      style: cytoscapeStyle({
        "background-color": palette.nodeBlack,
        "border-color": palette.edge,
        "text-outline-color": palette.nodeBlack,
        color: "#f8fafc",
      }),
    },
    {
      selector: "node.color-red",
      style: cytoscapeStyle({
        "background-color": palette.nodeRed,
        "border-color": palette.edgeRed,
        "text-outline-color": palette.nodeRed,
      }),
    },
    {
      selector: "node.color-yellow",
      style: cytoscapeStyle({
        "background-color": palette.nodeYellow,
        "border-color": palette.edgeYellow,
        "text-outline-color": palette.nodeYellow,
      }),
    },
    {
      selector: "node.color-blue",
      style: cytoscapeStyle({
        "background-color": palette.nodeBlue,
        "border-color": palette.edgeBlue,
        "text-outline-color": palette.nodeBlue,
      }),
    },
    {
      selector: "node.color-green",
      style: cytoscapeStyle({
        "background-color": palette.nodeGreen,
        "border-color": palette.edgeGreen,
        "text-outline-color": palette.nodeGreen,
      }),
    },
    {
      selector: "node.color-pink",
      style: cytoscapeStyle({
        "background-color": palette.nodePink,
        "border-color": palette.edgePink,
        "text-outline-color": palette.nodePink,
      }),
    },
    {
      selector: "node.range-preview",
      style: cytoscapeStyle({
        "border-color": palette.active,
        "border-width": 4,
        "underlay-color": palette.active,
        "underlay-opacity": palette.activeOpacity * 0.6,
        "underlay-padding": 5,
        "z-index": 18,
      }),
    },
    {
      selector: "edge",
      style: cytoscapeStyle({
        width: EDGE_WIDTH,
        "curve-style": "unbundled-bezier",
        "control-point-distances": "data(bow)",
        "control-point-weights": 0.5,
        "loop-direction": "data(loopDirection)",
        "loop-sweep": "data(loopSweep)",
        "line-color": palette.edge,
        "line-opacity": 1,
        "target-arrow-color": palette.edge,
        "target-arrow-shape": "none",
        "arrow-scale": normalArrowScale,
        "box-selection": "contain",
        label: "data(label)",
        "font-family": palette.fontFamily,
        "font-size": palette.edgeFontSize,
        "font-weight": 700,
        color: palette.nodeText,
        "text-background-color": palette.labelBg,
        "text-background-opacity": 0.92,
        "text-background-padding": palette.labelPadding,
        "text-border-color": palette.labelBorder,
        "text-border-width": 1,
        "text-border-opacity": 1,
        "text-rotation": "none",
      }),
    },
    {
      selector: "edge.directed",
      style: cytoscapeStyle({
        "target-arrow-shape": "triangle",
      }),
    },
    {
      selector: "edge.label-editing",
      style: cytoscapeStyle({
        label: "",
      }),
    },
    {
      selector: "edge.color-white",
      style: cytoscapeStyle({
        "line-color": palette.edgeWhite,
        "target-arrow-color": palette.edgeWhite,
      }),
    },
    {
      selector: "edge.color-black",
      style: cytoscapeStyle({
        "line-color": palette.edgeBlack,
        "target-arrow-color": palette.edgeBlack,
      }),
    },
    {
      selector: "edge.color-red",
      style: cytoscapeStyle({
        "line-color": palette.edgeRed,
        "target-arrow-color": palette.edgeRed,
      }),
    },
    {
      selector: "edge.color-yellow",
      style: cytoscapeStyle({
        "line-color": palette.edgeYellow,
        "target-arrow-color": palette.edgeYellow,
      }),
    },
    {
      selector: "edge.color-blue",
      style: cytoscapeStyle({
        "line-color": palette.edgeBlue,
        "target-arrow-color": palette.edgeBlue,
      }),
    },
    {
      selector: "edge.color-green",
      style: cytoscapeStyle({
        "line-color": palette.edgeGreen,
        "target-arrow-color": palette.edgeGreen,
      }),
    },
    {
      selector: "edge.color-pink",
      style: cytoscapeStyle({
        "line-color": palette.edgePink,
        "target-arrow-color": palette.edgePink,
      }),
    },
    {
      selector: "edge.range-preview",
      style: cytoscapeStyle({
        width: SELECTED_EDGE_WIDTH,
        "arrow-scale": selectedArrowScale,
        "line-color": palette.active,
        "line-opacity": 0.72,
        "target-arrow-color": palette.active,
        "z-index": 16,
      }),
    },
    {
      selector: "edge.multi",
      style: cytoscapeStyle({
        width: MULTI_EDGE_WIDTH,
      }),
    },
    {
      selector: "node:selected",
      style: cytoscapeStyle({
        "underlay-color": palette.active,
        "underlay-opacity": palette.activeOpacity,
        "underlay-padding": 8,
      }),
    },
    ...SELECTED_EDGE_SELECTORS.map((selector) => ({
      selector,
      style: cytoscapeStyle({
        width: SELECTED_EDGE_WIDTH,
        "arrow-scale": selectedArrowScale,
        "line-outline-width": 0,
        "underlay-color": palette.active,
        "underlay-opacity": palette.activeOpacity,
        "underlay-padding": 9,
        "z-index": 20,
      }),
    })),
    {
      selector: ".edge-source",
      style: cytoscapeStyle({
        "underlay-color": palette.active,
        "underlay-opacity": palette.activeOpacity,
        "underlay-padding": 8,
      }),
    },
  ];
}

function clampArrowScale(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(2, Math.max(0.6, value));
}

function cytoscapeStyle(style: Record<string, string | number>) {
  return style as Css.Node | Css.Edge | Css.Core;
}

function edgeColorClass(color: GraphColor | undefined) {
  return color && color !== "paper" ? `color-${color}` : "";
}

function nodeColorClass(color: GraphColor | undefined) {
  return color && color !== "paper" ? `color-${color}` : "";
}
