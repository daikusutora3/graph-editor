import type { GraphEdge, GraphModel, GraphNode } from "../core/graph/model";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
export function hasOnly(
  value: Record<string, unknown>,
  keys: readonly string[],
) {
  return Object.keys(value).every((key) => keys.includes(key));
}
export function fail(code: string, message: string) {
  return { ok: false, code, message };
}
export type NodeSelector = { id?: string; label?: string };
export const nodeSelectorSchema = {
  type: "object",
  description:
    "Identify one node by ID or exact unique label; provide exactly one.",
  properties: { id: { type: "string" }, label: { type: "string" } },
  additionalProperties: false,
};
export function isNodeSelector(value: unknown): value is NodeSelector {
  return (
    isRecord(value) &&
    hasOnly(value, ["id", "label"]) &&
    ((typeof value.id === "string" &&
      value.id.length > 0 &&
      value.label === undefined) ||
      (typeof value.label === "string" && value.id === undefined))
  );
}
type Resolution<T> = { value: T } | { error: ReturnType<typeof fail> };
export function createResolver(graph: GraphModel) {
  const nodeIds = new Map(graph.nodes.map((node) => [node.id, node]));
  const labels = new Map<string, GraphNode[]>();
  for (const node of graph.nodes) {
    const matches = labels.get(node.label);
    if (matches) matches.push(node);
    else labels.set(node.label, [node]);
  }
  const edgeIds = new Map(graph.edges.map((edge) => [edge.id, edge]));
  let pairs: Map<string, GraphEdge[]> | undefined;
  const key = (source: string, target: string) =>
    JSON.stringify(
      graph.settings.directed || source <= target
        ? [source, target]
        : [target, source],
    );
  const node = (selector: NodeSelector): Resolution<GraphNode> => {
    const found =
      selector.id !== undefined
        ? nodeIds.has(selector.id)
          ? [nodeIds.get(selector.id)!]
          : []
        : (labels.get(selector.label!) ?? []);
    if (found.length === 0)
      return {
        error: fail(
          "node-not-found",
          "A node selector did not match. Read the graph and retry.",
        ),
      };
    if (found.length > 1)
      return {
        error: fail(
          "ambiguous-node",
          "A node label matches multiple nodes. Use a node ID.",
        ),
      };
    return { value: found[0] };
  };
  const edge = (selector: Record<string, unknown>): Resolution<GraphEdge> => {
    if (typeof selector.id === "string") {
      const found = edgeIds.get(selector.id);
      return found
        ? { value: found }
        : {
            error: fail(
              "edge-not-found",
              "An edge ID did not match. Read the graph and retry.",
            ),
          };
    }
    const source = node(selector.source as NodeSelector);
    if ("error" in source) return source;
    const target = node(selector.target as NodeSelector);
    if ("error" in target) return target;
    // Most bulk operations resolve only IDs; avoid copying huge endpoint IDs
    // into pair keys unless an endpoint selector actually needs them.
    if (!pairs) {
      pairs = new Map();
      for (const candidate of graph.edges) {
        const pair = key(candidate.source, candidate.target);
        const matches = pairs.get(pair);
        if (matches) matches.push(candidate);
        else pairs.set(pair, [candidate]);
      }
    }
    const found = pairs.get(key(source.value.id, target.value.id)) ?? [];
    if (found.length === 0)
      return {
        error: fail("edge-not-found", "No edge matches the endpoints."),
      };
    if (found.length > 1)
      return {
        error: fail(
          "ambiguous-edge",
          "Multiple edges match the endpoints. Use an edge ID.",
        ),
      };
    return { value: found[0] };
  };
  return { node, edge };
}
export function isEdgeSelector(
  value: unknown,
): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    hasOnly(value, ["id", "source", "target"]) &&
    ((typeof value.id === "string" &&
      value.id.length > 0 &&
      value.source === undefined &&
      value.target === undefined) ||
      (value.id === undefined &&
        isNodeSelector(value.source) &&
        isNodeSelector(value.target)))
  );
}
export const edgeSelectorSchema = {
  type: "object",
  description:
    "Edge ID or source and target node selectors. Parallel edges require an ID.",
  properties: {
    id: { type: "string" },
    source: nodeSelectorSchema,
    target: nodeSelectorSchema,
  },
  additionalProperties: false,
};
