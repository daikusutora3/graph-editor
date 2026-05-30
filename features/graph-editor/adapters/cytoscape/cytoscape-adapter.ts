import type { Css, ElementDefinition, StylesheetJson } from "cytoscape";

import {
  computeEdgeRouting,
  defaultEdgeRoutingMeta,
  type EdgeRoutingMeta,
  type EdgeRoutingOptions,
} from "../../core/layout/edge-routing";
import { recordTimedEvent } from "../../diagnostics/graph-performance-events";
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
  isolated: boolean;
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
  nodeIsolated: string;
  nodeYellow: string;
  nodeBlue: string;
  nodeGreen: string;
  nodePink: string;
  edge: string;
  edgeYellow: string;
  edgeBlue: string;
  edgeGreen: string;
  edgePink: string;
  labelBg: string;
  labelBorder: string;
  warn: string;
  warnBg: string;
  active: string;
  activeBg: string;
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
  "edge.color-blue:selected",
  "edge.color-green:selected",
  "edge.color-pink:selected",
];

export function graphModelToCytoscapeElements(
  model: GraphModel,
  options: CytoscapeElementOptions = {},
): ElementDefinition[] {
  const degrees = getDegreeCounts(model);
  const edgeMeta =
    options.edgeRoutingMeta ??
    computeCytoscapeEdgeRoutingMeta(model, options.edgeRoutingOptions);

  return [
    ...model.nodes.map((node) =>
      nodeToCytoscapeElement(node, (degrees.get(node.id) ?? 0) === 0),
    ),
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
  return recordTimedEvent(
    "routing",
    () => computeEdgeRouting(model, edgeRoutingOptions),
    {
      avoidNodes: Boolean(edgeRoutingOptions?.avoidNodes),
      edges: model.edges.length,
      nodes: model.nodes.length,
    },
  );
}

function nodeToCytoscapeElement(
  node: GraphNode,
  isolated = false,
): ElementDefinition {
  return {
    group: "nodes",
    classes: [isolated ? "isolated" : "", nodeColorClass(node.color)]
      .filter(Boolean)
      .join(" "),
    data: {
      id: node.id,
      label: node.label,
      order: node.order,
      isolated,
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
): StylesheetJson {
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
      selector: "node.isolated",
      style: cytoscapeStyle({
        "background-color": palette.node,
        "background-opacity": 1,
      }),
    },
    {
      selector: "node.label-editing",
      style: cytoscapeStyle({
        content: "",
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
        "arrow-scale": 1,
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
        "arrow-scale": SELECTED_EDGE_ARROW_SCALE,
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

function cytoscapeStyle(style: Record<string, string | number>) {
  return style as Css.Node | Css.Edge | Css.Core;
}

function edgeColorClass(color: GraphColor | undefined) {
  return color && color !== "paper" ? `color-${color}` : "";
}

function nodeColorClass(color: GraphColor | undefined) {
  return color && color !== "paper" ? `color-${color}` : "";
}

function getDegreeCounts(model: GraphModel): Map<NodeId, number> {
  const degrees = new Map<NodeId, number>(
    model.nodes.map((node) => [node.id, 0]),
  );

  for (const edge of model.edges) {
    degrees.set(edge.source, (degrees.get(edge.source) ?? 0) + 1);
    if (edge.target !== edge.source) {
      degrees.set(edge.target, (degrees.get(edge.target) ?? 0) + 1);
    }
  }

  return degrees;
}
