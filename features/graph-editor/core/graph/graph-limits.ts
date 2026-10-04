export const GRAPH_MAX_NODES = 1_000;
export const GRAPH_MAX_EDGES = 5_000;
export const GRAPH_MAX_TEXT_CODE_POINTS = 256;
export const GRAPH_MAX_JSON_CHARS = 2_000_000;
export const GRAPH_MAX_INPUT_CHARS = 1_000_000;

export function isGraphText(value: unknown): value is string {
  if (typeof value !== "string") return false;
  // UTF-16 code units never undercount Unicode code points. Short text needs
  // no iteration, while astral characters still get their full 256-point limit.
  if (value.length <= GRAPH_MAX_TEXT_CODE_POINTS) return true;
  if (value.length > GRAPH_MAX_TEXT_CODE_POINTS * 2) return false;
  let codePoints = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (++codePoints > GRAPH_MAX_TEXT_CODE_POINTS) return false;
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff) index += 1;
    }
  }
  return true;
}
