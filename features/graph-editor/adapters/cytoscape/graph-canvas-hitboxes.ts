import type { Core, EdgeSingular, NodeSingular, Position } from "cytoscape";

import type { EdgeId, GraphModel, NodeId } from "../../core/graph/model";

import type {
  InlineEditTarget,
  RenderedPoint,
} from "../../canvas/graph-canvas-types";

export type NodeHitbox = {
  id: NodeId;
  label: string;
  x: number;
  y: number;
};

export type EdgeLabelHitbox = {
  id: EdgeId;
  label: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  x: number;
  y: number;
};

export const NODE_HITBOX_SIZE = 48;
export const EDGE_LABEL_HITBOX_HEIGHT = 32;

export function readNodeHitboxes(cy: Core, graph: GraphModel): NodeHitbox[] {
  const labels = new Map(graph.nodes.map((node) => [node.id, node.label]));

  return cy.nodes().map((node) => {
    const position = node.renderedPosition();

    return {
      id: node.id(),
      label: labels.get(node.id()) ?? node.id(),
      x: position.x,
      y: position.y,
    };
  });
}

export function readEdgeLabelHitboxes(
  cy: Core,
  graph: GraphModel,
): EdgeLabelHitbox[] {
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const hitboxes: EdgeLabelHitbox[] = [];

  cy.edges().forEach((edge) => {
    const graphEdge = edges.get(edge.id());

    if (!graphEdge) {
      return;
    }

    const position = readEdgeRenderedLabelPosition(edge);
    const source = edge.source().renderedPosition();
    const target = edge.target().renderedPosition();

    hitboxes.push({
      id: edge.id(),
      label: graph.settings.weighted
        ? (graphEdge.weight ?? "1")
        : (graphEdge.label ?? ""),
      sourceX: source.x,
      sourceY: source.y,
      targetX: target.x,
      targetY: target.y,
      x: position.x,
      y: position.y,
    });
  });

  return hitboxes;
}

export function readInlineEditPosition(
  edit: InlineEditTarget,
  nodeHitboxes: NodeHitbox[],
  edgeLabelHitboxes: EdgeLabelHitbox[],
) {
  if (edit.kind === "node-label") {
    const node = nodeHitboxes.find((item) => item.id === edit.nodeId);

    return node ?? edit.fallbackPosition;
  }

  const edge = edgeLabelHitboxes.find((item) => item.id === edit.edgeId);

  return edge ?? edit.fallbackPosition;
}

export function readRenderedNodePosition(cy: Core | null, nodeId: NodeId) {
  if (!cy) {
    return null;
  }

  const node = cy.getElementById(nodeId);

  if (node.empty() || !node.isNode()) {
    return null;
  }

  const position = (node as NodeSingular).renderedPosition();

  return { x: position.x, y: position.y };
}

export function readRenderedEdgeLabelPosition(cy: Core | null, edgeId: EdgeId) {
  if (!cy) {
    return null;
  }

  const edge = cy.getElementById(edgeId);

  if (edge.empty() || !edge.isEdge()) {
    return null;
  }

  return readEdgeRenderedLabelPosition(edge as EdgeSingular);
}

function readEdgeRenderedLabelPosition(edge: EdgeSingular): RenderedPoint {
  const midpointProvider = edge as EdgeSingular & {
    renderedMidpoint?: () => Position;
  };
  const renderedMidpoint = midpointProvider.renderedMidpoint?.();

  if (
    renderedMidpoint &&
    Number.isFinite(renderedMidpoint.x) &&
    Number.isFinite(renderedMidpoint.y)
  ) {
    return renderedMidpoint;
  }

  const source = edge.source().renderedPosition();
  const target = edge.target().renderedPosition();

  if (source.x === target.x && source.y === target.y) {
    return { x: source.x + 36, y: source.y - 36 };
  }

  return midpoint(source, target);
}

export function edgeLabelHitboxWidth(label: string) {
  return clamp(label.length * 9 + 28, 44, 112);
}

function midpoint(a: RenderedPoint, b: RenderedPoint): RenderedPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
