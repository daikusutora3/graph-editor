export function stableHypot(x: number, y: number) {
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax === Infinity || ay === Infinity) return Infinity;
  const scale = Math.max(ax, ay);
  if (scale === 0) return 0;
  const sx = ax / scale;
  const sy = ay / scale;
  return scale * Math.sqrt(sx * sx + sy * sy);
}
