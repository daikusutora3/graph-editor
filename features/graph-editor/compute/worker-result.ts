import type { ComputeJob, ComputeValue } from "./worker-protocol";

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositionMap(value: unknown) {
  if (!isRecord(value)) return false;
  for (const point of Object.values(value))
    if (
      !isRecord(point) ||
      !isFiniteNumber(point.x) ||
      !isFiniteNumber(point.y)
    )
      return false;
  return true;
}

function isFiniteArray(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  // Iteration also rejects holes; Array.every() would silently skip them.
  for (const number of value) if (!isFiniteNumber(number)) return false;
  return true;
}

function isRoutingResult(value: unknown) {
  if (!(value instanceof Map)) return false;
  for (const [id, route] of value) {
    if (
      typeof id !== "string" ||
      !isRecord(route) ||
      !isFiniteNumber(route.bowPx) ||
      typeof route.duplicate !== "boolean" ||
      !isFiniteNumber(route.loopDirectionDeg) ||
      !isFiniteNumber(route.loopSweepDeg) ||
      (route.loopStepSizePx !== undefined &&
        !isFiniteNumber(route.loopStepSizePx)) ||
      !isFiniteArray(route.controlPointDistancesPx) ||
      !isFiniteArray(route.controlPointWeights) ||
      route.controlPointDistancesPx.length !==
        route.controlPointWeights.length ||
      (route.status !== undefined &&
        route.status !== "ready" &&
        route.status !== "pending" &&
        route.status !== "unresolved")
    )
      return false;
  }
  return true;
}

/** Only results produced by the requested job may cross the Worker boundary. */
export function isComputeResult(
  kind: ComputeJob["kind"],
  value: unknown,
): value is ComputeValue {
  if (kind === "routing") return isRoutingResult(value);
  if (!isRecord(value)) return false;
  if (kind === "layout")
    return (
      value.type === "move-nodes" &&
      typeof value.label === "string" &&
      isPositionMap(value.after)
    );
  return (
    (value.status === "unchanged" ||
      value.status === "resolved" ||
      value.status === "unresolved") &&
    typeof value.remainingPairs === "number" &&
    Number.isSafeInteger(value.remainingPairs) &&
    value.remainingPairs >= 0 &&
    isPositionMap(value.positions)
  );
}
