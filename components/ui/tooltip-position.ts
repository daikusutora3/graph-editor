export type TooltipSide =
  "bottom" | "bottom-start" | "bottom-end" | "top" | "top-start";

export type TooltipRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export const TOOLTIP_MARGIN = 8;

/** The tooltip is measured after its size is constrained to the viewport. */
export function getTooltipPosition(
  anchor: TooltipRect,
  size: { width: number; height: number },
  viewport: TooltipRect,
  side: TooltipSide = "bottom",
) {
  const minLeft = viewport.left + TOOLTIP_MARGIN;
  const minTop = viewport.top + TOOLTIP_MARGIN;
  const maxRight = viewport.left + viewport.width - TOOLTIP_MARGIN;
  const maxBottom = viewport.top + viewport.height - TOOLTIP_MARGIN;
  const above = anchor.top - TOOLTIP_MARGIN - minTop;
  const below = maxBottom - (anchor.top + anchor.height + TOOLTIP_MARGIN);
  let topSide = side.startsWith("top");
  const preferredSpace = topSide ? above : below;
  const oppositeSpace = topSide ? below : above;
  if (preferredSpace < size.height && oppositeSpace > preferredSpace) {
    topSide = !topSide;
  }

  const left = side.endsWith("start")
    ? anchor.left
    : side.endsWith("end")
      ? anchor.left + anchor.width - size.width
      : anchor.left + (anchor.width - size.width) / 2;
  const top = topSide
    ? anchor.top - TOOLTIP_MARGIN - size.height
    : anchor.top + anchor.height + TOOLTIP_MARGIN;

  return {
    left: Math.max(minLeft, Math.min(left, maxRight - size.width)),
    top: Math.max(minTop, Math.min(top, maxBottom - size.height)),
  };
}
