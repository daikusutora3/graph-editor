import {
  SELECTABLE_EDGE_COLORS,
  SELECTABLE_NODE_COLORS,
} from "../core/graph/colors";
import {
  GRAPH_MAX_ABS_COORDINATE,
  isGraphCoordinate,
} from "../core/graph/graph-coordinates";
import {
  normalizeEdgeLabelInput,
  normalizeEdgeWeightInput,
  normalizeNodeLabelInput,
} from "../core/graph/edit-values";
import {
  GRAPH_MAX_EDGES,
  GRAPH_MAX_NODES,
  isGraphText,
} from "../core/graph/graph-limits";
import { stripUndefinedProperties } from "../core/graph/graph-utils";
import type {
  GraphColor,
  GraphEdge,
  GraphModel,
  GraphNode,
} from "../core/graph/model";
import { graphAtom } from "../shell/state/graph-atoms";
import { selectionAtom } from "../shell/state/editor-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

import {
  createResolver,
  edgeSelectorSchema,
  fail,
  hasOnly,
  isEdgeSelector,
  isNodeSelector,
  isRecord,
  nodeSelectorSchema,
} from "./batch-edit-primitives";
import {
  edgeFilterSchema,
  nodeFilterSchema,
  resolveFilterTargets,
} from "./filter-edit-tool";
export {
  createResolver,
  edgeSelectorSchema,
  fail,
  hasOnly,
  isEdgeSelector,
  isNodeSelector,
  isRecord,
  nodeSelectorSchema,
} from "./batch-edit-primitives";
export type { NodeSelector } from "./batch-edit-primitives";

function isNodeColor(value: unknown): value is GraphColor {
  return (
    typeof value === "string" &&
    SELECTABLE_NODE_COLORS.includes(value as GraphColor)
  );
}
function isEdgeColor(value: unknown): value is GraphColor {
  return (
    typeof value === "string" &&
    SELECTABLE_EDGE_COLORS.includes(value as GraphColor)
  );
}
function isWeight(value: unknown) {
  return (
    (typeof value === "string" && isGraphText(value.trim())) ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

export function createBatchEditTool({
  store,
  revision,
  selectionRevision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "update_graph_elements",
    description:
      "Edit nodes and edges atomically in one undo step. Target explicit items, all, the current selection, or matching filters. Filters use shared colors or edge weights and do not change the selection. Report nonNumericWeights when greater than zero.",
    inputSchema: {
      type: "object",
      properties: {
        nodes: {
          type: "array",
          maxItems: GRAPH_MAX_NODES,
          description:
            "Node updates. Each must have a label, color or position, unless nodeColor is provided.",
          items: {
            type: "object",
            properties: {
              node: nodeSelectorSchema,
              label: { type: "string" },
              color: { type: "string", enum: SELECTABLE_NODE_COLORS },
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
            },
            required: ["node"],
            additionalProperties: false,
          },
        },
        edges: {
          type: "array",
          maxItems: GRAPH_MAX_EDGES,
          description:
            "Edge updates. Each needs a weight, label or color, or a shared edgeColor or edgeWeight.",
          items: {
            type: "object",
            properties: {
              edge: edgeSelectorSchema,
              weight: { type: ["string", "number"] },
              label: { type: "string" },
              color: { type: "string", enum: SELECTABLE_EDGE_COLORS },
            },
            required: ["edge"],
            additionalProperties: false,
          },
        },
        nodeColor: {
          type: "string",
          enum: SELECTABLE_NODE_COLORS,
          description:
            "Apply one color to every listed node. Do not combine with per-node colors.",
        },
        edgeColor: {
          type: "string",
          enum: SELECTABLE_EDGE_COLORS,
          description:
            "Apply one color to every listed edge. Do not combine with per-edge colors.",
        },
        edgeWeight: {
          type: ["string", "number"],
          description:
            "Set one weight for every targeted edge. Use strings for exact digits; omit per-edge weights.",
        },
        nodeFilter: {
          ...nodeFilterSchema,
          description:
            "Color matching nodes using nodeColor without changing the selection.",
        },
        edgeFilter: {
          ...edgeFilterSchema,
          description:
            "Change matching edges with edgeColor and/or edgeWeight. Weight bounds are inclusive; decimal strings preserve precision.",
        },
        allNodes: {
          type: "boolean",
          description:
            "Set to true with nodeColor to color all nodes; omit nodes.",
        },
        allEdges: {
          type: "boolean",
          description:
            "Target all edges with edgeColor and/or edgeWeight; omit edges.",
        },
        selectedNodes: {
          type: "boolean",
          description:
            "Color all currently selected nodes using nodeColor; omit nodes and allNodes. Requires expectedSelectionRevision.",
        },
        selectedEdges: {
          type: "boolean",
          description:
            "Target selected edges with edgeColor and/or edgeWeight. Requires expectedSelectionRevision.",
        },
        expectedSelectionRevision: {
          type: "string",
          description:
            "The selection.revision from get_graph_summary; required for selectedNodes or selectedEdges.",
        },
        expectedRevision: {
          type: "string",
          description: "Current graph revision from a read tool.",
        },
      },
      required: ["expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (input, options) => {
      if (
        isRecord(input) &&
        (input.selectedNodes === true || input.selectedEdges === true) &&
        typeof input.expectedSelectionRevision !== "string"
      )
        return fail(
          "invalid-input",
          "Selected targets require expectedSelectionRevision from selection.revision in get_graph_summary.",
        );
      if (
        isRecord(input) &&
        input.selectedNodes === true &&
        (input.nodes !== undefined ||
          input.allNodes === true ||
          input.nodeColor === undefined)
      )
        return fail(
          "invalid-input",
          "selectedNodes requires nodeColor and cannot be combined with nodes or allNodes.",
        );
      if (
        isRecord(input) &&
        input.selectedEdges === true &&
        (input.edges !== undefined ||
          input.allEdges === true ||
          (input.edgeColor === undefined && input.edgeWeight === undefined))
      )
        return fail(
          "invalid-input",
          "selectedEdges requires edgeColor or edgeWeight and cannot be combined with edges or allEdges.",
        );
      if (
        !isRecord(input) ||
        !hasOnly(input, [
          "nodes",
          "edges",
          "nodeColor",
          "edgeColor",
          "edgeWeight",
          "nodeFilter",
          "edgeFilter",
          "allNodes",
          "allEdges",
          "selectedNodes",
          "selectedEdges",
          "expectedSelectionRevision",
          "expectedRevision",
        ]) ||
        typeof input.expectedRevision !== "string" ||
        (input.nodes !== undefined &&
          (!Array.isArray(input.nodes) ||
            input.nodes.length > GRAPH_MAX_NODES)) ||
        (input.edges !== undefined &&
          (!Array.isArray(input.edges) ||
            input.edges.length > GRAPH_MAX_EDGES)) ||
        (input.nodeColor !== undefined && !isNodeColor(input.nodeColor)) ||
        (input.edgeColor !== undefined && !isEdgeColor(input.edgeColor)) ||
        (input.edgeWeight !== undefined && !isWeight(input.edgeWeight)) ||
        (input.allNodes !== undefined && typeof input.allNodes !== "boolean") ||
        (input.allEdges !== undefined && typeof input.allEdges !== "boolean") ||
        (input.selectedNodes !== undefined &&
          typeof input.selectedNodes !== "boolean") ||
        (input.selectedEdges !== undefined &&
          typeof input.selectedEdges !== "boolean") ||
        (input.expectedSelectionRevision !== undefined &&
          typeof input.expectedSelectionRevision !== "string") ||
        (input.nodeFilter !== undefined &&
          (input.nodes !== undefined ||
            input.allNodes === true ||
            input.selectedNodes === true ||
            input.nodeColor === undefined)) ||
        (input.edgeFilter !== undefined &&
          (input.edges !== undefined ||
            input.allEdges === true ||
            input.selectedEdges === true ||
            (input.edgeColor === undefined &&
              input.edgeWeight === undefined))) ||
        (input.allNodes === true &&
          (input.nodes !== undefined || input.nodeColor === undefined)) ||
        (input.allEdges === true &&
          (input.edges !== undefined ||
            (input.edgeColor === undefined && input.edgeWeight === undefined)))
      ) {
        return fail(
          "invalid-input",
          "Provide valid node or edge updates and the current revision.",
        );
      }
      if (input.expectedRevision !== revision())
        return fail(
          "stale-revision",
          "The graph changed. Read it again before editing.",
        );
      if (
        input.expectedSelectionRevision !== undefined &&
        input.expectedSelectionRevision !== selectionRevision()
      )
        return fail(
          "stale-selection",
          "The selection changed. Read the current graph summary before editing selected elements.",
        );
      const graph = store.get(graphAtom);
      if (input.edgeWeight !== undefined && !graph.settings.weighted)
        return fail(
          "unweighted-graph",
          "Switch to a weighted graph before editing weights.",
        );
      const selection = store.get(selectionAtom);
      let filteredNodes: Set<string> | undefined;
      let filteredEdges: Set<string> | undefined;
      let nonNumericWeights = 0;
      if (input.nodeFilter !== undefined || input.edgeFilter !== undefined) {
        const filtered = resolveFilterTargets(
          graph,
          input.nodeFilter,
          input.edgeFilter,
        );
        if (!("nodeIds" in filtered) || !filtered.nodeIds || !filtered.edgeIds)
          return filtered;
        filteredNodes = filtered.nodeIds;
        filteredEdges = filtered.edgeIds;
        nonNumericWeights = filtered.nonNumericWeights;
      }
      const nodes: unknown[] =
        filteredNodes && input.nodeFilter !== undefined
          ? [...filteredNodes].map((id) => ({ node: { id } }))
          : input.selectedNodes === true
            ? selection.nodeIds.map((id) => ({ node: { id } }))
            : input.allNodes === true
              ? graph.nodes.map((node) => ({ node: { id: node.id } }))
              : ((input.nodes ?? []) as unknown[]);
      const edges: unknown[] =
        filteredEdges && input.edgeFilter !== undefined
          ? [...filteredEdges].map((id) => ({ edge: { id } }))
          : input.selectedEdges === true
            ? selection.edgeIds.map((id) => ({ edge: { id } }))
            : input.allEdges === true
              ? graph.edges.map((edge) => ({ edge: { id: edge.id } }))
              : ((input.edges ?? []) as unknown[]);
      const selectedBoth =
        input.selectedNodes === true && input.selectedEdges === true;
      if (
        (input.allNodes === true && !nodes.length) ||
        (input.allEdges === true && !edges.length) ||
        (input.selectedNodes === true && !nodes.length && !selectedBoth) ||
        (input.selectedEdges === true && !edges.length && !selectedBoth) ||
        (selectedBoth && !nodes.length && !edges.length)
      )
        return fail(
          "no-targets",
          "The graph or selection has no elements of the requested type.",
        );
      if (
        (!nodes.length && !edges.length) ||
        (input.nodeColor !== undefined && !nodes.length && !selectedBoth) ||
        (input.edgeColor !== undefined && !edges.length && !selectedBoth) ||
        (input.edgeWeight !== undefined && !edges.length && !selectedBoth)
      )
        return fail(
          "invalid-input",
          "List at least one target for each supplied change.",
        );
      const resolver = createResolver(graph);
      const nodePatches = new Map<
        string,
        Partial<Pick<GraphNode, "label" | "color" | "x" | "y">>
      >();
      const edgePatches = new Map<
        string,
        Partial<Pick<GraphEdge, "label" | "color" | "weight">>
      >();
      for (const item of nodes) {
        if (
          !isRecord(item) ||
          !hasOnly(item, ["node", "label", "color", "position"]) ||
          !isNodeSelector(item.node) ||
          (item.label !== undefined &&
            (typeof item.label !== "string" ||
              !isGraphText(item.label.trim()))) ||
          (item.color !== undefined && !isNodeColor(item.color)) ||
          (item.position !== undefined &&
            (!isRecord(item.position) ||
              !hasOnly(item.position, ["x", "y"]) ||
              !isGraphCoordinate(item.position.x) ||
              !isGraphCoordinate(item.position.y))) ||
          (input.nodeColor !== undefined && item.color !== undefined) ||
          (item.label === undefined &&
            item.color === undefined &&
            item.position === undefined &&
            input.nodeColor === undefined)
        )
          return fail(
            "invalid-input",
            "Each node needs a valid selector and change. Shared and individual node colors cannot be combined.",
          );
        const resolved = resolver.node(item.node);
        if ("error" in resolved) return resolved.error;
        if (nodePatches.has(resolved.value.id))
          return fail(
            "duplicate-target",
            "The same node was specified more than once.",
          );
        const patch: Partial<Pick<GraphNode, "label" | "color" | "x" | "y">> =
          {};
        if (typeof item.label === "string")
          patch.label = normalizeNodeLabelInput(item.label);
        const color = item.color ?? input.nodeColor;
        if (isNodeColor(color))
          patch.color = color === "paper" ? undefined : color;
        if (isRecord(item.position)) {
          patch.x = item.position.x as number;
          patch.y = item.position.y as number;
        }
        nodePatches.set(resolved.value.id, patch);
      }
      for (const item of edges) {
        if (
          !isRecord(item) ||
          !hasOnly(item, ["edge", "weight", "label", "color"]) ||
          !isEdgeSelector(item.edge) ||
          (item.weight !== undefined && !isWeight(item.weight)) ||
          (item.label !== undefined &&
            (typeof item.label !== "string" ||
              !isGraphText(item.label.trim()))) ||
          (item.color !== undefined && !isEdgeColor(item.color)) ||
          (input.edgeColor !== undefined && item.color !== undefined) ||
          (input.edgeWeight !== undefined && item.weight !== undefined) ||
          (item.weight === undefined &&
            item.label === undefined &&
            item.color === undefined &&
            input.edgeColor === undefined &&
            input.edgeWeight === undefined)
        )
          return fail(
            "invalid-input",
            "Each edge needs a valid selector and change. Shared and individual colors or weights cannot be combined.",
          );
        if (item.weight !== undefined && !graph.settings.weighted)
          return fail(
            "unweighted-graph",
            "Switch to a weighted graph before editing weights.",
          );
        const resolved = resolver.edge(item.edge);
        if ("error" in resolved) return resolved.error;
        if (edgePatches.has(resolved.value.id))
          return fail(
            "duplicate-target",
            "The same edge was specified more than once.",
          );
        const patch: Partial<Pick<GraphEdge, "label" | "color" | "weight">> =
          {};
        const weight = item.weight ?? input.edgeWeight;
        if (weight !== undefined)
          patch.weight = normalizeEdgeWeightInput(String(weight));
        if (typeof item.label === "string")
          patch.label = normalizeEdgeLabelInput(item.label);
        const color = item.color ?? input.edgeColor;
        if (isEdgeColor(color))
          patch.color = color === "paper" ? undefined : color;
        edgePatches.set(resolved.value.id, patch);
      }
      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before the graph changed.",
        );
      const model: GraphModel = {
        ...graph,
        nodes: graph.nodes.map((node) =>
          nodePatches.has(node.id)
            ? stripUndefinedProperties({ ...node, ...nodePatches.get(node.id) })
            : node,
        ),
        edges: graph.edges.map((edge) =>
          edgePatches.has(edge.id)
            ? stripUndefinedProperties({ ...edge, ...edgePatches.get(edge.id) })
            : edge,
        ),
      };
      const result = store.set(executeCommandAtom, {
        type: "replace-model",
        label: "Edit graph elements",
        model,
      });
      if (result.status === "rejected")
        return fail(result.reason, result.message);
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        selectionRevision: selectionRevision(),
        nodeCount: nodePatches.size,
        edgeCount: edgePatches.size,
        ...(input.edgeFilter !== undefined ? { nonNumericWeights } : {}),
      };
    },
  };
}
