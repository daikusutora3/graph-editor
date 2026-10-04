import type { Core, EdgeSingular } from "cytoscape";
import type { RangeSelectionFilter } from "../../features/graph-editor/canvas/range-selection-filter";
import type { RangeSelectionBox } from "../../features/graph-editor/canvas/range-selection-preview-geometry";

// Frozen containment implementation from graph-canvas-range-selection-preview.ts
// before endpoint early rejection. Shared by equivalence tests and benchmarks.
export function readRangeSelectionPreviewReference(
  cy: Pick<Core, "nodes" | "edges">,
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
      if (
        box.x1 <= nodeBox.x1 &&
        box.y1 <= nodeBox.y1 &&
        box.x2 >= nodeBox.x2 &&
        box.y2 >= nodeBox.y2
      )
        nodeIds.add(node.id());
    });
  if (filter !== "nodes")
    cy.edges().forEach((edge) => {
      if (edgeControlPathInBoxReference(box, edge)) edgeIds.add(edge.id());
    });
  return { nodeIds, edgeIds };
}

export function edgeControlPathInBoxReference(
  box: RangeSelectionBox,
  edge: Pick<
    EdgeSingular,
    | "renderedSourceEndpoint"
    | "renderedTargetEndpoint"
    | "renderedControlPoints"
    | "renderedSegmentPoints"
  >,
) {
  const read = (method: "renderedControlPoints" | "renderedSegmentPoints") => {
    try {
      const points = edge[method]();
      return Array.isArray(points) ? points : [];
    } catch {
      return [];
    }
  };
  const points = [
    edge.renderedSourceEndpoint(),
    edge.renderedTargetEndpoint(),
    ...read("renderedControlPoints"),
    ...read("renderedSegmentPoints"),
  ].filter(
    (point): point is { x: number; y: number } =>
      typeof point === "object" &&
      point !== null &&
      "x" in point &&
      "y" in point &&
      typeof point.x === "number" &&
      typeof point.y === "number" &&
      Number.isFinite(point.x) &&
      Number.isFinite(point.y),
  );
  return points.every(
    (point) =>
      point.x >= box.x1 &&
      point.x <= box.x2 &&
      point.y >= box.y1 &&
      point.y <= box.y2,
  );
}
