import { createEdge, createNode } from "./graph-factory";
import { stripUndefinedProperties } from "./graph-utils";
import type { GraphIntent, GraphModel, GraphSettings } from "./model";

export function reduceGraphIntent(
  model: GraphModel,
  intent: GraphIntent,
): GraphModel {
  switch (intent.type) {
    case "replace-model":
      return intent.model;
    case "add-node": {
      const nodeIndex = nextAvailableNodeIndex(model);
      const node = createNode({
        ...intent.input,
        label:
          intent.input.label ?? String(nodeIndex + model.settings.indexBase),
        order: nodeIndex,
      });
      return { ...model, nodes: [...model.nodes, node] };
    }
    case "add-edge":
      return { ...model, edges: [...model.edges, createEdge(intent.input)] };
    case "delete-selection": {
      const nodeIds = new Set(intent.selection.nodeIds);
      const edgeIds = new Set(intent.selection.edgeIds);
      return {
        ...model,
        nodes: model.nodes.filter((node) => !nodeIds.has(node.id)),
        edges: model.edges.filter(
          (edge) =>
            !edgeIds.has(edge.id) &&
            !nodeIds.has(edge.source) &&
            !nodeIds.has(edge.target),
        ),
      };
    }
    case "update-node":
      return {
        ...model,
        nodes: model.nodes.map((node) =>
          node.id === intent.nodeId
            ? stripUndefinedProperties({ ...node, ...intent.patch })
            : node,
        ),
      };
    case "set-nodes-color": {
      const idSet = new Set(intent.nodeIds);
      const nextColor = intent.color === "paper" ? undefined : intent.color;
      return {
        ...model,
        nodes: model.nodes.map((node) =>
          idSet.has(node.id)
            ? stripUndefinedProperties({ ...node, color: nextColor })
            : node,
        ),
      };
    }
    case "update-edge":
      return {
        ...model,
        edges: model.edges.map((edge) =>
          edge.id === intent.edgeId
            ? stripUndefinedProperties({ ...edge, ...intent.patch })
            : edge,
        ),
      };
    case "set-edges-color": {
      const idSet = new Set(intent.edgeIds);
      const nextColor = intent.color === "paper" ? undefined : intent.color;
      return {
        ...model,
        edges: model.edges.map((edge) =>
          idSet.has(edge.id)
            ? stripUndefinedProperties({ ...edge, color: nextColor })
            : edge,
        ),
      };
    }
    case "reverse-edges": {
      const idSet = new Set(intent.edgeIds);
      return {
        ...model,
        edges: model.edges.map((edge) =>
          idSet.has(edge.id)
            ? { ...edge, source: edge.target, target: edge.source }
            : edge,
        ),
      };
    }
    case "update-settings": {
      const settings = { ...model.settings, ...intent.patch };
      return {
        ...model,
        nodes: adjustNodeLabelsForIndexBase(
          model.nodes,
          model.settings.indexBase,
          settings.indexBase,
        ),
        edges: settings.weighted
          ? model.edges.map((edge) =>
              edge.weight == null || edge.weight.trim() === ""
                ? { ...edge, weight: "1" }
                : edge,
            )
          : model.edges,
        settings,
      };
    }
    case "move-nodes":
      return {
        ...model,
        nodes: model.nodes.map((node) => {
          const position = intent.after[node.id];
          return position ? { ...node, x: position.x, y: position.y } : node;
        }),
      };
    case "put-graph-elements": {
      const nodeIds = new Set(intent.nodes.map((node) => node.id));
      const edgeIds = new Set(intent.edges.map((edge) => edge.id));
      return {
        ...model,
        nodes: [
          ...model.nodes.filter((node) => !nodeIds.has(node.id)),
          ...intent.nodes,
        ],
        edges: [
          ...model.edges.filter((edge) => !edgeIds.has(edge.id)),
          ...intent.edges,
        ],
      };
    }
  }
}

function nextAvailableNodeIndex(model: GraphModel) {
  const usedLabels = new Set(model.nodes.map((node) => node.label));
  const usedOrders = new Set(model.nodes.map((node) => node.order));
  let index = 0;

  while (
    usedLabels.has(String(index + model.settings.indexBase)) ||
    usedOrders.has(index)
  ) {
    index += 1;
  }

  return index;
}

function adjustNodeLabelsForIndexBase(
  nodes: GraphModel["nodes"],
  previousIndexBase: GraphSettings["indexBase"],
  nextIndexBase: GraphSettings["indexBase"],
) {
  if (previousIndexBase === nextIndexBase) {
    return nodes;
  }

  return nodes.map((node) => {
    const expectedPreviousLabel = String(node.order + previousIndexBase);

    if (node.label !== expectedPreviousLabel) {
      return node;
    }

    return {
      ...node,
      label: String(node.order + nextIndexBase),
    };
  });
}
