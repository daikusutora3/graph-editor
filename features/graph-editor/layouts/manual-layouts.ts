import { createMoveNodesCommand } from "../core/graph/graph-intents";
import type { GraphModel, NodeId } from "../core/graph/model";
import {
  componentOrder,
  connectedComponents,
  degreeMap,
  directedAdjacency,
  isBipartite,
  isDirectedAcyclic,
  isForest,
  orderBipartiteSide,
  orderedNodeIds,
  orderIndex,
  pathOrder,
  prioritizeRoot,
  stronglyConnectedComponents,
  undirectedAdjacency,
} from "../core/graph/graph-analysis";
import {
  circleRadiusForSpacing,
  ensureMinimumNodeDistance,
  layoutCircle,
  layoutCircleRadius,
  LAYOUT_CIRCLE_MIN_RADIUS,
  LAYOUT_COMPONENT_GAP,
  LAYOUT_NODE_CLEARANCE,
  normalizeForcePositions,
  normalizePositions,
  packPositionColumns,
  packPositionGroups,
  pseudoRandom,
} from "./layout-geometry";

const LAYOUT_TARGET_EDGE_LENGTH = 124;

type LayoutRuntimeDefinition = {
  kind: string;
  priority: "primary" | "advanced";
  positions: (
    model: GraphModel,
    rootNodeId?: NodeId,
  ) => Record<NodeId, { x: number; y: number }>;
  disabledReason?: (model: GraphModel) => LayoutDisabledReason | null;
};

export type LayoutDisabledReason =
  | "emptyGraph"
  | "notForest"
  | "dagRequiresDirected"
  | "notDag"
  | "notBipartite"
  | "sccRequiresDirected";

const manualLayoutDefinitions = [
  {
    kind: "force",
    priority: "primary",
    positions: (model) => layoutForce(model),
  },
  {
    kind: "circle",
    priority: "advanced",
    positions: (model) =>
      layoutCircle(orderedNodeIds(model), LAYOUT_CIRCLE_MIN_RADIUS),
  },
  {
    kind: "grid",
    priority: "advanced",
    positions: (model) => layoutGrid(orderedNodeIds(model)),
  },
  {
    kind: "bfs",
    priority: "primary",
    positions: (model, rootNodeId) => layoutBfs(model, rootNodeId),
  },
  {
    kind: "tree",
    priority: "advanced",
    positions: (model, rootNodeId) => layoutTree(model, rootNodeId),
    disabledReason: (model) => (isForest(model) ? null : "notForest"),
  },
  {
    kind: "concentric",
    priority: "advanced",
    positions: (model) => layoutConcentric(model),
  },
  {
    kind: "dagLayer",
    priority: "advanced",
    positions: (model) => layoutDag(model),
    disabledReason: (model) => {
      if (!model.settings.directed) {
        return "dagRequiresDirected";
      }

      return isDirectedAcyclic(model) ? null : "notDag";
    },
  },
  {
    kind: "bipartite",
    priority: "advanced",
    positions: (model) => layoutBipartite(model),
    disabledReason: (model) => (isBipartite(model) ? null : "notBipartite"),
  },
  {
    kind: "scc",
    priority: "advanced",
    positions: (model) => layoutScc(model),
    disabledReason: (model) =>
      model.settings.directed ? null : "sccRequiresDirected",
  },
  {
    kind: "radial",
    priority: "advanced",
    positions: (model, rootNodeId) => layoutRadial(model, rootNodeId),
  },
  {
    kind: "line",
    priority: "advanced",
    positions: (model) => layoutLine(model),
  },
  {
    kind: "spread",
    priority: "primary",
    positions: (model) => layoutSpread(model),
  },
] as const satisfies readonly LayoutRuntimeDefinition[];

export type LayoutKind = (typeof manualLayoutDefinitions)[number]["kind"];

export type LayoutDefinition = {
  kind: LayoutKind;
  priority: "primary" | "advanced";
};

export const layoutDefinitions: readonly LayoutDefinition[] =
  manualLayoutDefinitions.map(({ kind, priority }) => ({
    kind,
    priority,
  }));

const layoutRuntimeByKind = new Map<LayoutKind, LayoutRuntimeDefinition>(
  manualLayoutDefinitions.map((definition) => [definition.kind, definition]),
);

export function createManualLayoutCommand(
  model: GraphModel,
  kind: LayoutKind,
  rootNodeId?: NodeId,
) {
  const after = createLayoutPositions(model, kind, rootNodeId);

  return createMoveNodesCommand(`Apply ${kind} layout`, after);
}

function createLayoutPositions(
  model: GraphModel,
  kind: LayoutKind,
  rootNodeId?: NodeId,
) {
  const positions = getLayoutRuntime(kind).positions(model, rootNodeId);

  return ensureMinimumNodeDistance(positions);
}

export function manualLayoutDisabledReasonCode(
  kind: LayoutKind,
  model: GraphModel,
): LayoutDisabledReason | null {
  if (model.nodes.length === 0) {
    return "emptyGraph";
  }

  return getLayoutRuntime(kind).disabledReason?.(model) ?? null;
}

function getLayoutRuntime(kind: LayoutKind) {
  const runtime = layoutRuntimeByKind.get(kind);

  if (!runtime) {
    throw new Error(`Unknown layout kind: ${kind}`);
  }

  return runtime;
}

function layoutGrid(nodeIds: NodeId[]) {
  const columns = Math.ceil(Math.sqrt(nodeIds.length));

  return Object.fromEntries(
    nodeIds.map((nodeId, index) => [
      nodeId,
      {
        x: (index % columns) * 128,
        y: Math.floor(index / columns) * 104,
      },
    ]),
  ) as Record<NodeId, { x: number; y: number }>;
}

function layoutForce(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  if (nodeIds.length <= 1) return layoutCircle(nodeIds, 0);

  const nodeIdSet = new Set(nodeIds);
  const validEdges = model.edges
    .filter(
      (edge) =>
        nodeIdSet.has(edge.source) &&
        nodeIdSet.has(edge.target) &&
        edge.source !== edge.target,
    )
    .map((edge) => [edge.source, edge.target] as const);

  if (validEdges.length === 0) {
    return layoutCircle(nodeIds, LAYOUT_CIRCLE_MIN_RADIUS);
  }

  const components = connectedComponents(model);

  if (components.length > 1) {
    return packPositionGroups(
      components.map((component) => {
        const componentSet = new Set(component);
        const componentEdges = validEdges.filter(
          ([source, target]) =>
            componentSet.has(source) && componentSet.has(target),
        );

        if (componentEdges.length === 0) {
          return layoutCircle(
            component,
            component.length <= 1 ? 0 : LAYOUT_NODE_CLEARANCE,
          );
        }

        return layoutForceComponent(component, componentEdges);
      }),
    );
  }

  return layoutForceComponent(nodeIds, validEdges);
}

function layoutForceComponent(
  nodeIds: NodeId[],
  edges: ReadonlyArray<readonly [NodeId, NodeId]>,
) {
  const positions = new Map(
    nodeIds.map((nodeId, nodeIndex) => {
      const seeded = layoutCircle(nodeIds, layoutCircleRadius(nodeIds.length))[
        nodeId
      ];
      const jitter = {
        x: (pseudoRandom(nodeIndex + 17) - 0.5) * 24,
        y: (pseudoRandom(nodeIndex + 53) - 0.5) * 24,
      };

      return [
        nodeId,
        {
          x: seeded.x + jitter.x,
          y: seeded.y + jitter.y,
        },
      ];
    }),
  );
  const ideal = LAYOUT_TARGET_EDGE_LENGTH;
  let temperature = ideal * 0.8;

  for (let iteration = 0; iteration < 180; iteration += 1) {
    const displacement = new Map(
      nodeIds.map((nodeId) => [nodeId, { x: 0, y: 0 }]),
    );

    for (let first = 0; first < nodeIds.length; first += 1) {
      for (let second = first + 1; second < nodeIds.length; second += 1) {
        const firstId = nodeIds[first];
        const secondId = nodeIds[second];
        const firstPosition = positions.get(firstId)!;
        const secondPosition = positions.get(secondId)!;
        let dx = firstPosition.x - secondPosition.x;
        let dy = firstPosition.y - secondPosition.y;
        let distance = Math.hypot(dx, dy);

        if (distance < 0.01) {
          dx = pseudoRandom(first + 1) - 0.5;
          dy = pseudoRandom(second + 1) - 0.5;
          distance = Math.hypot(dx, dy) || 1;
        }

        const force = (ideal * ideal) / distance;
        const offsetX = (dx / distance) * force;
        const offsetY = (dy / distance) * force;

        displacement.get(firstId)!.x += offsetX;
        displacement.get(firstId)!.y += offsetY;
        displacement.get(secondId)!.x -= offsetX;
        displacement.get(secondId)!.y -= offsetY;
      }
    }

    for (const [source, target] of edges) {
      const sourcePosition = positions.get(source)!;
      const targetPosition = positions.get(target)!;
      const dx = sourcePosition.x - targetPosition.x;
      const dy = sourcePosition.y - targetPosition.y;
      const distance = Math.max(0.01, Math.hypot(dx, dy));
      const force = (distance * distance) / ideal;
      const offsetX = (dx / distance) * force;
      const offsetY = (dy / distance) * force;

      displacement.get(source)!.x -= offsetX;
      displacement.get(source)!.y -= offsetY;
      displacement.get(target)!.x += offsetX;
      displacement.get(target)!.y += offsetY;
    }

    for (const nodeId of nodeIds) {
      const point = positions.get(nodeId)!;
      const delta = displacement.get(nodeId)!;
      const length = Math.max(0.01, Math.hypot(delta.x, delta.y));
      const step = Math.min(length, temperature);

      positions.set(nodeId, {
        x: point.x + (delta.x / length) * step,
        y: point.y + (delta.y / length) * step,
      });
    }

    temperature *= 0.965;
  }

  return normalizeForcePositions(
    Object.fromEntries(positions),
    edges,
    LAYOUT_TARGET_EDGE_LENGTH,
  );
}

function layoutBfs(model: GraphModel, rootNodeId?: NodeId) {
  const nodeIds = orderedNodeIds(model);
  const adjacency = model.settings.directed
    ? directedAdjacency(model)
    : undirectedAdjacency(model);
  const order = orderIndex(nodeIds);
  const visited = new Set<NodeId>();
  const rank = new Map<NodeId, number>();
  let componentOffset = 0;
  const starts = prioritizeRoot(nodeIds, rootNodeId);

  for (const start of starts) {
    if (visited.has(start)) continue;

    const queue: Array<{ nodeId: NodeId; depth: number }> = [
      { nodeId: start, depth: 0 },
    ];
    visited.add(start);

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;
      rank.set(nodeId, componentOffset + depth);

      const neighbors = [...(adjacency.get(nodeId) ?? [])].sort(
        (a, b) => order.get(a)! - order.get(b)!,
      );

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push({ nodeId: neighbor, depth: depth + 1 });
      }
    }

    componentOffset = Math.max(componentOffset, ...rank.values()) + 2;
  }

  return positionColumns(groupByRank(nodeIds, rank), 150, 92);
}

function layoutTree(model: GraphModel, rootNodeId?: NodeId) {
  const nodeIds = orderedNodeIds(model);
  const adjacency = undirectedAdjacency(model);
  const components = connectedComponents(model);
  const degree = degreeMap(model);
  const order = orderIndex(nodeIds);
  const positions: Record<NodeId, { x: number; y: number }> = {};
  const leafGap = 112;
  const depthGap = 112;
  let nextComponentX = 0;

  for (const component of components) {
    const componentSet = new Set(component);
    const root =
      rootNodeId && componentSet.has(rootNodeId)
        ? rootNodeId
        : [...component].sort((a, b) => {
            const byDegree = degree.get(b)! - degree.get(a)!;
            return byDegree === 0 ? order.get(a)! - order.get(b)! : byDegree;
          })[0];
    const visited = new Set<NodeId>([root]);
    const children = new Map<NodeId, NodeId[]>(
      component.map((nodeId) => [nodeId, []]),
    );
    const queue = [root];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = [...(adjacency.get(current) ?? [])].sort(
        (a, b) => order.get(a)! - order.get(b)!,
      );

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        children.get(current)!.push(neighbor);
        queue.push(neighbor);
      }
    }

    let leafCursor = 0;
    const local = new Map<NodeId, { x: number; y: number }>();

    const place = (nodeId: NodeId, depth: number): number => {
      const childIds = children.get(nodeId) ?? [];

      if (childIds.length === 0) {
        const x = leafCursor * leafGap;
        leafCursor += 1;
        local.set(nodeId, { x, y: depth * depthGap });
        return x;
      }

      const childXs = childIds.map((childId) => place(childId, depth + 1));
      const x = childXs.reduce((sum, value) => sum + value, 0) / childXs.length;
      local.set(nodeId, { x, y: depth * depthGap });
      return x;
    };

    place(root, 0);

    const localEntries = [...local.entries()];
    const minX = Math.min(...localEntries.map(([, point]) => point.x));
    const maxX = Math.max(...localEntries.map(([, point]) => point.x));
    const componentWidth = Math.max(leafGap, maxX - minX);

    for (const [nodeId, point] of localEntries) {
      positions[nodeId] = {
        x: Math.round(point.x - minX + nextComponentX),
        y: Math.round(point.y),
      };
    }

    nextComponentX += componentWidth + 180;
  }

  return normalizePositions(positions);
}

function layoutComponents(model: GraphModel) {
  return packPositionGroups(
    connectedComponents(model).map((component) =>
      component.length <= 4
        ? layoutCircle(component, 70)
        : layoutGrid(component),
    ),
  );
}

function layoutScc(model: GraphModel) {
  if (!model.settings.directed) {
    return layoutComponents(model);
  }

  const components = stronglyConnectedComponents(model);
  const componentIndexByNode = new Map<NodeId, number>();
  const order = orderIndex(orderedNodeIds(model));
  const outgoing = new Map<number, Set<number>>(
    components.map((_, index) => [index, new Set<number>()]),
  );
  const indegree = new Map<number, number>(
    components.map((_, index) => [index, 0]),
  );

  components.forEach((component, componentIndex) => {
    for (const nodeId of component) {
      componentIndexByNode.set(nodeId, componentIndex);
    }
  });

  for (const edge of model.edges) {
    const sourceIndex = componentIndexByNode.get(edge.source);
    const targetIndex = componentIndexByNode.get(edge.target);
    if (sourceIndex === undefined || targetIndex === undefined) continue;
    if (sourceIndex === targetIndex) continue;
    if (outgoing.get(sourceIndex)!.has(targetIndex)) continue;

    outgoing.get(sourceIndex)!.add(targetIndex);
    indegree.set(targetIndex, indegree.get(targetIndex)! + 1);
  }

  const rank = new Map<number, number>(
    components.map((_, index) => [index, 0]),
  );
  const queue = components
    .map((_, index) => index)
    .filter((index) => indegree.get(index) === 0);

  while (queue.length > 0) {
    queue.sort(
      (a, b) =>
        componentOrder(components[a], order) -
        componentOrder(components[b], order),
    );
    const current = queue.shift()!;

    for (const next of outgoing.get(current) ?? []) {
      rank.set(next, Math.max(rank.get(next)!, rank.get(current)! + 1));
      indegree.set(next, indegree.get(next)! - 1);
      if (indegree.get(next) === 0) {
        queue.push(next);
      }
    }
  }

  const maxRank = Math.max(0, ...rank.values());
  const columns = Array.from({ length: maxRank + 1 }, () => [] as number[]);
  const componentLayouts = components.map((component) =>
    layoutCircle(
      [...component].sort((a, b) => order.get(a)! - order.get(b)!),
      component.length <= 1 ? 0 : Math.max(44, component.length * 18),
    ),
  );
  components.forEach((_, index) => {
    columns[rank.get(index) ?? 0].push(index);
  });

  columns.forEach((column) => {
    column.sort(
      (a, b) =>
        componentOrder(components[a], order) -
        componentOrder(components[b], order),
    );
  });

  return packPositionColumns(
    columns.map((column) =>
      column.map((componentIndex) => componentLayouts[componentIndex]),
    ),
    180,
    LAYOUT_COMPONENT_GAP,
  );
}

function layoutBipartite(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  const adjacency = undirectedAdjacency(model);
  const order = orderIndex(nodeIds);
  const color = new Map<NodeId, 0 | 1>();
  let conflict = false;

  for (const nodeId of nodeIds) {
    if (color.has(nodeId)) continue;

    const queue = [nodeId];
    color.set(nodeId, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const currentColor = color.get(current)!;
      const neighbors = [...(adjacency.get(current) ?? [])].sort(
        (a, b) => order.get(a)! - order.get(b)!,
      );

      for (const neighbor of neighbors) {
        const nextColor = currentColor === 0 ? 1 : 0;
        const seenColor = color.get(neighbor);

        if (seenColor === undefined) {
          color.set(neighbor, nextColor);
          queue.push(neighbor);
        } else if (seenColor === currentColor) {
          conflict = true;
        }
      }
    }
  }

  if (conflict) {
    return currentPositions(model);
  }

  const rawLeft = nodeIds.filter((nodeId) => color.get(nodeId) === 0);
  const rawRight = nodeIds.filter((nodeId) => color.get(nodeId) === 1);
  const left = orderBipartiteSide(rawLeft, rawRight, adjacency, order, "desc");
  const right = orderBipartiteSide(rawRight, rawLeft, adjacency, order, "asc");

  return positionColumns([left, right], 180, 92);
}

function layoutDag(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  const order = orderIndex(nodeIds);
  const adjacency = new Map<NodeId, Set<NodeId>>(
    nodeIds.map((nodeId) => [nodeId, new Set<NodeId>()]),
  );
  const reverse = new Map<NodeId, Set<NodeId>>(
    nodeIds.map((nodeId) => [nodeId, new Set<NodeId>()]),
  );
  const indegree = new Map<NodeId, number>(
    nodeIds.map((nodeId) => [nodeId, 0]),
  );

  for (const edge of model.edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;
    if (edge.source === edge.target) continue;
    if (adjacency.get(edge.source)!.has(edge.target)) continue;

    adjacency.get(edge.source)!.add(edge.target);
    reverse.get(edge.target)!.add(edge.source);
    indegree.set(edge.target, indegree.get(edge.target)! + 1);
  }

  const rank = new Map<NodeId, number>(nodeIds.map((nodeId) => [nodeId, 0]));
  const visited = new Set<NodeId>();
  const queue = nodeIds.filter((nodeId) => indegree.get(nodeId) === 0);

  while (queue.length > 0) {
    queue.sort((a, b) => order.get(a)! - order.get(b)!);
    const current = queue.shift()!;
    visited.add(current);

    const neighbors = [...adjacency.get(current)!].sort(
      (a, b) => order.get(a)! - order.get(b)!,
    );

    for (const neighbor of neighbors) {
      rank.set(neighbor, Math.max(rank.get(neighbor)!, rank.get(current)! + 1));
      indegree.set(neighbor, indegree.get(neighbor)! - 1);

      if (indegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  const fallbackStart = Math.max(0, ...rank.values()) + 1;
  let fallbackIndex = 0;

  for (const nodeId of nodeIds) {
    if (visited.has(nodeId)) continue;
    rank.set(nodeId, fallbackStart + Math.floor(fallbackIndex / 4));
    fallbackIndex += 1;
  }

  const columns = orderLayerColumns(
    groupByRank(nodeIds, rank),
    adjacency,
    reverse,
    order,
  );

  return positionColumns(columns, 150, 92);
}

function layoutConcentric(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  const degree = degreeMap(model);
  const order = orderIndex(nodeIds);
  const positions: Record<NodeId, { x: number; y: number }> = {};
  const degreeValues = [
    ...new Set(nodeIds.map((nodeId) => degree.get(nodeId)!)),
  ].sort((a, b) => b - a);

  if (nodeIds.length <= 1) return layoutCircle(nodeIds, 0);
  if (degreeValues.length <= 1) {
    return layoutCircle(nodeIds, LAYOUT_CIRCLE_MIN_RADIUS);
  }

  let previousRadius = 0;
  let hasPreviousShell = false;

  degreeValues.forEach((degreeValue) => {
    const shell = nodeIds
      .filter((nodeId) => degree.get(nodeId) === degreeValue)
      .sort((a, b) => order.get(a)! - order.get(b)!);

    if (!hasPreviousShell && shell.length === 1) {
      positions[shell[0]] = { x: 0, y: 0 };
      hasPreviousShell = true;
      return;
    }

    const effectiveRadius = Math.max(
      hasPreviousShell ? previousRadius + LAYOUT_NODE_CLEARANCE : 80,
      circleRadiusForSpacing(shell.length),
    );
    previousRadius = effectiveRadius;
    hasPreviousShell = true;

    shell.forEach((nodeId, nodeIndex) => {
      const angle = (Math.PI * 2 * nodeIndex) / shell.length - Math.PI / 2;

      positions[nodeId] = {
        x: Math.round(Math.cos(angle) * effectiveRadius),
        y: Math.round(Math.sin(angle) * effectiveRadius),
      };
    });
  });

  return positions;
}

function layoutRadial(model: GraphModel, rootNodeId?: NodeId) {
  const nodeIds = orderedNodeIds(model);
  const adjacency = undirectedAdjacency(model);
  const order = orderIndex(nodeIds);
  const visited = new Set<NodeId>();
  const groups: Array<Record<NodeId, { x: number; y: number }>> = [];
  const starts = prioritizeRoot(nodeIds, rootNodeId);

  for (const root of starts) {
    if (visited.has(root)) continue;

    const levels: NodeId[][] = [];
    const queue: Array<{ nodeId: NodeId; depth: number }> = [
      { nodeId: root, depth: 0 },
    ];
    visited.add(root);

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;
      levels[depth] ??= [];
      levels[depth].push(nodeId);

      const neighbors = [...(adjacency.get(nodeId) ?? [])].sort(
        (a, b) => order.get(a)! - order.get(b)!,
      );

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push({ nodeId: neighbor, depth: depth + 1 });
      }
    }

    const positions: Record<NodeId, { x: number; y: number }> = {};

    let previousRadius = 0;

    levels.forEach((level, depth) => {
      if (depth === 0) {
        positions[level[0]] = { x: 0, y: 0 };
        return;
      }

      const radius = Math.max(
        96 + depth * 92,
        previousRadius + LAYOUT_NODE_CLEARANCE,
        circleRadiusForSpacing(level.length),
      );
      previousRadius = radius;

      level.forEach((nodeId, index) => {
        const angle = (Math.PI * 2 * index) / level.length - Math.PI / 2;
        positions[nodeId] = {
          x: Math.round(Math.cos(angle) * radius),
          y: Math.round(Math.sin(angle) * radius),
        };
      });
    });

    groups.push(positions);
  }

  return packPositionGroups(groups);
}

function layoutLine(model: GraphModel) {
  return layoutPathIds(pathOrder(model));
}

function layoutPathIds(nodeIds: NodeId[]) {
  return Object.fromEntries(
    nodeIds.map((nodeId, index) => [
      nodeId,
      {
        x: (index - (nodeIds.length - 1) / 2) * 128,
        y: 0,
      },
    ]),
  ) as Record<NodeId, { x: number; y: number }>;
}

function layoutSpread(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  if (nodeIds.length <= 1) {
    return Object.fromEntries(
      nodeIds.map((nodeId) => [nodeId, { x: 0, y: 0 }]),
    ) as Record<NodeId, { x: number; y: number }>;
  }

  const positions = new Map(
    model.nodes.map((node) => [node.id, { x: node.x, y: node.y }]),
  );
  const minimumDistance = 64;

  for (let iteration = 0; iteration < 18; iteration += 1) {
    for (let first = 0; first < nodeIds.length; first += 1) {
      for (let second = first + 1; second < nodeIds.length; second += 1) {
        const firstId = nodeIds[first];
        const secondId = nodeIds[second];
        const firstPosition = positions.get(firstId)!;
        const secondPosition = positions.get(secondId)!;
        let dx = secondPosition.x - firstPosition.x;
        let dy = secondPosition.y - firstPosition.y;
        let distance = Math.hypot(dx, dy);

        if (distance >= minimumDistance) continue;

        if (distance < 0.01) {
          const angle = pseudoRandom(first * 97 + second * 13) * Math.PI * 2;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          distance = 1;
        }

        const push = (minimumDistance - distance) / 2;
        const offsetX = (dx / distance) * push;
        const offsetY = (dy / distance) * push;

        positions.set(firstId, {
          x: firstPosition.x - offsetX,
          y: firstPosition.y - offsetY,
        });
        positions.set(secondId, {
          x: secondPosition.x + offsetX,
          y: secondPosition.y + offsetY,
        });
      }
    }
  }

  return normalizePositions(Object.fromEntries(positions));
}

function currentPositions(model: GraphModel) {
  return Object.fromEntries(
    model.nodes.map((node) => [node.id, { x: node.x, y: node.y }]),
  ) as Record<NodeId, { x: number; y: number }>;
}

function groupByRank(nodeIds: NodeId[], rank: Map<NodeId, number>) {
  const maxRank = Math.max(0, ...rank.values());
  const columns = Array.from({ length: maxRank + 1 }, () => [] as NodeId[]);

  for (const nodeId of nodeIds) {
    columns[rank.get(nodeId) ?? 0].push(nodeId);
  }

  return columns.filter((column) => column.length > 0);
}

function positionColumns(
  columns: NodeId[][],
  columnGap: number,
  rowGap: number,
) {
  const effectiveRowGap = Math.max(rowGap, LAYOUT_NODE_CLEARANCE);
  const visibleColumns = columns.filter((column) => column.length > 0);
  const positions: Record<NodeId, { x: number; y: number }> = {};

  visibleColumns.forEach((column, columnIndex) => {
    const x = (columnIndex - (visibleColumns.length - 1) / 2) * columnGap;

    column.forEach((nodeId, rowIndex) => {
      positions[nodeId] = {
        x,
        y: (rowIndex - (column.length - 1) / 2) * effectiveRowGap,
      };
    });
  });

  return positions;
}

function orderLayerColumns(
  columns: NodeId[][],
  outgoing: Map<NodeId, Set<NodeId>>,
  incoming: Map<NodeId, Set<NodeId>>,
  order: Map<NodeId, number>,
) {
  const result = columns.map((column) => [...column]);

  for (let sweep = 0; sweep < 2; sweep += 1) {
    for (let columnIndex = 1; columnIndex < result.length; columnIndex += 1) {
      result[columnIndex] = sortLayerByBarycenter(
        result[columnIndex],
        result[columnIndex - 1],
        incoming,
        order,
      );
    }

    for (
      let columnIndex = result.length - 2;
      columnIndex >= 0;
      columnIndex -= 1
    ) {
      result[columnIndex] = sortLayerByBarycenter(
        result[columnIndex],
        result[columnIndex + 1],
        outgoing,
        order,
      );
    }
  }

  return result;
}

function sortLayerByBarycenter(
  layer: NodeId[],
  reference: NodeId[],
  related: Map<NodeId, Set<NodeId>>,
  order: Map<NodeId, number>,
) {
  const referenceOrder = orderIndex(reference);
  const score = (nodeId: NodeId) => {
    const indexes = [...(related.get(nodeId) ?? [])]
      .map((neighbor) => referenceOrder.get(neighbor))
      .filter((index): index is number => index !== undefined);

    if (indexes.length === 0) return order.get(nodeId) ?? 0;
    return indexes.reduce((sum, index) => sum + index, 0) / indexes.length;
  };

  return [...layer].sort((a, b) => {
    const byScore = score(a) - score(b);
    return byScore === 0 ? order.get(a)! - order.get(b)! : byScore;
  });
}
