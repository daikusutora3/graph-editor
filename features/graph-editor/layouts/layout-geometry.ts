import type { NodeId } from "../core/graph/model";

export const LAYOUT_NODE_CLEARANCE = 104;
export const LAYOUT_COMPONENT_GAP = 180;
export const LAYOUT_CIRCLE_MIN_RADIUS = 120;

export function layoutCircle(nodeIds: NodeId[], minimumRadius: number) {
  if (nodeIds.length <= 1) {
    return Object.fromEntries(
      nodeIds.map((nodeId) => [nodeId, { x: 0, y: 0 }]),
    ) as Record<NodeId, { x: number; y: number }>;
  }

  const radius = Math.max(
    minimumRadius,
    nodeIds.length * 20,
    circleRadiusForSpacing(nodeIds.length),
  );

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
  ) as Record<NodeId, { x: number; y: number }>;
}

export function layoutCircleRadius(nodeCount: number) {
  return Math.max(
    LAYOUT_CIRCLE_MIN_RADIUS,
    nodeCount * 20,
    circleRadiusForSpacing(nodeCount),
  );
}

export function circleRadiusForSpacing(nodeCount: number) {
  if (nodeCount <= 1) return 0;

  return Math.ceil(LAYOUT_NODE_CLEARANCE / (2 * Math.sin(Math.PI / nodeCount)));
}

export function pseudoRandom(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

export function normalizePositions(
  positions: Record<NodeId, { x: number; y: number }>,
) {
  const entries = Object.entries(positions);
  if (entries.length === 0) return positions;

  const center = entries.reduce(
    (sum, [, point]) => ({
      x: sum.x + point.x / entries.length,
      y: sum.y + point.y / entries.length,
    }),
    { x: 0, y: 0 },
  );

  return Object.fromEntries(
    entries.map(([nodeId, point]) => [
      nodeId,
      {
        x: Math.round(point.x - center.x),
        y: Math.round(point.y - center.y),
      },
    ]),
  ) as Record<NodeId, { x: number; y: number }>;
}

export function normalizeForcePositions(
  positions: Record<NodeId, { x: number; y: number }>,
  edges: ReadonlyArray<readonly [NodeId, NodeId]>,
  targetEdgeLength: number,
) {
  let normalized = normalizePositions(positions);
  const edgeLengths = edges
    .map(([source, target]) => {
      const sourcePoint = normalized[source];
      const targetPoint = normalized[target];

      if (!sourcePoint || !targetPoint) return 0;

      return Math.hypot(
        sourcePoint.x - targetPoint.x,
        sourcePoint.y - targetPoint.y,
      );
    })
    .filter((length) => length > 1)
    .sort((a, b) => a - b);
  const medianEdgeLength = median(edgeLengths);

  if (medianEdgeLength > 0) {
    normalized = scalePositions(
      normalized,
      targetEdgeLength / medianEdgeLength,
    );
  }

  const nearestDistance = nearestNodeDistance(normalized);

  if (nearestDistance > 0 && nearestDistance < LAYOUT_NODE_CLEARANCE) {
    normalized = scalePositions(
      normalized,
      LAYOUT_NODE_CLEARANCE / nearestDistance,
    );
  }

  return normalized;
}

export function packPositionGroups(
  groups: Array<Record<NodeId, { x: number; y: number }>>,
) {
  if (groups.length <= 1) {
    return normalizePositions(groups[0] ?? {});
  }

  const bounds = groups.map(positionBounds);
  const columns = Math.ceil(Math.sqrt(groups.length));
  const columnWidths = Array.from({ length: columns }, () => 0);
  const rowCount = Math.ceil(groups.length / columns);
  const rowHeights = Array.from({ length: rowCount }, () => 0);

  bounds.forEach((bound, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);

    columnWidths[column] = Math.max(columnWidths[column], bound.width);
    rowHeights[row] = Math.max(rowHeights[row], bound.height);
  });

  const columnOffsets = cumulativeOffsets(columnWidths, LAYOUT_COMPONENT_GAP);
  const rowOffsets = cumulativeOffsets(rowHeights, LAYOUT_COMPONENT_GAP);
  const packed: Record<NodeId, { x: number; y: number }> = {};

  groups.forEach((group, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const bound = bounds[index];
    const offsetX =
      columnOffsets[column] + (columnWidths[column] - bound.width) / 2;
    const offsetY = rowOffsets[row] + (rowHeights[row] - bound.height) / 2;

    for (const [nodeId, point] of Object.entries(group)) {
      packed[nodeId] = {
        x: Math.round(point.x - bound.minX + offsetX),
        y: Math.round(point.y - bound.minY + offsetY),
      };
    }
  });

  return normalizePositions(packed);
}

export function packPositionColumns(
  columns: Array<Array<Record<NodeId, { x: number; y: number }>>>,
  columnGap: number,
  rowGap: number,
) {
  const visibleColumns = columns.filter((column) => column.length > 0);

  if (visibleColumns.length === 0) {
    return {};
  }

  const columnBounds = visibleColumns.map((column) =>
    column.map(positionBounds),
  );
  const columnWidths = columnBounds.map((bounds) =>
    Math.max(0, ...bounds.map((bound) => bound.width)),
  );
  const columnHeights = columnBounds.map((bounds) =>
    bounds.reduce(
      (height, bound, index) =>
        height + bound.height + (index > 0 ? rowGap : 0),
      0,
    ),
  );
  const columnOffsets = cumulativeOffsets(columnWidths, columnGap);
  const packed: Record<NodeId, { x: number; y: number }> = {};

  visibleColumns.forEach((column, columnIndex) => {
    const bounds = columnBounds[columnIndex];
    let nextY = -columnHeights[columnIndex] / 2;

    column.forEach((group, rowIndex) => {
      const bound = bounds[rowIndex];
      const offsetX =
        columnOffsets[columnIndex] +
        (columnWidths[columnIndex] - bound.width) / 2;
      const offsetY = nextY;

      for (const [nodeId, point] of Object.entries(group)) {
        packed[nodeId] = {
          x: Math.round(point.x - bound.minX + offsetX),
          y: Math.round(point.y - bound.minY + offsetY),
        };
      }

      nextY += bound.height + rowGap;
    });
  });

  return normalizePositions(packed);
}

export function scalePositions(
  positions: Record<NodeId, { x: number; y: number }>,
  scale: number,
) {
  return Object.fromEntries(
    Object.entries(positions).map(([nodeId, point]) => [
      nodeId,
      {
        x: point.x * scale,
        y: point.y * scale,
      },
    ]),
  ) as Record<NodeId, { x: number; y: number }>;
}

export function ensureMinimumNodeDistance(
  positions: Record<NodeId, { x: number; y: number }>,
) {
  const nearestDistance = nearestNodeDistance(positions);

  if (nearestDistance <= 0 || nearestDistance >= LAYOUT_NODE_CLEARANCE) {
    return positions;
  }

  return scalePositions(positions, LAYOUT_NODE_CLEARANCE / nearestDistance);
}

function positionBounds(positions: Record<NodeId, { x: number; y: number }>) {
  const points = Object.values(positions);

  if (points.length === 0) {
    return { minX: 0, minY: 0, width: 0, height: 0 };
  }

  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

function cumulativeOffsets(sizes: number[], gap: number) {
  let nextOffset = 0;

  return sizes.map((size) => {
    const offset = nextOffset;
    nextOffset += size + gap;
    return offset;
  });
}

function median(values: number[]) {
  if (values.length === 0) return 0;

  const middle = Math.floor(values.length / 2);

  if (values.length % 2 === 1) {
    return values[middle];
  }

  return (values[middle - 1] + values[middle]) / 2;
}

function nearestNodeDistance(
  positions: Record<NodeId, { x: number; y: number }>,
) {
  const points = Object.values(positions);
  let nearest = Number.POSITIVE_INFINITY;

  for (let first = 0; first < points.length; first += 1) {
    for (let second = first + 1; second < points.length; second += 1) {
      nearest = Math.min(
        nearest,
        Math.hypot(
          points[first].x - points[second].x,
          points[first].y - points[second].y,
        ),
      );
    }
  }

  return Number.isFinite(nearest) ? nearest : 0;
}
