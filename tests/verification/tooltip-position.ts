import assert from "node:assert/strict";

import {
  getTooltipPosition,
  TOOLTIP_MARGIN,
  type TooltipRect,
  type TooltipSide,
} from "../../components/ui/tooltip-position";

const viewport: TooltipRect = { left: 0, top: 0, width: 320, height: 720 };
const anchor: TooltipRect = { left: 140, top: 300, width: 40, height: 40 };
const size = { width: 120, height: 48 };
const sides: TooltipSide[] = [
  "bottom",
  "bottom-start",
  "bottom-end",
  "top",
  "top-start",
];

assert.equal(TOOLTIP_MARGIN, 8, "tooltips retain a small viewport gutter");
assert.equal(
  getTooltipPosition(anchor, size, viewport).left,
  100,
  "the default tooltip is centered beneath its trigger",
);
assert.equal(
  getTooltipPosition(anchor, size, viewport, "bottom-start").left,
  140,
  "start alignment follows the trigger's left edge when space permits",
);
assert.equal(
  getTooltipPosition(anchor, size, viewport, "bottom-end").left,
  60,
  "end alignment follows the trigger's right edge when space permits",
);
assert.equal(
  getTooltipPosition(anchor, size, viewport, "top").left,
  100,
  "top alignment retains horizontal centering",
);
assert.equal(
  getTooltipPosition(anchor, size, viewport, "top-start").left,
  140,
  "top-start alignment follows the trigger's left edge",
);

const leftEdge = getTooltipPosition(
  { left: 4, top: 300, width: 40, height: 40 },
  size,
  viewport,
);
assert.equal(leftEdge.left, 8, "left-edge hints stay inside the viewport");
const rightEdge = getTooltipPosition(
  { left: 276, top: 300, width: 40, height: 40 },
  size,
  viewport,
);
assert.equal(rightEdge.left, 192, "right-edge hints stay inside the viewport");

const bottomAnchor = { left: 140, top: 668, width: 40, height: 40 };
for (const side of ["bottom", "bottom-start", "bottom-end"] as const) {
  const position = getTooltipPosition(bottomAnchor, size, viewport, side);
  assert(
    position.top + size.height <= bottomAnchor.top,
    `${side} flips above a trigger near the bottom edge`,
  );
}
const topAnchor = { left: 140, top: 8, width: 40, height: 40 };
for (const side of ["top", "top-start"] as const) {
  const position = getTooltipPosition(topAnchor, size, viewport, side);
  assert(
    position.top >= topAnchor.top + topAnchor.height,
    `${side} flips below a trigger near the top edge`,
  );
}

function assertFits(
  trigger: TooltipRect,
  dimensions: { width: number; height: number },
  bounds: TooltipRect,
  side: TooltipSide,
  description: string,
) {
  const position = getTooltipPosition(trigger, dimensions, bounds, side);
  assert(
    Number.isFinite(position.left) && Number.isFinite(position.top),
    `${description}: ${side} returns finite coordinates`,
  );
  assert(
    position.left >= bounds.left + TOOLTIP_MARGIN &&
      position.left + dimensions.width <=
        bounds.left + bounds.width - TOOLTIP_MARGIN,
    `${description}: ${side} fits horizontally`,
  );
  assert(
    position.top >= bounds.top + TOOLTIP_MARGIN &&
      position.top + dimensions.height <=
        bounds.top + bounds.height - TOOLTIP_MARGIN,
    `${description}: ${side} fits vertically`,
  );
}

const offsetViewport = { left: 45, top: 160, width: 320, height: 280 };
const offsetPosition = getTooltipPosition(
  { left: 50, top: 380, width: 40, height: 40 },
  size,
  offsetViewport,
);
assert.equal(
  offsetPosition.left,
  53,
  "a panned visual viewport uses its own left boundary",
);
assert(
  offsetPosition.top + size.height <= 380,
  "a panned visual viewport flips against its visible bottom boundary",
);

for (const bounds of [viewport, offsetViewport]) {
  for (const left of [bounds.left, bounds.left + bounds.width - 40]) {
    for (const top of [bounds.top, bounds.top + bounds.height - 40]) {
      for (const side of sides) {
        assertFits(
          { left, top, width: 40, height: 40 },
          size,
          bounds,
          side,
          "a tooltip at a viewport corner",
        );
      }
    }
  }
}

const shortViewport = { left: 0, top: 0, width: 320, height: 96 };
const longTextSize = { width: 304, height: 80 };
for (const side of sides) {
  assertFits(
    { left: 140, top: 28, width: 40, height: 40 },
    longTextSize,
    shortViewport,
    side,
    "long text fills a short viewport when neither side has enough space",
  );
}

console.log("Tooltip viewport positioning passed");
