import { canUseEdgeEndpoints, filterAddableEdges } from "./edge-constraints";
import { createEdge, createNode } from "./graph-factory";
import { stripUndefinedProperties } from "./graph-utils";
import type {
  GraphColor,
  GraphIntent,
  GraphModel,
  GraphSettings,
} from "./model";

export function reduceGraphIntent(
  model: GraphModel,
  intent: GraphIntent,
): GraphModel {
  switch (intent.type) {
    case "replace-model":
      return intent.model;
    case "add-node": {
      const nodeOrder = nextAvailableNodeOrder(model);
      const node = createNode({
        ...intent.input,
        label:
          intent.input.label ??
          String(nextAvailableNodeLabelIndex(model) + model.settings.indexBase),
        order: nodeOrder,
      });
      return { ...model, nodes: [...model.nodes, node] };
    }
    case "add-edge": {
      const edge = createEdge(intent.input);

      if (!canUseEdgeEndpoints(model, edge.source, edge.target)) {
        return model;
      }

      return { ...model, edges: [...model.edges, edge] };
    }
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
      return {
        ...model,
        nodes: colorElements(model.nodes, intent.nodeIds, intent.color),
      };
    }
    case "update-edge": {
      const currentEdge = model.edges.find((edge) => edge.id === intent.edgeId);
      const nextSource = intent.patch.source ?? currentEdge?.source;
      const nextTarget = intent.patch.target ?? currentEdge?.target;
      if (
        currentEdge &&
        nextSource &&
        nextTarget &&
        !canUseEdgeEndpoints(model, nextSource, nextTarget, intent.edgeId)
      ) {
        return model;
      }

      return {
        ...model,
        edges: model.edges.map((edge) =>
          edge.id === intent.edgeId
            ? stripUndefinedProperties({ ...edge, ...intent.patch })
            : edge,
        ),
      };
    }
    case "set-edges-color": {
      return {
        ...model,
        edges: colorElements(model.edges, intent.edgeIds, intent.color),
      };
    }
    case "set-selection-colors": {
      return {
        ...model,
        nodes: intent.nodeIds.length
          ? colorElements(model.nodes, intent.nodeIds, intent.nodeColor)
          : model.nodes,
        edges: intent.edgeIds.length
          ? colorElements(model.edges, intent.edgeIds, intent.edgeColor)
          : model.edges,
      };
    }
    case "reverse-edges": {
      const idSet = new Set(intent.edgeIds);
      const untouchedEdges = model.edges.filter((edge) => !idSet.has(edge.id));
      const baseModel = { ...model, edges: untouchedEdges };
      const acceptedEdges = new Map(
        filterAddableEdges(
          baseModel,
          model.edges
            .filter((edge) => idSet.has(edge.id))
            .map((edge) => ({
              ...edge,
              source: edge.target,
              target: edge.source,
            })),
        ).map((edge) => [edge.id, edge]),
      );

      return {
        ...model,
        edges: model.edges.map((edge) => acceptedEdges.get(edge.id) ?? edge),
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
          const position = Object.hasOwn(intent.after, node.id)
            ? intent.after[node.id]
            : undefined;
          return position ? { ...node, x: position.x, y: position.y } : node;
        }),
      };
    case "put-graph-elements": {
      const nodeIds = new Set(intent.nodes.map((node) => node.id));
      const edgeIds = new Set(intent.edges.map((edge) => edge.id));
      const baseModel = {
        ...model,
        nodes: [
          ...model.nodes.filter((node) => !nodeIds.has(node.id)),
          ...intent.nodes,
        ],
        edges: model.edges.filter((edge) => !edgeIds.has(edge.id)),
      };
      const nextEdges = filterAddableEdges(baseModel, intent.edges);

      return {
        ...baseModel,
        edges: [...baseModel.edges, ...nextEdges],
      };
    }
  }
}

function colorElements<T extends { id: string; color?: GraphColor }>(
  elements: T[],
  ids: string[],
  color: GraphColor,
) {
  const idSet = new Set(ids);
  const nextColor = color === "paper" ? undefined : color;
  return elements.map((element) =>
    idSet.has(element.id)
      ? stripUndefinedProperties({ ...element, color: nextColor })
      : element,
  );
}

function nextAvailableNodeLabelIndex(model: GraphModel) {
  const usedLabels = new Set(model.nodes.map((node) => node.label));
  let index = 0;

  while (usedLabels.has(String(index + model.settings.indexBase))) {
    index += 1;
  }

  return index;
}

function nextAvailableNodeOrder(model: GraphModel) {
  const usedOrders = new Set(model.nodes.map((node) => node.order));
  let order = 0;

  while (usedOrders.has(order)) {
    order += 1;
  }

  return order;
}

function adjustNodeLabelsForIndexBase(
  nodes: GraphModel["nodes"],
  previousIndexBase: GraphSettings["indexBase"],
  nextIndexBase: GraphSettings["indexBase"],
) {
  if (previousIndexBase === nextIndexBase) {
    return nodes;
  }

  const delta = nextIndexBase - previousIndexBase;

  return nodes.map((node) => {
    if (!/^-?\d+$/.test(node.label)) {
      return node;
    }

    return {
      ...node,
      label: (BigInt(node.label) + BigInt(delta)).toString(),
    };
  });
}
