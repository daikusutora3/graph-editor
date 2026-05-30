import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../core/graph/graph-factory";
import type { GraphModel, GraphSettings, NodeId } from "../core/graph/model";

type Point = { x: number; y: number };
type SampleGraphFactory = (settings: Partial<GraphSettings>) => GraphModel;
export type SampleGraphKind = keyof typeof sampleGraphFactories;

const UNIT_DISK_POINTS = [
  { x: -160, y: -40 },
  { x: -70, y: -80 },
  { x: -80, y: 20 },
  { x: 20, y: -40 },
  { x: 110, y: -80 },
  { x: 120, y: 20 },
  { x: 210, y: -40 },
] as const;

const PERMUTATION_ORDER = [2, 5, 6, 1, 3, 4] as const;

function layoutPoint(index: number, count: number): { x: number; y: number } {
  if (count <= 1) return { x: 0, y: 0 };
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const radius = Math.max(170, count * 24);
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

function orderedNodeIds(model: GraphModel): NodeId[] {
  return [...model.nodes]
    .sort((a, b) => a.order - b.order)
    .map((node) => node.id);
}

function withNodePositions(
  model: GraphModel,
  positions: Record<NodeId, Point>,
): GraphModel {
  return {
    ...model,
    nodes: model.nodes.map((node) => {
      const position = positions[node.id];

      return position ? { ...node, ...position } : node;
    }),
  };
}

function withNodeLabels(model: GraphModel, labels: string[]): GraphModel {
  return {
    ...model,
    nodes: model.nodes.map((node) => {
      const label = labels[node.order];

      return label ? { ...node, label } : node;
    }),
  };
}

function subsetLabel(values: number[]): string {
  return `{${values.map((value) => String(value + 1)).join(",")}}`;
}

function bitLabels(count: number, width: number): string[] {
  return Array.from({ length: count }, (_, value) =>
    value.toString(2).padStart(width, "0"),
  );
}

function chordEndpointsCross(
  first: readonly [number, number],
  second: readonly [number, number],
): boolean {
  const [a, b] = [...first].sort((x, y) => x - y);
  const [c, d] = [...second].sort((x, y) => x - y);

  return (a < c && c < b && b < d) || (c < a && a < d && d < b);
}

function pointLiesOnCircularArc(
  point: number,
  [start, end]: readonly [number, number],
): boolean {
  return start <= end
    ? start <= point && point <= end
    : point >= start || point <= end;
}

function circularArcsIntersect(
  first: readonly [number, number],
  second: readonly [number, number],
): boolean {
  return (
    pointLiesOnCircularArc(first[0], second) ||
    pointLiesOnCircularArc(first[1], second) ||
    pointLiesOnCircularArc(second[0], first) ||
    pointLiesOnCircularArc(second[1], first)
  );
}

function pathPositions(nodeIds: NodeId[], gap = 128): Record<NodeId, Point> {
  return Object.fromEntries(
    nodeIds.map((nodeId, index) => [
      nodeId,
      {
        x: (index - (nodeIds.length - 1) / 2) * gap,
        y: 0,
      },
    ]),
  );
}

function gridPositions(
  nodeIds: NodeId[],
  columns = Math.ceil(Math.sqrt(nodeIds.length || 1)),
): Record<NodeId, Point> {
  const rowGap = 104;
  const columnGap = 128;

  return Object.fromEntries(
    nodeIds.map((nodeId, index) => {
      const row = Math.floor(index / columns);
      const column = index % columns;
      const rowCount = Math.ceil(nodeIds.length / columns);

      return [
        nodeId,
        {
          x: (column - (columns - 1) / 2) * columnGap,
          y: (row - (rowCount - 1) / 2) * rowGap,
        },
      ];
    }),
  );
}

function circlePositions(
  nodeIds: NodeId[],
  minimumRadius = 150,
): Record<NodeId, Point> {
  if (nodeIds.length <= 1) {
    return Object.fromEntries(
      nodeIds.map((nodeId) => [nodeId, { x: 0, y: 0 }]),
    );
  }

  const radius = Math.max(minimumRadius, nodeIds.length * 24);

  return Object.fromEntries(
    nodeIds.map((nodeId, index) => {
      const angle = (Math.PI * 2 * index) / nodeIds.length - Math.PI / 2;

      return [
        nodeId,
        {
          x: Math.round(Math.cos(angle) * radius),
          y: Math.round(Math.sin(angle) * radius),
        },
      ];
    }),
  );
}

function doubleCirclePositions(
  outerIds: NodeId[],
  innerIds: NodeId[],
  outerRadius = 210,
  innerRadius = 105,
): Record<NodeId, Point> {
  const positions: Record<NodeId, Point> = {};

  outerIds.forEach((nodeId, index) => {
    const angle = (Math.PI * 2 * index) / outerIds.length - Math.PI / 2;
    positions[nodeId] = {
      x: Math.round(Math.cos(angle) * outerRadius),
      y: Math.round(Math.sin(angle) * outerRadius),
    };
  });

  innerIds.forEach((nodeId, index) => {
    const angle = (Math.PI * 2 * index) / innerIds.length - Math.PI / 2;
    positions[nodeId] = {
      x: Math.round(Math.cos(angle) * innerRadius),
      y: Math.round(Math.sin(angle) * innerRadius),
    };
  });

  return positions;
}

function starPositions(nodeIds: NodeId[], radius = 170): Record<NodeId, Point> {
  const [center, ...leaves] = nodeIds;
  const positions: Record<NodeId, Point> = {};

  if (!center) return positions;
  positions[center] = { x: 0, y: 0 };

  Object.assign(positions, circlePositions(leaves, radius));
  return positions;
}

function binaryTreePositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  const positions: Record<NodeId, Point> = {};
  const levelGap = 112;
  const leafGap = 112;

  nodeIds.forEach((nodeId, index) => {
    const level = Math.floor(Math.log2(index + 1));
    const firstIndex = 2 ** level - 1;
    const positionInLevel = index - firstIndex;
    const levelSize = Math.min(2 ** level, nodeIds.length - firstIndex);

    positions[nodeId] = {
      x:
        (positionInLevel - (levelSize - 1) / 2) *
        leafGap *
        2 ** Math.max(0, 2 - level),
      y: (level - 1) * levelGap,
    };
  });

  return positions;
}

function bipartitePositions(
  leftIds: NodeId[],
  rightIds: NodeId[],
): Record<NodeId, Point> {
  const maxRows = Math.max(leftIds.length, rightIds.length, 1);
  const columnGap = 180;
  const rowGap = 92;
  const placeColumn = (nodeIds: NodeId[], x: number) =>
    Object.fromEntries(
      nodeIds.map((nodeId, index) => [
        nodeId,
        {
          x,
          y: (index - (maxRows - 1) / 2) * rowGap,
        },
      ]),
    );

  return {
    ...placeColumn(leftIds, -columnGap / 2),
    ...placeColumn(rightIds, columnGap / 2),
  };
}

function chainPositions(
  leftIds: NodeId[],
  rightIds: NodeId[],
): Record<NodeId, Point> {
  return bipartitePositions(leftIds, [...rightIds].reverse());
}

function multipartitePositions(
  nodeIds: NodeId[],
  partSizes: number[],
): Record<NodeId, Point> {
  if (partSizes.join(",") === "1,2,3" && nodeIds.length >= 6) {
    return fixedPositions(nodeIds, [
      { x: 0, y: -180 },
      { x: -220, y: 35 },
      { x: -150, y: 165 },
      { x: 165, y: -25 },
      { x: 245, y: 95 },
      { x: 125, y: 185 },
    ]);
  }

  const positions: Record<NodeId, Point> = {};
  const columnGap = 150;
  const rowGap = 96;
  let cursor = 0;

  partSizes.forEach((partSize, partIndex) => {
    const x = (partIndex - (partSizes.length - 1) / 2) * columnGap;

    for (let rowIndex = 0; rowIndex < partSize; rowIndex += 1) {
      const nodeId = nodeIds[cursor + rowIndex];
      if (!nodeId) continue;
      positions[nodeId] = {
        x,
        y: (rowIndex - (partSize - 1) / 2) * rowGap,
      };
    }

    cursor += partSize;
  });

  return positions;
}

function splitPositions(
  cliqueIds: NodeId[],
  independentIds: NodeId[],
): Record<NodeId, Point> {
  return fixedPositions(
    [...cliqueIds, ...independentIds],
    [
      { x: -95, y: -90 },
      { x: 95, y: -90 },
      { x: 0, y: 20 },
      { x: -180, y: 130 },
      { x: -60, y: 155 },
      { x: 60, y: 155 },
      { x: 180, y: 130 },
    ],
  );
}

function layeredPositions(columns: NodeId[][]): Record<NodeId, Point> {
  const positions: Record<NodeId, Point> = {};
  const columnGap = 150;
  const rowGap = 92;

  columns.forEach((column, columnIndex) => {
    const x = (columnIndex - (columns.length - 1) / 2) * columnGap;

    column.forEach((nodeId, rowIndex) => {
      positions[nodeId] = {
        x,
        y: (rowIndex - (column.length - 1) / 2) * rowGap,
      };
    });
  });

  return positions;
}

function prismPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return {
    [nodeIds[0]]: { x: 0, y: -200 },
    [nodeIds[1]]: { x: -190, y: 120 },
    [nodeIds[2]]: { x: 190, y: 120 },
    [nodeIds[3]]: { x: 0, y: -85 },
    [nodeIds[4]]: { x: -82, y: 55 },
    [nodeIds[5]]: { x: 82, y: 55 },
  };
}

function tetrahedralPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return {
    [nodeIds[0]]: { x: -155, y: 95 },
    [nodeIds[1]]: { x: 155, y: 95 },
    [nodeIds[2]]: { x: 0, y: -155 },
    [nodeIds[3]]: { x: 0, y: 20 },
  };
}

function diamondPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return {
    [nodeIds[0]]: { x: -125, y: 0 },
    [nodeIds[1]]: { x: 125, y: 0 },
    [nodeIds[2]]: { x: 0, y: -135 },
    [nodeIds[3]]: { x: 0, y: 135 },
  };
}

function pawPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return {
    [nodeIds[0]]: { x: -90, y: 70 },
    [nodeIds[1]]: { x: 90, y: 70 },
    [nodeIds[2]]: { x: 0, y: -85 },
    [nodeIds[3]]: { x: 170, y: -150 },
  };
}

function bullPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return {
    [nodeIds[0]]: { x: -90, y: 70 },
    [nodeIds[1]]: { x: 90, y: 70 },
    [nodeIds[2]]: { x: 0, y: -85 },
    [nodeIds[3]]: { x: -185, y: -80 },
    [nodeIds[4]]: { x: 185, y: -80 },
  };
}

function houseXPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return {
    [nodeIds[0]]: { x: -170, y: 110 },
    [nodeIds[1]]: { x: 170, y: 110 },
    [nodeIds[2]]: { x: 0, y: 18 },
    [nodeIds[3]]: { x: 0, y: -155 },
    [nodeIds[4]]: { x: 150, y: -155 },
  };
}

function gemPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return {
    ...pathPositions(nodeIds.slice(0, 4), 116),
    [nodeIds[4]]: { x: 0, y: -150 },
  };
}

function fanPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return {
    ...pathPositions(nodeIds.slice(0, -1), 108),
    [nodeIds[nodeIds.length - 1]]: { x: 0, y: -160 },
  };
}

function friendshipPositions(
  nodeIds: NodeId[],
  triangleCount: number,
): Record<NodeId, Point> {
  const positions: Record<NodeId, Point> = {};
  positions[nodeIds[0]] = { x: 0, y: 0 };

  for (let index = 0; index < triangleCount; index += 1) {
    const angle = (Math.PI * 2 * index) / triangleCount - Math.PI / 2;
    const tangent = angle + Math.PI / 2;
    const center = {
      x: Math.round(Math.cos(angle) * 170),
      y: Math.round(Math.sin(angle) * 170),
    };
    const first = nodeIds[index * 2 + 1];
    const second = nodeIds[index * 2 + 2];

    if (first) {
      positions[first] = {
        x: center.x + Math.round(Math.cos(tangent) * 44),
        y: center.y + Math.round(Math.sin(tangent) * 44),
      };
    }
    if (second) {
      positions[second] = {
        x: center.x - Math.round(Math.cos(tangent) * 44),
        y: center.y - Math.round(Math.sin(tangent) * 44),
      };
    }
  }

  return positions;
}

function hypercubePositions(
  nodeIds: NodeId[],
  dimension: number,
): Record<NodeId, Point> {
  const layers: NodeId[][] = Array.from({ length: dimension + 1 }, () => []);

  nodeIds.forEach((nodeId, index) => {
    const weight = hammingWeight(index);
    layers[weight]?.push(nodeId);
  });

  return layeredPositions(layers);
}

function octahedralPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return {
    [nodeIds[0]]: { x: 0, y: -220 },
    [nodeIds[1]]: { x: 0, y: 40 },
    [nodeIds[2]]: { x: -175, y: 110 },
    [nodeIds[3]]: { x: 80, y: -65 },
    [nodeIds[4]]: { x: 175, y: 110 },
    [nodeIds[5]]: { x: -80, y: -65 },
  };
}

function icosahedralPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: 0, y: -260 },
    { x: 260, y: 160 },
    { x: -260, y: 160 },
    { x: -113, y: -29 },
    { x: 0, y: -90 },
    { x: 113, y: -29 },
    { x: 0, y: 154 },
    { x: -113, y: 93 },
    { x: -38, y: 12 },
    { x: 38, y: 12 },
    { x: 113, y: 93 },
    { x: 0, y: 73 },
  ]);
}

function caterpillarPositions(
  nodeIds: NodeId[],
  spineCount: number,
): Record<NodeId, Point> {
  const positions: Record<NodeId, Point> = {};
  const spineGap = 112;

  nodeIds.slice(0, spineCount).forEach((nodeId, index) => {
    positions[nodeId] = {
      x: (index - (spineCount - 1) / 2) * spineGap,
      y: 0,
    };
  });

  for (let index = spineCount; index < nodeIds.length; index += 1) {
    const leafIndex = index - spineCount;
    const spineIndex = Math.floor(leafIndex / 2);
    const side = leafIndex % 2 === 0 ? -1 : 1;
    positions[nodeIds[index]] = {
      x: (spineIndex - (spineCount - 1) / 2) * spineGap,
      y: side * 100,
    };
  }

  return positions;
}

function unitDiskPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return Object.fromEntries(
    nodeIds.map((nodeId, index) => [
      nodeId,
      UNIT_DISK_POINTS[index] ?? layoutPoint(index, nodeIds.length),
    ]),
  );
}

function mycielskiPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  const baseCount = Math.floor((nodeIds.length - 1) / 2);
  const originalIds = nodeIds.slice(0, baseCount);
  const copyIds = nodeIds.slice(baseCount, baseCount * 2);
  const rootId = nodeIds[baseCount * 2];

  return {
    ...circlePositions(originalIds, 210),
    ...circlePositions(copyIds, 115),
    ...(rootId ? { [rootId]: { x: 0, y: 0 } } : {}),
  };
}

function moserSpindlePositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  const points = [
    { x: -156, y: -41 },
    { x: 0, y: -131 },
    { x: 0, y: 49 },
    { x: 156, y: -41 },
    { x: -24, y: -30 },
    { x: 76, y: 120 },
    { x: -104, y: 131 },
  ];

  return Object.fromEntries(
    nodeIds.map((nodeId, index) => [
      nodeId,
      points[index] ?? layoutPoint(index, nodeIds.length),
    ]),
  );
}

function fixedPositions(
  nodeIds: NodeId[],
  points: Point[],
): Record<NodeId, Point> {
  return Object.fromEntries(
    nodeIds.map((nodeId, index) => [
      nodeId,
      points[index] ?? layoutPoint(index, nodeIds.length),
    ]),
  );
}

function chordalPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: 0, y: -180 },
    { x: -175, y: 120 },
    { x: 0, y: 12 },
    { x: 175, y: 120 },
    { x: -95, y: 55 },
    { x: 95, y: 55 },
  ]);
}

function intervalPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -210, y: -82 },
    { x: -210, y: 82 },
    { x: -75, y: 0 },
    { x: 65, y: 0 },
    { x: 190, y: -66 },
    { x: 310, y: 52 },
  ]);
}

function cographPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -170, y: -85 },
    { x: -60, y: -145 },
    { x: -60, y: -25 },
    { x: 120, y: -90 },
    { x: 220, y: -90 },
    { x: 45, y: 110 },
  ]);
}

function lineGraphPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -240, y: -84 },
    { x: -80, y: -84 },
    { x: 80, y: -84 },
    { x: 240, y: -84 },
    { x: -240, y: 84 },
    { x: -80, y: 84 },
    { x: 80, y: 84 },
    { x: 240, y: 84 },
  ]);
}

function knightPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return gridPositions(nodeIds, 4);
}

function thresholdPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -155, y: -95 },
    { x: 35, y: -115 },
    { x: -215, y: 105 },
    { x: -55, y: 25 },
    { x: 135, y: 45 },
    { x: 260, y: 150 },
  ]);
}

function dagPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -220, y: 0 },
    { x: -80, y: -85 },
    { x: -80, y: 85 },
    { x: 80, y: -85 },
    { x: 80, y: 85 },
    { x: 220, y: 0 },
  ]);
}

function sccDemoPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -220, y: -70 },
    { x: -280, y: 34 },
    { x: -160, y: 34 },
    { x: 0, y: -52 },
    { x: 0, y: 52 },
    { x: 220, y: -52 },
    { x: 220, y: 52 },
  ]);
}

function flowNetworkPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -260, y: 0 },
    { x: -90, y: -90 },
    { x: -90, y: 90 },
    { x: 90, y: -90 },
    { x: 90, y: 90 },
    { x: 260, y: 0 },
  ]);
}

function weightedGraphPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -245, y: 0 },
    { x: -100, y: -115 },
    { x: -95, y: 95 },
    { x: 80, y: -86 },
    { x: 95, y: 105 },
    { x: 245, y: 0 },
  ]);
}

function barbellPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -285, y: -100 },
    { x: -285, y: 100 },
    { x: -145, y: 0 },
    { x: -230, y: 0 },
    { x: 145, y: 0 },
    { x: 285, y: -100 },
    { x: 285, y: 100 },
    { x: 230, y: 0 },
  ]);
}

function permutationPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  const rowGap = 58;
  const columnGap = 96;

  return Object.fromEntries(
    nodeIds.map((nodeId, index) => [
      nodeId,
      {
        x: (index - (nodeIds.length - 1) / 2) * columnGap,
        y: ((PERMUTATION_ORDER[index] ?? index + 1) - 3.5) * rowGap,
      },
    ]),
  );
}

function dodecahedralPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: 0, y: -240 },
    { x: 228, y: -74 },
    { x: 141, y: 194 },
    { x: -141, y: 194 },
    { x: -228, y: -74 },
    { x: 46, y: -143 },
    { x: 121, y: -88 },
    { x: 150, y: 0 },
    { x: 121, y: 88 },
    { x: 46, y: 143 },
    { x: -46, y: 143 },
    { x: -121, y: 88 },
    { x: -150, y: 0 },
    { x: -121, y: -88 },
    { x: -46, y: -143 },
    { x: 41, y: -57 },
    { x: 67, y: 22 },
    { x: 0, y: 70 },
    { x: -67, y: 22 },
    { x: -41, y: -57 },
  ]);
}

function clebschPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  const outerIndexes = [0, 1, 3, 2, 6, 7, 5, 4];
  const innerIndexes = outerIndexes.map((index) => 15 - index);

  return doubleCirclePositions(
    outerIndexes.map((index) => nodeIds[index]).filter(Boolean),
    innerIndexes.map((index) => nodeIds[index]).filter(Boolean),
    235,
    112,
  );
}

function heawoodPositions(
  pointIds: NodeId[],
  lineIds: NodeId[],
): Record<NodeId, Point> {
  return doubleCirclePositions(pointIds, lineIds, 225, 112);
}

function comparabilityPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -145, y: 130 },
    { x: 145, y: 130 },
    { x: -220, y: 0 },
    { x: 0, y: 0 },
    { x: 220, y: 0 },
    { x: -85, y: -135 },
    { x: 85, y: -135 },
  ]);
}

function distanceHereditaryPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -95, y: -95 },
    { x: 95, y: -95 },
    { x: 95, y: 95 },
    { x: -95, y: 95 },
    { x: -235, y: -95 },
    { x: 235, y: 95 },
    { x: 0, y: 185 },
    { x: 0, y: -185 },
  ]);
}

function planarPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -220, y: -145 },
    { x: 220, y: -145 },
    { x: 230, y: 150 },
    { x: -230, y: 150 },
    { x: -78, y: -35 },
    { x: 78, y: -35 },
    { x: 0, y: 82 },
  ]);
}

function blockPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -210, y: 0 },
    { x: -110, y: -105 },
    { x: -90, y: 45 },
    { x: 30, y: -70 },
    { x: 70, y: 75 },
    { x: 190, y: -15 },
    { x: 205, y: 130 },
  ]);
}

function cactusPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -235, y: 5 },
    { x: -145, y: -100 },
    { x: -95, y: 55 },
    { x: 10, y: -95 },
    { x: 120, y: -45 },
    { x: 85, y: 85 },
    { x: 190, y: 50 },
    { x: 260, y: -45 },
    { x: 330, y: 50 },
  ]);
}

function seriesParallelPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: -245, y: 0 },
    { x: -110, y: -135 },
    { x: 105, y: -135 },
    { x: 0, y: 0 },
    { x: -145, y: 135 },
    { x: 0, y: 135 },
    { x: 145, y: 135 },
    { x: 245, y: 0 },
  ]);
}

function partialKTreePositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  return fixedPositions(nodeIds, [
    { x: 104, y: -41 },
    { x: -17, y: 0 },
    { x: -220, y: -81 },
    { x: 64, y: 41 },
    { x: -98, y: 41 },
    { x: 185, y: -81 },
    { x: -17, y: 122 },
  ]);
}

function subsetPairPositions(nodeIds: NodeId[]): Record<NodeId, Point> {
  const outerIndexes = [0, 4, 7, 9, 3];
  const innerIndexes = [1, 5, 8, 6, 2];
  const positions: Record<NodeId, Point> = {};

  Object.assign(
    positions,
    doubleCirclePositions(
      outerIndexes.map((index) => nodeIds[index]).filter(Boolean),
      innerIndexes.map((index) => nodeIds[index]).filter(Boolean),
      220,
      105,
    ),
  );

  return positions;
}

function applyPreferredSampleLayout(
  kind: SampleGraphKind,
  model: GraphModel,
): GraphModel {
  const nodeIds = orderedNodeIds(model);
  const layout = sampleLayoutByKind[kind];

  return layout ? layout(model, nodeIds) : model;
}

type SampleLayout = (model: GraphModel, nodeIds: NodeId[]) => GraphModel;

const byPosition =
  (positions: (nodeIds: NodeId[]) => Record<NodeId, Point>): SampleLayout =>
  (model, nodeIds) =>
    withNodePositions(model, positions(nodeIds));

const bipartiteLayout = (
  positions: (
    leftNodeIds: NodeId[],
    rightNodeIds: NodeId[],
  ) => Record<NodeId, Point>,
): SampleLayout =>
  byPosition((nodeIds) =>
    positions(
      nodeIds.filter((nodeId) => nodeId.startsWith("l")),
      nodeIds.filter((nodeId) => nodeId.startsWith("r")),
    ),
  );

const sampleLayoutByKind: Partial<Record<SampleGraphKind, SampleLayout>> = {
  path: byPosition(pathPositions),
  cycle: byPosition(circlePositions),
  complete: byPosition(circlePositions),
  circle: byPosition(circlePositions),
  paley: byPosition(circlePositions),
  edgeless: byPosition((nodeIds) => gridPositions(nodeIds, 3)),
  star: byPosition(starPositions),
  claw: byPosition(starPositions),
  tree: byPosition(binaryTreePositions),
  chordal: byPosition(chordalPositions),
  interval: byPosition(intervalPositions),
  threshold: byPosition(thresholdPositions),
  split: byPosition((nodeIds) =>
    splitPositions(nodeIds.slice(0, 3), nodeIds.slice(3)),
  ),
  cograph: byPosition(cographPositions),
  line: byPosition(lineGraphPositions),
  permutation: byPosition(permutationPositions),
  comparability: byPosition(comparabilityPositions),
  bipartite: bipartiteLayout(bipartitePositions),
  chain: bipartiteLayout(chainPositions),
  multipartite: byPosition((nodeIds) =>
    multipartitePositions(nodeIds, [1, 2, 3]),
  ),
  grid: byPosition((nodeIds) => gridPositions(nodeIds, 3)),
  knight: byPosition(knightPositions),
  unitDisk: byPosition(unitDiskPositions),
  distanceHereditary: byPosition(distanceHereditaryPositions),
  planar: byPosition(planarPositions),
  outerplanar: byPosition((nodeIds) => circlePositions(nodeIds, 210)),
  block: byPosition(blockPositions),
  cactus: byPosition(cactusPositions),
  seriesParallel: byPosition(seriesParallelPositions),
  partialKTree: byPosition(partialKTreePositions),
  prism: byPosition(prismPositions),
  crown: bipartiteLayout(bipartitePositions),
  dag: byPosition(dagPositions),
  sccDemo: byPosition(sccDemoPositions),
  flowNetwork: byPosition(flowNetworkPositions),
  weighted: byPosition(weightedGraphPositions),
  barbell: byPosition(barbellPositions),
  diamond: byPosition(diamondPositions),
  paw: byPosition(pawPositions),
  bull: byPosition(bullPositions),
  gem: byPosition(gemPositions),
  fan: byPosition(fanPositions),
  friendship: byPosition((nodeIds) => friendshipPositions(nodeIds, 3)),
  turan: byPosition((nodeIds) => multipartitePositions(nodeIds, [3, 3, 2])),
  hypercube: byPosition((nodeIds) => hypercubePositions(nodeIds, 4)),
  clebsch: byPosition(clebschPositions),
  houseX: byPosition(houseXPositions),
  tetrahedral: byPosition(tetrahedralPositions),
  octahedral: byPosition(octahedralPositions),
  icosahedral: byPosition(icosahedralPositions),
  circularArc: byPosition((nodeIds) => circlePositions(nodeIds, 190)),
  heawood: byPosition((nodeIds) =>
    heawoodPositions(
      nodeIds.filter((nodeId) => nodeId.startsWith("p")),
      nodeIds.filter((nodeId) => nodeId.startsWith("l")),
    ),
  ),
  caterpillar: byPosition((nodeIds) => caterpillarPositions(nodeIds, 5)),
  mycielski: byPosition(mycielskiPositions),
  grotzsch: byPosition(mycielskiPositions),
  kneser: byPosition((nodeIds) => circlePositions(nodeIds, 240)),
  johnson: byPosition(subsetPairPositions),
  generalizedPetersen: byPosition((nodeIds) =>
    doubleCirclePositions(
      nodeIds.filter((nodeId) => nodeId.startsWith("o")),
      nodeIds.filter((nodeId) => nodeId.startsWith("i")),
    ),
  ),
  mobiusLadder: byPosition((nodeIds) => circlePositions(nodeIds, 210)),
  dodecahedral: byPosition(dodecahedralPositions),
  moserSpindle: byPosition(moserSpindlePositions),
};

function addNodes(model: GraphModel, count: number): NodeId[] {
  const ids: NodeId[] = [];
  for (let index = 0; index < count; index += 1) {
    const id = `n${index}`;
    ids.push(id);
    model.nodes.push(
      createNode({
        id,
        label: String(index + model.settings.indexBase),
        order: index,
        ...layoutPoint(index, count),
      }),
    );
  }
  return ids;
}

function addUnitEdge(
  model: GraphModel,
  index: number,
  source: NodeId,
  target: NodeId,
): void {
  model.edges.push(
    createEdge({
      id: `e${index}`,
      source,
      target,
      weight: model.settings.weighted ? "1" : undefined,
    }),
  );
}

function createGraphFromEdges(
  nodeCount: number,
  edges: Array<readonly [number, number]>,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const ids = addNodes(model, Math.max(0, nodeCount));

  edges.forEach(([source, target], index) => {
    if (!ids[source] || !ids[target]) return;
    addUnitEdge(model, index, ids[source], ids[target]);
  });

  return model;
}

function completeEdges(nodeCount: number, offset = 0) {
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < nodeCount; source += 1) {
    for (let target = source + 1; target < nodeCount; target += 1) {
      edges.push([source + offset, target + offset]);
    }
  }

  return edges;
}

function hammingWeight(value: number): number {
  let count = 0;
  let next = value;

  while (next > 0) {
    count += next & 1;
    next >>= 1;
  }

  return count;
}

function hammingDistance(first: number, second: number): number {
  return hammingWeight(first ^ second);
}

function combinations(size: number, choose: number): number[][] {
  const result: number[][] = [];
  const current: number[] = [];

  function visit(start: number): void {
    if (current.length === choose) {
      result.push([...current]);
      return;
    }

    for (let value = start; value < size; value += 1) {
      current.push(value);
      visit(value + 1);
      current.pop();
    }
  }

  visit(0);
  return result;
}

function intersectionSize(first: number[], second: number[]): number {
  return first.filter((value) => second.includes(value)).length;
}

function areDisjoint(first: number[], second: number[]): boolean {
  return intersectionSize(first, second) === 0;
}

function createEmptySampleGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createEmptyGraphModel(settings);
}

function createEdgelessGraph(
  nodeCount = 6,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  addNodes(model, Math.max(0, nodeCount));
  return model;
}

function createPathGraph(
  nodeCount = 5,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const ids = addNodes(model, Math.max(0, nodeCount));
  for (let index = 0; index < ids.length - 1; index += 1) {
    addUnitEdge(model, index, ids[index], ids[index + 1]);
  }
  return model;
}

function createCycleGraph(
  nodeCount = 6,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createPathGraph(Math.max(0, nodeCount), settings);
  if (model.nodes.length >= 2) {
    addUnitEdge(
      model,
      model.edges.length,
      model.nodes[model.nodes.length - 1].id,
      model.nodes[0].id,
    );
  }
  return model;
}

function createStarGraph(
  leafCount = 5,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const ids = addNodes(model, Math.max(0, leafCount) + 1);
  for (let index = 1; index < ids.length; index += 1) {
    addUnitEdge(model, index - 1, ids[0], ids[index]);
  }
  return model;
}

function createTreeGraph(
  nodeCount = 7,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const ids = addNodes(model, Math.max(0, nodeCount));
  for (let index = 1; index < ids.length; index += 1) {
    addUnitEdge(model, index - 1, ids[Math.floor((index - 1) / 2)], ids[index]);
  }
  return model;
}

function createCompleteGraph(
  nodeCount = 5,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const ids = addNodes(model, Math.max(0, nodeCount));
  let edgeIndex = 0;

  for (let source = 0; source < ids.length; source += 1) {
    for (let target = source + 1; target < ids.length; target += 1) {
      addUnitEdge(model, edgeIndex, ids[source], ids[target]);
      edgeIndex += 1;
    }
  }

  return model;
}

function createBipartiteGraph(
  leftCount = 3,
  rightCount = 3,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const leftIds: NodeId[] = [];
  const rightIds: NodeId[] = [];
  const maxRows = Math.max(leftCount, rightCount, 1);

  for (let index = 0; index < leftCount; index += 1) {
    const id = `l${index}`;
    leftIds.push(id);
    model.nodes.push(
      createNode({
        id,
        label: String(model.nodes.length + model.settings.indexBase),
        order: model.nodes.length,
        x: -150,
        y: (index - (maxRows - 1) / 2) * 96,
      }),
    );
  }

  for (let index = 0; index < rightCount; index += 1) {
    const id = `r${index}`;
    rightIds.push(id);
    model.nodes.push(
      createNode({
        id,
        label: String(model.nodes.length + model.settings.indexBase),
        order: model.nodes.length,
        x: 150,
        y: (index - (maxRows - 1) / 2) * 96,
      }),
    );
  }

  let edgeIndex = 0;
  leftIds.forEach((source) => {
    rightIds.forEach((target) => {
      addUnitEdge(model, edgeIndex, source, target);
      edgeIndex += 1;
    });
  });

  return model;
}

function createCompleteMultipartiteGraph(
  partSizes = [2, 2, 2],
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const ids = addNodes(
    model,
    partSizes.reduce((sum, size) => sum + size, 0),
  );
  const parts: number[][] = [];
  let cursor = 0;

  partSizes.forEach((size) => {
    parts.push(Array.from({ length: size }, (_, index) => cursor + index));
    cursor += size;
  });

  let edgeIndex = 0;
  for (let sourcePart = 0; sourcePart < parts.length; sourcePart += 1) {
    for (
      let targetPart = sourcePart + 1;
      targetPart < parts.length;
      targetPart += 1
    ) {
      for (const source of parts[sourcePart]) {
        for (const target of parts[targetPart]) {
          addUnitEdge(model, edgeIndex, ids[source], ids[target]);
          edgeIndex += 1;
        }
      }
    }
  }

  return model;
}

function createGridGraph(
  rows = 3,
  columns = 3,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const ids: NodeId[][] = [];

  for (let row = 0; row < rows; row += 1) {
    ids[row] = [];
    for (let column = 0; column < columns; column += 1) {
      const id = `n${row}-${column}`;
      ids[row][column] = id;
      model.nodes.push(
        createNode({
          id,
          label: String(model.nodes.length + model.settings.indexBase),
          order: model.nodes.length,
          x: (column - (columns - 1) / 2) * 96,
          y: (row - (rows - 1) / 2) * 96,
        }),
      );
    }
  }

  let edgeIndex = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (column + 1 < columns) {
        addUnitEdge(model, edgeIndex, ids[row][column], ids[row][column + 1]);
        edgeIndex += 1;
      }
      if (row + 1 < rows) {
        addUnitEdge(model, edgeIndex, ids[row][column], ids[row + 1][column]);
        edgeIndex += 1;
      }
    }
  }

  return model;
}

function createKnightGraph(
  rows = 4,
  columns = 4,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [];
  const moves = [
    [1, 2],
    [2, 1],
  ] as const;
  const indexOf = (row: number, column: number) => row * columns + column;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      for (const [dr, dc] of moves) {
        for (const rowSign of [-1, 1]) {
          for (const columnSign of [-1, 1]) {
            const nextRow = row + dr * rowSign;
            const nextColumn = column + dc * columnSign;
            if (
              nextRow < 0 ||
              nextRow >= rows ||
              nextColumn < 0 ||
              nextColumn >= columns
            ) {
              continue;
            }

            const source = indexOf(row, column);
            const target = indexOf(nextRow, nextColumn);
            if (source < target) {
              edges.push([source, target]);
            }
          }
        }
      }
    }
  }

  return createGraphFromEdges(rows * columns, edges, settings);
}

function createDisconnectedGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const points = [
    { x: -230, y: 0 },
    { x: -120, y: 0 },
    { x: -10, y: 0 },
    { x: 145, y: -95 },
    { x: 255, y: 35 },
    { x: 85, y: 65 },
  ];
  const ids = points.map((point, index) => {
    const id = `n${index}`;
    model.nodes.push(
      createNode({
        id,
        label: String(index + model.settings.indexBase),
        order: index,
        ...point,
      }),
    );
    return id;
  });
  const edges = [
    [0, 1],
    [1, 2],
    [3, 4],
    [4, 5],
    [5, 3],
  ] as const;

  edges.forEach(([source, target], index) => {
    addUnitEdge(model, index, ids[source], ids[target]);
  });

  return model;
}

function createWheelGraph(
  rimCount = 6,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const centerId = "center";
  model.nodes.push(
    createNode({
      id: centerId,
      label: String(model.settings.indexBase),
      order: 0,
      x: 0,
      y: 0,
    }),
  );

  const rimIds: NodeId[] = [];
  for (let index = 0; index < rimCount; index += 1) {
    const id = `r${index}`;
    const point = layoutPoint(index, rimCount);
    rimIds.push(id);
    model.nodes.push(
      createNode({
        id,
        label: String(index + 1 + model.settings.indexBase),
        order: index + 1,
        ...point,
      }),
    );
  }

  let edgeIndex = 0;
  rimIds.forEach((id, index) => {
    addUnitEdge(model, edgeIndex, id, rimIds[(index + 1) % rimIds.length]);
    edgeIndex += 1;
    addUnitEdge(model, edgeIndex, centerId, id);
    edgeIndex += 1;
  });

  return model;
}

function createLadderGraph(
  rungCount = 4,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const topIds: NodeId[] = [];
  const bottomIds: NodeId[] = [];

  for (let index = 0; index < rungCount; index += 1) {
    const topId = `t${index}`;
    const bottomId = `b${index}`;
    const x = (index - (rungCount - 1) / 2) * 110;
    topIds.push(topId);
    bottomIds.push(bottomId);
    model.nodes.push(
      createNode({
        id: topId,
        label: String(model.nodes.length + model.settings.indexBase),
        order: model.nodes.length,
        x,
        y: -70,
      }),
      createNode({
        id: bottomId,
        label: String(model.nodes.length + 1 + model.settings.indexBase),
        order: model.nodes.length + 1,
        x,
        y: 70,
      }),
    );
  }

  let edgeIndex = 0;
  for (let index = 0; index < rungCount; index += 1) {
    addUnitEdge(model, edgeIndex, topIds[index], bottomIds[index]);
    edgeIndex += 1;

    if (index + 1 < rungCount) {
      addUnitEdge(model, edgeIndex, topIds[index], topIds[index + 1]);
      edgeIndex += 1;
      addUnitEdge(model, edgeIndex, bottomIds[index], bottomIds[index + 1]);
      edgeIndex += 1;
    }
  }

  return model;
}

function createCubeGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  const model = createEmptyGraphModel(settings);
  const ids: NodeId[] = [];
  const points = [
    { x: -200, y: -150 },
    { x: 200, y: -150 },
    { x: -200, y: 150 },
    { x: 200, y: 150 },
    { x: -80, y: -60 },
    { x: 80, y: -60 },
    { x: -80, y: 60 },
    { x: 80, y: 60 },
  ];

  points.forEach((point, index) => {
    const id = `n${index}`;
    ids.push(id);
    model.nodes.push(
      createNode({
        id,
        label: String(index + model.settings.indexBase),
        order: index,
        ...point,
      }),
    );
  });

  let edgeIndex = 0;
  for (let source = 0; source < ids.length; source += 1) {
    for (let bit = 0; bit < 3; bit += 1) {
      const target = source ^ (1 << bit);
      if (source < target) {
        addUnitEdge(model, edgeIndex, ids[source], ids[target]);
        edgeIndex += 1;
      }
    }
  }

  return model;
}

function createPrismGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    6,
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [3, 4],
      [4, 5],
      [5, 3],
      [0, 3],
      [1, 4],
      [2, 5],
    ],
    settings,
  );
}

function createCrownGraph(
  partSize = 4,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const leftIds: NodeId[] = [];
  const rightIds: NodeId[] = [];

  for (let index = 0; index < partSize; index += 1) {
    const leftId = `l${index}`;
    const rightId = `r${index}`;
    leftIds.push(leftId);
    rightIds.push(rightId);
    model.nodes.push(
      createNode({
        id: leftId,
        label: String(model.nodes.length + model.settings.indexBase),
        order: model.nodes.length,
        x: -160,
        y: (index - (partSize - 1) / 2) * 86,
      }),
      createNode({
        id: rightId,
        label: String(model.nodes.length + 1 + model.settings.indexBase),
        order: model.nodes.length + 1,
        x: 160,
        y: (index - (partSize - 1) / 2) * 86,
      }),
    );
  }

  let edgeIndex = 0;
  leftIds.forEach((source, sourceIndex) => {
    rightIds.forEach((target, targetIndex) => {
      if (sourceIndex === targetIndex) return;
      addUnitEdge(model, edgeIndex, source, target);
      edgeIndex += 1;
    });
  });

  return model;
}

function createPetersenGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const outerIds: NodeId[] = [];
  const innerIds: NodeId[] = [];

  for (let index = 0; index < 5; index += 1) {
    const outerPoint = layoutPoint(index, 5);
    const innerPoint = {
      x: Math.round(outerPoint.x * 0.46),
      y: Math.round(outerPoint.y * 0.46),
    };
    const outerId = `o${index}`;
    const innerId = `i${index}`;
    outerIds.push(outerId);
    innerIds.push(innerId);
    model.nodes.push(
      createNode({
        id: outerId,
        label: String(model.nodes.length + model.settings.indexBase),
        order: model.nodes.length,
        ...outerPoint,
      }),
      createNode({
        id: innerId,
        label: String(model.nodes.length + 1 + model.settings.indexBase),
        order: model.nodes.length + 1,
        ...innerPoint,
      }),
    );
  }

  let edgeIndex = 0;
  for (let index = 0; index < 5; index += 1) {
    addUnitEdge(model, edgeIndex, outerIds[index], outerIds[(index + 1) % 5]);
    edgeIndex += 1;
    addUnitEdge(model, edgeIndex, outerIds[index], innerIds[index]);
    edgeIndex += 1;
    addUnitEdge(model, edgeIndex, innerIds[index], innerIds[(index + 2) % 5]);
    edgeIndex += 1;
  }

  return model;
}

function createHouseGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  const model = createEmptyGraphModel(settings);
  const points = [
    { x: -120, y: 80 },
    { x: 120, y: 80 },
    { x: 120, y: -70 },
    { x: -120, y: -70 },
    { x: 0, y: -175 },
  ];
  const ids = points.map((point, index) => {
    const id = `n${index}`;
    model.nodes.push(
      createNode({
        id,
        label: String(index + model.settings.indexBase),
        order: index,
        ...point,
      }),
    );
    return id;
  });
  const edges = [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 0],
    [3, 4],
    [4, 2],
  ] as const;

  edges.forEach(([source, target], index) => {
    addUnitEdge(model, index, ids[source], ids[target]);
  });

  return model;
}

function createButterflyGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const points = [
    { x: 0, y: 0 },
    { x: -145, y: -95 },
    { x: -145, y: 95 },
    { x: 145, y: -95 },
    { x: 145, y: 95 },
  ];
  const ids = points.map((point, index) => {
    const id = `n${index}`;
    model.nodes.push(
      createNode({
        id,
        label: String(index + model.settings.indexBase),
        order: index,
        ...point,
      }),
    );
    return id;
  });
  const edges = [
    [0, 1],
    [1, 2],
    [2, 0],
    [0, 3],
    [3, 4],
    [4, 0],
  ] as const;

  edges.forEach(([source, target], index) => {
    addUnitEdge(model, index, ids[source], ids[target]);
  });

  return model;
}

function createClawGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createStarGraph(3, settings);
}

function createDiamondGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    4,
    [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
    ],
    settings,
  );
}

function createPawGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    4,
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [2, 3],
    ],
    settings,
  );
}

function createBullGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    5,
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [0, 3],
      [1, 4],
    ],
    settings,
  );
}

function createGemGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    5,
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
    ],
    settings,
  );
}

function createFanGraph(
  pathNodeCount = 5,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [];
  const hub = pathNodeCount;

  for (let index = 0; index < pathNodeCount - 1; index += 1) {
    edges.push([index, index + 1]);
  }

  for (let index = 0; index < pathNodeCount; index += 1) {
    edges.push([hub, index]);
  }

  return createGraphFromEdges(pathNodeCount + 1, edges, settings);
}

function createFriendshipGraph(
  triangleCount = 3,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [];

  for (let index = 0; index < triangleCount; index += 1) {
    const first = index * 2 + 1;
    const second = first + 1;
    edges.push([0, first], [first, second], [second, 0]);
  }

  return createGraphFromEdges(triangleCount * 2 + 1, edges, settings);
}

function createTuranGraph(
  nodeCount = 8,
  partCount = 3,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const partSizes = Array.from({ length: partCount }, (_, index) =>
    Math.floor((nodeCount + partCount - index - 1) / partCount),
  );

  return createCompleteMultipartiteGraph(partSizes, settings);
}

function createHypercubeGraph(
  dimension = 4,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const nodeCount = 2 ** dimension;
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < nodeCount; source += 1) {
    for (let bit = 0; bit < dimension; bit += 1) {
      const target = source ^ (1 << bit);
      if (source < target) {
        edges.push([source, target]);
      }
    }
  }

  const model = createGraphFromEdges(nodeCount, edges, settings);

  return withNodeLabels(model, bitLabels(nodeCount, dimension));
}

function createHouseXGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    5,
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [4, 2],
      [0, 2],
      [1, 3],
    ],
    settings,
  );
}

function createTetrahedralGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createCompleteGraph(4, settings);
}

function createOctahedralGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createGraphFromEdges(
    6,
    completeEdges(6).filter(
      ([source, target]) =>
        !(
          (source === 0 && target === 1) ||
          (source === 2 && target === 3) ||
          (source === 4 && target === 5)
        ),
    ),
    settings,
  );
}

function createIcosahedralGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [];

  for (let index = 0; index < 5; index += 1) {
    const upper = index + 1;
    const nextUpper = ((index + 1) % 5) + 1;
    const lower = index + 6;
    const previousLower = ((index + 4) % 5) + 6;
    const nextLower = ((index + 1) % 5) + 6;

    edges.push(
      [0, upper],
      [upper, nextUpper],
      [upper, lower],
      [upper, previousLower],
      [11, lower],
      [lower, nextLower],
    );
  }

  return createGraphFromEdges(12, edges, settings);
}

function createHeawoodGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  const model = createEmptyGraphModel(settings);
  const pointIds: NodeId[] = [];
  const lineIds: NodeId[] = [];

  for (let index = 0; index < 7; index += 1) {
    const pointId = `p${index}`;
    const lineId = `l${index}`;
    pointIds.push(pointId);
    lineIds.push(lineId);
    model.nodes.push(
      createNode({
        id: pointId,
        label: `P${index + 1}`,
        order: model.nodes.length,
        x: -150,
        y: (index - 3) * 74,
      }),
      createNode({
        id: lineId,
        label: `L${index + 1}`,
        order: model.nodes.length + 1,
        x: 150,
        y: (index - 3) * 74,
      }),
    );
  }

  const fanoLines = [
    [0, 1, 3],
    [1, 2, 4],
    [2, 3, 5],
    [3, 4, 6],
    [4, 5, 0],
    [5, 6, 1],
    [6, 0, 2],
  ] as const;

  let edgeIndex = 0;
  fanoLines.forEach((points, lineIndex) => {
    points.forEach((pointIndex) => {
      addUnitEdge(model, edgeIndex, pointIds[pointIndex], lineIds[lineIndex]);
      edgeIndex += 1;
    });
  });

  return model;
}

function createCaterpillarGraph(
  spineCount = 5,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [];

  for (let index = 0; index < spineCount - 1; index += 1) {
    edges.push([index, index + 1]);
  }

  for (let index = 0; index < spineCount; index += 1) {
    edges.push([index, spineCount + index * 2]);
    edges.push([index, spineCount + index * 2 + 1]);
  }

  return createGraphFromEdges(spineCount * 3, edges, settings);
}

function createChordalGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    6,
    [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
      [1, 4],
      [2, 4],
      [2, 5],
      [3, 5],
    ],
    settings,
  );
}

function createIntervalGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const intervals = [
    [0, 3],
    [1, 4],
    [2, 5],
    [5, 7],
    [6, 9],
    [8, 10],
  ] as const;
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < intervals.length; source += 1) {
    for (let target = source + 1; target < intervals.length; target += 1) {
      if (
        intervals[source][0] <= intervals[target][1] &&
        intervals[target][0] <= intervals[source][1]
      ) {
        edges.push([source, target]);
      }
    }
  }

  return createGraphFromEdges(intervals.length, edges, settings);
}

function createSplitGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    7,
    [
      ...completeEdges(3),
      [3, 0],
      [4, 0],
      [4, 1],
      [5, 1],
      [5, 2],
      [6, 0],
      [6, 1],
      [6, 2],
    ],
    settings,
  );
}

function createCographGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    6,
    [
      [0, 1],
      [0, 2],
      [1, 2],
      [3, 4],
      [5, 0],
      [5, 1],
      [5, 2],
      [5, 3],
      [5, 4],
    ],
    settings,
  );
}

function createThresholdGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createGraphFromEdges(
    6,
    [
      [0, 1],
      [0, 3],
      [1, 3],
      [2, 3],
      [0, 4],
      [1, 4],
      [2, 4],
      [3, 4],
    ],
    settings,
  );
}

function createLineGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < 8; source += 1) {
    for (let target = source + 1; target < 8; target += 1) {
      const sameSide = Math.floor(source / 4) === Math.floor(target / 4);
      const sameColumn = source % 4 === target % 4;

      if (sameSide || sameColumn) {
        edges.push([source, target]);
      }
    }
  }

  return createGraphFromEdges(8, edges, settings);
}

function createPermutationGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < PERMUTATION_ORDER.length; source += 1) {
    for (
      let target = source + 1;
      target < PERMUTATION_ORDER.length;
      target += 1
    ) {
      if (PERMUTATION_ORDER[source] > PERMUTATION_ORDER[target]) {
        edges.push([source, target]);
      }
    }
  }

  return createGraphFromEdges(PERMUTATION_ORDER.length, edges, settings);
}

function createComparabilityGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createGraphFromEdges(
    7,
    [
      [0, 2],
      [0, 3],
      [1, 3],
      [1, 4],
      [2, 5],
      [3, 5],
      [3, 6],
      [4, 6],
      [0, 5],
      [0, 6],
      [1, 5],
      [1, 6],
    ],
    settings,
  );
}

function createChainGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  const model = createEmptyGraphModel(settings);
  const leftIds: NodeId[] = [];
  const rightIds: NodeId[] = [];

  for (let index = 0; index < 3; index += 1) {
    const leftId = `l${index}`;
    const rightId = `r${index}`;
    leftIds.push(leftId);
    rightIds.push(rightId);
    model.nodes.push(
      createNode({
        id: leftId,
        label: String(model.nodes.length + model.settings.indexBase),
        order: model.nodes.length,
        x: -150,
        y: (index - 1) * 96,
      }),
      createNode({
        id: rightId,
        label: String(model.nodes.length + 1 + model.settings.indexBase),
        order: model.nodes.length + 1,
        x: 150,
        y: (index - 1) * 96,
      }),
    );
  }

  let edgeIndex = 0;
  leftIds.forEach((source, sourceIndex) => {
    rightIds.slice(0, 3 - sourceIndex).forEach((target) => {
      addUnitEdge(model, edgeIndex, source, target);
      edgeIndex += 1;
    });
  });

  return model;
}

function createDistanceHereditaryGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createGraphFromEdges(
    8,
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 4],
      [2, 5],
      [0, 6],
      [2, 6],
      [1, 7],
      [3, 7],
    ],
    settings,
  );
}

function createPlanarGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    7,
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [0, 4],
      [1, 5],
      [2, 5],
      [2, 6],
      [3, 6],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 4],
    ],
    settings,
  );
}

function createOuterplanarGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const nodeCount = 7;
  const edges: Array<readonly [number, number]> = [];

  for (let index = 0; index < nodeCount; index += 1) {
    edges.push([index, (index + 1) % nodeCount]);
  }

  for (let index = 2; index < nodeCount - 1; index += 1) {
    edges.push([0, index]);
  }

  return createGraphFromEdges(nodeCount, edges, settings);
}

function createBlockGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    7,
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [2, 3],
      [3, 4],
      [4, 2],
      [4, 5],
      [5, 6],
      [6, 4],
    ],
    settings,
  );
}

function createCactusGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    9,
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 2],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 6],
    ],
    settings,
  );
}

function createSeriesParallelGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createGraphFromEdges(
    8,
    [
      [0, 1],
      [1, 2],
      [2, 7],
      [0, 3],
      [3, 7],
      [0, 4],
      [4, 5],
      [5, 6],
      [6, 7],
    ],
    settings,
  );
}

function createPartialKTreeGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createGraphFromEdges(
    7,
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [0, 3],
      [1, 3],
      [1, 4],
      [2, 4],
      [2, 5],
      [3, 5],
      [3, 6],
      [4, 6],
    ],
    settings,
  );
}

function createCircleGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  const chords = [
    [2, 6],
    [4, 12],
    [1, 9],
    [7, 11],
    [5, 8],
    [0, 3],
    [10, 13],
  ] as const;
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < chords.length; source += 1) {
    for (let target = source + 1; target < chords.length; target += 1) {
      if (chordEndpointsCross(chords[source], chords[target])) {
        edges.push([source, target]);
      }
    }
  }

  return createGraphFromEdges(chords.length, edges, settings);
}

function createCircularArcGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const arcs = [
    [0, 3.2],
    [2, 5],
    [3, 6.2],
    [6, 9.2],
    [8.5, 11],
    [9, 1],
  ] as const;
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < arcs.length; source += 1) {
    for (let target = source + 1; target < arcs.length; target += 1) {
      if (circularArcsIntersect(arcs[source], arcs[target])) {
        edges.push([source, target]);
      }
    }
  }

  return createGraphFromEdges(arcs.length, edges, settings);
}

function createUnitDiskGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [];
  const radius = 125;

  for (let source = 0; source < UNIT_DISK_POINTS.length; source += 1) {
    for (
      let target = source + 1;
      target < UNIT_DISK_POINTS.length;
      target += 1
    ) {
      const dx = UNIT_DISK_POINTS[source].x - UNIT_DISK_POINTS[target].x;
      const dy = UNIT_DISK_POINTS[source].y - UNIT_DISK_POINTS[target].y;
      if (Math.hypot(dx, dy) <= radius) {
        edges.push([source, target]);
      }
    }
  }

  return createGraphFromEdges(UNIT_DISK_POINTS.length, edges, settings);
}

function createMycielskiGraph(
  baseCycleNodeCountOrSettings: number | Partial<GraphSettings> = 5,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [];
  const baseCycleNodeCount =
    typeof baseCycleNodeCountOrSettings === "number"
      ? baseCycleNodeCountOrSettings
      : 5;
  const actualSettings =
    typeof baseCycleNodeCountOrSettings === "number"
      ? settings
      : baseCycleNodeCountOrSettings;
  const baseCount = Math.max(3, baseCycleNodeCount);

  for (let index = 0; index < baseCount; index += 1) {
    const next = (index + 1) % baseCount;
    edges.push(
      [index, next],
      [index, next + baseCount],
      [next, index + baseCount],
    );
  }

  for (let index = baseCount; index < baseCount * 2; index += 1) {
    edges.push([index, baseCount * 2]);
  }

  const model = createGraphFromEdges(baseCount * 2 + 1, edges, actualSettings);

  return withNodeLabels(model, [
    ...Array.from({ length: baseCount }, (_, index) => `v${index + 1}`),
    ...Array.from({ length: baseCount }, (_, index) => `u${index + 1}`),
    "w",
  ]);
}

function createKneserGraph(
  setSizeOrSettings: number | Partial<GraphSettings> = 6,
  subsetSizeOrSettings: number | Partial<GraphSettings> = 2,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const setSize = typeof setSizeOrSettings === "number" ? setSizeOrSettings : 6;
  const subsetSize =
    typeof subsetSizeOrSettings === "number" ? subsetSizeOrSettings : 2;
  const actualSettings =
    typeof setSizeOrSettings === "number"
      ? typeof subsetSizeOrSettings === "number"
        ? settings
        : subsetSizeOrSettings
      : setSizeOrSettings;
  const sets = combinations(setSize, subsetSize);
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < sets.length; source += 1) {
    for (let target = source + 1; target < sets.length; target += 1) {
      if (areDisjoint(sets[source], sets[target])) {
        edges.push([source, target]);
      }
    }
  }

  const model = createGraphFromEdges(sets.length, edges, actualSettings);

  return withNodeLabels(
    model,
    sets.map((set) => subsetLabel(set)),
  );
}

function createJohnsonGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  const sets = combinations(5, 2);
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < sets.length; source += 1) {
    for (let target = source + 1; target < sets.length; target += 1) {
      if (intersectionSize(sets[source], sets[target]) === 1) {
        edges.push([source, target]);
      }
    }
  }

  const model = createGraphFromEdges(sets.length, edges, settings);

  return withNodeLabels(
    model,
    sets.map((set) => subsetLabel(set)),
  );
}

function createPaleyGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  const order = 13;
  const residues = new Set([1, 3, 4, 9, 10, 12]);
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < order; source += 1) {
    for (let target = source + 1; target < order; target += 1) {
      if (residues.has((target - source + order) % order)) {
        edges.push([source, target]);
      }
    }
  }

  const model = createGraphFromEdges(order, edges, settings);

  return withNodeLabels(
    model,
    Array.from({ length: order }, (_, value) => String(value)),
  );
}

function createGeneralizedPetersenGraph(
  vertexCount = 7,
  skip = 2,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = createEmptyGraphModel(settings);
  const outerIds: NodeId[] = [];
  const innerIds: NodeId[] = [];

  for (let index = 0; index < vertexCount; index += 1) {
    const outerId = `o${index}`;
    const innerId = `i${index}`;
    outerIds.push(outerId);
    innerIds.push(innerId);
    model.nodes.push(
      createNode({
        id: outerId,
        label: String(model.nodes.length + model.settings.indexBase),
        order: model.nodes.length,
        ...layoutPoint(index, vertexCount),
      }),
      createNode({
        id: innerId,
        label: String(model.nodes.length + 1 + model.settings.indexBase),
        order: model.nodes.length + 1,
        x: Math.round(layoutPoint(index, vertexCount).x * 0.5),
        y: Math.round(layoutPoint(index, vertexCount).y * 0.5),
      }),
    );
  }

  let edgeIndex = 0;
  for (let index = 0; index < vertexCount; index += 1) {
    addUnitEdge(
      model,
      edgeIndex,
      outerIds[index],
      outerIds[(index + 1) % vertexCount],
    );
    edgeIndex += 1;
    addUnitEdge(model, edgeIndex, outerIds[index], innerIds[index]);
    edgeIndex += 1;
    addUnitEdge(
      model,
      edgeIndex,
      innerIds[index],
      innerIds[(index + skip) % vertexCount],
    );
    edgeIndex += 1;
  }

  return model;
}

function createClebschGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  const edges: Array<readonly [number, number]> = [];

  for (let source = 0; source < 16; source += 1) {
    for (let target = source + 1; target < 16; target += 1) {
      const distance = hammingDistance(source, target);
      if (distance === 1 || distance === 4) {
        edges.push([source, target]);
      }
    }
  }

  const model = createGraphFromEdges(16, edges, settings);

  return withNodeLabels(model, bitLabels(16, 4));
}

function createDagGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    6,
    [
      [0, 1],
      [0, 2],
      [1, 3],
      [1, 4],
      [2, 4],
      [3, 5],
      [4, 5],
    ],
    { ...settings, directed: true },
  );
}

function createSccDemoGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    7,
    [
      [0, 1],
      [1, 2],
      [2, 0],
      [2, 3],
      [3, 4],
      [4, 3],
      [4, 5],
      [5, 6],
      [6, 5],
    ],
    { ...settings, directed: true },
  );
}

function createFlowNetworkGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [
    [0, 1],
    [0, 2],
    [1, 3],
    [1, 4],
    [2, 4],
    [3, 5],
    [4, 5],
    [1, 5],
  ];
  const weights = ["10", "8", "5", "4", "7", "7", "10", "6"];
  const model = createGraphFromEdges(6, edges, {
    ...settings,
    directed: true,
    weighted: true,
    weightKind: "number",
  });

  model.edges = model.edges.map((edge, index) => ({
    ...edge,
    weight: weights[index],
  }));

  return withNodeLabels(model, ["s", "a", "b", "c", "d", "t"]);
}

function createWeightedGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const edges: Array<readonly [number, number]> = [
    [0, 1],
    [0, 2],
    [1, 2],
    [1, 3],
    [2, 3],
    [2, 4],
    [3, 4],
    [3, 5],
    [4, 5],
  ];
  const weights = ["4", "2", "1", "5", "8", "10", "2", "6", "3"];
  const model = createGraphFromEdges(6, edges, {
    ...settings,
    weighted: true,
    weightKind: "number",
  });

  model.edges = model.edges.map((edge, index) => ({
    ...edge,
    weight: weights[index],
  }));

  return model;
}

function createBarbellGraph(settings: Partial<GraphSettings> = {}): GraphModel {
  return createGraphFromEdges(
    8,
    [
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
      [4, 5],
      [4, 6],
      [4, 7],
      [5, 6],
      [5, 7],
      [6, 7],
      [2, 4],
    ],
    settings,
  );
}

function createMobiusLadderGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createGraphFromEdges(
    8,
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 0],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ],
    settings,
  );
}

function createMoserSpindleGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createGraphFromEdges(
    7,
    [
      [0, 1],
      [0, 2],
      [1, 2],
      [1, 3],
      [2, 3],
      [3, 4],
      [3, 5],
      [4, 5],
      [4, 6],
      [5, 6],
      [0, 6],
    ],
    settings,
  );
}

function createDodecahedralGraph(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return createGraphFromEdges(
    20,
    [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
      [4, 0],
      [5, 6],
      [6, 7],
      [7, 8],
      [8, 9],
      [9, 10],
      [10, 11],
      [11, 12],
      [12, 13],
      [13, 14],
      [14, 5],
      [15, 16],
      [16, 17],
      [17, 18],
      [18, 19],
      [19, 15],
      [0, 5],
      [1, 7],
      [2, 9],
      [3, 11],
      [4, 13],
      [15, 6],
      [16, 8],
      [17, 10],
      [18, 12],
      [19, 14],
    ],
    settings,
  );
}

const sampleGraphFactories = {
  empty: (settings) => createEmptySampleGraph(settings),
  path: (settings) => createPathGraph(6, settings),
  cycle: (settings) => createCycleGraph(6, settings),
  edgeless: (settings) => createEdgelessGraph(6, settings),
  star: (settings) => createStarGraph(5, settings),
  tree: (settings) => createTreeGraph(7, settings),
  complete: (settings) => createCompleteGraph(5, settings),
  bipartite: (settings) => createBipartiteGraph(3, 3, settings),
  multipartite: (settings) =>
    createCompleteMultipartiteGraph([1, 2, 3], settings),
  grid: (settings) => createGridGraph(3, 3, settings),
  disconnected: (settings) => createDisconnectedGraph(settings),
  wheel: (settings) => createWheelGraph(6, settings),
  ladder: (settings) => createLadderGraph(4, settings),
  cube: (settings) => createCubeGraph(settings),
  prism: (settings) => createPrismGraph(settings),
  crown: (settings) => createCrownGraph(5, settings),
  knight: (settings) => createKnightGraph(4, 4, settings),
  petersen: (settings) => createPetersenGraph(settings),
  house: (settings) => createHouseGraph(settings),
  butterfly: (settings) => createButterflyGraph(settings),
  claw: (settings) => createClawGraph(settings),
  diamond: (settings) => createDiamondGraph(settings),
  paw: (settings) => createPawGraph(settings),
  bull: (settings) => createBullGraph(settings),
  gem: (settings) => createGemGraph(settings),
  fan: (settings) => createFanGraph(5, settings),
  friendship: (settings) => createFriendshipGraph(3, settings),
  turan: (settings) => createTuranGraph(8, 3, settings),
  hypercube: (settings) => createHypercubeGraph(4, settings),
  houseX: (settings) => createHouseXGraph(settings),
  tetrahedral: (settings) => createTetrahedralGraph(settings),
  octahedral: (settings) => createOctahedralGraph(settings),
  icosahedral: (settings) => createIcosahedralGraph(settings),
  heawood: (settings) => createHeawoodGraph(settings),
  caterpillar: (settings) => createCaterpillarGraph(5, settings),
  chordal: (settings) => createChordalGraph(settings),
  interval: (settings) => createIntervalGraph(settings),
  split: (settings) => createSplitGraph(settings),
  cograph: (settings) => createCographGraph(settings),
  threshold: (settings) => createThresholdGraph(settings),
  line: (settings) => createLineGraph(settings),
  permutation: (settings) => createPermutationGraph(settings),
  comparability: (settings) => createComparabilityGraph(settings),
  chain: (settings) => createChainGraph(settings),
  distanceHereditary: (settings) => createDistanceHereditaryGraph(settings),
  planar: (settings) => createPlanarGraph(settings),
  outerplanar: (settings) => createOuterplanarGraph(settings),
  block: (settings) => createBlockGraph(settings),
  cactus: (settings) => createCactusGraph(settings),
  seriesParallel: (settings) => createSeriesParallelGraph(settings),
  partialKTree: (settings) => createPartialKTreeGraph(settings),
  circle: (settings) => createCircleGraph(settings),
  circularArc: (settings) => createCircularArcGraph(settings),
  unitDisk: (settings) => createUnitDiskGraph(settings),
  mycielski: (settings) => createMycielskiGraph(4, settings),
  kneser: (settings) => createKneserGraph(6, 2, settings),
  johnson: (settings) => createJohnsonGraph(settings),
  paley: (settings) => createPaleyGraph(settings),
  generalizedPetersen: (settings) =>
    createGeneralizedPetersenGraph(7, 2, settings),
  clebsch: (settings) => createClebschGraph(settings),
  dag: (settings) => createDagGraph(settings),
  sccDemo: (settings) => createSccDemoGraph(settings),
  flowNetwork: (settings) => createFlowNetworkGraph(settings),
  weighted: (settings) => createWeightedGraph(settings),
  barbell: (settings) => createBarbellGraph(settings),
  mobiusLadder: (settings) => createMobiusLadderGraph(settings),
  grotzsch: (settings) => createMycielskiGraph(5, settings),
  moserSpindle: (settings) => createMoserSpindleGraph(settings),
  dodecahedral: (settings) => createDodecahedralGraph(settings),
} satisfies Record<string, SampleGraphFactory>;

export const sampleGraphKinds = Object.keys(
  sampleGraphFactories,
) as SampleGraphKind[];

export function createSampleGraph(
  kind: SampleGraphKind,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model = sampleGraphFactories[kind](settings);
  return applyPreferredSampleLayout(kind, model);
}
