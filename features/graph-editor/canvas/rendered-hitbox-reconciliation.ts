import type {
  EdgeLabelHitbox,
  NodeHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";

// Preserve unchanged entries as well as the whole array. Individual hitbox
// components can then skip rendering when another node or edge moves.
export function reconcileNodeHitboxes(
  current: NodeHitbox[],
  next: NodeHitbox[],
) {
  return reconcileHitboxes(current, next, sameNodeHitbox);
}

export function reconcileEdgeLabelHitboxes(
  current: EdgeLabelHitbox[],
  next: EdgeLabelHitbox[],
) {
  return reconcileHitboxes(current, next, sameEdgeLabelHitbox);
}

function reconcileHitboxes<T extends { id: string }>(
  current: T[],
  next: T[],
  same: (a: T, b: T) => boolean,
) {
  let changed = current.length !== next.length;
  let currentById: Map<string, T> | undefined;
  const reconciled = next.map((item, index) => {
    let previous: T | undefined = current[index];
    if (previous?.id !== item.id) {
      currentById ??= new Map(current.map((hitbox) => [hitbox.id, hitbox]));
      previous = currentById.get(item.id);
      changed = true;
    }
    if (previous && same(previous, item)) return previous;
    changed = true;
    return item;
  });
  return changed ? reconciled : current;
}

function sameNodeHitbox(a: NodeHitbox, b: NodeHitbox) {
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width
  );
}

function sameEdgeLabelHitbox(a: EdgeLabelHitbox, b: EdgeLabelHitbox) {
  return (
    a.id === b.id &&
    a.label === b.label &&
    a.sourceX === b.sourceX &&
    a.sourceY === b.sourceY &&
    a.targetX === b.targetX &&
    a.targetY === b.targetY &&
    a.sourceWidth === b.sourceWidth &&
    a.targetWidth === b.targetWidth &&
    a.nodeHeight === b.nodeHeight &&
    a.x === b.x &&
    a.y === b.y &&
    a.bowPx === b.bowPx &&
    a.loopDirectionDeg === b.loopDirectionDeg &&
    a.loopSweepDeg === b.loopSweepDeg &&
    sameNumbers(a.controlPointDistancesPx, b.controlPointDistancesPx) &&
    sameNumbers(a.controlPointWeights, b.controlPointWeights)
  );
}

function sameNumbers(
  a: readonly number[] | undefined,
  b: readonly number[] | undefined,
) {
  return (
    a === b ||
    (a !== undefined &&
      b !== undefined &&
      a.length === b.length &&
      a.every((value, index) => value === b[index]))
  );
}
