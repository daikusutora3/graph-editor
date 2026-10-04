import { sameSerializableValue } from "./graph-utils";
import { assertValidGraphModel } from "./graph-validation";
import type { GraphModel, GraphPatch } from "./model";

export function applyGraphPatch(
  model: GraphModel,
  patch: GraphPatch,
): GraphModel {
  return prepareGraphPatch(model, patch).after;
}

/** Validates the restored model once and retains its JSON for the save queue. */
export function prepareGraphPatch(model: GraphModel, patch: GraphPatch) {
  const next: GraphModel = {
    ...model,
    nodes: patch.nodes ? patchElements(model.nodes, patch.nodes) : model.nodes,
    edges: patch.edges ? patchElements(model.edges, patch.edges) : model.edges,
    settings: patch.settings ?? model.settings,
  };

  return { after: next, serialized: assertValidGraphModel(next) };
}

function patchElements<T extends { id: string }>(
  items: T[],
  patch: { remove?: string[]; put?: T[]; order?: string[] },
) {
  const existingIds = new Set(items.map((item) => item.id));
  const removedIds = new Set(patch.remove ?? []);
  const puts = new Map((patch.put ?? []).map((item) => [item.id, item]));
  return reorderById(
    [
      ...items
        .filter((item) => !removedIds.has(item.id))
        .map((item) => puts.get(item.id) ?? item),
      ...[...puts.values()].filter((item) => !existingIds.has(item.id)),
    ],
    patch.order,
  );
}

export function diffGraphModels(
  before: GraphModel,
  after: GraphModel,
): GraphPatch {
  const patch: GraphPatch = {};
  const nodes = diffElements(before.nodes, after.nodes);
  const edges = diffElements(before.edges, after.edges);
  if (nodes) patch.nodes = nodes;
  if (edges) patch.edges = edges;

  if (!sameSerializableValue(before.settings, after.settings)) {
    patch.settings = after.settings;
  }

  return patch;
}

function diffElements<T extends { id: string }>(before: T[], after: T[]) {
  // Reducers preserve each untouched collection, so a node edit need not walk
  // every edge twice to prepare its forward and backward history patches.
  if (before === after) return undefined;
  const beforeById = new Map(before.map((item) => [item.id, item]));
  const afterById = new Map(after.map((item) => [item.id, item]));
  const orderChanged = !sameIdOrder(before, after);
  const remove = before
    .filter((item) => !afterById.has(item.id))
    .map((item) => item.id);
  const put = after.filter(
    (item) => !sameSerializableValue(beforeById.get(item.id), item),
  );
  if (remove.length === 0 && put.length === 0 && !orderChanged)
    return undefined;
  return {
    ...(remove.length > 0 ? { remove } : {}),
    ...(put.length > 0 ? { put } : {}),
    ...(orderChanged ? { order: after.map((item) => item.id) } : {}),
  };
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
