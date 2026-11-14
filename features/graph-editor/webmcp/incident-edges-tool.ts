import type { GraphEdge, GraphNode } from "../core/graph/model";
import { graphAtom } from "../shell/state/graph-atoms";
import {
  fail,
  hasOnly,
  isNodeSelector,
  isRecord,
  nodeSelectorSchema,
} from "./batch-edit-tool";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

const MAX_RESULT_CHARS = 12_000;
const MAX_PAGE_SIZE = 10;

/** Inspect the actual edges touching one node without exporting the graph. */
export function createIncidentEdgesTool({
  store,
  revision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "get_incident_edges",
    description:
      "Find edges and neighboring nodes connected to one node without exporting the graph. For directed graphs choose incoming, outgoing or all edges. For undirected graphs every direction returns the same incident edges. Parallel edges appear separately and self-loops appear once.",
    inputSchema: {
      type: "object",
      properties: {
        node: {
          ...nodeSelectorSchema,
          description: "Identify the node by ID or an exact unique label.",
        },
        direction: {
          type: "string",
          enum: ["all", "in", "out"],
          description:
            "Directed edges: incoming, outgoing, or both. Defaults to all. For undirected graphs all three mean incident edges.",
        },
        offset: {
          type: "integer",
          minimum: 0,
          description:
            "Zero-based offset within matching edges; defaults to 0.",
        },
        limit: {
          type: "integer",
          minimum: 1,
          maximum: MAX_PAGE_SIZE,
          description: "Maximum number of edges per page; defaults to 10.",
        },
        expectedRevision: {
          type: "string",
          description:
            "Revision from an earlier graph read; prevents mixing pages after edits.",
        },
      },
      required: ["node"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: async (input) => {
      if (
        !isRecord(input) ||
        !hasOnly(input, [
          "node",
          "direction",
          "offset",
          "limit",
          "expectedRevision",
        ]) ||
        !isNodeSelector(input.node) ||
        (input.direction !== undefined &&
          input.direction !== "all" &&
          input.direction !== "in" &&
          input.direction !== "out") ||
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
          "Provide a node selector, direction all, in or out, an optional nonnegative offset, and a limit from 1 to 10.",
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
      const selector = input.node;
      const nodes = graph.nodes.filter((node) =>
        selector.id !== undefined
          ? node.id === selector.id
          : node.label === selector.label,
      );
      if (nodes.length === 0)
        return fail(
          "node-not-found",
          "No node matches the selector. Read the graph and try again.",
        );
      if (nodes.length > 1)
        return fail(
          "ambiguous-node",
          "More than one node has this label. Find the candidates and select one by ID.",
        );
      const node = nodes[0];
      const direction = input.direction ?? "all";
      const incident = graph.edges.filter((edge) => {
        if (!graph.settings.directed || direction === "all")
          return edge.source === node.id || edge.target === node.id;
        return direction === "in"
          ? edge.target === node.id
          : edge.source === node.id;
      });
      const nodeById = new Map<string, GraphNode>(
        graph.nodes.map((item) => [item.id, item]),
      );
      const offset = (input.offset ?? 0) as number;
      const limit = (input.limit ?? MAX_PAGE_SIZE) as number;
      type IncidentEdge = Pick<
        GraphEdge,
        "id" | "source" | "target" | "weight" | "label" | "color"
      > & {
        neighbor: { id: string; label: string };
      };
      const items: IncidentEdge[] = [];
      const result = () => ({
        ok: true,
        revision: currentRevision,
        directed: graph.settings.directed,
        weighted: graph.settings.weighted,
        direction,
        matchCount: incident.length,
        offset,
        nextOffset:
          offset + items.length < incident.length
            ? offset + items.length
            : null,
        items,
      });
      for (const edge of incident.slice(offset, offset + limit)) {
        const neighborId = edge.source === node.id ? edge.target : edge.source;
        const neighbor = nodeById.get(neighborId);
        if (!neighbor)
          return fail("invalid-graph", "An edge refers to a missing node.");
        items.push({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          ...(edge.weight === undefined ? {} : { weight: edge.weight }),
          ...(edge.label === undefined ? {} : { label: edge.label }),
          ...(edge.color === undefined ? {} : { color: edge.color }),
          neighbor: { id: neighbor.id, label: neighbor.label },
        });
        if (JSON.stringify(result()).length > MAX_RESULT_CHARS) {
          items.pop();
          if (items.length === 0)
            return fail(
              "element-too-large",
              "A matching edge exceeds the response limit. Its data was not returned.",
            );
          break;
        }
      }
      return result();
    },
  };
}
