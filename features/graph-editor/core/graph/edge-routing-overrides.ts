import type { EdgeRoutingOverride } from "./model";

const MAX_BOW_PX = 180;
const MAX_ROUTING_LOOP_DIRECTION_DEG = 360;
const MIN_ROUTING_LOOP_SWEEP_DEG = 20;
const MAX_ROUTING_LOOP_SWEEP_DEG = 180;

export function normalizeEdgeRoutingOverride(
  value: unknown,
): EdgeRoutingOverride | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const routing: EdgeRoutingOverride = {};
  const bowPx = finiteNumber(value.bowPx);
  const loopDirectionDeg = finiteNumber(value.loopDirectionDeg);
  const loopSweepDeg = finiteNumber(value.loopSweepDeg);

  if (bowPx != null) {
    routing.bowPx = clamp(bowPx, -MAX_BOW_PX, MAX_BOW_PX);
  }

  if (loopDirectionDeg != null) {
    routing.loopDirectionDeg = clamp(
      loopDirectionDeg,
      -MAX_ROUTING_LOOP_DIRECTION_DEG,
      MAX_ROUTING_LOOP_DIRECTION_DEG,
    );
  }

  if (loopSweepDeg != null) {
    routing.loopSweepDeg = clamp(
      loopSweepDeg,
      MIN_ROUTING_LOOP_SWEEP_DEG,
      MAX_ROUTING_LOOP_SWEEP_DEG,
    );
  }

  return Object.keys(routing).length > 0 ? routing : undefined;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
