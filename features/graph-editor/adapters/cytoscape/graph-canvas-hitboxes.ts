import type { Core, EdgeSingular, NodeSingular, Position } from "cytoscape";

import type { EdgeId, GraphModel, NodeId } from "../../core/graph/model";

import type { RenderedPoint } from "../../core/view/types";
import { normalizeLoopStepSize } from "../../core/layout/edge-routing-loops";
import type { InlineEditTarget } from "../../canvas/graph-canvas-types";
import { decodeCytoscapeId, getCytoscapeElement } from "./cytoscape-ids";

export type NodeHitbox = {
  id: NodeId;
  label: string;
  x: number;
  y: number;

  width: number;
};

export type EdgeLabelHitbox = {
  id: EdgeId;

  isLoop: boolean;
  label: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;

  sourceWidth: number;
  targetWidth: number;
  nodeHeight: number;
  x: number;
  y: number;

  labelWidth?: number;
  labelHeight?: number;
  bowPx: number;
  controlPointDistancesPx?: readonly number[];
  controlPointWeights?: readonly number[];
  loopDirectionDeg: number;
  loopSweepDeg: number;

  loopStepSizePx?: number;

  loopPoints?: readonly RenderedPoint[];
};

export const NODE_HITBOX_SIZE = 72;
const NODE_HITBOX_MARGIN = 12;
export const EDGE_LABEL_HITBOX_HEIGHT = 32;

export function readNodeHitboxes(
  cy: Core,
  graph: GraphModel,
  options?: { ids: ReadonlySet<NodeId>; labels: ReadonlyMap<NodeId, string> },
): NodeHitbox[] {
  const labels =
    options?.labels ??
    new Map(graph.nodes.map((node) => [node.id, node.label]));
  const nodes = options
    ? [...options.ids]
        .map((id) => getCytoscapeElement(cy, id))
        .filter((node) => node.isNode() && !node.removed())
    : cy.nodes();

  return nodes.map((node) => {
    const id = decodeCytoscapeId(node.id());
    const position = node.renderedPosition();

    return {
      id,
      label: labels.get(id) ?? id,
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
  options?: {
    ids: ReadonlySet<EdgeId>;
    edges: ReadonlyMap<EdgeId, GraphModel["edges"][number]>;
  },
): EdgeLabelHitbox[] {
  const edges =
    options?.edges ?? new Map(graph.edges.map((edge) => [edge.id, edge]));
  const collection = options
    ? [...options.ids]
        .map((id) => getCytoscapeElement(cy, id))
        .filter((edge) => edge.isEdge() && !edge.removed())
    : cy.edges();
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

  collection.forEach((edge) => {
    const id = decodeCytoscapeId(edge.id());
    const graphEdge = edges.get(id);

    if (!graphEdge) {
      return;
    }

    const position = readEdgeRenderedLabelPosition(edge);
    const label = edgeHitboxLabel(graphEdge, graph.settings.weighted);
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
      id,
      isLoop: graphEdge.source === graphEdge.target,
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

  const node = getCytoscapeElement(cy, nodeId);

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

  const edge = getCytoscapeElement(cy, edgeId);

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

  if (edge.isLoop()) {
    return { x: source.x + 36, y: source.y - 36 };
  }

  return midpoint(source, target);
}

export function edgeLabelHitboxWidth(label: string) {
  return Math.max(label.length * 9 + 28, 44);
}

export function edgeHitboxLabel(
  edge: GraphModel["edges"][number],
  weighted: boolean,
) {
  return edge.label ?? (weighted ? (edge.weight ?? "1") : "");
}

function midpoint(a: RenderedPoint, b: RenderedPoint): RenderedPoint {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}
