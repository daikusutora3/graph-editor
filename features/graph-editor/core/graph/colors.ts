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

export function normalizeGraphColor(value: unknown): GraphColor | undefined {
  return typeof value === "string" && isGraphColor(value) ? value : undefined;
}

export function nextGraphColor(color: GraphColor | undefined): GraphColor {
  const currentIndex = GRAPH_COLORS.indexOf(color ?? "paper");
  const nextIndex =
    currentIndex < 0 ? 1 : (currentIndex + 1) % GRAPH_COLORS.length;

  return GRAPH_COLORS[nextIndex];
}

function isGraphColor(value: string): value is GraphColor {
  return (GRAPH_COLORS as string[]).includes(value);
}
