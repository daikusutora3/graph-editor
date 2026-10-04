import type { Core, EdgeSingular } from "cytoscape";

import type { RangeSelectionFilter } from "./range-selection-filter";

type RenderedPoint = { x: number; y: number };

export type RangeSelectionBox = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type RangeSelectionViewport = {
  zoom: number;
  pan: RenderedPoint;
};

export function readRangeSelectionPreview(
  cy: Pick<Core, "nodes" | "edges" | "zoom" | "pan">,
  box: RangeSelectionBox,
  filter: RangeSelectionFilter,
) {
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  if (filter !== "edges")
    cy.nodes().forEach((node) => {
      const nodeBox = node.renderedBoundingBox({
        includeNodes: true,
        includeEdges: false,
        includeLabels: false,
        includeOverlays: false,
        includeUnderlays: false,
      });

      if (boxContains(box, nodeBox)) nodeIds.add(node.id());
    });

  if (filter !== "nodes") {
    const pan = cy.pan();
    const viewport = { zoom: cy.zoom(), pan: { x: pan.x, y: pan.y } };
    cy.edges().forEach((edge) => {
      if (edgeControlPathInBox(box, edge, viewport)) edgeIds.add(edge.id());
    });
  }

  return { nodeIds, edgeIds };
}

function boxContains(a: RangeSelectionBox, b: RangeSelectionBox) {
  return a.x1 <= b.x1 && a.y1 <= b.y1 && a.x2 >= b.x2 && a.y2 >= b.y2;
}

export function edgeControlPathInBox(
  box: RangeSelectionBox,
  edge: Pick<
    EdgeSingular,
    | "renderedSourceEndpoint"
    | "renderedTargetEndpoint"
    | "controlPoints"
    | "segmentPoints"
  >,
  viewport: RangeSelectionViewport = { zoom: 1, pan: { x: 0, y: 0 } },
) {
  // Most edges are outside a small selection box. Reject their endpoints
  // before asking Cytoscape for control points or allocating point arrays.
  const source = edge.renderedSourceEndpoint();
  if (isRenderedPoint(source) && !pointInBox(box, source)) return false;
  const target = edge.renderedTargetEndpoint();
  if (isRenderedPoint(target) && !pointInBox(box, target)) return false;

  for (const method of ["controlPoints", "segmentPoints"] as const) {
    for (const point of readRenderedEdgePoints(edge, method, viewport)) {
      if (isRenderedPoint(point) && !pointInBox(box, point)) return false;
    }
  }
  // Non-finite points were ignored by the previous containment check. An
  // edge with no finite points still satisfies that vacuous check.
  return true;
}

function readRenderedEdgePoints(
  edge: Pick<EdgeSingular, "controlPoints" | "segmentPoints">,
  method: "controlPoints" | "segmentPoints",
  viewport: RangeSelectionViewport,
) {
  try {
    const points = edge[method]();
    // Cytoscape's rendered plural getters call .map even when their model
    // getter returns undefined (e.g. segmentPoints on a bezier edge). Guard
    // that case, then retain its exact coordinate transformation before
    // filtering finite points. A malformed point still invalidates the whole
    // getter, and sparse arrays keep their holes, just as in the original.
    return Array.isArray(points)
      ? points.map((point) => ({
          x: point.x * viewport.zoom + viewport.pan.x,
          y: point.y * viewport.zoom + viewport.pan.y,
        }))
      : [];
  } catch {
    return [];
  }
}

function isRenderedPoint(point: unknown): point is RenderedPoint {
  return (
    typeof point === "object" &&
    point !== null &&
    "x" in point &&
    "y" in point &&
    typeof point.x === "number" &&
    typeof point.y === "number" &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y)
  );
}

function pointInBox(box: RangeSelectionBox, point: RenderedPoint) {
  return (
    point.x >= box.x1 &&
    point.x <= box.x2 &&
    point.y >= box.y1 &&
    point.y <= box.y2
  );
}
