export const GRAPH_MAX_NODES = 1_000;
export const GRAPH_MAX_EDGES = 5_000;
export const GRAPH_MAX_TEXT_CODE_POINTS = 256;
export const GRAPH_MAX_JSON_CHARS = 2_000_000;
export const GRAPH_MAX_INPUT_CHARS = 1_000_000;

export function isGraphText(value: unknown): value is string {
  return (
    typeof value === "string" &&
    Array.from(value).length <= GRAPH_MAX_TEXT_CODE_POINTS
  );
}
