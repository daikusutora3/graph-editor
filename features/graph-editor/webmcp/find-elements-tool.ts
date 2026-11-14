import type { GraphEdge, GraphNode } from "../core/graph/model";
import { graphAtom } from "../shell/state/graph-atoms";
import {
  createResolver,
  edgeSelectorSchema,
  fail,
  hasOnly,
  isEdgeSelector,
  isNodeSelector,
  isRecord,
  nodeSelectorSchema,
  type NodeSelector,
} from "./batch-edit-tool";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";
import {
  nodeFilterSchema,
  edgeFilterSchema,
  resolveFilterTargets,
} from "./filter-edit-tool";

// The limit covers the complete JSON result, including revision and metadata.
const MAX_RESULT_CHARS = 12_000;
const MAX_PAGE_SIZE = 10;

export function createFindElementsTool({
  store,
  revision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "find_graph_elements",
    description:
      "Find nodes or edges by selector or filter, without changing the graph or selection. Returns the total match count and bounded pages. Use expectedRevision across pages.",
    inputSchema: {
      type: "object",
      properties: {
        node: {
          ...nodeSelectorSchema,
          description:
            "Find nodes with this ID or exact label. Duplicate labels return multiple candidates.",
        },
        edge: {
          ...edgeSelectorSchema,
          description:
            "Find an edge ID or edges between two uniquely identified nodes. Parallel edges return multiple candidates.",
        },
        nodeFilter: nodeFilterSchema,
        edgeFilter: edgeFilterSchema,
        offset: {
          type: "integer",
          minimum: 0,
          description: "Zero-based offset within matching elements, default 0.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_PAGE_SIZE,
          description: "Maximum candidates to return, default 10.",
        },
        expectedRevision: {
          type: "string",
          description:
            "Revision from an earlier read; prevents mixing results after edits.",
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (input) => {
      if (
        !isRecord(input) ||
        !hasOnly(input, [
          "node",
          "edge",
          "nodeFilter",
          "edgeFilter",
          "offset",
          "limit",
          "expectedRevision",
        ]) ||
        [input.node, input.edge, input.nodeFilter, input.edgeFilter].filter(
          (value) => value !== undefined,
        ).length !== 1 ||
        (input.node !== undefined && !isNodeSelector(input.node)) ||
        (input.edge !== undefined && !isEdgeSelector(input.edge)) ||
        (input.offset !== undefined &&
          (!Number.isSafeInteger(input.offset) ||
            (input.offset as number) < 0)) ||
        (input.limit !== undefined &&
          (!Number.isSafeInteger(input.limit) ||
            (input.limit as number) < 1 ||
            (input.limit as number) > MAX_PAGE_SIZE)) ||
        (input.expectedRevision !== undefined &&
          typeof input.expectedRevision !== "string")
      ) {
        return fail(
          "invalid-input",
          "Provide exactly one node, edge, nodeFilter or edgeFilter, an optional offset and a limit from 1 to 10.",
        );
      }
      const currentRevision = revision();
      if (
        input.expectedRevision !== undefined &&
        input.expectedRevision !== currentRevision
      ) {
        return fail(
          "stale-revision",
          "The graph changed. Read it again before continuing.",
        );
      }
      const graph = store.get(graphAtom);
      let matches: GraphNode[] | GraphEdge[];
      let kind: "nodes" | "edges";
      let nonNumericWeights: number | undefined;
      if (input.nodeFilter !== undefined || input.edgeFilter !== undefined) {
        const filtered = resolveFilterTargets(
          graph,
          input.nodeFilter,
          input.edgeFilter,
          true,
        );
        if (!("nodeIds" in filtered) || !filtered.nodeIds || !filtered.edgeIds)
          return filtered;
        nonNumericWeights = filtered.nonNumericWeights;
        kind = input.nodeFilter !== undefined ? "nodes" : "edges";
        matches =
          kind === "nodes"
            ? graph.nodes.filter((node) => filtered.nodeIds!.has(node.id))
            : graph.edges.filter((edge) => filtered.edgeIds!.has(edge.id));
      } else if (isNodeSelector(input.node)) {
        const selector = input.node;
        kind = "nodes";
        matches = graph.nodes.filter((node) =>
          selector.id !== undefined
            ? node.id === selector.id
            : node.label === selector.label,
        );
      } else if (isEdgeSelector(input.edge)) {
        kind = "edges";
        if (typeof input.edge.id === "string") {
          const id = input.edge.id;
          matches = graph.edges.filter((edge) => edge.id === id);
        } else {
          const resolver = createResolver(graph);
          const source = resolver.node(input.edge.source as NodeSelector);
          if ("error" in source) return source.error;
          const target = resolver.node(input.edge.target as NodeSelector);
          if ("error" in target) return target.error;
          matches = graph.edges.filter(
            (edge) =>
              (edge.source === source.value.id &&
                edge.target === target.value.id) ||
              (!graph.settings.directed &&
                edge.source === target.value.id &&
                edge.target === source.value.id),
          );
        }
      } else {
        return fail(
          "invalid-input",
          "Provide exactly one valid node or edge selector.",
        );
      }

      const offset = (input.offset ?? 0) as number;
      const limit = (input.limit ?? MAX_PAGE_SIZE) as number;
      const remaining = matches.slice(offset, offset + limit);
      const items: Array<GraphNode | GraphEdge> = [];
      const result = () => ({
        ok: true,
        revision: currentRevision,
        kind,
        matchCount: matches.length,
        ...(input.edgeFilter !== undefined ? { nonNumericWeights } : {}),
        offset,
        nextOffset:
          offset + items.length < matches.length ? offset + items.length : null,
        items,
      });
      for (const item of remaining) {
        items.push(item);
        if (JSON.stringify(result()).length > MAX_RESULT_CHARS) {
          items.pop();
          if (!items.length) {
            return fail(
              "element-too-large",
              "A matching element exceeds the response limit. Its data was not returned.",
            );
          }
          break;
        }
      }
      return result();
    },
  };
}
