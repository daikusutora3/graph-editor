import type { EdgeCurvePoint } from "../../core/layout/edge-route-geometry";

export type PreviewCurvePoints =
  | readonly [EdgeCurvePoint, EdgeCurvePoint, EdgeCurvePoint]
  | readonly [EdgeCurvePoint, EdgeCurvePoint, EdgeCurvePoint, EdgeCurvePoint];

export function previewCurveBounds(points: PreviewCurvePoints) {
  const first = points[0];
  const last = points[points.length - 1];
  let minX = Math.min(first.x, last.x);
  let maxX = Math.max(first.x, last.x);
  let minY = Math.min(first.y, last.y);
  let maxY = Math.max(first.y, last.y);
  const cubic = points.length === 4;

  for (let axis = 0; axis < 2; axis++) {
    const key = axis === 0 ? "x" : "y";
    const p0 = points[0][key];
    const p1 = points[1][key];
    const p2 = points[2][key];
    if (!cubic) {
      const denominator = p0 - 2 * p1 + p2;
      if (denominator !== 0) includeParameter((p0 - p1) / denominator);
    } else {
      const p3 = points[3]![key];
      const a = -p0 + 3 * p1 - 3 * p2 + p3;
      const b = 2 * (p0 - 2 * p1 + p2);
      const c = p1 - p0;
      if (a === 0) {
        if (b !== 0) includeParameter(-c / b);
      } else {
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
          const root = Math.sqrt(discriminant);

          const q = -0.5 * (b + (b < 0 ? -root : root));
          includeParameter(q / a);
          if (q !== 0) includeParameter(c / q);
        }
      }
    }
  }
  return { minX, maxX, minY, maxY };

  function includeParameter(parameter: number) {
    if (!(parameter > 0 && parameter < 1)) return;

    const inverse = 1 - parameter;
    const aX = inverse * points[0].x + parameter * points[1].x;
    const aY = inverse * points[0].y + parameter * points[1].y;
    const bX = inverse * points[1].x + parameter * points[2].x;
    const bY = inverse * points[1].y + parameter * points[2].y;
    let x = inverse * aX + parameter * bX;
    let y = inverse * aY + parameter * bY;
    if (cubic) {
      const cX = inverse * points[2].x + parameter * points[3]!.x;
      const cY = inverse * points[2].y + parameter * points[3]!.y;
      const dX = inverse * bX + parameter * cX;
      const dY = inverse * bY + parameter * cY;
      x = inverse * x + parameter * dX;
      y = inverse * y + parameter * dY;
    }
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
}
