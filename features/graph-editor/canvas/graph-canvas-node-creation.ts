import { nanoid } from "nanoid";

import { graphViewportInsets } from "../adapters/cytoscape/graph-canvas-viewport";
import { addNodeCommand } from "../core/graph/graph-intents";
import { isGraphCoordinate } from "../core/graph/graph-coordinates";
import type { GraphIntent, GraphModel } from "../core/graph/model";
import {
  estimateNodeWidth,
  NODE_SIZE_PX,
  nodeGeometryWidth,
} from "../core/graph/node-size";
import type { GraphCanvasChrome } from "../core/view/types";
import type { CommandResult } from "../shell/state/history-atoms";

type Position = { x: number; y: number };
type NodeCreationViewport = {
  width: number;
  height: number;
  /** Camera pan in graph coordinates, including any renderer rebase. */
  pan: Position;
  zoom: number;
};
type NodeCreationMetrics = {
  nodeSize: number;
  newNodeWidth: number;
  actionHeight?: number;
  viewportInsets?: { top: number; bottom: number };
};

/** Use the same validated, undoable command for pointer and button placement. */
export function createGraphNodeAtPosition(
  executeCommand: (command: GraphIntent) => CommandResult,
  position: Position,
) {
  const id = nanoid();
  const result = executeCommand(addNodeCommand({ id, ...position }));
  return result.status === "applied"
    ? (result.graph.nodes.find((node) => node.id === id) ?? null)
    : null;
}

/**
 * Find a visible space close to the center, without moving the camera. Work
 * from the latest graph rather than the renderer, which may be one paint
 * behind when the user activates the button several times in succession.
 */
export function findNodeCreationPosition(
  graph: GraphModel,
  viewport: NodeCreationViewport,
  chrome: GraphCanvasChrome,
  metrics?: NodeCreationMetrics,
): Position | null {
  const { width, height, pan, zoom } = viewport;
  const nodeSize = metrics?.nodeSize ?? NODE_SIZE_PX;
  const actionHeight = metrics?.actionHeight ?? 44;
  const newNodeWidth = Math.max(
    nodeSize,
    metrics?.newNodeWidth ??
      (graph.settings.showNodeLabels
        ? estimateNodeWidth(
            String(graph.nodes.length + graph.settings.indexBase),
          )
        : nodeSize),
  );
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 2 ||
    height < 2 ||
    !Number.isFinite(zoom) ||
    zoom <= 0 ||
    !Number.isFinite(nodeSize) ||
    nodeSize <= 0 ||
    !Number.isFinite(newNodeWidth) ||
    !Number.isFinite(actionHeight) ||
    actionHeight < 0 ||
    !Number.isFinite(pan.x) ||
    !Number.isFinite(pan.y)
  )
    return null;

  const baseInsets = graphViewportInsets(viewport, chrome);
  const insets = {
    ...baseInsets,
    top: Math.max(baseInsets.top, metrics?.viewportInsets?.top ?? 0),
    // The mobile creation action sits above the bottom toolbar. Keep new
    // nodes above that extra row as the search expands away from center.
    bottom:
      Math.max(baseInsets.bottom, metrics?.viewportInsets?.bottom ?? 0) +
      (chrome.layout === "mobile" ? actionHeight + 12 : 0),
  };
  // The next automatic label is no longer than this count, even after
  // deletions. Reserve its pill width as well as a little visual clearance.
  const halfWidth = (newNodeWidth * zoom) / 2;
  const halfHeight = (nodeSize * zoom) / 2;
  const gap = 12;
  if (
    width - insets.left - insets.right < halfWidth * 2 + gap * 2 ||
    height - insets.top - insets.bottom < halfHeight * 2 + gap * 2
  )
    return null;
  const center = {
    x: (insets.left + width - insets.right) / 2,
    y: (insets.top + height - insets.bottom) / 2,
  };
  const bounds = {
    left: Math.min(center.x, insets.left + halfWidth + gap),
    right: Math.max(center.x, width - insets.right - halfWidth - gap),
    top: Math.min(center.y, insets.top + halfHeight + gap),
    bottom: Math.max(center.y, height - insets.bottom - halfHeight - gap),
  };
  const step = Math.max(72, halfWidth * 2 + gap);
  const candidates: Position[] = [];
  // Include half-step and edge-aligned positions: a short mobile view may
  // fit several rows even when no whole step fits on both sides of center.
  // Each axis has at most 65 samples, bounding the search to 4,225 points.
  for (const y of candidateAxis(center.y, bounds.top, bounds.bottom, step / 2))
    for (const x of candidateAxis(
      center.x,
      bounds.left,
      bounds.right,
      step / 2,
    ))
      candidates.push({ x, y });
  candidates.sort(
    (a, b) =>
      Math.hypot(a.x - center.x, a.y - center.y) -
      Math.hypot(b.x - center.x, b.y - center.y),
  );

  const nodes = graph.nodes.map((node) => ({
    x: node.x * zoom + pan.x,
    y: node.y * zoom + pan.y,
    halfWidth:
      (Math.max(
        nodeSize,
        graph.settings.showNodeLabels ? nodeGeometryWidth(node) : nodeSize,
      ) *
        zoom) /
      2,
  }));
  let fallback: Position | null = null;
  for (const candidate of candidates) {
    const position = {
      x: (candidate.x - pan.x) / zoom,
      y: (candidate.y - pan.y) / zoom,
    };
    if (!isGraphCoordinate(position.x) || !isGraphCoordinate(position.y))
      continue;
    fallback ??= position;
    if (
      nodes.every((node) => {
        // Both nodes are horizontal pills. The distance between their
        // center segments includes their round ends, unlike an axis-aligned
        // box test that rejects useful diagonal spaces on small screens.
        const dx = Math.max(
          0,
          Math.abs(candidate.x - node.x) -
            (halfWidth - halfHeight) -
            (node.halfWidth - halfHeight),
        );
        return Math.hypot(dx, candidate.y - node.y) >= halfHeight * 2 + gap;
      })
    )
      return position;
  }
  // A crowded canvas can still be edited; the existing overlap layout can
  // make more room. Never place an invisible node beyond coordinate limits.
  return fallback;
}

function candidateAxis(center: number, min: number, max: number, step: number) {
  const samples = new Set([center, min, max]);
  for (let index = 1; index <= 31; index += 1) {
    const before = center - index * step;
    const after = center + index * step;
    if (before < min && after > max) break;
    if (before >= min) samples.add(before);
    if (after <= max) samples.add(after);
  }
  return samples;
}
