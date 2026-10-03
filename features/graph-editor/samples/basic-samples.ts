import {
  createEdge,
  createEmptyGraphModel,
  createNode,
} from "../core/graph/graph-factory";
import type { GraphModel, GraphSettings, NodeId } from "../core/graph/model";

type Point = { x: number; y: number };

export const popularSampleGraphKinds = ["cycle", "tree", "grid"] as const;
export type PopularSampleGraphKind = (typeof popularSampleGraphKinds)[number];

/** The starter screen needs only these three samples, before the gallery loads. */
export function createPopularSampleGraph(
  kind: PopularSampleGraphKind,
  settings: Partial<GraphSettings> = {},
): GraphModel {
  const model =
    kind === "cycle"
      ? createCycleGraph(6, settings)
      : kind === "tree"
        ? createTreeGraph(7, settings)
        : createGridGraph(3, 3, settings);
  const nodeIds = orderedNodeIds(model);
  const positions =
    kind === "cycle"
      ? circlePositions(nodeIds)
      : kind === "tree"
        ? binaryTreePositions(nodeIds)
        : gridPositions(nodeIds, 3);

  return withNodePositions(model, positions);
}

export function layoutPoint(
  index: number,
  count: number,
): { x: number; y: number } {
  if (count <= 1) return { x: 0, y: 0 };
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
  const radius = Math.max(170, count * 24);
  return {
    x: Math.round(Math.cos(angle) * radius),
    y: Math.round(Math.sin(angle) * radius),
  };
}

export function orderedNodeIds(model: GraphModel): NodeId[] {
  return [...model.nodes]
    .sort((a, b) => a.order - b.order)
    .map((node) => node.id);
}

export function withNodePositions(
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

export function gridPositions(
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

export function circlePositions(
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

export function binaryTreePositions(nodeIds: NodeId[]): Record<NodeId, Point> {
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

export function addNodes(model: GraphModel, count: number): NodeId[] {
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

export function addUnitEdge(
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

export function createPathGraph(
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

export function createCycleGraph(
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

export function createTreeGraph(
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

export function createGridGraph(
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
