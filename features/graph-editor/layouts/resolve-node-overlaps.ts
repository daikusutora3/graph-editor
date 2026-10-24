import type { GraphModel, NodePositionMap } from "../core/graph/model";
import {
  GRAPH_MAX_ABS_COORDINATE,
  isGraphCoordinate,
} from "../core/graph/graph-coordinates";
import { NODE_SIZE_PX, nodeGeometryWidth } from "../core/graph/node-size";
import { tryRustOverlaps } from "../compute/wasm-layouts";

export const OVERLAP_GAP_PX = 12;
export type OverlapResult = {
  positions: NodePositionMap;
  status: "unchanged" | "resolved" | "unresolved";
  remainingPairs: number;
};

export function resolveNodeOverlaps(model: GraphModel): OverlapResult {
  const task = createOverlapTask(model);
  let step = task.next();
  while (!step.done) step = task.next();
  return step.value;
}

export function* createOverlapTask(
  model: GraphModel,
): Generator<void, OverlapResult> {
  const nodes = model.nodes.toSorted(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  let positions = Object.fromEntries(
    nodes.map((node) => [node.id, { x: node.x, y: node.y }]),
  );
  const spans = nodes.map((node) =>
    Math.max(
      0,
      (nodeGeometryWidth({
        ...node,
        label: model.settings.showNodeLabels ? node.label : "",
      }) -
        NODE_SIZE_PX) /
        2,
    ),
  );
  const required = NODE_SIZE_PX + OVERLAP_GAP_PX;
  let changed = false;
  yield;
  const rustResult = tryRustOverlaps(nodes, spans, model.settings.snapToGrid);
  if (rustResult) {
    for (const [index, node] of nodes.entries()) {
      positions[node.id] = {
        x: rustResult.coordinates[index * 2]!,
        y: rustResult.coordinates[index * 2 + 1]!,
      };
    }
    return yield* finish(rustResult.remainingPairs, rustResult.changed);
  }
  function* scan(move: boolean, limit = Infinity): Generator<void, number> {
    let remaining = 0;
    if (!move) {
      const verticalOrder = nodes
        .map((node, index) => ({ index, point: positions[node.id]! }))
        .sort((a, b) => a.point.y - b.point.y);
      for (let i = 0; i < verticalOrder.length; i++) {
        yield;
        const a = verticalOrder[i]!;
        for (let j = i + 1; j < verticalOrder.length; j++) {
          const b = verticalOrder[j]!;
          const dy = b.point.y - a.point.y;
          if (dy >= required) break;
          if (j % 64 === 0) yield;
          const first = Math.min(a.index, b.index);
          const second = Math.max(a.index, b.index);
          const gapX = Math.max(
            0,
            Math.abs(b.point.x - a.point.x) - spans[first]! - spans[second]!,
          );
          if (gapX >= required) continue;
          if (Math.hypot(gapX, dy) >= required - 0.00001) continue;
          remaining++;
          if (remaining >= limit) return remaining;
        }
      }
      return remaining;
    }
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        if (j % 64 === 0) yield;
        const a = positions[nodes[i]!.id]!;
        const b = positions[nodes[j]!.id]!;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const gapX = Math.max(0, Math.abs(dx) - spans[i]! - spans[j]!);
        if (gapX >= required || Math.abs(dy) >= required) continue;
        const distance = Math.hypot(gapX, dy);
        if (distance >= required - 0.00001) continue;
        remaining++;

        const ux = distance > 0.00001 ? (Math.sign(dx) * gapX) / distance : 0;
        const uy = distance > 0.00001 ? dy / distance : (i + j) % 2 ? 1 : -1;
        const push = (required - distance + 0.001) / 2;
        let mx = ux * push,
          my = uy * push;
        if (model.settings.snapToGrid) {
          mx = Math.sign(mx) * Math.ceil(Math.abs(mx) / 24) * 24;
          my = Math.sign(my) * Math.ceil(Math.abs(my) / 24) * 24;
        }
        a.x -= mx;
        a.y -= my;
        b.x += mx;
        b.y += my;
        if (model.settings.snapToGrid) {
          for (const point of [a, b]) {
            point.x = Math.round(point.x / 24) * 24;
            point.y = Math.round(point.y / 24) * 24;
          }
        }
        changed = true;
      }
    return remaining;
  }
  function* finish(
    remainingPairs: number,
    moved: boolean,
  ): Generator<void, OverlapResult> {
    if (!translateIntoCoordinateRange(positions, model.settings.snapToGrid)) {
      positions = Object.fromEntries(
        nodes.map((node) => [node.id, { x: node.x, y: node.y }]),
      );
      return {
        positions,
        remainingPairs: yield* scan(false),
        status: "unresolved",
      };
    }
    return {
      positions,
      remainingPairs,
      status: remainingPairs ? "unresolved" : moved ? "resolved" : "unchanged",
    };
  }

  if ((yield* scan(false, 1)) === 0) {
    return { positions, remainingPairs: 0, status: "unchanged" };
  }
  for (let step = 0; step < 128; step++) if ((yield* scan(true)) === 0) break;

  if ((yield* scan(false)) > 0) {
    for (let j = 1; j < nodes.length; j++) {
      const b = positions[nodes[j]!.id]!;
      for (let pass = 0; pass < nodes.length; pass++) {
        let moved = false;
        for (let i = 0; i < j; i++) {
          if (i % 64 === 0) yield;
          const a = positions[nodes[i]!.id]!;
          const gapX = Math.max(0, Math.abs(b.x - a.x) - spans[i]! - spans[j]!);
          if (Math.hypot(gapX, b.y - a.y) >= required - 0.00001) continue;
          b.y = a.y + Math.sqrt(required * required - gapX * gapX) + 0.001;
          if (model.settings.snapToGrid) b.y = Math.ceil(b.y / 24) * 24;
          moved = true;
          changed = true;
        }
        if (!moved) break;
      }
    }
  }
  const remainingPairs = yield* scan(false);
  return yield* finish(remainingPairs, changed);
}

function translateIntoCoordinateRange(
  positions: NodePositionMap,
  snap: boolean,
) {
  const points = Object.values(positions);
  if (
    points.every(
      (point) => isGraphCoordinate(point.x) && isGraphCoordinate(point.y),
    )
  )
    return true;
  const offset = (axis: "x" | "y") => {
    const values = points.map((point) => point[axis]);
    if (!values.every(Number.isFinite)) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const step = snap ? 24 : 1;
    const lower = snap
      ? Math.ceil((-GRAPH_MAX_ABS_COORDINATE - min) / step) * step
      : -GRAPH_MAX_ABS_COORDINATE - min;
    const upper = snap
      ? Math.floor((GRAPH_MAX_ABS_COORDINATE - max) / step) * step
      : GRAPH_MAX_ABS_COORDINATE - max;
    if (lower > upper) return null;
    return lower > 0 ? lower : upper < 0 ? upper : 0;
  };
  const dx = offset("x"),
    dy = offset("y");
  if (dx === null || dy === null) return false;
  for (const point of points) {
    point.x += dx;
    point.y += dy;
  }
  return points.every(
    (point) => isGraphCoordinate(point.x) && isGraphCoordinate(point.y),
  );
}
