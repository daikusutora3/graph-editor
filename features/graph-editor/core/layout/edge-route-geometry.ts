import type { GraphNode } from "../graph/model";

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

export function singleBowCurve(bowPx: number): EdgeCurveGeometry {
  return {
    controlPointDistancesPx: [bowPx],
    controlPointWeights: [0.5],
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

export function edgeCurveSegments(
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

export function edgeCurveControlPoints(
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
  let minimum = Number.POSITIVE_INFINITY;

  for (const point of sampleEdgeCurve(source, target, curve, 16)) {
    minimum = Math.min(minimum, Math.hypot(node.x - point.x, node.y - point.y));
  }

  return minimum;
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
