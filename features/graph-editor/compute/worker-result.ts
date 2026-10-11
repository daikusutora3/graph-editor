import type { ComputeJob, ComputeValue } from "./worker-protocol";
import { isGraphCoordinate } from "../core/graph/graph-coordinates";

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

type CoordinateCheck = (value: unknown) => boolean;

function isPositionMap(value: unknown, coordinate: CoordinateCheck) {
  if (!isRecord(value)) return false;
  for (const point of Object.values(value))
    if (!isRecord(point) || !coordinate(point.x) || !coordinate(point.y))
      return false;
  return true;
}

function isCoordinateArray(
  value: unknown,
  coordinate: CoordinateCheck,
): value is number[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  // Iteration also rejects holes; Array.every() would silently skip them.
  for (const number of value) if (!coordinate(number)) return false;
  return true;
}

function isRoutingResult(value: unknown, coordinate: CoordinateCheck) {
  if (!(value instanceof Map)) return false;
  for (const [id, route] of value) {
    if (
      typeof id !== "string" ||
      !isRecord(route) ||
      !coordinate(route.bowPx) ||
      typeof route.duplicate !== "boolean" ||
      !coordinate(route.loopDirectionDeg) ||
      !coordinate(route.loopSweepDeg) ||
      (route.loopStepSizePx !== undefined &&
        !coordinate(route.loopStepSizePx)) ||
      !isCoordinateArray(route.controlPointDistancesPx, coordinate) ||
      !isCoordinateArray(route.controlPointWeights, coordinate) ||
      route.controlPointWeights.some((weight) => weight < 0 || weight > 1) ||
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
  return isResult(kind, value, isGraphCoordinate);
}

/** Distinguish finite domain overflow from malformed output/ABI faults. */
export function isComputeResultOutsideCoordinateRange(
  kind: ComputeJob["kind"],
  value: unknown,
) {
  return (
    !isComputeResult(kind, value) &&
    isResult(
      kind,
      value,
      (coordinate) =>
        typeof coordinate === "number" && Number.isFinite(coordinate),
    )
  );
}

function isResult(
  kind: ComputeJob["kind"],
  value: unknown,
  coordinate: CoordinateCheck,
) {
  if (kind === "routing") return isRoutingResult(value, coordinate);
  if (!isRecord(value)) return false;
  if (kind === "layout")
    return (
      value.type === "move-nodes" &&
      typeof value.label === "string" &&
      isPositionMap(value.after, coordinate)
    );
  return (
    (value.status === "unchanged" ||
      value.status === "resolved" ||
      value.status === "unresolved") &&
    typeof value.remainingPairs === "number" &&
    Number.isSafeInteger(value.remainingPairs) &&
    value.remainingPairs >= 0 &&
    isPositionMap(value.positions, coordinate)
  );
}
