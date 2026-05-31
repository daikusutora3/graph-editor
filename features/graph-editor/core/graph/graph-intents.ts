import type {
  EdgeId,
  EdgeRoutingOverride,
  GraphColor,
  GraphEdge,
  GraphIntent,
  GraphModel,
  GraphNode,
  GraphSettings,
  NodePositionMap,
  NodeId,
} from "./model";

type FixedLabelIntentType = Exclude<
  GraphIntent["type"],
  "replace-model" | "move-nodes" | "put-graph-elements"
>;

const FIXED_GRAPH_INTENT_LABELS: Record<FixedLabelIntentType, string> = {
  "add-edge": "Add edge",
  "add-node": "Add node",
  "delete-selection": "Delete selection",
  "reverse-edges": "Reverse edges",
  "set-edges-color": "Set edge color",
  "set-nodes-color": "Set node color",
  "update-edge": "Update edge",
  "update-node": "Update node",
  "update-settings": "Update settings",
};

export function replaceModelCommand(next: GraphModel): GraphIntent {
  return { type: "replace-model", label: "Replace graph", model: next };
}

export function addNodeCommand(input: {
  id: NodeId;
  label?: string;
  x?: number;
  y?: number;
  color?: GraphColor;
}): GraphIntent {
  return { type: "add-node", input };
}

export function addEdgeCommand(input: {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  weight?: string;
  label?: string;
  color?: GraphColor;
  routing?: EdgeRoutingOverride;
}): GraphIntent {
  return { type: "add-edge", input };
}

export function deleteSelectionCommand(selection: {
  nodeIds: NodeId[];
  edgeIds: EdgeId[];
}): GraphIntent {
  return { type: "delete-selection", selection };
}

export function updateNodeCommand(
  nodeId: NodeId,
  patch: Partial<Pick<GraphNode, "label" | "x" | "y" | "order" | "color">>,
): GraphIntent {
  return { type: "update-node", nodeId, patch };
}

export function setNodesColorCommand(
  nodeIds: NodeId[],
  color: GraphColor,
): GraphIntent {
  return { type: "set-nodes-color", nodeIds, color };
}

export function updateEdgeCommand(
  edgeId: EdgeId,
  patch: Partial<
    Pick<
      GraphEdge,
      "source" | "target" | "label" | "weight" | "color" | "routing"
    >
  >,
): GraphIntent {
  return { type: "update-edge", edgeId, patch };
}

export function setEdgesColorCommand(
  edgeIds: EdgeId[],
  color: GraphColor,
): GraphIntent {
  return { type: "set-edges-color", edgeIds, color };
}

export function reverseEdgesCommand(edgeIds: EdgeId[]): GraphIntent {
  return { type: "reverse-edges", edgeIds };
}

export function updateSettingsCommand(
  patch: Partial<GraphSettings>,
): GraphIntent {
  return { type: "update-settings", patch };
}

export function createMoveNodesCommand(
  label: string,
  after: NodePositionMap,
): GraphIntent {
  return { type: "move-nodes", label, after };
}

export function graphIntentLabel(intent: GraphIntent): string {
  switch (intent.type) {
    case "replace-model":
    case "move-nodes":
    case "put-graph-elements":
      return intent.label;
    default:
      return FIXED_GRAPH_INTENT_LABELS[intent.type];
  }
}
