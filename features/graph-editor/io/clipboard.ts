import { nanoid } from "nanoid";

import { filterAddableEdges } from "../core/graph/edge-constraints";
import { createEdge, createNode } from "../core/graph/graph-factory";
import type {
  GraphEdge,
  GraphIntent,
  GraphModel,
  GraphNode,
  EdgeId,
  NodeId,
} from "../core/graph/model";

const PASTE_OFFSET_PX = 32;

type GraphSelection = {
  nodeIds: NodeId[];
  edgeIds: EdgeId[];
};

export type GraphClipboardPayload = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  indexBase: GraphModel["settings"]["indexBase"];
};

type PasteGraphResult = {
  command: GraphIntent;
  selection: GraphSelection;
};

export function createGraphClipboardPayload(
  graph: GraphModel,
  selection: GraphSelection,
): GraphClipboardPayload | null {
  const selectedNodeIds = new Set(selection.nodeIds);
  const selectedEdgeIds = new Set(selection.edgeIds);

  const nodes = graph.nodes.filter((node) => selectedNodeIds.has(node.id));
  const edges =
    nodes.length > 0
      ? graph.edges.filter(
          (edge) =>
            selectedNodeIds.has(edge.source) &&
            selectedNodeIds.has(edge.target),
        )
      : graph.edges.filter((edge) => selectedEdgeIds.has(edge.id));

  if (nodes.length === 0 && edges.length === 0) {
    return null;
  }

  return {
    nodes,
    edges,
    indexBase: graph.settings.indexBase,
  };
}

export function createPasteGraphCommand(
  graph: GraphModel,
  payload: GraphClipboardPayload,
  pasteCount: number,
): PasteGraphResult | null {
  const offset = Math.max(1, pasteCount) * PASTE_OFFSET_PX;
  const nodeIdMap = new Map<NodeId, NodeId>();
  const createdNodes = createPastedNodes(graph, payload, offset, nodeIdMap);
  const candidateEdges =
    createdNodes.length > 0
      ? createPastedEdgesFromNodes(payload.edges, nodeIdMap)
      : createPastedEdgesFromExistingNodes(graph, payload.edges);
  const graphWithCreatedNodes = {
    ...graph,
    nodes: [...graph.nodes, ...createdNodes],
  };
  const createdEdges = filterAddableEdges(
    graphWithCreatedNodes,
    candidateEdges,
  );

  if (createdNodes.length === 0 && createdEdges.length === 0) {
    return null;
  }

  return {
    command: {
      type: "put-graph-elements",
      label: "Paste graph selection",
      nodes: createdNodes,
      edges: createdEdges,
    },
    selection: {
      nodeIds: createdNodes.map((node) => node.id),
      edgeIds: createdEdges.map((edge) => edge.id),
    },
  };
}

function createPastedNodes(
  graph: GraphModel,
  payload: GraphClipboardPayload,
  offset: number,
  nodeIdMap: Map<NodeId, NodeId>,
) {
  const usedOrders = new Set(graph.nodes.map((node) => node.order));

  return payload.nodes.map((node) => {
    const order = takeNextOrder(usedOrders);
    const id = nanoid();
    nodeIdMap.set(node.id, id);

    return createNode({
      id,
      label: createPastedNodeLabel(node, payload, graph, order),
      order,
      x: node.x + offset,
      y: node.y + offset,
      color: node.color,
    });
  });
}

function createPastedNodeLabel(
  node: GraphNode,
  payload: GraphClipboardPayload,
  graph: GraphModel,
  order: number,
) {
  const standardLabel = String(node.order + payload.indexBase);

  if (node.label === standardLabel) {
    return String(order + graph.settings.indexBase);
  }

  return node.label;
}

function createPastedEdgesFromNodes(
  edges: GraphEdge[],
  nodeIdMap: Map<NodeId, NodeId>,
) {
  return edges.flatMap((edge) => {
    const source = nodeIdMap.get(edge.source);
    const target = nodeIdMap.get(edge.target);

    if (!source || !target) {
      return [];
    }

    return [cloneEdge(edge, source, target)];
  });
}

function createPastedEdgesFromExistingNodes(
  graph: GraphModel,
  edges: GraphEdge[],
) {
  const existingNodeIds = new Set(graph.nodes.map((node) => node.id));

  return edges.flatMap((edge) => {
    if (
      !existingNodeIds.has(edge.source) ||
      !existingNodeIds.has(edge.target)
    ) {
      return [];
    }

    return [cloneEdge(edge, edge.source, edge.target)];
  });
}

function cloneEdge(edge: GraphEdge, source: NodeId, target: NodeId) {
  return createEdge({
    id: nanoid(),
    source,
    target,
    weight: edge.weight,
    label: edge.label,
    color: edge.color,
    routing: edge.routing ? { ...edge.routing } : undefined,
  });
}

function takeNextOrder(usedOrders: Set<number>) {
  let order = 0;

  while (usedOrders.has(order)) {
    order += 1;
  }

  usedOrders.add(order);
  return order;
}
