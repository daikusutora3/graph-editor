import {
  canRustBatchInteractiveReroutes,
  canRustSelectInteractiveRoute,
  createRustInteractiveRerouteBatch,
  type InteractiveRoutingCandidate,
} from "../../compute/wasm-interactive-routing";
import type {
  EdgeId,
  GraphEdge,
  GraphModel,
  GraphNode,
  NodeId,
} from "../graph/model";
import { nodeGeometryWidth, NODE_SIZE_PX } from "../graph/node-size";
import { createCurveNodeDistance } from "./edge-route-geometry";
import type { EdgeRoutingMeta } from "./edge-routing";

export function* interactiveRerouteEdgeIdsTask(
  model: GraphModel,
  previousMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
  movedNodeIds: ReadonlySet<NodeId>,
): Generator<void, Set<EdgeId> | null> {
  if (previousMeta.size === 0 || movedNodeIds.size === 0) {
    return null;
  }

  const nodesById = new Map(model.nodes.map((node) => [node.id, node]));
  const movedNodes: Array<GraphNode & { measuredWidth: number }> = [];
  for (const [index, node] of model.nodes.entries()) {
    if (index % 64 === 0) yield;
    if (movedNodeIds.has(node.id))
      movedNodes.push({ ...node, measuredWidth: nodeGeometryWidth(node) });
  }
  const reroute = new Set<EdgeId>();
  // A whole-graph drag marks every valid edge by endpoint membership; there is
  // no obstacle selection to accelerate and no reason to build Wasm buffers.
  let rustBatch: ReturnType<typeof createRustInteractiveRerouteBatch> = null;
  if (
    movedNodes.length !== model.nodes.length &&
    canRustBatchInteractiveReroutes(movedNodes.length, model.edges.length)
  ) {
    // Sampling selects the backend only. Every edge is still tested. Pending,
    // curved and endpoint-moved routes are already cheap; avoid array/buffer
    // construction when those dominate (e.g. beyond the quality size gate).
    let eligible = 0;
    for (let index = 0; index < 16; index++) {
      const edge = model.edges[Math.floor((index * model.edges.length) / 16)]!;
      const candidate = routeCandidate(
        edge,
        nodesById,
        previousMeta,
        movedNodeIds,
      );
      if (candidate && canRustSelectInteractiveRoute(candidate)) eligible++;
    }
    if (eligible >= 4)
      rustBatch = createRustInteractiveRerouteBatch(
        movedNodes,
        model.edges.length,
      );
  }

  if (rustBatch) {
    // Keep batches bounded so the Worker can receive cancellation between them.
    // Apply every decision in original edge order, including JS-only metadata.
    for (let start = 0; start < model.edges.length; start += 64) {
      const entries: {
        id: EdgeId;
        candidate: InteractiveRoutingCandidate | null;
        rustIndex: number;
      }[] = [];
      const candidates: InteractiveRoutingCandidate[] = [];
      for (const edge of model.edges.slice(start, start + 64)) {
        yield;
        const candidate = routeCandidate(
          edge,
          nodesById,
          previousMeta,
          movedNodeIds,
        );
        const rustIndex =
          candidate && canRustSelectInteractiveRoute(candidate)
            ? candidates.push(candidate) - 1
            : -1;
        entries.push({ id: edge.id, candidate, rustIndex });
      }
      const decisions = rustBatch(candidates);
      for (const { id, candidate, rustIndex } of entries) {
        if (!candidate) {
          reroute.add(id);
          continue;
        }
        const decision = rustIndex < 0 ? undefined : decisions?.[rustIndex];
        if (decision === 0) continue;
        if (
          decision === 1 ||
          (yield* routeNeedsObstacleReroute(candidate, movedNodes))
        )
          reroute.add(id);
      }
      yield;
    }
    return reroute;
  }

  for (const edge of model.edges) {
    yield;
    const candidate = routeCandidate(
      edge,
      nodesById,
      previousMeta,
      movedNodeIds,
    );
    if (
      !candidate ||
      (yield* routeNeedsObstacleReroute(candidate, movedNodes))
    ) {
      reroute.add(edge.id);
    }
  }

  return reroute;
}

function routeCandidate(
  edge: GraphEdge,
  nodesById: Map<NodeId, GraphNode>,
  previousMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
  movedNodeIds: ReadonlySet<NodeId>,
): InteractiveRoutingCandidate | null {
  const previous = previousMeta.get(edge.id);
  if (
    movedNodeIds.has(edge.source) ||
    movedNodeIds.has(edge.target) ||
    edge.source === edge.target ||
    previous?.status === "pending" ||
    previous?.status === "unresolved" ||
    (previous?.controlPointWeights.length ?? 0) > 1 ||
    (previous?.bowPx ?? 0) !== 0
  )
    return null;
  const source = nodesById.get(edge.source);
  const target = nodesById.get(edge.target);
  return source && target && previous
    ? { source, target, curve: previous }
    : null;
}

function* routeNeedsObstacleReroute(
  { source, target, curve }: InteractiveRoutingCandidate,
  movedNodes: Array<GraphNode & { measuredWidth: number }>,
): Generator<void, boolean> {
  const distanceToNode = createCurveNodeDistance(source, target, curve);
  // Straight single-control routes stay inside their endpoint box, so remote
  // capsules cannot affect the reroute decision. Other geometry stays exact.
  const isStraight =
    curve.controlPointDistancesPx.every((distance) => distance === 0) &&
    curve.controlPointWeights.every((weight) => weight >= 0 && weight <= 1);
  // The extra pixel includes the distance solver's subdivision tolerance;
  // translated drawings also need slack for floating-point cancellation.
  const margin =
    85 +
    Number.EPSILON *
      Math.max(
        1,
        Math.abs(source.x),
        Math.abs(source.y),
        Math.abs(target.x),
        Math.abs(target.y),
      ) *
      8;
  const x1 = Math.min(source.x, target.x) - margin;
  const x2 = Math.max(source.x, target.x) + margin;
  const y1 = Math.min(source.y, target.y) - margin;
  const y2 = Math.max(source.y, target.y) + margin;
  for (const [index, node] of movedNodes.entries()) {
    if (index % 64 === 0) yield;
    const span = Math.max(0, (node.measuredWidth - NODE_SIZE_PX) / 2);
    if (
      isStraight &&
      (node.x + span < x1 || node.x - span > x2 || node.y < y1 || node.y > y2)
    )
      continue;
    if (distanceToNode(node) < 84) {
      return true;
    }
  }
  return false;
}
