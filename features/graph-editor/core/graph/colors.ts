import type { GraphColor } from "./model";

export const GRAPH_COLORS: GraphColor[] = [
  "paper",
  "white",
  "black",
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
];

export const SELECTABLE_NODE_COLORS: GraphColor[] = [
  "white",
  "black",
  "red",
  "yellow",
  "blue",
  "green",
];

export const SELECTABLE_EDGE_COLORS: GraphColor[] = [
  "black",
  "red",
  "yellow",
  "blue",
  "green",
];

export function normalizeGraphColor(value: unknown): GraphColor | undefined {
  return typeof value === "string" && isGraphColor(value) ? value : undefined;
}

export function nextNodeColor(color: GraphColor | undefined): GraphColor {
  return nextSelectableColor(color, SELECTABLE_NODE_COLORS);
}

export function nextEdgeColor(color: GraphColor | undefined): GraphColor {
  return nextSelectableColor(color, SELECTABLE_EDGE_COLORS);
}

function nextSelectableColor(
  color: GraphColor | undefined,
  colors: GraphColor[],
): GraphColor {
  const currentIndex = colors.indexOf(color ?? "paper");
  const nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % colors.length;

  return colors[nextIndex];
}

function isGraphColor(value: string): value is GraphColor {
  return (GRAPH_COLORS as string[]).includes(value);
}
