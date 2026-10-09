import {
  canRustCountCurveNodeCollisions,
  countRustCurveNodeCollisions,
} from "../../compute/wasm-routing";
import { getRustKernelReady } from "../../compute/rust-kernel";
import type { GraphEdge, GraphNode } from "../graph/model";
import { nodeGeometryWidth, NODE_SIZE_PX } from "../graph/node-size";
import {
  createCurveNodeDistance,
  type EdgeCurveGeometry,
} from "./edge-route-geometry";
import type { RoutingWork } from "./edge-routing-shared";

/** Dense curved routes benefit from numeric batching. A small deterministic
 * sample chooses only the backend; both implementations still check every
 * node with the same bounds, distance threshold, exclusion and work count. */
export function shouldUseRustCurveNodeCollisions(
  curve: EdgeCurveGeometry,
  source: GraphNode,
  target: GraphNode,
  nodes: GraphNode[],
) {
  if (!getRustKernelReady() || nodes.length < 32) return false;
  if (!canRustCountCurveNodeCollisions(curve, source, target)) return false;
  const controls = Math.min(
    curve.controlPointDistancesPx.length,
    curve.controlPointWeights.length,
  );
  if (controls === 0) return false;
  // Small straight scans are already only a few microseconds; keep them in JS
  // instead of adding Wasm transfer for an insignificant absolute saving.
  if (
    nodes.length < 256 &&
    curve.controlPointDistancesPx.every((distance) => distance === 0)
  )
    return false;
  const reach =
    Math.max(0, ...curve.controlPointDistancesPx.map(Math.abs)) + NODE_SIZE_PX;
  const x1 = Math.min(source.x, target.x) - reach;
  const x2 = Math.max(source.x, target.x) + reach;
  const y1 = Math.min(source.y, target.y) - reach;
  const y2 = Math.max(source.y, target.y) + reach;
  let inside = 0;
  for (let index = 0; index < 16; index++) {
    const node = nodes[Math.floor((index * nodes.length) / 16)]!;
    const halfWidth = nodeGeometryWidth(node) / 2;
    if (!(
      node.x + halfWidth < x1 ||
      node.x - halfWidth > x2 ||
      node.y < y1 ||
      node.y > y2
    ))
      inside++;
  }
  return inside >= 4;
}

export function countCurveNodeCollisions(
  curve: EdgeCurveGeometry,
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode,
  nodes: GraphNode[],
  work?: RoutingWork,
) {
  if (shouldUseRustCurveNodeCollisions(curve, source, target, nodes)) {
    const result = countRustCurveNodeCollisions(
      curve,
      source,
      target,
      edge,
      nodes,
    );
    if (result) {
      if (work) work.units += result.units;
      return result.collisions;
    }
  }
  return countCurveNodeCollisionsJs(curve, edge, source, target, nodes, work);
}

function countCurveNodeCollisionsJs(
  curve: EdgeCurveGeometry,
  edge: GraphEdge,
  source: GraphNode,
  target: GraphNode,
  nodes: GraphNode[],
  work?: RoutingWork,
) {
  const reach =
    Math.max(0, ...curve.controlPointDistancesPx.map(Math.abs)) + NODE_SIZE_PX;
  const x1 = Math.min(source.x, target.x) - reach;
  const x2 = Math.max(source.x, target.x) + reach;
  const y1 = Math.min(source.y, target.y) - reach;
  const y2 = Math.max(source.y, target.y) + reach;
  let count = 0;
  const distanceToNode = createCurveNodeDistance(source, target, curve);
  for (const node of nodes) {
    if (node.id === edge.source || node.id === edge.target) continue;
    const halfWidth = nodeGeometryWidth(node) / 2;
    if (
      node.x + halfWidth < x1 ||
      node.x - halfWidth > x2 ||
      node.y < y1 ||
      node.y > y2
    )
      continue;
    if (work) work.units += 1;
    if (distanceToNode(node) < NODE_SIZE_PX / 2 + 6) count++;
  }
  return count;
}
