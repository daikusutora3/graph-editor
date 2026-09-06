import { MAX_BOW_PX } from "../graph/edge-routing-overrides";
import type { EdgeRoutingOverride, GraphNode } from "../graph/model";
import { nodeGeometryWidth, NODE_SIZE_PX } from "../graph/node-size";

export type EdgeCurveGeometry = {
  controlPointDistancesPx: readonly number[];
  controlPointWeights: readonly number[];
};

export type EdgeCurvePoint = {
  x: number;
  y: number;
};

export type QuadraticCurveSegment = {
  start: EdgeCurvePoint;
  control: EdgeCurvePoint;
  end: EdgeCurvePoint;
};

/** Manual and automatic bends share these limits so every curve is draggable. */
export { MAX_BOW_PX } from "../graph/edge-routing-overrides";
const MIN_BOW_WEIGHT = 0.05;
const MAX_BOW_WEIGHT = 0.95;

/**
 * Finds the single quadratic control point, placed straight above `point` in
 * the chord frame, so that the curve p0 → control → p2 passes through `point`.
 * With B(u) = (1-u)²p0 + 2u(1-u)C + u²p2 the along-axis equation
 * u²(1-2w) + 2uw - w = 0 gives the parameter u under the point, and the
 * offset there is 2u(1-u)·d, hence d = perpendicular / (2u(1-u)).
 */
export function quadraticControlThroughPoint(
  p0: EdgeCurvePoint,
  p2: EdgeCurvePoint,
  point: EdgeCurvePoint,
): EdgeCurvePoint {
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const length = Math.hypot(dx, dy) || 1;
  const px = point.x - p0.x;
  const py = point.y - p0.y;
  const along = (px * dx + py * dy) / length;
  const perpendicular = (px * -dy + py * dx) / length;
  const weight = clampWeight(along / length);
  const u =
    Math.abs(1 - 2 * weight) < 1e-6
      ? 0.5
      : (-weight + Math.sqrt(weight - weight * weight)) / (1 - 2 * weight);
  const distance = perpendicular / (2 * u * (1 - u));

  return {
    x: p0.x + (dx / length) * weight * length + (-dy / length) * distance,
    y: p0.y + (dy / length) * weight * length + (dx / length) * distance,
  };
}

/** Expresses an absolute control point as (distance, weight) on the p0 → p2 chord. */
export function curveFromControlPoint(
  p0: EdgeCurvePoint,
  p2: EdgeCurvePoint,
  control: EdgeCurvePoint,
  { limitBow = true }: { limitBow?: boolean } = {},
): EdgeCurveGeometry {
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const length = Math.hypot(dx, dy) || 1;
  const cx = control.x - p0.x;
  const cy = control.y - p0.y;
  const distance = (cx * -dy + cy * dx) / length;

  return {
    controlPointDistancesPx: [limitBow ? clampBow(distance) : distance],
    controlPointWeights: [clampWeight((cx * dx + cy * dy) / (length * length))],
  };
}

/** Single-control curve through a point given by chord weight and offset. */
export function curveThroughChordOffset(
  p0: EdgeCurvePoint,
  p2: EdgeCurvePoint,
  weight: number,
  offsetPx: number,
): EdgeCurveGeometry {
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const length = Math.hypot(dx, dy) || 1;
  const point = {
    x: p0.x + dx * weight + (-dy / length) * offsetPx,
    y: p0.y + dy * weight + (dx / length) * offsetPx,
  };

  return curveFromControlPoint(
    p0,
    p2,
    quadraticControlThroughPoint(p0, p2, point),
  );
}

export function clampBow(bowPx: number) {
  return Math.max(-MAX_BOW_PX, Math.min(MAX_BOW_PX, bowPx));
}

function clampWeight(weight: number) {
  return Math.max(MIN_BOW_WEIGHT, Math.min(MAX_BOW_WEIGHT, weight));
}

export function singleBowCurve(bowPx: number, weight = 0.5): EdgeCurveGeometry {
  return {
    controlPointDistancesPx: [bowPx],
    controlPointWeights: [weight],
  };
}

export function reverseEdgeCurve(curve: EdgeCurveGeometry): EdgeCurveGeometry {
  return {
    controlPointDistancesPx: [...curve.controlPointDistancesPx]
      .reverse()
      .map((distance) => -distance),
    controlPointWeights: [...curve.controlPointWeights]
      .reverse()
      .map((weight) => 1 - weight),
  };
}

export function offsetEdgeCurve(
  curve: EdgeCurveGeometry,
  offsetPx: number,
): EdgeCurveGeometry {
  if (offsetPx === 0) {
    return curve;
  }

  return {
    ...curve,
    controlPointDistancesPx: curve.controlPointDistancesPx.map(
      (distance) => distance + offsetPx,
    ),
  };
}

function edgeCurveSegments(
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  curve: EdgeCurveGeometry,
): QuadraticCurveSegment[] {
  const controls = edgeCurveControlPoints(source, target, curve);

  if (controls.length === 0) {
    return [];
  }

  return controls.map((control, index) => ({
    start:
      index === 0 ? source : midpoint(controls[index - 1] ?? source, control),
    control,
    end:
      index === controls.length - 1
        ? target
        : midpoint(control, controls[index + 1] ?? target),
  }));
}

function edgeCurveControlPoints(
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  curve: EdgeCurveGeometry,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const normalX = length === 0 ? 0 : -dy / length;
  const normalY = length === 0 ? 0 : dx / length;
  const count = Math.min(
    curve.controlPointDistancesPx.length,
    curve.controlPointWeights.length,
  );

  return Array.from({ length: count }, (_, index) => {
    const weight = curve.controlPointWeights[index] ?? 0.5;
    const distance = curve.controlPointDistancesPx[index] ?? 0;

    return {
      x: source.x + dx * weight + normalX * distance,
      y: source.y + dy * weight + normalY * distance,
    };
  });
}

export function sampleEdgeCurve(
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  curve: EdgeCurveGeometry,
  samplesPerSegment = 12,
) {
  const segments = edgeCurveSegments(source, target, curve);

  if (segments.length === 0) {
    return [source, target];
  }

  return segments.flatMap((segment, segmentIndex) =>
    Array.from(
      { length: Math.max(2, samplesPerSegment) + 1 },
      (_, sampleIndex) => {
        if (segmentIndex > 0 && sampleIndex === 0) {
          return null;
        }

        return quadraticPoint(
          segment,
          sampleIndex / Math.max(2, samplesPerSegment),
        );
      },
    ).filter((point): point is EdgeCurvePoint => point !== null),
  );
}

export function edgeCurveMidpoint(
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  curve: EdgeCurveGeometry,
) {
  const samples = sampleEdgeCurve(source, target, curve, 16);
  const lengths: number[] = [];
  let totalLength = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1] ?? source;
    const current = samples[index] ?? target;
    totalLength += Math.hypot(current.x - previous.x, current.y - previous.y);
    lengths.push(totalLength);
  }

  const targetLength = totalLength / 2;
  const segmentIndex = lengths.findIndex((length) => length >= targetLength);

  if (segmentIndex < 0) {
    return midpoint(source, target);
  }

  const previousLength =
    segmentIndex === 0 ? 0 : (lengths[segmentIndex - 1] ?? 0);
  const segmentLength =
    (lengths[segmentIndex] ?? previousLength) - previousLength;
  const ratio =
    segmentLength === 0 ? 0 : (targetLength - previousLength) / segmentLength;
  const start = samples[segmentIndex] ?? source;
  const end = samples[segmentIndex + 1] ?? target;

  return {
    x: start.x + (end.x - start.x) * ratio,
    y: start.y + (end.y - start.y) * ratio,
  };
}

export function edgeCurveSvgPath(
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  curve: EdgeCurveGeometry,
) {
  const segments = edgeCurveSegments(source, target, curve);

  if (segments.length === 0) {
    return `M${round(source.x)} ${round(source.y)}L${round(target.x)} ${round(target.y)}`;
  }

  return [
    `M${round(segments[0]?.start.x ?? source.x)} ${round(
      segments[0]?.start.y ?? source.y,
    )}`,
    ...segments.map(
      (segment) =>
        `Q${round(segment.control.x)} ${round(segment.control.y)} ${round(
          segment.end.x,
        )} ${round(segment.end.y)}`,
    ),
  ].join("");
}

export function minimumCurveDistanceToNode(
  source: GraphNode,
  target: GraphNode,
  curve: EdgeCurveGeometry,
  node: GraphNode,
) {
  return createCurveNodeDistance(source, target, curve)(node);
}

/** Subdivide a candidate once, then reuse exactly the same segments for each obstacle. */
export function createCurveNodeDistance(
  source: GraphNode,
  target: GraphNode,
  curve: EdgeCurveGeometry,
) {
  const pieces: {
    start: EdgeCurvePoint;
    end: EdgeCurvePoint;
    error: number;
  }[] = [];
  const visit = (segment: QuadraticCurveSegment, depth: number) => {
    const { start, control, end } = segment;
    const error = pointSegmentDistance(control, start, end) / 2;
    if (error <= 0.25 || depth >= 16) {
      pieces.push({ start, end, error });
      return;
    }
    const a = { x: (start.x + control.x) / 2, y: (start.y + control.y) / 2 };
    const b = { x: (end.x + control.x) / 2, y: (end.y + control.y) / 2 };
    const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    visit({ start, control: a, end: mid }, depth + 1);
    visit({ start: mid, control: b, end }, depth + 1);
  };
  for (const segment of edgeCurveSegments(source, target, curve))
    visit(segment, 0);
  return (node: GraphNode) => {
    const span = Math.max(0, (nodeGeometryWidth(node) - NODE_SIZE_PX) / 2);
    const left = { x: node.x - span, y: node.y };
    const right = { x: node.x + span, y: node.y };
    let minimum = Infinity;
    for (const { start, end, error } of pieces)
      minimum = Math.min(
        minimum,
        segmentDistance(start, end, left, right) - error,
      );
    return minimum;
  };
}

function pointSegmentDistance(
  p: EdgeCurvePoint,
  a: EdgeCurvePoint,
  b: EdgeCurvePoint,
) {
  const dx = b.x - a.x,
    dy = b.y - a.y;
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1),
    ),
  );
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
function segmentDistance(
  a: EdgeCurvePoint,
  b: EdgeCurvePoint,
  c: EdgeCurvePoint,
  d: EdgeCurvePoint,
) {
  // The capsule's center segment is horizontal. Include interior intersections.
  if (a.y !== b.y) {
    const t = (c.y - a.y) / (b.y - a.y);
    const x = a.x + t * (b.x - a.x);
    if (t >= 0 && t <= 1 && x >= c.x && x <= d.x) return 0;
  }
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

export function approximateCurveLength(
  source: EdgeCurvePoint,
  target: EdgeCurvePoint,
  curve: EdgeCurveGeometry,
) {
  const samples = sampleEdgeCurve(source, target, curve, 12);
  let length = 0;

  for (let index = 1; index < samples.length; index += 1) {
    const previous = samples[index - 1] ?? source;
    const current = samples[index] ?? target;
    length += Math.hypot(current.x - previous.x, current.y - previous.y);
  }

  return length;
}

function quadraticPoint(
  segment: QuadraticCurveSegment,
  t: number,
): EdgeCurvePoint {
  const inverse = 1 - t;

  return {
    x:
      inverse * inverse * segment.start.x +
      2 * inverse * t * segment.control.x +
      t * t * segment.end.x,
    y:
      inverse * inverse * segment.start.y +
      2 * inverse * t * segment.control.y +
      t * t * segment.end.y,
  };
}

function midpoint(a: EdgeCurvePoint, b: EdgeCurvePoint) {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

/** Prefer committed routing, otherwise begin at the curve currently on screen. */
export function nudgeEdgeBend(
  manual: EdgeRoutingOverride | undefined,
  rendered: EdgeCurveGeometry | undefined,
  delta: number,
) {
  const bowPx = manual?.bowPx ?? rendered?.controlPointDistancesPx[0];
  const bowT =
    manual?.bowT ??
    (manual?.bowPx !== undefined ? 0.5 : rendered?.controlPointWeights[0]);
  if (bowPx === undefined || bowT === undefined) return null;
  return { bowPx: clampBow(bowPx + delta), bowT };
}
