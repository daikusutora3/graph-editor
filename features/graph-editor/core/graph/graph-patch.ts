import { sameSerializableValue } from "./graph-utils";
import { assertValidGraphModel } from "./graph-validation";
import type { GraphModel, GraphPatch } from "./model";

export function applyGraphPatch(
  model: GraphModel,
  patch: GraphPatch,
): GraphModel {
  const existingNodeIds = new Set(model.nodes.map((node) => node.id));
  const existingEdgeIds = new Set(model.edges.map((edge) => edge.id));
  const removedNodeIds = new Set(patch.nodes?.remove ?? []);
  const removedEdgeIds = new Set(patch.edges?.remove ?? []);
  const nodePuts = new Map(
    (patch.nodes?.put ?? []).map((node) => [node.id, node]),
  );
  const edgePuts = new Map(
    (patch.edges?.put ?? []).map((edge) => [edge.id, edge]),
  );
  const nodes = reorderById(
    [
      ...model.nodes
        .filter((node) => !removedNodeIds.has(node.id))
        .map((node) => nodePuts.get(node.id) ?? node),
      ...[...nodePuts.values()].filter((node) => !existingNodeIds.has(node.id)),
    ],
    patch.nodes?.order,
  );
  const edges = reorderById(
    [
      ...model.edges
        .filter((edge) => !removedEdgeIds.has(edge.id))
        .map((edge) => edgePuts.get(edge.id) ?? edge),
      ...[...edgePuts.values()].filter((edge) => !existingEdgeIds.has(edge.id)),
    ],
    patch.edges?.order,
  );
  const next: GraphModel = {
    ...model,
    nodes,
    edges,
    settings: patch.settings ?? model.settings,
  };

  assertValidGraphModel(next);
  return next;
}

export function diffGraphModels(
  before: GraphModel,
  after: GraphModel,
): GraphPatch {
  const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
  const afterNodes = new Map(after.nodes.map((node) => [node.id, node]));
  const beforeEdges = new Map(before.edges.map((edge) => [edge.id, edge]));
  const afterEdges = new Map(after.edges.map((edge) => [edge.id, edge]));
  const nodeOrderChanged = !sameIdOrder(before.nodes, after.nodes);
  const edgeOrderChanged = !sameIdOrder(before.edges, after.edges);
  const nodeRemove = before.nodes
    .filter((node) => !afterNodes.has(node.id))
    .map((node) => node.id);
  const nodePut = after.nodes.filter(
    (node) => !sameSerializableValue(beforeNodes.get(node.id), node),
  );
  const edgeRemove = before.edges
    .filter((edge) => !afterEdges.has(edge.id))
    .map((edge) => edge.id);
  const edgePut = after.edges.filter(
    (edge) => !sameSerializableValue(beforeEdges.get(edge.id), edge),
  );
  const patch: GraphPatch = {};

  if (nodeRemove.length > 0 || nodePut.length > 0 || nodeOrderChanged) {
    patch.nodes = {
      ...(nodeRemove.length > 0 ? { remove: nodeRemove } : {}),
      ...(nodePut.length > 0 ? { put: nodePut } : {}),
      ...(nodeOrderChanged
        ? { order: after.nodes.map((node) => node.id) }
        : {}),
    };
  }

  if (edgeRemove.length > 0 || edgePut.length > 0 || edgeOrderChanged) {
    patch.edges = {
      ...(edgeRemove.length > 0 ? { remove: edgeRemove } : {}),
      ...(edgePut.length > 0 ? { put: edgePut } : {}),
      ...(edgeOrderChanged
        ? { order: after.edges.map((edge) => edge.id) }
        : {}),
    };
  }

  if (!sameSerializableValue(before.settings, after.settings)) {
    patch.settings = after.settings;
  }

  return patch;
}

export function isEmptyGraphPatch(patch: GraphPatch) {
  return (
    !patch.settings &&
    !patch.nodes?.remove?.length &&
    !patch.nodes?.put?.length &&
    !patch.nodes?.order &&
    !patch.edges?.remove?.length &&
    !patch.edges?.put?.length &&
    !patch.edges?.order
  );
}

function reorderById<T extends { id: string }>(items: T[], order?: string[]) {
  if (!order) {
    return items;
  }

  const byId = new Map(items.map((item) => [item.id, item]));
  return order.flatMap((id) => {
    const item = byId.get(id);
    return item ? [item] : [];
  });
}

function sameIdOrder<T extends { id: string }>(a: T[], b: T[]) {
  return (
    a.length === b.length && a.every((item, index) => item.id === b[index]?.id)
  );
}
