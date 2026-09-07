// PNGs exported through the app: white background, 1280px long edge, 24px padding.
// Edge list and matrix use circle layout; weighted tree uses tree layout.
export const guideExamples = [
  {
    id: "edge-list",
    imageWidth: 1280,
    input: "4 4\n1 2\n2 3\n2 4\n3 4",
    nodes: [
      [1, 50, 90],
      [2, 140, 90],
      [3, 235, 35],
      [4, 235, 145],
    ],
    edges: [
      [1, 2],
      [2, 3],
      [2, 4],
      [3, 4],
    ],
  },
  {
    id: "adjacency-matrix",
    imageWidth: 1141,
    input: "0 1 1\n1 0 1\n1 1 0",
    nodes: [
      [1, 150, 30],
      [2, 65, 145],
      [3, 235, 145],
    ],
    edges: [
      [1, 2],
      [1, 3],
      [2, 3],
    ],
  },
  {
    id: "weighted-tree",
    imageWidth: 780,
    input: "4 3\n1 2 5\n1 3 2\n3 4 7",
    nodes: [
      [1, 150, 25],
      [2, 65, 95],
      [3, 225, 95],
      [4, 225, 165],
    ],
    edges: [
      [1, 2, 5],
      [1, 3, 2],
      [3, 4, 7],
    ],
  },
] as const;
