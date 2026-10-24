export const NODE_SIZE_PX = 48;
export const NODE_FONT_PX = 16;
export const NODE_LABEL_PADDING_PX = 14;

export function estimateLabelWidth(label: string, fontPx = NODE_FONT_PX) {
  let width = 0;

  for (const char of label) {
    width += fontPx * (/[\u3000-\u9fff\uff00-\uffef]/.test(char) ? 1 : 0.68);
  }

  return width;
}

export function estimateNodeWidth(label: string) {
  if (!label) {
    return NODE_SIZE_PX;
  }

  return Math.max(
    NODE_SIZE_PX,
    Math.ceil(estimateLabelWidth(label) + NODE_LABEL_PADDING_PX * 2),
  );
}

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

export function nodeGeometryWidth(node: {
  label: string;
  measuredWidth?: number;
}) {
  return node.measuredWidth ?? estimateNodeWidth(node.label);
}

export function nodeGeometryHeight(node: {
  label: string;
  measuredHeight?: number;
}) {
  return node.measuredHeight ?? NODE_SIZE_PX;
}

export function nodeGeometryClearance(
  node: { label: string; measuredHeight?: number },
  base: number,
) {
  return Math.max(0, base + (nodeGeometryHeight(node) - NODE_SIZE_PX) / 2);
}
