import type { EdgeRoutingMeta } from "../core/layout/edge-routing";

export type RoutingDelta = Map<string, EdgeRoutingMeta | null>;

/** Null retains a route from this request's baseline, preserving result order. */
export function createRoutingDelta(
  result: Map<string, EdgeRoutingMeta>,
  previous: ReadonlyMap<string, EdgeRoutingMeta>,
): RoutingDelta | null {
  const delta: RoutingDelta = new Map();
  let retained = 0;
  for (const [id, meta] of result) {
    const unchanged = meta === previous.get(id);
    if (unchanged) retained++;
    delta.set(id, unchanged ? null : meta);
  }
  // A full result is cheaper when most routes changed. No cross-job state.
  return retained > result.size / 2 ? delta : null;
}

export function restoreRoutingDelta(
  delta: RoutingDelta,
  previous: ReadonlyMap<string, EdgeRoutingMeta>,
) {
  const result = new Map<string, EdgeRoutingMeta>();
  for (const [id, meta] of delta) {
    const value = meta === null ? previous.get(id) : meta;
    if (!value) throw new Error("Routing response has no matching baseline");
    result.set(id, value);
  }
  return result;
}
