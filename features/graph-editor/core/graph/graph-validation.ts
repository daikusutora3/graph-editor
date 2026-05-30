import type { GraphModel } from "./model";

export function assertValidGraphModel(model: GraphModel) {
  const nodeIds = new Set(model.nodes.map((node) => node.id));
  const edgeIds = new Set(model.edges.map((edge) => edge.id));
  const nodeOrders = new Set(model.nodes.map((node) => node.order));

  if (nodeIds.size !== model.nodes.length) {
    throw new Error("Graph patch produced duplicate node ids");
  }

  if (edgeIds.size !== model.edges.length) {
    throw new Error("Graph patch produced duplicate edge ids");
  }

  if (nodeOrders.size !== model.nodes.length) {
    throw new Error("Graph patch produced duplicate node orders");
  }

  for (const edge of model.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error("Graph patch produced a dangling edge");
    }
  }
}
