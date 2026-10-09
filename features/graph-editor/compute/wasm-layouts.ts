import { getRustKernelReady, runRustKernel } from "./rust-kernel";

type Point = { x: number; y: number };

/** One call crosses the Wasm boundary for the complete numerical relaxation. */
export function tryRustForceLayout(
  positions: readonly Point[],
  edges: ReadonlyArray<readonly [number, number]>,
  collisionOffsets: readonly number[],
  ideal: number,
): Float64Array | null {
  if (!getRustKernelReady()) return null;
  const nodes = new Float64Array(positions.length * 3);
  positions.forEach((point, index) => {
    nodes[index * 3] = point.x;
    nodes[index * 3 + 1] = point.y;
    nodes[index * 3 + 2] = collisionOffsets[index]!;
  });
  const indices = new Float64Array(edges.length * 2);
  edges.forEach(([source, target], index) => {
    indices[index * 2] = source;
    indices[index * 2 + 1] = target;
  });
  return runRustKernel("force_layout", [nodes, indices], positions.length * 2, [
    positions.length,
    edges.length,
    ideal,
  ]);
}

export function tryRustNodeClearance(
  positions: readonly Point[],
  spans: readonly number[],
  required: number,
  maxRequiredSquared: number,
): number | null {
  if (!getRustKernelReady()) return null;
  const result = runRustKernel(
    "node_clearance",
    [packNodes(positions, spans)],
    1,
    [positions.length, required, maxRequiredSquared],
  );
  return result?.[0] ?? null;
}

export function tryRustOverlaps(
  positions: readonly Point[],
  spans: readonly number[],
  snap: boolean,
): {
  coordinates: Float64Array;
  remainingPairs: number;
  changed: boolean;
} | null {
  if (!getRustKernelReady()) return null;
  const result = runRustKernel(
    "resolve_overlaps",
    [packNodes(positions, spans)],
    positions.length * 2 + 2,
    [positions.length, Number(snap)],
  );
  if (!result) return null;
  return {
    coordinates: result,
    remainingPairs: result[positions.length * 2]!,
    changed: result[positions.length * 2 + 1] === 1,
  };
}

function packNodes(positions: readonly Point[], spans: readonly number[]) {
  const result = new Float64Array(positions.length * 3);
  positions.forEach((point, index) => {
    result[index * 3] = point.x;
    result[index * 3 + 1] = point.y;
    result[index * 3 + 2] = spans[index]!;
  });
  return result;
}
