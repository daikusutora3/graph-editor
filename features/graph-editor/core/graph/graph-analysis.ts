import type { GraphModel, NodeId } from "./model";
import { getNodeByOrder } from "./selectors";

export function orderedNodeIds(model: GraphModel) {
  return getNodeByOrder(model).map((node) => node.id);
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

export function graphAdjacency(model: GraphModel, directed: boolean) {
  const adjacency = new Map<NodeId, Set<NodeId>>(
    model.nodes.map((node) => [node.id, new Set<NodeId>()]),
  );

  for (const edge of model.edges) {
    if (!adjacency.has(edge.source) || !adjacency.has(edge.target)) continue;

    adjacency.get(edge.source)!.add(edge.target);
    if (!directed) adjacency.get(edge.target)!.add(edge.source);
  }

  return adjacency;
}

export function connectedComponents(
  model: GraphModel,
  adjacency = graphAdjacency(model, false),
) {
  const nodeIds = orderedNodeIds(model);
  const order = orderIndex(nodeIds);
  const visited = new Set<NodeId>();
  const components: NodeId[][] = [];

  for (const start of nodeIds) {
    if (visited.has(start)) continue;

    const queue = [start];
    visited.add(start);

    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]!;
      const neighbors = [...(adjacency.get(current) ?? [])].sort(
        (a, b) => order.get(a)! - order.get(b)!,
      );

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }

    components.push(queue);
  }

  return components;
}

export function stronglyConnectedComponents(model: GraphModel) {
  const nodeIds = orderedNodeIds(model);
  const order = orderIndex(nodeIds);
  const adjacency = graphAdjacency(model, true);
  const indexByNode = new Map<NodeId, number>();
  const lowLink = new Map<NodeId, number>();
  const stack: NodeId[] = [];
  const onStack = new Set<NodeId>();
  const components: NodeId[][] = [];
  const firstOrderByComponent = new Map<NodeId[], number>();
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
    let firstOrder = Infinity;
    let current: NodeId | undefined;

    do {
      current = stack.pop();
      if (!current) break;
      onStack.delete(current);
      component.push(current);
      firstOrder = Math.min(firstOrder, order.get(current)!);
    } while (current !== nodeId);

    components.push(component);
    firstOrderByComponent.set(component, firstOrder);
  };

  for (const nodeId of nodeIds) {
    if (!indexByNode.has(nodeId)) {
      visit(nodeId);
    }
  }

  return components.sort(
    (a, b) => firstOrderByComponent.get(a)! - firstOrderByComponent.get(b)!,
  );
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

export function bipartiteColoring(
  model: GraphModel,
  adjacency = graphAdjacency(model, false),
) {
  const nodeIds = orderedNodeIds(model);
  const color = new Map<NodeId, 0 | 1>();

  for (const nodeId of nodeIds) {
    if (color.has(nodeId)) continue;

    const queue = [nodeId];
    color.set(nodeId, 0);

    for (let head = 0; head < queue.length; head += 1) {
      const current = queue[head]!;
      const nextColor = color.get(current) === 0 ? 1 : 0;

      for (const neighbor of adjacency.get(current) ?? []) {
        const seenColor = color.get(neighbor);

        if (seenColor === undefined) {
          color.set(neighbor, nextColor);
          queue.push(neighbor);
        } else if (seenColor !== nextColor) {
          return null;
        }
      }
    }
  }

  return color;
}

export function isBipartite(model: GraphModel) {
  return bipartiteColoring(model) !== null;
}

export function isForest(model: GraphModel) {
  const parent = new Map(model.nodes.map((node) => [node.id, node.id]));

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

  const nodeIds = model.nodes.map((node) => node.id);
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

  const queue = nodeIds.filter((nodeId) => indegree.get(nodeId) === 0);

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head]!;

    for (const neighbor of outgoing.get(current) ?? []) {
      indegree.set(neighbor, indegree.get(neighbor)! - 1);
      if (indegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  return queue.length === nodeIds.length;
}
