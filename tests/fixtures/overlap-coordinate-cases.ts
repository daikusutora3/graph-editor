import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { overlapGraph, overlapNode } from "./overlaps";

const fractionalCoincident = Array.from({ length: 16 }, (_, index) => ({
  ...overlapNode(index, -32.125, 16.375, "fractional measured label"),
  measuredWidth: 70.123456789 + index * 4.987654321,
}));
const translatedCoincident = Array.from({ length: 12 }, (_, index) =>
  overlapNode(index, 100_000_000, -100_000_000),
);

export const additionalOverlapCoordinateCases: ReadonlyArray<
  readonly [name: string, graph: GraphModel, status: "unchanged" | "resolved"]
> = [
  [
    "coincident fractional widths",
    overlapGraph(fractionalCoincident),
    "resolved",
  ],
  [
    "coincident fractional widths shuffled",
    overlapGraph([...fractionalCoincident].reverse()),
    "resolved",
  ],
  [
    "coincident fractional widths grid",
    overlapGraph(fractionalCoincident, { snapToGrid: true }),
    "resolved",
  ],
  [
    "coincident fractional widths grid shuffled",
    overlapGraph([...fractionalCoincident].reverse(), { snapToGrid: true }),
    "resolved",
  ],
  ["large translated cluster", overlapGraph(translatedCoincident), "resolved"],
  [
    "large translated cluster shuffled",
    overlapGraph([...translatedCoincident].reverse()),
    "resolved",
  ],
  [
    "extreme finite separated coordinates",
    overlapGraph([
      overlapNode(0, -Number.MAX_VALUE, 0),
      overlapNode(1, 0, Number.MAX_VALUE),
      overlapNode(2, Number.MAX_VALUE, 0),
      overlapNode(3, 0, -Number.MAX_VALUE),
    ]),
    "unchanged",
  ],
  [
    "large fractional separated coordinates",
    overlapGraph([
      overlapNode(0, 100_000_000.125, -100_000_000.375),
      overlapNode(1, 100_000_512.125, -100_000_000.375),
      overlapNode(2, 100_000_000.125, -100_000_512.375),
    ]),
    "unchanged",
  ],
];
