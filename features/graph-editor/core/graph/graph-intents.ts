import type {
  EdgeId,
  GraphColor,
  GraphEdge,
  GraphIntent,
  GraphModel,
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
  "set-selection-colors": "Set selection colors",
  "update-edge": "Update edge",
  "update-node": "Update node",
  "update-settings": "Update settings",
};

export function replaceModelCommand(next: GraphModel): GraphIntent {
  return { type: "replace-model", label: "Replace graph", model: next };
}

export function addNodeCommand(
  input: Extract<GraphIntent, { type: "add-node" }>["input"],
): GraphIntent {
  return { type: "add-node", input };
}

export function addEdgeCommand(input: GraphEdge): GraphIntent {
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
  patch: Extract<GraphIntent, { type: "update-node" }>["patch"],
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
  patch: Extract<GraphIntent, { type: "update-edge" }>["patch"],
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

export function setSelectionColorsCommand(
  colors: Omit<Extract<GraphIntent, { type: "set-selection-colors" }>, "type">,
): GraphIntent {
  return { type: "set-selection-colors", ...colors };
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
