import type {
  Core,
  Css,
  ElementDefinition,
  NodeSingular,
  StylesheetJson,
} from "cytoscape";

import {
  computeEdgeRouting,
  defaultEdgeRoutingMeta,
  type EdgeRoutingMeta,
  type EdgeRoutingOptions,
} from "../../core/layout/edge-routing";
import { minimumCurveDistanceToNode } from "../../core/layout/edge-route-geometry";
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
  displayLabel: string;
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
  controlPointDistances: readonly number[];
  controlPointWeights: readonly number[];
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
  active: string;
  selectedNode: string;
  selectedNodeText: string;
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

const EDGE_WIDTH = 2.5;
/** Horizontal padding between a node label and the node border. */
const NODE_LABEL_PADDING = 14;

type TextMeasure = (text: string) => number;

/** Measures label width in CSS px; falls back to an estimate outside the DOM. */
function createTextMeasure(palette: GraphCanvasPalette): TextMeasure {
  const font = `600 ${palette.nodeFontSize}px ${palette.fontFamily}`;
  const context =
    typeof document === "undefined"
      ? null
      : document.createElement("canvas").getContext("2d");

  if (!context) {
    return (text) =>
      [...text].reduce(
        (width, char) =>
          width +
          palette.nodeFontSize *
            (/[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 1 : 0.62),
        0,
      );
  }

  return (text) => {
    context.font = font;
    return context.measureText(text).width;
  };
}

function nodeWidth(
  label: string,
  palette: GraphCanvasPalette,
  measure: TextMeasure,
) {
  if (!label) {
    return palette.nodeSize;
  }

  return Math.max(
    palette.nodeSize,
    Math.ceil(measure(label) + NODE_LABEL_PADDING * 2),
  );
}
const SELECTED_EDGE_WIDTH = 3.5;
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
    ...model.nodes.map((node) =>
      nodeToCytoscapeElement(node, model.settings.showNodeLabels),
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
  return computeEdgeRouting(model, edgeRoutingOptions);
}

export function syncCytoscapeEdgeRoutingData(
  cy: Core,
  model: GraphModel,
  edgeRoutingOptions?: EdgeRoutingOptions,
  interaction?: {
    movedNodeIds: ReadonlySet<NodeId>;
    previousMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
  },
) {
  const positionedModel = graphModelWithCytoscapeNodePositions(cy, model);
  const rerouteEdgeIds = interaction
    ? interactiveRerouteEdgeIds(
        positionedModel,
        interaction.previousMeta,
        interaction.movedNodeIds,
      )
    : null;
  const edgeRoutingMeta = computeCytoscapeEdgeRoutingMeta(
    positionedModel,
    interaction
      ? {
          ...edgeRoutingOptions,
          previousMeta: interaction.previousMeta,
          rerouteEdgeIds,
        }
      : edgeRoutingOptions,
  );

  cy.edges().forEach((edge) => {
    const meta = edgeRoutingMeta.get(edge.id());

    if (!meta || !edgeRoutingDataChanged(edge.data(), meta)) {
      return;
    }

    edge.data({
      bow: meta.bowPx,
      controlPointDistances: meta.controlPointDistancesPx,
      controlPointWeights: meta.controlPointWeights,
      duplicate: meta.duplicate,
      loopDirection: `${meta.loopDirectionDeg}deg`,
      loopSweep: `${meta.loopSweepDeg}deg`,
    });
  });

  return edgeRoutingMeta;
}

function interactiveRerouteEdgeIds(
  model: GraphModel,
  previousMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
  movedNodeIds: ReadonlySet<NodeId>,
) {
  if (previousMeta.size === 0 || movedNodeIds.size === 0) {
    return null;
  }

  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const movedNodes = model.nodes.filter((node) => movedNodeIds.has(node.id));
  const reroute = new Set<EdgeId>();

  for (const edge of model.edges) {
    const previous = previousMeta.get(edge.id);

    if (
      movedNodeIds.has(edge.source) ||
      movedNodeIds.has(edge.target) ||
      edge.source === edge.target ||
      (previous?.controlPointWeights.length ?? 0) > 1
    ) {
      reroute.add(edge.id);
      continue;
    }

    const source = nodesById.get(edge.source);
    const target = nodesById.get(edge.target);

    if (!source || !target || !previous) {
      reroute.add(edge.id);
      continue;
    }

    if (
      movedNodes.some(
        (node) =>
          minimumCurveDistanceToNode(source, target, previous, node) < 84,
      )
    ) {
      reroute.add(edge.id);
    }
  }

  return reroute;
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
    !sameNumericArray(
      data.controlPointDistances,
      meta.controlPointDistancesPx,
    ) ||
    !sameNumericArray(data.controlPointWeights, meta.controlPointWeights) ||
    data.duplicate !== meta.duplicate ||
    data.loopDirection !== `${meta.loopDirectionDeg}deg` ||
    data.loopSweep !== `${meta.loopSweepDeg}deg`
  );
}

function nodeToCytoscapeElement(
  node: GraphNode,
  showNodeLabels: boolean,
): ElementDefinition {
  return {
    group: "nodes",
    classes: [nodeColorClass(node.color)].filter(Boolean).join(" "),
    data: {
      id: node.id,
      label: node.label,
      displayLabel: showNodeLabels ? node.label : "",
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
      controlPointDistances: routingMeta.controlPointDistancesPx,
      controlPointWeights: routingMeta.controlPointWeights,
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
  const measure = createTextMeasure(palette);

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
        // A circle that stretches into a pill when the label needs more room.
        shape: "round-rectangle",
        "corner-radius": `${palette.nodeSize / 2}px`,
        width: (node: NodeSingular) =>
          nodeWidth(node.data("displayLabel") as string, palette, measure),
        height: palette.nodeSize,
        "background-color": palette.node,
        "background-opacity": 1,
        "border-color": palette.nodeBorder,
        "border-width": 2,
        color: palette.nodeText,
        content: "data(displayLabel)",
        "box-selection": "contain",
        "font-family": palette.fontFamily,
        "font-size": palette.nodeFontSize,
        "font-weight": 600,
        "text-halign": "center",
        "text-valign": "center",
        "text-outline-color": palette.node,
        "text-outline-width": 0,
        "text-wrap": "none",
        "underlay-shape": "round-rectangle",
        "underlay-corner-radius": `${palette.nodeSize / 2 + 5}px`,
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
        // Control points are measured from node centres, matching the routing
        // and manual-bend math, instead of from the node border intersections.
        "edge-distances": "node-position",
        "control-point-distances": "data(controlPointDistances)",
        "control-point-weights": "data(controlPointWeights)",
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
        "font-weight": 600,
        color: palette.nodeText,
        "text-background-color": palette.labelBg,
        "text-background-opacity": 1,
        "text-background-shape": "round-rectangle",
        "text-background-padding": palette.labelPadding,
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
        "background-color": palette.selectedNode,
        "border-color": palette.active,
        color: palette.selectedNodeText,
        "text-outline-color": palette.selectedNode,
        "underlay-color": palette.active,
        "underlay-opacity": palette.activeOpacity,
        "underlay-padding": 5,
      }),
    },
    ...SELECTED_EDGE_SELECTORS.map((selector) => ({
      selector,
      style: cytoscapeStyle({
        width: SELECTED_EDGE_WIDTH,
        "arrow-scale": selectedArrowScale,
        "line-color": palette.active,
        "line-outline-width": 0,
        "target-arrow-color": palette.active,
        color: palette.active,
        "underlay-opacity": 0,
        "z-index": 20,
      }),
    })),
    {
      selector: ".edge-source",
      style: cytoscapeStyle({
        "border-color": palette.active,
        "underlay-color": palette.active,
        "underlay-opacity": palette.activeOpacity,
        "underlay-padding": 5,
      }),
    },
  ];
}

function sameNumericArray(value: unknown, expected: readonly number[]) {
  if (!Array.isArray(value) || value.length !== expected.length) {
    return false;
  }

  return value.every(
    (item, index) => typeof item === "number" && item === expected[index],
  );
}

function clampArrowScale(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(2, Math.max(0.6, value));
}

function cytoscapeStyle(
  style: Record<string, string | number | ((node: NodeSingular) => number)>,
) {
  return style as Css.Node | Css.Edge | Css.Core;
}

function edgeColorClass(color: GraphColor | undefined) {
  return color && color !== "paper" ? `color-${color}` : "";
}

function nodeColorClass(color: GraphColor | undefined) {
  return color && color !== "paper" ? `color-${color}` : "";
}
