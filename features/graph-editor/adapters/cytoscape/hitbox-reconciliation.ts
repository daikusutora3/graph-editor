import type { EdgeLabelHitbox, NodeHitbox } from "./graph-canvas-hitboxes";

export function createNodeHitboxSnapshot() {
  return createHitboxSnapshot(sameNodeHitbox);
}

export function createEdgeLabelHitboxSnapshot() {
  return createHitboxSnapshot(sameEdgeLabelHitbox);
}

// A full read establishes order and the index. Local geometry invalidations
// then compare only their replacements and copy the array only if needed.
function createHitboxSnapshot<T extends { id: string }>(
  same: (a: T, b: T) => boolean,
) {
  let snapshot: T[] = [];
  let indexes = new Map<string, number>();
  return {
    reset(next: T[]) {
      snapshot = reconcileHitboxes(snapshot, next, same);
      indexes = new Map(snapshot.map((entry, index) => [entry.id, index]));
      return snapshot;
    },
    replace(replacements: T[]) {
      let next = snapshot;
      for (const replacement of replacements) {
        const index = indexes.get(replacement.id);
        if (index === undefined) continue;
        const previous = snapshot[index]!;
        if (previous === replacement || same(previous, replacement)) continue;
        if (next === snapshot) next = snapshot.slice();
        next[index] = replacement;
      }
      snapshot = next;
      return snapshot;
    },
  };
}

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
  if (current === next) return current;
  let changed = current.length !== next.length;
  let currentById: Map<string, T> | undefined;
  const reconciled = next.map((item, index) => {
    let previous: T | undefined = current[index];
    if (previous?.id !== item.id) {
      currentById ??= new Map(current.map((hitbox) => [hitbox.id, hitbox]));
      previous = currentById.get(item.id);
      changed = true;
    }
    if (previous && (previous === item || same(previous, item)))
      return previous;
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
    a.labelWidth === b.labelWidth &&
    a.labelHeight === b.labelHeight &&
    a.loopDirectionDeg === b.loopDirectionDeg &&
    a.loopSweepDeg === b.loopSweepDeg &&
    a.loopStepSizePx === b.loopStepSizePx &&
    samePoints(a.loopPoints, b.loopPoints) &&
    sameNumbers(a.controlPointDistancesPx, b.controlPointDistancesPx) &&
    sameNumbers(a.controlPointWeights, b.controlPointWeights)
  );
}

function samePoints(
  a: EdgeLabelHitbox["loopPoints"],
  b: EdgeLabelHitbox["loopPoints"],
) {
  return (
    a === b ||
    (a !== undefined &&
      b !== undefined &&
      a.length === b.length &&
      a.every(
        (point, index) => point.x === b[index]!.x && point.y === b[index]!.y,
      ))
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
