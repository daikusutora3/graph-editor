export const GRAPH_MAX_ABS_COORDINATE = 1_000_000_000;

export function isGraphCoordinate(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    Math.abs(value) <= GRAPH_MAX_ABS_COORDINATE
  );
}

export function hasGraphCoordinatePositions(points: readonly unknown[]) {
  for (const point of points) {
    if (!point || typeof point !== "object") return false;
    const position = point as { x?: unknown; y?: unknown };
    if (!isGraphCoordinate(position.x) || !isGraphCoordinate(position.y))
      return false;
  }
  return true;
}
