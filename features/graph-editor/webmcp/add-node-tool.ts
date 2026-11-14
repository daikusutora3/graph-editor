import { nanoid } from "nanoid";

import { withMeasuredNodeGeometry } from "../adapters/browser/node-geometry";
import { isGraphCoordinate } from "../core/graph/graph-coordinates";
import { normalizeNodeLabelInput } from "../core/graph/edit-values";
import { addNodeCommand } from "../core/graph/graph-intents";
import { GRAPH_MAX_NODES, isGraphText } from "../core/graph/graph-limits";
import type { GraphModel } from "../core/graph/model";
import { nodeGeometryHeight, nodeGeometryWidth } from "../core/graph/node-size";
import { graphAtom } from "../shell/state/graph-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

type Position = { x: number; y: number };
type MeasuredNode = Position & {
  measuredWidth?: number;
  measuredHeight?: number;
  label: string;
};
const GAP = 16;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function fail(code: string, message: string) {
  return { ok: false, code, message };
}

function defaultLabel(graph: GraphModel) {
  const used = new Set(graph.nodes.map((node) => node.label));
  let index = graph.settings.indexBase;
  while (used.has(String(index))) index += 1;
  return String(index);
}

// Candidate positions touch a node's expanded bounding box. This preserves all
// existing positions and bounds work by O(n²) for the editor's 1000-node limit.
function findPosition(graph: GraphModel, label: string): Position | null {
  if (graph.nodes.length === 0) return { x: 0, y: 0 };
  const probe = { id: "webmcp-probe", label, order: 0, x: 0, y: 0 };
  const measured = withMeasuredNodeGeometry({
    ...graph,
    nodes: [...graph.nodes, probe],
  });
  const nodes: MeasuredNode[] = measured.nodes.slice(0, -1);
  const candidateNode: MeasuredNode = measured.nodes[measured.nodes.length - 1];
  const width = nodeGeometryWidth(candidateNode);
  const height = nodeGeometryHeight(candidateNode);
  for (const anchor of nodes) {
    const dx = (nodeGeometryWidth(anchor) + width) / 2 + GAP;
    const dy = (nodeGeometryHeight(anchor) + height) / 2 + GAP;
    const candidates = [
      { x: anchor.x + dx, y: anchor.y },
      { x: anchor.x - dx, y: anchor.y },
      { x: anchor.x, y: anchor.y + dy },
      { x: anchor.x, y: anchor.y - dy },
    ];
    for (const candidate of candidates) {
      if (!isGraphCoordinate(candidate.x) || !isGraphCoordinate(candidate.y))
        continue;
      const clear = nodes.every(
        (node) =>
          Math.abs(candidate.x - node.x) >=
            (nodeGeometryWidth(node) + width) / 2 + GAP ||
          Math.abs(candidate.y - node.y) >=
            (nodeGeometryHeight(node) + height) / 2 + GAP,
      );
      if (clear) return candidate;
    }
  }
  return null;
}

export function createAddNodeTool({
  store,
  revision,
  requestFit,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "add_node",
    description:
      "Add one node without changing existing nodes. Supply a label and optional position, or let the editor place it near the graph. Read the graph first and pass its revision. Undo is available.",
    inputSchema: {
      type: "object",
      properties: {
        label: {
          type: "string",
          description:
            "Optional node label, up to 256 Unicode code points. Omit for the next available number.",
        },
        position: {
          type: "object",
          description:
            "Optional explicit graph coordinates; omitted positions are chosen to avoid nodes.",
          properties: {
            x: { type: "number", minimum: -1000000000, maximum: 1000000000 },
            y: { type: "number", minimum: -1000000000, maximum: 1000000000 },
          },
          required: ["x", "y"],
          additionalProperties: false,
        },
        expectedRevision: {
          type: "string",
          description:
            "Current graph revision obtained from a graph read tool.",
        },
      },
      required: ["expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input, options) => {
      if (
        !isRecord(input) ||
        Object.keys(input).some(
          (key) => !["label", "position", "expectedRevision"].includes(key),
        ) ||
        typeof input.expectedRevision !== "string" ||
        (input.label !== undefined &&
          (typeof input.label !== "string" ||
            !isGraphText(input.label.trim()))) ||
        (input.position !== undefined &&
          (!isRecord(input.position) ||
            Object.keys(input.position).some(
              (key) => !["x", "y"].includes(key),
            ) ||
            !isGraphCoordinate(input.position.x) ||
            !isGraphCoordinate(input.position.y)))
      ) {
        return fail(
          "invalid-input",
          "Provide the current revision, an optional valid label, and optional finite x and y graph coordinates.",
        );
      }
      if (input.expectedRevision !== revision())
        return fail(
          "stale-revision",
          "The graph changed. Read it again before editing.",
        );
      const graph = store.get(graphAtom);
      if (graph.nodes.length >= GRAPH_MAX_NODES)
        return fail("node-limit", "The graph has reached the node limit.");
      const label =
        typeof input.label === "string"
          ? normalizeNodeLabelInput(input.label)
          : defaultLabel(graph);
      let position: Position | null;
      try {
        position = isRecord(input.position)
          ? { x: input.position.x as number, y: input.position.y as number }
          : findPosition(graph, label);
      } catch {
        return fail(
          "position-failed",
          "Could not measure node sizes. Specify coordinates or try again.",
        );
      }
      if (!position)
        return fail(
          "position-unavailable",
          "Could not find an available position within graph coordinate limits. Specify coordinates or adjust the graph.",
        );
      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before the graph changed.",
        );
      const id = nanoid();
      const result = store.set(
        executeCommandAtom,
        addNodeCommand({ id, label, ...position }),
      );
      if (result.status === "rejected")
        return fail(result.reason, result.message);
      if (result.status !== "applied")
        return fail(
          "node-not-added",
          "The node could not be added. Read the graph before retrying.",
        );
      let fitRequested = false;
      try {
        requestFit(result.graph);
        fitRequested = true;
      } catch {
        /* The node was already committed. */
      }
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        nodeId: id,
        position,
        fitRequested,
      };
    },
  };
}
