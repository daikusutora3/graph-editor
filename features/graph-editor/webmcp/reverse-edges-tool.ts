import { filterAddableEdges } from "../core/graph/edge-constraints";
import { reverseEdgesCommand } from "../core/graph/graph-intents";
import { GRAPH_MAX_EDGES } from "../core/graph/graph-limits";
import { selectionAtom } from "../shell/state/editor-atoms";
import { graphAtom } from "../shell/state/graph-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import {
  createResolver,
  edgeSelectorSchema,
  fail,
  hasOnly,
  isEdgeSelector,
  isRecord,
} from "./batch-edit-tool";
import { edgeFilterSchema, resolveFilterTargets } from "./filter-edit-tool";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

export function createReverseEdgesTool({
  store,
  revision,
  selectionRevision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "reverse_edges",
    description:
      "Reverse directed edges in one undo step. Choose explicit edges, edgeFilter, selectedEdges, or allEdges. A filter preserves the current selection. Self-loops stay unchanged; invalid reversals reject the entire request. Report any nonNumericWeights excluded from a weight filter.",
    inputSchema: {
      type: "object",
      properties: {
        edges: {
          type: "array",
          maxItems: GRAPH_MAX_EDGES,
          items: edgeSelectorSchema,
          description: "Explicit edge IDs or unique endpoint selectors.",
        },
        edgeFilter: edgeFilterSchema,
        allEdges: {
          type: "boolean",
          description: "Reverse all edges; omit edges and selectedEdges.",
        },
        selectedEdges: {
          type: "boolean",
          description:
            "Reverse selected edges; requires expectedSelectionRevision and excludes edges/allEdges.",
        },
        expectedRevision: {
          type: "string",
          description: "Current graph revision from a read tool.",
        },
        expectedSelectionRevision: {
          type: "string",
          description:
            "Selection revision from get_graph_summary; required for selectedEdges.",
        },
      },
      required: ["expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input, options) => {
      if (
        !isRecord(input) ||
        !hasOnly(input, [
          "edges",
          "edgeFilter",
          "allEdges",
          "selectedEdges",
          "expectedRevision",
          "expectedSelectionRevision",
        ]) ||
        typeof input.expectedRevision !== "string" ||
        (input.edges !== undefined &&
          (!Array.isArray(input.edges) ||
            input.edges.length > GRAPH_MAX_EDGES)) ||
        (input.allEdges !== undefined && typeof input.allEdges !== "boolean") ||
        (input.selectedEdges !== undefined &&
          typeof input.selectedEdges !== "boolean") ||
        (input.expectedSelectionRevision !== undefined &&
          typeof input.expectedSelectionRevision !== "string") ||
        (input.selectedEdges === true &&
          typeof input.expectedSelectionRevision !== "string") ||
        (input.edgeFilter !== undefined &&
          (input.edges !== undefined ||
            input.allEdges === true ||
            input.selectedEdges === true)) ||
        ((input.allEdges === true || input.selectedEdges === true) &&
          input.edges !== undefined) ||
        (input.allEdges === true && input.selectedEdges === true)
      ) {
        return fail(
          "invalid-input",
          "Provide edge selectors, allEdges, or selectedEdges with its selection revision, plus the current graph revision.",
        );
      }
      if (input.expectedRevision !== revision())
        return fail(
          "stale-revision",
          "The graph changed. Read it again before reversing edges.",
        );
      if (
        input.expectedSelectionRevision !== undefined &&
        input.expectedSelectionRevision !== selectionRevision()
      )
        return fail(
          "stale-selection",
          "The selection changed. Read the current graph summary before reversing selected edges.",
        );
      const graph = store.get(graphAtom);
      if (!graph.settings.directed)
        return fail(
          "undirected-graph",
          "Reversing edges requires a directed graph.",
        );
      let filteredEdgeIds: Set<string> | undefined;
      let nonNumericWeights = 0;
      if (input.edgeFilter !== undefined) {
        const filtered = resolveFilterTargets(
          graph,
          undefined,
          input.edgeFilter,
        );
        if (!("nodeIds" in filtered) || !filtered.nodeIds || !filtered.edgeIds)
          return filtered;
        filteredEdgeIds = filtered.edgeIds;
        nonNumericWeights = filtered.nonNumericWeights;
      }
      const selectors: unknown[] = filteredEdgeIds
        ? [...filteredEdgeIds].map((id) => ({ id }))
        : input.allEdges === true
          ? graph.edges.map((edge) => ({ id: edge.id }))
          : input.selectedEdges === true
            ? store.get(selectionAtom).edgeIds.map((id) => ({ id }))
            : ((input.edges ?? []) as unknown[]);
      if (selectors.length === 0)
        return fail(
          "no-targets",
          "There are no edges in the requested target.",
        );
      const targetIds = filteredEdgeIds ?? new Set<string>();
      if (!filteredEdgeIds) {
        const resolver = createResolver(graph);
        for (const selector of selectors) {
          if (!isEdgeSelector(selector))
            return fail(
              "invalid-input",
              "Identify each edge by ID or unique endpoints.",
            );
          const resolved = resolver.edge(selector);
          if ("error" in resolved) return resolved.error;
          if (targetIds.has(resolved.value.id))
            return fail(
              "duplicate-target",
              "The same edge was specified more than once.",
            );
          targetIds.add(resolved.value.id);
        }
      }
      const targets = graph.edges.filter((edge) => targetIds.has(edge.id));
      const reversible = targets.filter((edge) => edge.source !== edge.target);
      const loops = targets.length - reversible.length;
      const movingIds = new Set(reversible.map((edge) => edge.id));
      const base = {
        ...graph,
        edges: graph.edges.filter((edge) => !movingIds.has(edge.id)),
      };
      const reversed = reversible.map((edge) => ({
        ...edge,
        source: edge.target,
        target: edge.source,
      }));
      if (filterAddableEdges(base, reversed).length !== reversed.length)
        return fail(
          "edge-not-allowed",
          "Reversing these edges would violate the graph's edge constraints. No edges were changed.",
        );
      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before the graph changed.",
        );
      if (!reversible.length)
        return {
          ok: true,
          status: "noop",
          revision: revision(),
          selectionRevision: selectionRevision(),
          reversedEdges: 0,
          unchangedSelfLoops: loops,
          ...(input.edgeFilter === undefined ? {} : { nonNumericWeights }),
        };
      const result = store.set(
        executeCommandAtom,
        reverseEdgesCommand([...movingIds]),
      );
      if (result.status === "rejected")
        return fail(result.reason, result.message);
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        selectionRevision: selectionRevision(),
        reversedEdges: reversible.length,
        unchangedSelfLoops: loops,
        ...(input.edgeFilter === undefined ? {} : { nonNumericWeights }),
      };
    },
  };
}
