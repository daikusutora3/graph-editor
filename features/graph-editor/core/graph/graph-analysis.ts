import type { GraphModel, NodeId } from "./model";

export function orderedNodeIds(model: GraphModel) {
  return [...model.nodes]
    .sort((a, b) => a.order - b.order)
    .map((node) => node.id);
}

export function prioritizeRoot(nodeIds: NodeId[], rootNodeId?: NodeId) {
  if (!rootNodeId || !nodeIds.includes(rootNodeId)) {
    return nodeIds;
  }

  return [rootNodeId, ...nodeIds.filter((nodeId) => nodeId !== rootNodeId)];
}

export function orderIndex(nodeIds: NodeId[]) {
  return new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
}

export function componentOrder(
  component: NodeId[],
  order: Map<NodeId, number>,
) {
  return Math.min(...component.map((nodeId) => order.get(nodeId) ?? 0));
}

export function orderBipartiteSide(
  side: NodeId[],
  opposite: NodeId[],
  adjacency: Map<NodeId, Set<NodeId>>,
  order: Map<NodeId, number>,
  direction: "asc" | "desc",
) {
  const oppositeOrder = orderIndex(opposite);
  const score = (nodeId: NodeId) => {
    const neighbors = [...(adjacency.get(nodeId) ?? [])]
      .map((neighbor) => oppositeOrder.get(neighbor))
      .filter((index): index is number => index !== undefined);

    if (neighbors.length === 0) {
      return direction === "asc"
        ? Number.POSITIVE_INFINITY
        : Number.NEGATIVE_INFINITY;
    }

    return neighbors.reduce((sum, index) => sum + index, 0) / neighbors.length;
  };

  return [...side].sort((a, b) => {
    const byScore =
      direction === "asc" ? score(a) - score(b) : score(b) - score(a);
    return byScore === 0 ? order.get(a)! - order.get(b)! : byScore;
  });
}

export function undirectedAdjacency(model: GraphModel) {
  const adjacency = new Map<NodeId, Set<NodeId>>(
    model.nodes.map((node) => [node.id, new Set<NodeId>()]),
  );

  for (const edge of model.edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;

    adjacency.get(edge.source)!.add(edge.target);
    adjacency.get(edge.target)!.add(edge.source);
  }

  return adjacency;
}

export function directedAdjacency(model: GraphModel) {
  const adjacency = new Map<NodeId, Set<NodeId>>(
    model.nodes.map((node) => [node.id, new Set<NodeId>()]),
  );

  for (const edge of model.edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;

    adjacency.get(edge.source)!.add(edge.target);
  }

  return adjacency;
}

export function connectedComponents(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  const adjacency = undirectedAdjacency(model);
  const order = orderIndex(nodeIds);
  const visited = new Set<NodeId>();
  const components: NodeId[][] = [];

  for (const start of nodeIds) {
    if (visited.has(start)) continue;

    const component: NodeId[] = [];
    const queue = [start];
    visited.add(start);

    while (queue.length > 0) {
      const current = queue.shift()!;
      component.push(current);

      const neighbors = [...(adjacency.get(current) ?? [])].sort(
        (a, b) => order.get(a)! - order.get(b)!,
      );

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }

    components.push(component);
  }

  return components;
}

export function stronglyConnectedComponents(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  const adjacency = directedAdjacency(model);
  const indexByNode = new Map<NodeId, number>();
  const lowLink = new Map<NodeId, number>();
  const stack: NodeId[] = [];
  const onStack = new Set<NodeId>();
  const components: NodeId[][] = [];
  let index = 0;

  const visit = (nodeId: NodeId) => {
    indexByNode.set(nodeId, index);
    lowLink.set(nodeId, index);
    index += 1;
    stack.push(nodeId);
    onStack.add(nodeId);

    for (const neighbor of adjacency.get(nodeId) ?? []) {
      if (!indexByNode.has(neighbor)) {
        visit(neighbor);
        lowLink.set(
          nodeId,
          Math.min(lowLink.get(nodeId)!, lowLink.get(neighbor)!),
        );
      } else if (onStack.has(neighbor)) {
        lowLink.set(
          nodeId,
          Math.min(lowLink.get(nodeId)!, indexByNode.get(neighbor)!),
        );
      }
    }

    if (lowLink.get(nodeId) !== indexByNode.get(nodeId)) return;

    const component: NodeId[] = [];
    let current: NodeId | undefined;

    do {
      current = stack.pop();
      if (!current) break;
      onStack.delete(current);
      component.push(current);
    } while (current !== nodeId);

    components.push(component);
  };

  for (const nodeId of nodeIds) {
    if (!indexByNode.has(nodeId)) {
      visit(nodeId);
    }
  }

  return components.sort((a, b) => {
    const firstA = Math.min(...a.map((nodeId) => nodeIds.indexOf(nodeId)));
    const firstB = Math.min(...b.map((nodeId) => nodeIds.indexOf(nodeId)));
    return firstA - firstB;
  });
}

export function degreeMap(model: GraphModel) {
  const degrees = new Map<NodeId, number>(
    model.nodes.map((node) => [node.id, 0]),
  );

  for (const edge of model.edges) {
    if (degrees.has(edge.source)) {
      degrees.set(edge.source, degrees.get(edge.source)! + 1);
    }

    if (degrees.has(edge.target)) {
      degrees.set(edge.target, degrees.get(edge.target)! + 1);
    }
  }

  return degrees;
}

export function isBipartite(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  const adjacency = undirectedAdjacency(model);
  const color = new Map<NodeId, 0 | 1>();

  for (const nodeId of nodeIds) {
    if (color.has(nodeId)) continue;

    const queue = [nodeId];
    color.set(nodeId, 0);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const nextColor = color.get(current) === 0 ? 1 : 0;

      for (const neighbor of adjacency.get(current) ?? []) {
        const seenColor = color.get(neighbor);

        if (seenColor === undefined) {
          color.set(neighbor, nextColor);
          queue.push(neighbor);
        } else if (seenColor !== nextColor) {
          return false;
        }
      }
    }
  }

  return true;
}

export function isForest(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  const parent = new Map(nodeIds.map((nodeId) => [nodeId, nodeId]));

  const find = (nodeId: NodeId): NodeId => {
    const currentParent = parent.get(nodeId);

    if (!currentParent || currentParent === nodeId) {
      return nodeId;
    }

    const root = find(currentParent);
    parent.set(nodeId, root);
    return root;
  };

  for (const edge of model.edges) {
    if (!parent.has(edge.source) || !parent.has(edge.target)) continue;
    if (edge.source === edge.target) return false;

    const sourceRoot = find(edge.source);
    const targetRoot = find(edge.target);

    if (sourceRoot === targetRoot) {
      return false;
    }

    parent.set(sourceRoot, targetRoot);
  }

  return true;
}

export function isDirectedAcyclic(model: GraphModel) {
  if (!model.settings.directed) return false;

  const nodeIds = orderedNodeIds(model);
  const outgoing = new Map<NodeId, Set<NodeId>>(
    nodeIds.map((nodeId) => [nodeId, new Set<NodeId>()]),
  );
  const indegree = new Map<NodeId, number>(
    nodeIds.map((nodeId) => [nodeId, 0]),
  );

  for (const edge of model.edges) {
    if (!outgoing.has(edge.source) || !outgoing.has(edge.target)) continue;
    if (edge.source === edge.target) return false;
    if (outgoing.get(edge.source)!.has(edge.target)) continue;

    outgoing.get(edge.source)!.add(edge.target);
    indegree.set(edge.target, indegree.get(edge.target)! + 1);
  }

  const order = orderIndex(nodeIds);
  const queue = nodeIds.filter((nodeId) => indegree.get(nodeId) === 0);
  let visitedCount = 0;

  while (queue.length > 0) {
    queue.sort((a, b) => order.get(a)! - order.get(b)!);
    const current = queue.shift()!;
    visitedCount += 1;

    for (const neighbor of outgoing.get(current) ?? []) {
      indegree.set(neighbor, indegree.get(neighbor)! - 1);
      if (indegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  return visitedCount === nodeIds.length;
}

export function pathOrder(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  const adjacency = undirectedAdjacency(model);
  const order = orderIndex(nodeIds);
  const unvisited = new Set(nodeIds);
  const result: NodeId[] = [];

  while (unvisited.size > 0) {
    const start =
      nodeIds.find(
        (nodeId) => unvisited.has(nodeId) && adjacency.get(nodeId)!.size <= 1,
      ) ?? nodeIds.find((nodeId) => unvisited.has(nodeId))!;
    let current: NodeId | null = start;
    let previous: NodeId | null = null;

    while (current && unvisited.has(current)) {
      result.push(current);
      unvisited.delete(current);

      const next: NodeId | null =
        [...(adjacency.get(current) ?? [])]
          .filter((nodeId) => nodeId !== previous && unvisited.has(nodeId))
          .sort((a, b) => order.get(a)! - order.get(b)!)[0] ?? null;

      previous = current;
      current = next;
    }
  }

  return result;
}
