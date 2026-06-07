import type {
  EdgeId,
  EdgeRoutingOverride,
  GraphColor,
  GraphEdge,
  GraphModel,
  GraphNode,
  GraphSettings,
  NodeId,
} from "./model";
import { stripUndefinedProperties } from "./graph-utils";

export const defaultGraphSettings: GraphSettings = {
  directed: false,
  weighted: false,
  indexBase: 0,
  allowSelfLoops: true,
  allowMultiEdges: true,
  autoEdgeRouting: true,
  snapToGrid: false,
  weightKind: "number",
};

export function createEmptyGraphModel(
  settings: Partial<GraphSettings> = {},
): GraphModel {
  return {
    version: 1,
    nodes: [],
    edges: [],
    settings: { ...defaultGraphSettings, ...settings },
  };
}

export function createNode(input: {
  id: NodeId;
  label?: string;
  order: number;
  x?: number;
  y?: number;
  color?: GraphColor;
}): GraphNode {
  return stripUndefinedProperties({
    id: input.id,
    label: input.label ?? String(input.order + 1),
    order: input.order,
    x: input.x ?? 0,
    y: input.y ?? 0,
    color: input.color === "paper" ? undefined : input.color,
  });
}

export function createEdge(input: {
  id: EdgeId;
  source: NodeId;
  target: NodeId;
  weight?: string;
  label?: string;
  color?: GraphColor;
  routing?: EdgeRoutingOverride;
}): GraphEdge {
  return stripUndefinedProperties({
    id: input.id,
    source: input.source,
    target: input.target,
    weight: input.weight,
    label: input.label,
    color: input.color === "paper" ? undefined : input.color,
    routing: input.routing,
  });
}
