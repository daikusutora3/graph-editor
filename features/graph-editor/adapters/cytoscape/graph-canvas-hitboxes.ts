import type { Core, EdgeSingular, NodeSingular, Position } from "cytoscape";

import type { EdgeId, GraphModel, NodeId } from "../../core/graph/model";

import type { RenderedPoint } from "../../core/view/types";
import { normalizeLoopStepSize } from "../../core/layout/edge-routing-loops";
import type { InlineEditTarget } from "../../canvas/graph-canvas-types";

export type NodeHitbox = {
  id: NodeId;
  label: string;
  x: number;
  y: number;
  /** Rendered hit area width; grows with pill-shaped nodes. */
  width: number;
};

export type EdgeLabelHitbox = {
  id: EdgeId;
  label: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  /** Rendered outer sizes of the endpoints (pills are wider than tall). */
  sourceWidth: number;
  targetWidth: number;
  nodeHeight: number;
  x: number;
  y: number;
  /** Rendered label background bounds, with a minimum pointer target. */
  labelWidth?: number;
  labelHeight?: number;
  bowPx: number;
  controlPointDistancesPx?: readonly number[];
  controlPointWeights?: readonly number[];
  loopDirectionDeg: number;
  loopSweepDeg: number;
  /** Rendered fallback size; public renderer points take precedence. */
  loopStepSizePx?: number;
  /** Source, two controls, midpoint and target in rendered coordinates. */
  loopPoints?: readonly RenderedPoint[];
};

export const NODE_HITBOX_SIZE = 72;
const NODE_HITBOX_MARGIN = 12;
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
      width: Math.max(
        NODE_HITBOX_SIZE,
        node.renderedOuterWidth() + NODE_HITBOX_MARGIN * 2,
      ),
    };
  });
}

export function readEdgeLabelHitboxes(
  cy: Core,
  graph: GraphModel,
): EdgeLabelHitbox[] {
  const edges = new Map(graph.edges.map((edge) => [edge.id, edge]));
  const hitboxes: EdgeLabelHitbox[] = [];
  const zoom = cy.zoom();
  const nodeGeometry = new Map<
    string,
    {
      position: Position;
      width: number;
      height: number;
    }
  >();
  // Shared endpoints are read once per snapshot. This cache cannot outlive
  // the call, so dragging, zoom, label resizing and theme changes stay live.
  const geometryFor = (node: NodeSingular) => {
    const cached = nodeGeometry.get(node.id());
    if (cached) return cached;
    const geometry = {
      position: node.renderedPosition(),
      width: node.renderedOuterWidth(),
      height: node.renderedOuterHeight(),
    };
    nodeGeometry.set(node.id(), geometry);
    return geometry;
  };

  cy.edges().forEach((edge) => {
    const graphEdge = edges.get(edge.id());

    if (!graphEdge) {
      return;
    }

    const position = readEdgeRenderedLabelPosition(edge);
    const label =
      graphEdge.label ??
      (graph.settings.weighted ? (graphEdge.weight ?? "1") : "");
    const labelBounds = label
      ? edge.renderedBoundingBox({
          includeNodes: false,
          includeEdges: false,
          includeLabels: true,
          includeMainLabels: true,
          includeSourceLabels: false,
          includeTargetLabels: false,
          includeOverlays: false,
        })
      : null;
    const source = geometryFor(edge.source());
    const target = geometryFor(edge.target());

    hitboxes.push({
      id: edge.id(),
      label,
      sourceX: source.position.x,
      sourceY: source.position.y,
      targetX: target.position.x,
      targetY: target.position.y,
      sourceWidth: source.width,
      targetWidth: target.width,
      nodeHeight: source.height,
      x: position.x,
      y: position.y,
      labelWidth:
        labelBounds && Number.isFinite(labelBounds.w) && labelBounds.w > 0
          ? Math.max(44, labelBounds.w)
          : edgeLabelHitboxWidth(label),
      labelHeight:
        labelBounds && Number.isFinite(labelBounds.h) && labelBounds.h > 0
          ? Math.max(EDGE_LABEL_HITBOX_HEIGHT, labelBounds.h)
          : EDGE_LABEL_HITBOX_HEIGHT,
      bowPx: readNumericEdgeData(edge, "bow", 0),
      controlPointDistancesPx: readNumericArrayEdgeData(
        edge,
        "controlPointDistances",
        [readNumericEdgeData(edge, "bow", 0)],
      ).map((distance) => distance * zoom),
      controlPointWeights: readNumericArrayEdgeData(
        edge,
        "controlPointWeights",
        [0.5],
      ),
      loopDirectionDeg: readDegreeEdgeData(edge, "loopDirection", -45),
      loopSweepDeg: readDegreeEdgeData(edge, "loopSweep", 70),
      loopStepSizePx:
        normalizeLoopStepSize(readNumericEdgeData(edge, "loopStepSize", 40)) *
        zoom,
      loopPoints:
        graphEdge.source === graphEdge.target
          ? readRenderedLoopPoints(edge)
          : undefined,
    });
  });

  return hitboxes;
}

function readRenderedLoopPoints(edge: EdgeSingular) {
  const controls = edge.renderedControlPoints?.();
  if (controls?.length !== 2) return undefined;
  const start = edge.renderedSourceEndpoint?.();
  const end = edge.renderedTargetEndpoint?.();
  const loopMidpoint = edge.renderedMidpoint?.();
  const points = [start, controls[0], loopMidpoint, controls[1], end];
  if (
    !points.every(
      (point): point is RenderedPoint =>
        point !== undefined &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y),
    )
  )
    return undefined;
  return points;
}

function readNumericArrayEdgeData(
  edge: EdgeSingular,
  key: string,
  fallback: readonly number[],
) {
  const value = edge.data(key);

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => typeof item === "number" && Number.isFinite(item))
  ) {
    return value as number[];
  }

  return [...fallback];
}

function readNumericEdgeData(
  edge: EdgeSingular,
  key: string,
  fallback: number,
) {
  const value = Number(edge.data(key));

  return Number.isFinite(value) ? value : fallback;
}

function readDegreeEdgeData(edge: EdgeSingular, key: string, fallback: number) {
  const value = edge.data(key);

  if (typeof value === "string" && value.endsWith("deg")) {
    const numeric = Number(value.slice(0, -3));
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
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
  return Math.max(label.length * 9 + 28, 44);
}

function midpoint(a: RenderedPoint, b: RenderedPoint): RenderedPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}
