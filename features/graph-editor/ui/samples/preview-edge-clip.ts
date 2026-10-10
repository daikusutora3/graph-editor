import type {
  EdgeCurvePoint,
  QuadraticCurveSegment,
} from "../../core/layout/edge-route-geometry";

type PreviewTargetPill = {
  centre: EdgeCurvePoint;
  width: number;
  height: number;
};

/** Cut at the last entry into the target without changing the original curve. */
export function clipPreviewEdgeAtTarget(
  segments: readonly QuadraticCurveSegment[],
  target: PreviewTargetPill,
): readonly QuadraticCurveSegment[] {
  const radius = Math.min(target.width, target.height) / 2;
  const spanX = Math.max(0, target.width / 2 - radius);
  const spanY = Math.max(0, target.height / 2 - radius);
  const inside = (point: EdgeCurvePoint) => {
    const dx = Math.max(0, Math.abs(point.x - target.centre.x) - spanX);
    const dy = Math.max(0, Math.abs(point.y - target.centre.y) - spanY);
    return dx * dx + dy * dy <= radius * radius;
  };
  // The final endpoint is the target centre. Search backward so a curve that
  // leaves and reenters the pill keeps its final visible approach to the node.
  for (let index = segments.length - 1; index >= 0; index--) {
    const segment = segments[index];
    let high = 1;
    for (let sample = 31; sample >= 0; sample--) {
      let low = sample / 32;
      if (inside(quadraticPoint(segment, low))) {
        high = low;
        continue;
      }
      for (let step = 0; step < 24; step++) {
        const middle = (low + high) / 2;
        if (inside(quadraticPoint(segment, middle))) high = middle;
        else low = middle;
      }
      const a = interpolate(segment.start, segment.control, high);
      const b = interpolate(segment.control, segment.end, high);
      return [
        ...segments.slice(0, index),
        { start: segment.start, control: a, end: interpolate(a, b, high) },
      ];
    }
  }
  // A short straight edge can be entirely covered by overlapping nodes. Keep
  // it beneath the node instead of inventing an outward or reversed segment.
  return segments;
}

function quadraticPoint(segment: QuadraticCurveSegment, parameter: number) {
  const inverse = 1 - parameter;
  return {
    x:
      inverse * inverse * segment.start.x +
      2 * inverse * parameter * segment.control.x +
      parameter * parameter * segment.end.x,
    y:
      inverse * inverse * segment.start.y +
      2 * inverse * parameter * segment.control.y +
      parameter * parameter * segment.end.y,
  };
}

function interpolate(a: EdgeCurvePoint, b: EdgeCurvePoint, parameter: number) {
  return {
    x: a.x + (b.x - a.x) * parameter,
    y: a.y + (b.y - a.y) * parameter,
  };
}
