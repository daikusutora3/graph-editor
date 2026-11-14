import { nanoid } from "nanoid";

import { SELECTABLE_NODE_COLORS } from "../core/graph/colors";
import {
  GRAPH_MAX_ABS_COORDINATE,
  isGraphCoordinate,
} from "../core/graph/graph-coordinates";
import {
  normalizeEdgeWeightInput,
  normalizeNodeLabelInput,
} from "../core/graph/edit-values";
import { canUseEdgeEndpoints } from "../core/graph/edge-constraints";
import { addEdgeCommand, updateNodeCommand } from "../core/graph/graph-intents";
import { isGraphText } from "../core/graph/graph-limits";
import type { GraphColor, GraphModel, GraphNode } from "../core/graph/model";
import { graphAtom } from "../shell/state/graph-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

const nodeSelectorSchema = {
  type: "object",
  description:
    "Identify one node by id or by an exact, unique label. Supply exactly one.",
  properties: {
    id: { type: "string", description: "Node id from get_graph_summary." },
    label: { type: "string", description: "Exact node label; must be unique." },
  },
  additionalProperties: false,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}
function fail(code: string, message: string) {
  return { ok: false, code, message };
}
function isSelector(value: unknown): value is { id?: string; label?: string } {
  return (
    isRecord(value) &&
    hasOnlyKeys(value, ["id", "label"]) &&
    ((typeof value.id === "string" &&
      value.id.length > 0 &&
      value.label === undefined) ||
      (typeof value.label === "string" && value.id === undefined))
  );
}
function resolveNode(
  model: GraphModel,
  selector: { id?: string; label?: string },
): { node: GraphNode } | { error: ReturnType<typeof fail> } {
  const matches =
    selector.id !== undefined
      ? model.nodes.filter((node) => node.id === selector.id)
      : model.nodes.filter((node) => node.label === selector.label);
  if (matches.length === 0)
    return {
      error: fail(
        "node-not-found",
        "No node matches the selector. Read the graph and try again.",
      ),
    };
  if (matches.length > 1)
    return {
      error: fail(
        "ambiguous-node",
        "More than one node has this label. Read the graph and select a node by id.",
      ),
    };
  return { node: matches[0] };
}

export function createEditTools({
  store,
  revision,
}: WebMcpToolContext): WebMcpTool[] {
  return [
    {
      name: "update_node",
      description:
        "Change one node's label, color, and/or position without replacing the graph. Positions use graph coordinates. Identify it by id or exact unique label. Read the graph first and pass its revision. Undo is available in the editor.",
      inputSchema: {
        type: "object",
        properties: {
          node: nodeSelectorSchema,
          label: {
            type: "string",
            description: "New node label, up to 256 Unicode code points.",
          },
          color: {
            type: "string",
            enum: SELECTABLE_NODE_COLORS,
            description: "Node color; paper resets to the default.",
          },
          position: {
            type: "object",
            description:
              "New position in graph coordinates; supply both x and y.",
            properties: {
              x: {
                type: "number",
                minimum: -GRAPH_MAX_ABS_COORDINATE,
                maximum: GRAPH_MAX_ABS_COORDINATE,
              },
              y: {
                type: "number",
                minimum: -GRAPH_MAX_ABS_COORDINATE,
                maximum: GRAPH_MAX_ABS_COORDINATE,
              },
            },
            required: ["x", "y"],
            additionalProperties: false,
          },
          expectedRevision: {
            type: "string",
            description: "Current graph revision from a read tool.",
          },
        },
        required: ["node", "expectedRevision"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input, options) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, [
            "node",
            "label",
            "color",
            "position",
            "expectedRevision",
          ]) ||
          !isSelector(input.node) ||
          typeof input.expectedRevision !== "string" ||
          (input.label === undefined &&
            input.color === undefined &&
            input.position === undefined) ||
          (input.position !== undefined &&
            (!isRecord(input.position) ||
              !hasOnlyKeys(input.position, ["x", "y"]) ||
              !isGraphCoordinate(input.position.x) ||
              !isGraphCoordinate(input.position.y))) ||
          (input.label !== undefined &&
            (typeof input.label !== "string" ||
              !isGraphText(input.label.trim()))) ||
          (input.color !== undefined &&
            (typeof input.color !== "string" ||
              !SELECTABLE_NODE_COLORS.includes(input.color as GraphColor)))
        ) {
          return fail(
            "invalid-input",
            "Provide a node selector, a valid label, color and/or position with both graph coordinates, and the current revision.",
          );
        }
        if (input.expectedRevision !== revision())
          return fail(
            "stale-revision",
            "The graph changed. Read it again before editing.",
          );
        const resolved = resolveNode(store.get(graphAtom), input.node);
        if ("error" in resolved) return resolved.error;
        if (options?.signal.aborted)
          return fail(
            "cancelled",
            "The operation was cancelled before the graph changed.",
          );
        const patch: {
          label?: string;
          color?: GraphColor;
          x?: number;
          y?: number;
        } = {};
        if (typeof input.label === "string")
          patch.label = normalizeNodeLabelInput(input.label);
        if (typeof input.color === "string")
          patch.color =
            input.color === "paper" ? undefined : (input.color as GraphColor);
        if (isRecord(input.position)) {
          patch.x = input.position.x as number;
          patch.y = input.position.y as number;
        }
        const result = store.set(
          executeCommandAtom,
          updateNodeCommand(resolved.node.id, patch),
        );
        if (result.status === "rejected")
          return fail(result.reason, result.message);
        return {
          ok: true,
          status: result.status,
          revision: revision(),
          nodeId: resolved.node.id,
        };
      },
    },
    {
      name: "add_edge",
      description:
        "Add an edge between two existing nodes without replacing the graph. Identify endpoints by id or exact unique label. Read the graph first and pass its revision. Undo is available in the editor.",
      inputSchema: {
        type: "object",
        properties: {
          source: nodeSelectorSchema,
          target: nodeSelectorSchema,
          weight: {
            type: ["string", "number"],
            description:
              "Weight for a weighted graph; defaults to 1. Numbers and text are accepted.",
          },
          expectedRevision: {
            type: "string",
            description: "Current graph revision from a read tool.",
          },
        },
        required: ["source", "target", "expectedRevision"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: async (input, options) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, [
            "source",
            "target",
            "weight",
            "expectedRevision",
          ]) ||
          !isSelector(input.source) ||
          !isSelector(input.target) ||
          typeof input.expectedRevision !== "string" ||
          (input.weight !== undefined &&
            !(
              typeof input.weight === "string" &&
              isGraphText(input.weight.trim())
            ) &&
            !(
              typeof input.weight === "number" && Number.isFinite(input.weight)
            ))
        ) {
          return fail(
            "invalid-input",
            "Provide source and target selectors, an optional valid weight, and the current revision.",
          );
        }
        if (input.expectedRevision !== revision())
          return fail(
            "stale-revision",
            "The graph changed. Read it again before editing.",
          );
        const graph = store.get(graphAtom);
        if (!graph.settings.weighted && input.weight !== undefined)
          return fail(
            "unweighted-graph",
            "The graph is unweighted; a weight cannot be added.",
          );
        const source = resolveNode(graph, input.source);
        if ("error" in source) return source.error;
        const target = resolveNode(graph, input.target);
        if ("error" in target) return target.error;
        if (!canUseEdgeEndpoints(graph, source.node.id, target.node.id))
          return fail(
            "edge-not-allowed",
            "This edge is not allowed by the graph's self-loop or multiple-edge settings.",
          );
        if (options?.signal.aborted)
          return fail(
            "cancelled",
            "The operation was cancelled before the graph changed.",
          );
        const id = nanoid();
        const result = store.set(
          executeCommandAtom,
          addEdgeCommand({
            id,
            source: source.node.id,
            target: target.node.id,
            ...(graph.settings.weighted
              ? {
                  weight: normalizeEdgeWeightInput(
                    input.weight === undefined ? "1" : String(input.weight),
                  ),
                }
              : {}),
          }),
        );
        if (result.status === "rejected")
          return fail(result.reason, result.message);
        return {
          ok: true,
          status: result.status,
          revision: revision(),
          edgeId: id,
          sourceId: source.node.id,
          targetId: target.node.id,
        };
      },
    },
  ];
}
