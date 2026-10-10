/** Model coordinates and rendered curve offsets share this operating range.
 * At 1e9px, a double's spacing is below the resolver's 1e-5px clearance epsilon.
 * Bounded differences, squares and curve extrema also stay far from overflow.
 * Reject values outside the range; clamping would silently alter saved graphs.
 */
export const GRAPH_MAX_ABS_COORDINATE = 1_000_000_000;

export function isGraphCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= GRAPH_MAX_ABS_COORDINATE
  );
}

export function hasGraphCoordinatePositions(points: readonly unknown[]) {
  // Iteration also rejects sparse arrays received across the Worker boundary.
  for (const point of points) {
    if (!point || typeof point !== "object") return false;
    const position = point as { x?: unknown; y?: unknown };
    if (!isGraphCoordinate(position.x) || !isGraphCoordinate(position.y))
      return false;
  }
  return true;
}
