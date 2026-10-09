import type { EdgeCurvePoint } from "../../core/layout/edge-route-geometry";

export type PreviewCurvePoints =
  | readonly [EdgeCurvePoint, EdgeCurvePoint, EdgeCurvePoint]
  | readonly [EdgeCurvePoint, EdgeCurvePoint, EdgeCurvePoint, EdgeCurvePoint];

/** Exact axis extrema of the quadratic or cubic Bezier used by the SVG path. */
export function previewCurveBounds(points: PreviewCurvePoints) {
  const parameters = new Set([0, 1]);
  for (const axis of ["x", "y"] as const) {
    const [p0, p1, p2, p3] = points.map((point) => point[axis]);
    if (points.length === 3) {
      const denominator = p0 - 2 * p1 + p2;
      if (denominator !== 0) addParameter((p0 - p1) / denominator);
    } else {
      const a = -p0 + 3 * p1 - 3 * p2 + p3;
      const b = 2 * (p0 - 2 * p1 + p2);
      const c = p1 - p0;
      if (a === 0) {
        if (b !== 0) addParameter(-c / b);
      } else {
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
          const root = Math.sqrt(discriminant);
          // Avoid subtracting nearly equal values for one of the two roots.
          const q = -0.5 * (b + (b < 0 ? -root : root));
          addParameter(q / a);
          if (q !== 0) addParameter(c / q);
        }
      }
    }
  }
  const extrema = [...parameters].map((parameter) => {
    let current = [...points];
    while (current.length > 1) {
      current = current.slice(1).map((point, index) => ({
        x: (1 - parameter) * current[index].x + parameter * point.x,
        y: (1 - parameter) * current[index].y + parameter * point.y,
      }));
    }
    return current[0];
  });
  return {
    minX: Math.min(...extrema.map((point) => point.x)),
    maxX: Math.max(...extrema.map((point) => point.x)),
    minY: Math.min(...extrema.map((point) => point.y)),
    maxY: Math.max(...extrema.map((point) => point.y)),
  };

  function addParameter(parameter: number) {
    if (parameter > 0 && parameter < 1) parameters.add(parameter);
  }
}
