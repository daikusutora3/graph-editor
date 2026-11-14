import { deleteSelectionCommand } from "../core/graph/graph-intents";
import { graphAtom } from "../shell/state/graph-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(code: string, message: string) {
  return { ok: false, code, message };
}

export function createDeleteElementTool({
  store,
  revision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "delete_graph_element",
    description:
      "Delete one node by ID or exact unique label, or one edge by ID. Deleting a node also deletes all connected edges. Read the graph first and pass its revision. Undo is available in the editor during this session.",
    inputSchema: {
      type: "object",
      properties: {
        node: {
          type: "object",
          description: "Identify one node by ID or exact unique label.",
          properties: {
            id: { type: "string", description: "Node ID from the graph." },
            label: { type: "string", description: "Exact unique node label." },
          },
          oneOf: [{ required: ["id"] }, { required: ["label"] }],
          additionalProperties: false,
        },
        edgeId: { type: "string", description: "Edge ID from the graph." },
        expectedRevision: {
          type: "string",
          description: "Current graph revision from a read tool.",
        },
      },
      required: ["expectedRevision"],
      oneOf: [{ required: ["node"] }, { required: ["edgeId"] }],
      additionalProperties: false,
    },
    annotations: {
      readOnlyHint: false,
      untrustedContentHint: false,
      consequentialHint: true,
    },
    execute: async (input, options) => {
      if (
        !isRecord(input) ||
        Object.keys(input).some(
          (key) => !["node", "edgeId", "expectedRevision"].includes(key),
        ) ||
        typeof input.expectedRevision !== "string" ||
        (input.node === undefined) === (input.edgeId === undefined)
      ) {
        return fail(
          "invalid-input",
          "Provide exactly one node selector or edge ID and the current revision.",
        );
      }
      if (input.expectedRevision !== revision()) {
        return fail(
          "stale-revision",
          "The graph changed. Read it again before deleting an element.",
        );
      }

      const graph = store.get(graphAtom);
      let nodeIds: string[] = [];
      let edgeIds: string[] = [];
      if (input.node !== undefined) {
        const node = input.node;
        if (
          !isRecord(node) ||
          Object.keys(node).some((key) => !["id", "label"].includes(key)) ||
          !(
            (typeof node.id === "string" &&
              node.id.length > 0 &&
              node.label === undefined) ||
            (typeof node.label === "string" && node.id === undefined)
          )
        ) {
          return fail(
            "invalid-input",
            "Identify the node by exactly one ID or exact label.",
          );
        }
        const matches = graph.nodes.filter((candidate) =>
          node.id !== undefined
            ? candidate.id === node.id
            : candidate.label === node.label,
        );
        if (matches.length === 0)
          return fail("node-not-found", "No node matches the selector.");
        if (matches.length > 1)
          return fail(
            "ambiguous-node",
            "More than one node has this label. Read the graph and select a node by ID.",
          );
        nodeIds = [matches[0].id];
      } else {
        if (typeof input.edgeId !== "string" || input.edgeId.length === 0)
          return fail("invalid-input", "Provide a nonempty edge ID.");
        if (!graph.edges.some((edge) => edge.id === input.edgeId))
          return fail("edge-not-found", "No edge matches this ID.");
        edgeIds = [input.edgeId];
      }

      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before the graph changed.",
        );
      const result = store.set(
        executeCommandAtom,
        deleteSelectionCommand({ nodeIds, edgeIds }),
      );
      if (result.status === "rejected")
        return fail(result.reason, result.message);
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        deletedNodes: graph.nodes.length - result.graph.nodes.length,
        deletedEdges: graph.edges.length - result.graph.edges.length,
      };
    },
  };
}
