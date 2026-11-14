import { GRAPH_MAX_EDGES, GRAPH_MAX_NODES } from "../core/graph/graph-limits";
import { deleteSelectionCommand } from "../core/graph/graph-intents";
import { graphAtom } from "../shell/state/graph-atoms";
import { selectionAtom } from "../shell/state/editor-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import {
  createResolver,
  fail,
  hasOnly,
  isEdgeSelector,
  isNodeSelector,
  isRecord,
  edgeSelectorSchema,
  nodeSelectorSchema,
} from "./batch-edit-tool";
import {
  nodeFilterSchema,
  edgeFilterSchema,
  resolveFilterTargets,
} from "./filter-edit-tool";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

export function createBatchDeleteTool({
  store,
  revision,
  selectionRevision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "delete_graph_elements",
    description:
      "Delete nodes and/or edges in one undo step. Specify IDs or labels, current selection, or conditions such as color, neighbors, or weight. Filters do not change the screen selection; deleted selected elements are removed from it. Deleting nodes also removes their connected edges. Report nonNumericWeights if greater than zero.",
    inputSchema: {
      type: "object",
      properties: {
        nodes: {
          type: "array",
          maxItems: GRAPH_MAX_NODES,
          items: nodeSelectorSchema,
          description: "Nodes identified by ID or exact unique label.",
        },
        edges: {
          type: "array",
          maxItems: GRAPH_MAX_EDGES,
          items: edgeSelectorSchema,
          description:
            "Edges by ID or unique endpoints. Parallel edges require an ID.",
        },
        nodeFilter: {
          ...nodeFilterSchema,
          description:
            "Delete nodes matching these conditions without changing the selection. Do not combine with nodes or selectedNodes.",
        },
        edgeFilter: {
          ...edgeFilterSchema,
          description:
            "Delete edges matching these conditions without changing the selection. Do not combine with edges or selectedEdges. Weight bounds are inclusive; use decimal strings for exact large values. Non-comparable weights are counted and excluded.",
        },
        selectedNodes: {
          type: "boolean",
          description:
            "Delete all currently selected nodes; omit nodes. Requires expectedSelectionRevision. Connected edges are also deleted.",
        },
        selectedEdges: {
          type: "boolean",
          description:
            "Delete all currently selected edges; omit edges. Requires expectedSelectionRevision.",
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
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: false,
      consequentialHint: true,
    },
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
        (Number(input.nodes !== undefined) +
          Number(input.selectedNodes === true) +
          Number(input.nodeFilter !== undefined) >
          1 ||
          Number(input.edges !== undefined) +
            Number(input.selectedEdges === true) +
            Number(input.edgeFilter !== undefined) >
            1)
      )
        return fail(
          "invalid-input",
          "Choose one target mode per element type: explicit list, selection, or filter.",
        );
      if (
        !isRecord(input) ||
        !hasOnly(input, [
          "nodes",
          "edges",
          "selectedNodes",
          "selectedEdges",
          "nodeFilter",
          "edgeFilter",
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
        (input.selectedNodes !== undefined &&
          typeof input.selectedNodes !== "boolean") ||
        (input.selectedEdges !== undefined &&
          typeof input.selectedEdges !== "boolean") ||
        (input.expectedSelectionRevision !== undefined &&
          typeof input.expectedSelectionRevision !== "string")
      )
        return fail(
          "invalid-input",
          "Provide node and/or edge selectors and the current revision.",
        );
      if (input.expectedRevision !== revision())
        return fail(
          "stale-revision",
          "The graph changed. Read it again before deleting elements.",
        );
      if (
        input.expectedSelectionRevision !== undefined &&
        input.expectedSelectionRevision !== selectionRevision()
      )
        return fail(
          "stale-selection",
          "The selection changed. Read the current graph summary before deleting selected elements.",
        );
      const graph = store.get(graphAtom);
      const selection = store.get(selectionAtom);
      const filtered =
        input.nodeFilter !== undefined || input.edgeFilter !== undefined
          ? resolveFilterTargets(graph, input.nodeFilter, input.edgeFilter)
          : undefined;
      if (
        filtered &&
        !("nodeIds" in filtered && filtered.nodeIds && filtered.edgeIds)
      )
        return filtered;
      const nodes: unknown[] =
        input.selectedNodes === true
          ? selection.nodeIds.map((id) => ({ id }))
          : ((input.nodes ?? []) as unknown[]);
      const edgeSelectors: unknown[] =
        input.selectedEdges === true
          ? selection.edgeIds.map((id) => ({ id }))
          : ((input.edges ?? []) as unknown[]);
      const selectedBoth =
        input.selectedNodes === true && input.selectedEdges === true;
      if (
        (input.selectedNodes === true && !nodes.length && !selectedBoth) ||
        (input.selectedEdges === true &&
          !edgeSelectors.length &&
          !selectedBoth) ||
        (selectedBoth && !nodes.length && !edgeSelectors.length)
      )
        return fail(
          "no-targets",
          "The selection has no elements of the requested type.",
        );
      if (!nodes.length && !edgeSelectors.length && !filtered)
        return fail(
          "invalid-input",
          "List at least one node or edge to delete.",
        );
      // Filter-only deletes need no edge-pair lookup, which avoids constructing
      // large pair keys when imported graphs contain unusually long IDs.
      const resolver =
        nodes.length || edgeSelectors.length
          ? createResolver(graph)
          : undefined;
      const nodeIds = new Set<string>(filtered?.nodeIds ?? []);
      const edges = new Set<string>(filtered?.edgeIds ?? []);
      for (const selector of nodes) {
        if (!isNodeSelector(selector))
          return fail(
            "invalid-input",
            "Identify each node by one ID or exact label.",
          );
        const resolved = resolver!.node(selector);
        if ("error" in resolved) return resolved.error;
        if (nodeIds.has(resolved.value.id))
          return fail(
            "duplicate-target",
            "The same node was specified more than once.",
          );
        nodeIds.add(resolved.value.id);
      }
      for (const selector of edgeSelectors) {
        if (!isEdgeSelector(selector))
          return fail(
            "invalid-input",
            "Identify each edge by ID or unique endpoints.",
          );
        const resolved = resolver!.edge(selector);
        if ("error" in resolved) return resolved.error;
        if (edges.has(resolved.value.id))
          return fail(
            "duplicate-target",
            "The same edge was specified more than once.",
          );
        edges.add(resolved.value.id);
      }
      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before the graph changed.",
        );
      const result = store.set(
        executeCommandAtom,
        deleteSelectionCommand({ nodeIds: [...nodeIds], edgeIds: [...edges] }),
      );
      if (result.status === "rejected")
        return fail(result.reason, result.message);
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        selectionRevision: selectionRevision(),
        deletedNodes: graph.nodes.length - result.graph.nodes.length,
        deletedEdges: graph.edges.length - result.graph.edges.length,
        ...(filtered ? { nonNumericWeights: filtered.nonNumericWeights } : {}),
      };
    },
  };
}
