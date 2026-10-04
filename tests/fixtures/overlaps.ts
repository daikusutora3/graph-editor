import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type {
  GraphModel,
  GraphNode,
} from "../../features/graph-editor/core/graph/model";

export function overlapGraph(
  nodes: Array<GraphNode & { measuredWidth?: number }>,
  settings: Partial<GraphModel["settings"]> = {},
): GraphModel {
  const graph = createEmptyGraphModel();
  return { ...graph, nodes, settings: { ...graph.settings, ...settings } };
}

export function overlapNode(index: number, x: number, y: number, label = "") {
  return { id: `n${index}`, order: index, label, x, y };
}

const coincidentNodes = Array.from({ length: 12 }, (_, index) =>
  overlapNode(index, 0, 0),
);
const pillNodes = Array.from({ length: 12 }, (_, index) =>
  overlapNode(
    index,
    (index % 4) * 80,
    Math.floor(index / 4) * 30,
    "長いラベル",
  ),
);
const fractionalNodes = Array.from({ length: 18 }, (_, index) => ({
  ...overlapNode(
    index,
    (index % 6) * 31.23456789,
    (Math.floor(index / 6) - 1) * 28.987654321,
    "pill",
  ),
  measuredWidth: 70.123456789 + index * 4.987654321,
}));
const orderTies = Array.from({ length: 10 }, (_, index) => ({
  ...overlapNode(index, (index % 3) * 35, Math.floor(index / 3) * 25),
  order: Math.floor(index / 2),
}));

export const overlapVerificationFixtures: ReadonlyArray<
  readonly [string, GraphModel]
> = [
  ["empty", overlapGraph([])],
  ["single", overlapGraph([overlapNode(0, -12.34, 56.78)])],
  [
    "separated",
    overlapGraph(
      Array.from({ length: 40 }, (_, index) =>
        overlapNode(index, (index % 8) * 128, Math.floor(index / 8) * 104),
      ),
    ),
  ],
  ["coincident", overlapGraph(coincidentNodes)],
  ["coincident grid", overlapGraph(coincidentNodes, { snapToGrid: true })],
  ["wide labels", overlapGraph(pillNodes)],
  ["wide labels grid", overlapGraph(pillNodes, { snapToGrid: true })],
  ["hidden labels", overlapGraph(pillNodes, { showNodeLabels: false })],
  ["fractional widths", overlapGraph(fractionalNodes)],
  ["fractional widths shuffled", overlapGraph([...fractionalNodes].reverse())],
  ["order ties", overlapGraph(orderTies)],
  ["order ties shuffled", overlapGraph([...orderTies].reverse())],
  ...[60, 59.999995, 59.999985].map(
    (distance) =>
      [
        `vertical boundary ${distance}`,
        overlapGraph([
          overlapNode(0, -0.25, distance / 2),
          overlapNode(1, -0.25, -distance / 2),
        ]),
      ] as const,
  ),
  ...[60, 59.999995, 59.999985].map(
    (distance) =>
      [
        `diagonal boundary ${distance}`,
        overlapGraph([
          overlapNode(0, distance * 0.6, distance * 0.8),
          overlapNode(1, 0, 0),
        ]),
      ] as const,
  ),
];
