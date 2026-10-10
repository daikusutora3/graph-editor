import type { EdgeCurvePoint } from "../../core/layout/edge-route-geometry";

export const PREVIEW_ARROW_LENGTH = 5.25;
export const PREVIEW_ARROW_HALF_WIDTH = 2.25;
export const PREVIEW_ARROW_REACH = Math.hypot(
  PREVIEW_ARROW_LENGTH,
  PREVIEW_ARROW_HALF_WIDTH,
);

/** The marker uses strokeWidth units and puts its tip at the curve endpoint. */
export function previewArrowVertices(
  tip: EdgeCurvePoint,
  control: EdgeCurvePoint,
  strokeWidth: number,
) {
  const dx = tip.x - control.x;
  const dy = tip.y - control.y;
  const length = Math.hypot(dx, dy);
  const ux = length === 0 ? 1 : dx / length;
  const uy = length === 0 ? 0 : dy / length;
  const baseX = tip.x - ux * PREVIEW_ARROW_LENGTH * strokeWidth;
  const baseY = tip.y - uy * PREVIEW_ARROW_LENGTH * strokeWidth;
  const halfWidth = PREVIEW_ARROW_HALF_WIDTH * strokeWidth;
  return [
    tip,
    { x: baseX - uy * halfWidth, y: baseY + ux * halfWidth },
    { x: baseX + uy * halfWidth, y: baseY - ux * halfWidth },
  ];
}
