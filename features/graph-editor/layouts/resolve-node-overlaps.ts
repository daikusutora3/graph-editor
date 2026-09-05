import type { GraphModel, NodePositionMap } from "../core/graph/model";
import { NODE_SIZE_PX, nodeGeometryWidth } from "../core/graph/node-size";

export const OVERLAP_GAP_PX = 12;
export type OverlapResult = {
  positions: NodePositionMap;
  status: "unchanged" | "resolved" | "unresolved";
  remainingPairs: number;
};

/** Exact distance between the horizontal center segments of two stadiums. */
export function resolveNodeOverlaps(model: GraphModel): OverlapResult {
  const nodes = model.nodes.toSorted(
    (a, b) => a.order - b.order || a.id.localeCompare(b.id),
  );
  const positions = Object.fromEntries(
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
  const scan = (move: boolean) => {
    let remaining = 0;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = positions[nodes[i]!.id]!;
        const b = positions[nodes[j]!.id]!;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const gapX = Math.max(0, Math.abs(dx) - spans[i]! - spans[j]!);
        if (gapX >= required || Math.abs(dy) >= required) continue;
        const distance = Math.hypot(gapX, dy);
        if (distance >= required - 0.00001) continue;
        remaining++;
        if (!move) continue;
        // Overlapping center segments separate vertically; disjoint segments use their closest points.
        const ux = distance > 0.00001 ? (Math.sign(dx) * gapX) / distance : 0;
        const uy = distance > 0.00001 ? dy / distance : (i + j) % 2 ? 1 : -1;
        const push = (required - distance + 0.001) / 2;
        let mx = ux * push,
          my = uy * push;
        if (model.settings.snapToGrid) {
          // Outward grid steps cannot round a separating displacement back to zero.
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
  };
  for (let step = 0; step < 128; step++) if (scan(true) === 0) break;
  // Dense clusters can converge slowly under symmetric relaxation. Finish only
  // residual collisions in stable order, moving the later node monotonically.
  // Each jump passes an earlier capsule, so at most N jumps are needed per node.
  if (scan(false) > 0) {
    for (let j = 1; j < nodes.length; j++) {
      const b = positions[nodes[j]!.id]!;
      for (let pass = 0; pass < nodes.length; pass++) {
        let moved = false;
        for (let i = 0; i < j; i++) {
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
  const remainingPairs = scan(false);
  return {
    positions,
    remainingPairs,
    status: remainingPairs ? "unresolved" : changed ? "resolved" : "unchanged",
  };
}
