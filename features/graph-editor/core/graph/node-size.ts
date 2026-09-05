/**
 * Node geometry shared by rendering, routing and layouts. Nodes are 48px tall
 * pills: a circle for short labels, stretched horizontally for longer ones.
 */
export const NODE_SIZE_PX = 48;
export const NODE_FONT_PX = 16;
export const NODE_LABEL_PADDING_PX = 14;

/**
 * Rough label width without a DOM: CJK glyphs are 1em, others 0.68em. The
 * Latin factor errs wide so layouts and routing never under-reserve space.
 */
export function estimateLabelWidth(label: string, fontPx = NODE_FONT_PX) {
  let width = 0;

  for (const char of label) {
    width += fontPx * (/[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 1 : 0.68);
  }

  return width;
}

/** Node width in graph px for a label, matching the renderer's pill sizing. */
export function estimateNodeWidth(label: string) {
  if (!label) {
    return NODE_SIZE_PX;
  }

  return Math.max(
    NODE_SIZE_PX,
    Math.ceil(estimateLabelWidth(label) + NODE_LABEL_PADDING_PX * 2),
  );
}

/**
 * Distance from a pill's centre to its boundary along a direction. The pill is
 * a stadium: the segment [-a, a] on the x axis thickened by `halfHeight`.
 */
export function pillExtentTowards(
  halfWidth: number,
  halfHeight: number,
  dirX: number,
  dirY: number,
) {
  const length = Math.hypot(dirX, dirY) || 1;
  const ux = dirX / length;
  const uy = dirY / length;
  const a = Math.max(0, halfWidth - halfHeight);

  if (a === 0) {
    return halfHeight;
  }

  // dist(p, segment) = hypot(max(|px| - a, 0), py) = halfHeight; solve for t.
  let low = halfHeight;
  let high = halfWidth;

  for (let step = 0; step < 24; step += 1) {
    const t = (low + high) / 2;
    const px = Math.abs(t * ux);
    const py = t * uy;
    const distance = Math.hypot(Math.max(px - a, 0), py);

    if (distance < halfHeight) {
      low = t;
    } else {
      high = t;
    }
  }

  return (low + high) / 2;
}

/** Measured width is transient input supplied by the browser adapter. */
export function nodeGeometryWidth(node: {
  label: string;
  measuredWidth?: number;
}) {
  return node.measuredWidth ?? estimateNodeWidth(node.label);
}
