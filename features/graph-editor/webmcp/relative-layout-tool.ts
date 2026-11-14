import { GRAPH_MAX_NODES } from "../core/graph/graph-limits";
import { isGraphCoordinate } from "../core/graph/graph-coordinates";
import type { GraphNode } from "../core/graph/model";
import { selectionAtom } from "../shell/state/editor-atoms";
import { graphAtom } from "../shell/state/graph-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import {
  createResolver,
  fail,
  hasOnly,
  isNodeSelector,
  isRecord,
  nodeSelectorSchema,
} from "./batch-edit-tool";
import { nodeFilterSchema, resolveFilterTargets } from "./filter-edit-tool";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

export function createRelativeLayoutTool({
  store,
  revision,
  selectionRevision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "arrange_graph_nodes",
    description:
      "Arrange nodes in one undo step. Translate by dx/dy; align horizontally or vertically using a reference or the targets' mean coordinate; place one node relative to a reference. Choose nodes, nodeFilter, allNodes or selectedNodes. Filtered operations preserve the current selection.",
    inputSchema: {
      type: "object",
      properties: {
        operation: {
          type: "string",
          enum: [
            "translate",
            "align-horizontal",
            "align-vertical",
            "place-relative",
          ],
        },
        nodes: {
          type: "array",
          maxItems: GRAPH_MAX_NODES,
          items: nodeSelectorSchema,
          description: "Explicit node IDs or exact unique labels.",
        },
        nodeFilter: nodeFilterSchema,
        allNodes: { type: "boolean", description: "Target every node." },
        selectedNodes: {
          type: "boolean",
          description:
            "Target selected nodes; requires expectedSelectionRevision.",
        },
        reference: {
          ...nodeSelectorSchema,
          description:
            "Alignment anchor, or reference position for place-relative.",
        },
        dx: {
          type: "number",
          description:
            "Horizontal offset in graph units, positive to the right.",
        },
        dy: {
          type: "number",
          description: "Vertical offset in graph units, positive downwards.",
        },
        expectedRevision: {
          type: "string",
          description: "Current graph revision from a read tool.",
        },
        expectedSelectionRevision: {
          type: "string",
          description:
            "Current selection revision from get_graph_summary; required for selectedNodes.",
        },
      },
      required: ["operation", "expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (input, options) => {
      if (
        !isRecord(input) ||
        !hasOnly(input, [
          "operation",
          "nodes",
          "nodeFilter",
          "allNodes",
          "selectedNodes",
          "reference",
          "dx",
          "dy",
          "expectedRevision",
          "expectedSelectionRevision",
        ]) ||
        typeof input.operation !== "string" ||
        ![
          "translate",
          "align-horizontal",
          "align-vertical",
          "place-relative",
        ].includes(input.operation) ||
        typeof input.expectedRevision !== "string" ||
        (input.nodes !== undefined &&
          (!Array.isArray(input.nodes) ||
            input.nodes.length > GRAPH_MAX_NODES)) ||
        (input.allNodes !== undefined && typeof input.allNodes !== "boolean") ||
        (input.selectedNodes !== undefined &&
          typeof input.selectedNodes !== "boolean") ||
        (input.expectedSelectionRevision !== undefined &&
          typeof input.expectedSelectionRevision !== "string") ||
        (input.selectedNodes === true &&
          typeof input.expectedSelectionRevision !== "string") ||
        Number(input.nodes !== undefined) +
          Number(input.nodeFilter !== undefined) +
          Number(input.allNodes === true) +
          Number(input.selectedNodes === true) !==
          1 ||
        (input.reference !== undefined && !isNodeSelector(input.reference)) ||
        ((input.operation === "translate" ||
          input.operation === "place-relative") &&
          (!isGraphCoordinate(input.dx) || !isGraphCoordinate(input.dy))) ||
        ((input.operation === "align-horizontal" ||
          input.operation === "align-vertical") &&
          (input.dx !== undefined || input.dy !== undefined)) ||
        (input.operation === "translate" && input.reference !== undefined) ||
        (input.operation === "place-relative" && input.reference === undefined)
      )
        return fail(
          "invalid-input",
          "Provide one target group, an operation with its required offsets or reference, and the current revisions.",
        );
      if (input.expectedRevision !== revision())
        return fail(
          "stale-revision",
          "The graph changed. Read it again before arranging nodes.",
        );
      if (
        input.expectedSelectionRevision !== undefined &&
        input.expectedSelectionRevision !== selectionRevision()
      )
        return fail(
          "stale-selection",
          "The selection changed. Read the current graph summary before arranging selected nodes.",
        );
      const graph = store.get(graphAtom);
      let filteredNodeIds: Set<string> | undefined;
      if (input.nodeFilter !== undefined) {
        const filtered = resolveFilterTargets(
          graph,
          input.nodeFilter,
          undefined,
        );
        if (!("nodeIds" in filtered) || !filtered.nodeIds || !filtered.edgeIds)
          return filtered;
        filteredNodeIds = filtered.nodeIds;
      }
      // This is a node-only operation. Avoid constructing edge-pair keys for
      // large graphs and imported graphs containing exceptionally long IDs.
      const resolver = createResolver({ ...graph, edges: [] });
      const selectors: unknown[] = filteredNodeIds
        ? [...filteredNodeIds].map((id) => ({ id }))
        : input.allNodes === true
          ? graph.nodes.map((node) => ({ id: node.id }))
          : input.selectedNodes === true
            ? store.get(selectionAtom).nodeIds.map((id) => ({ id }))
            : (input.nodes as unknown[]);
      if (!selectors.length)
        return fail("no-targets", "No nodes match the requested target group.");
      if (input.operation === "place-relative" && selectors.length !== 1)
        return fail(
          "invalid-input",
          "place-relative requires exactly one target node.",
        );
      const targets: GraphNode[] = [];
      const ids = new Set<string>();
      for (const selector of selectors) {
        if (!isNodeSelector(selector))
          return fail(
            "invalid-input",
            "Identify each target by ID or exact unique label.",
          );
        const resolved = resolver.node(selector);
        if ("error" in resolved) return resolved.error;
        if (ids.has(resolved.value.id))
          return fail(
            "duplicate-target",
            "The same node was specified more than once.",
          );
        ids.add(resolved.value.id);
        targets.push(resolved.value);
      }
      let reference: GraphNode | undefined;
      if (isNodeSelector(input.reference)) {
        const resolved = resolver.node(input.reference);
        if ("error" in resolved) return resolved.error;
        reference = resolved.value;
      }
      const isHorizontal = input.operation === "align-horizontal";
      const isVertical = input.operation === "align-vertical";
      const coordinate =
        isHorizontal || isVertical
          ? reference
            ? isHorizontal
              ? reference.y
              : reference.x
            : targets.reduce(
                (sum, node) =>
                  sum + (isHorizontal ? node.y : node.x) / targets.length,
                0,
              )
          : undefined;
      const positions = new Map<string, { x: number; y: number }>();
      for (const node of targets) {
        const x =
          input.operation === "translate"
            ? node.x + (input.dx as number)
            : input.operation === "place-relative"
              ? reference!.x + (input.dx as number)
              : isVertical
                ? coordinate!
                : node.x;
        const y =
          input.operation === "translate"
            ? node.y + (input.dy as number)
            : input.operation === "place-relative"
              ? reference!.y + (input.dy as number)
              : isHorizontal
                ? coordinate!
                : node.y;
        if (!isGraphCoordinate(x) || !isGraphCoordinate(y))
          return fail(
            "coordinate-out-of-range",
            "At least one resulting coordinate exceeds graph limits. No nodes were changed.",
          );
        positions.set(node.id, { x, y });
      }
      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before the graph changed.",
        );
      const result = store.set(executeCommandAtom, {
        type: "replace-model",
        label: "Arrange graph nodes",
        model: {
          ...graph,
          nodes: graph.nodes.map((node) =>
            positions.has(node.id)
              ? { ...node, ...positions.get(node.id) }
              : node,
          ),
        },
      });
      if (result.status === "rejected")
        return fail(result.reason, result.message);
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        selectionRevision: selectionRevision(),
        nodeCount: targets.length,
        ...(coordinate === undefined
          ? {}
          : { alignmentCoordinate: coordinate }),
      };
    },
  };
}
