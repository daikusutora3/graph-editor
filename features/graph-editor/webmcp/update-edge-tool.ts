import { SELECTABLE_EDGE_COLORS } from "../core/graph/colors";
import {
  normalizeEdgeLabelInput,
  normalizeEdgeWeightInput,
} from "../core/graph/edit-values";
import { updateEdgeCommand } from "../core/graph/graph-intents";
import { isGraphText } from "../core/graph/graph-limits";
import type { GraphColor, GraphEdge, GraphModel } from "../core/graph/model";
import { graphAtom } from "../shell/state/graph-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

type Selector = { id?: string; label?: string };
const nodeSelectorSchema = {
  type: "object",
  description: "Identify a node by ID or an exact unique label; provide one.",
  properties: {
    id: { type: "string" },
    label: { type: "string" },
  },
  additionalProperties: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function only(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function isNodeSelector(value: unknown): value is Selector {
  return (
    isRecord(value) &&
    only(value, ["id", "label"]) &&
    ((typeof value.id === "string" &&
      value.id.length > 0 &&
      value.label === undefined) ||
      (typeof value.label === "string" && value.id === undefined))
  );
}

function fail(code: string, message: string) {
  return { ok: false, code, message };
}

function findNode(graph: GraphModel, selector: Selector): string | null {
  const matches = graph.nodes.filter((node) =>
    selector.id !== undefined
      ? node.id === selector.id
      : node.label === selector.label,
  );
  return matches.length === 1 ? matches[0].id : null;
}

export function createUpdateEdgeTool({
  store,
  revision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "update_edge",
    description:
      "Change an existing edge's weight, label, or color without replacing the graph. Identify the edge by ID, or by its two endpoints when there is only one matching edge. The change can be undone.",
    inputSchema: {
      type: "object",
      properties: {
        edge: {
          type: "object",
          description:
            "Provide an edge ID, or source and target node selectors. Parallel edges require an ID.",
          properties: {
            id: {
              type: "string",
              description: "Edge ID from get_graph_summary.",
            },
            source: nodeSelectorSchema,
            target: nodeSelectorSchema,
          },
          additionalProperties: false,
        },
        weight: {
          type: ["string", "number"],
          description: "Weight for a weighted graph. Blank becomes 1.",
        },
        label: {
          type: "string",
          description: "Edge label; an empty string removes it.",
        },
        color: {
          type: "string",
          enum: SELECTABLE_EDGE_COLORS,
          description: "Edge color; paper resets to default.",
        },
        expectedRevision: {
          type: "string",
          description: "Current graph revision from a read tool.",
        },
      },
      required: ["edge", "expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (input, options) => {
      if (
        !isRecord(input) ||
        !only(input, [
          "edge",
          "weight",
          "label",
          "color",
          "expectedRevision",
        ]) ||
        !isRecord(input.edge) ||
        !only(input.edge, ["id", "source", "target"]) ||
        !(
          (typeof input.edge.id === "string" &&
            input.edge.id.length > 0 &&
            input.edge.source === undefined &&
            input.edge.target === undefined) ||
          (input.edge.id === undefined &&
            isNodeSelector(input.edge.source) &&
            isNodeSelector(input.edge.target))
        ) ||
        typeof input.expectedRevision !== "string" ||
        (input.weight === undefined &&
          input.label === undefined &&
          input.color === undefined) ||
        (input.weight !== undefined &&
          !(
            typeof input.weight === "string" && isGraphText(input.weight.trim())
          ) &&
          !(
            typeof input.weight === "number" && Number.isFinite(input.weight)
          )) ||
        (input.label !== undefined &&
          (typeof input.label !== "string" ||
            !isGraphText(input.label.trim()))) ||
        (input.color !== undefined &&
          (typeof input.color !== "string" ||
            !SELECTABLE_EDGE_COLORS.includes(input.color as GraphColor)))
      ) {
        return fail(
          "invalid-input",
          "Provide an edge ID or two node selectors, at least one valid change, and the current revision.",
        );
      }
      if (input.expectedRevision !== revision()) {
        return fail(
          "stale-revision",
          "The graph changed. Read it again before editing.",
        );
      }
      const graph = store.get(graphAtom);
      if (input.weight !== undefined && !graph.settings.weighted) {
        return fail(
          "unweighted-graph",
          "The graph is unweighted; switch to weighted before editing a weight.",
        );
      }
      let matches: GraphEdge[];
      if (typeof input.edge.id === "string") {
        const edgeId = input.edge.id;
        matches = graph.edges.filter((edge) => edge.id === edgeId);
      } else {
        const source = findNode(graph, input.edge.source as Selector);
        const target = findNode(graph, input.edge.target as Selector);
        if (source === null || target === null) {
          return fail(
            "node-not-unique",
            "An endpoint is missing or has a duplicate label. Read nodes and identify each by ID.",
          );
        }
        matches = graph.edges.filter(
          (edge) =>
            (edge.source === source && edge.target === target) ||
            (!graph.settings.directed &&
              edge.source === target &&
              edge.target === source),
        );
      }
      if (matches.length === 0)
        return fail(
          "edge-not-found",
          "No edge matches. Read the graph and try again.",
        );
      if (matches.length > 1)
        return fail(
          "ambiguous-edge",
          "Multiple edges match these endpoints. Read edges and select one by ID.",
        );
      const edge = matches[0];
      const patch: Partial<Pick<GraphEdge, "weight" | "label" | "color">> = {};
      if (input.weight !== undefined)
        patch.weight = normalizeEdgeWeightInput(String(input.weight));
      if (typeof input.label === "string")
        patch.label = normalizeEdgeLabelInput(input.label);
      if (typeof input.color === "string")
        patch.color =
          input.color === "paper" ? undefined : (input.color as GraphColor);
      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before the graph changed.",
        );
      const result = store.set(
        executeCommandAtom,
        updateEdgeCommand(edge.id, patch),
      );
      if (result.status === "rejected")
        return fail(result.reason, result.message);
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        edgeId: edge.id,
      };
    },
  };
}
