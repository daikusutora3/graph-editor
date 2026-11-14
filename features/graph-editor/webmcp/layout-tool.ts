import {
  layoutKinds as kinds,
  manualLayoutDisabledReasonCode,
  type LayoutDisabledReason,
  type LayoutKind,
} from "../layouts";
import { applyManualLayoutAtom } from "../shell/state/editor-actions";
import { graphAtom } from "../shell/state/graph-atoms";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

const rootedKinds = new Set<LayoutKind>(["bfs", "tree", "radial"]);
const unavailableMessages: Record<LayoutDisabledReason, string> = {
  emptyGraph: "Add nodes before applying a layout.",
  tooLargeGraph:
    "This graph is too large for the force layout; choose another layout.",
  notForest: "Tree layout requires a forest without cycles.",
  dagRequiresDirected: "DAG layout requires a directed graph.",
  notDag: "DAG layout requires a directed graph without cycles.",
  notBipartite: "Bipartite layout requires a bipartite graph.",
  sccRequiresDirected: "SCC layout requires a directed graph.",
};

export function createLayoutTool({
  store,
  revision,
  requestFit,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "apply_layout",
    description:
      "Arrange the current graph using an editor layout. For BFS, tree and radial layouts, optionally specify rootNodeId; otherwise the layout chooses its default root. The change can be undone.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: kinds,
          description:
            "Layout: force, bfs, spread, tree, dagLayer, bipartite, scc, radial, circle, grid, line, or concentric.",
        },
        expectedRevision: {
          type: "string",
          description:
            "Current graph revision obtained from a graph read tool.",
        },
        rootNodeId: {
          type: "string",
          description:
            "Optional existing node ID for bfs, tree, or radial layout.",
        },
      },
      required: ["kind", "expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input, options) => {
      if (input === null || typeof input !== "object" || Array.isArray(input)) {
        return {
          ok: false,
          code: "invalid-input",
          message: "Provide a layout kind and current graph revision.",
        };
      }
      const args = input as Record<string, unknown>;
      if (
        Object.keys(args).some(
          (key) => !["kind", "expectedRevision", "rootNodeId"].includes(key),
        ) ||
        typeof args.kind !== "string" ||
        !kinds.includes(args.kind as LayoutKind) ||
        typeof args.expectedRevision !== "string" ||
        (args.rootNodeId !== undefined && typeof args.rootNodeId !== "string")
      ) {
        return {
          ok: false,
          code: "invalid-input",
          message:
            "Provide a supported layout kind, current graph revision, and optional root node ID.",
        };
      }
      const kind = args.kind as LayoutKind;
      if (args.expectedRevision !== revision()) {
        return {
          ok: false,
          code: "stale-revision",
          message:
            "The graph has changed. Read it again before applying a layout.",
        };
      }
      const graph = store.get(graphAtom);
      if (args.rootNodeId !== undefined && !rootedKinds.has(kind)) {
        return {
          ok: false,
          code: "invalid-root",
          message:
            "A root node can only be specified for bfs, tree, or radial layouts.",
        };
      }
      if (
        typeof args.rootNodeId === "string" &&
        !graph.nodes.some((node) => node.id === args.rootNodeId)
      ) {
        return {
          ok: false,
          code: "invalid-root",
          message:
            "The root node ID does not exist in the current graph. Read the graph to choose an existing node.",
        };
      }
      const reason = manualLayoutDisabledReasonCode(kind, graph);
      if (reason)
        return {
          ok: false,
          code: reason,
          message: unavailableMessages[reason],
        };
      if (options?.signal.aborted)
        return {
          ok: false,
          code: "cancelled",
          message: "Layout was cancelled before it started.",
        };
      try {
        const outcome = await store.set(applyManualLayoutAtom, kind, {
          signal: options?.signal,
          selectMode: false,
          rootNodeId:
            typeof args.rootNodeId === "string" ? args.rootNodeId : null,
        });
        if (outcome.status === "rejected") {
          return { ok: false, code: "layout-failed", message: outcome.message };
        }
        let fitRequested = false;
        if (kind !== "spread") {
          try {
            requestFit(outcome.graph);
            fitRequested = true;
          } catch {
            // The graph has already changed; viewport adjustment may be retried separately.
          }
        }
        return {
          ok: true,
          status: outcome.status,
          revision: revision(),
          fitRequested,
          ...("overlap" in outcome
            ? { remainingOverlaps: outcome.overlap.remainingPairs }
            : {}),
        };
      } catch {
        return {
          ok: false,
          code: "layout-failed",
          message:
            "Layout failed or was cancelled. Read the current graph before retrying.",
        };
      }
    },
  };
}
