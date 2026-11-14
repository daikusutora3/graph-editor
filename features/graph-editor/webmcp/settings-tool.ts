import { updateSettingsCommand } from "../core/graph/graph-intents";
import type { GraphSettings } from "../core/graph/model";
import { graphAtom } from "../shell/state/graph-atoms";
import { executeCommandAtom } from "../shell/state/history-atoms";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

export function createSettingsTool({
  store,
  revision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "update_graph_settings",
    description:
      "Change graph direction, weights, index base, grid snapping or label visibility. Changing indexBase can relabel numeric nodes. Enabling weights fills missing weights with 1. Undo is available.",
    inputSchema: {
      type: "object",
      properties: {
        directed: { type: "boolean", description: "Show directed edges." },
        weighted: {
          type: "boolean",
          description: "Show edge weights; disabling preserves stored weights.",
        },
        indexBase: {
          type: "integer",
          enum: [0, 1],
          description:
            "Numbering base; changing this can relabel numeric nodes.",
        },
        snapToGrid: { type: "boolean" },
        showNodeLabels: { type: "boolean" },
        expectedRevision: {
          type: "string",
          description: "Current graph revision from a read tool.",
        },
      },
      required: ["expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input, options) => {
      if (input === null || typeof input !== "object" || Array.isArray(input))
        return {
          ok: false,
          code: "invalid-input",
          message: "Provide settings to change and the current revision.",
        };
      const args = input as Record<string, unknown>;
      const keys = [
        "directed",
        "weighted",
        "indexBase",
        "snapToGrid",
        "showNodeLabels",
      ] as const;
      if (
        Object.keys(args).some(
          (key) =>
            key !== "expectedRevision" &&
            !keys.includes(key as (typeof keys)[number]),
        ) ||
        typeof args.expectedRevision !== "string" ||
        !keys.some((key) => args[key] !== undefined) ||
        ["directed", "weighted", "snapToGrid", "showNodeLabels"].some(
          (key) => args[key] !== undefined && typeof args[key] !== "boolean",
        ) ||
        (args.indexBase !== undefined &&
          args.indexBase !== 0 &&
          args.indexBase !== 1)
      ) {
        return {
          ok: false,
          code: "invalid-input",
          message: "Provide valid graph settings and the current revision.",
        };
      }
      if (args.expectedRevision !== revision())
        return {
          ok: false,
          code: "stale-revision",
          message: "The graph changed. Read it again before changing settings.",
        };
      if (options?.signal.aborted)
        return {
          ok: false,
          code: "cancelled",
          message: "The operation was cancelled before the graph changed.",
        };
      const before = store.get(graphAtom);
      const patch: Partial<GraphSettings> = {};
      if (typeof args.directed === "boolean") patch.directed = args.directed;
      if (typeof args.weighted === "boolean") patch.weighted = args.weighted;
      if (args.indexBase === 0 || args.indexBase === 1)
        patch.indexBase = args.indexBase;
      if (typeof args.snapToGrid === "boolean")
        patch.snapToGrid = args.snapToGrid;
      if (typeof args.showNodeLabels === "boolean")
        patch.showNodeLabels = args.showNodeLabels;
      const result = store.set(
        executeCommandAtom,
        updateSettingsCommand(patch),
      );
      if (result.status === "rejected")
        return { ok: false, code: result.reason, message: result.message };
      return {
        ok: true,
        status: result.status,
        revision: revision(),
        settings: result.graph.settings,
        relabeledNodes: result.graph.nodes.filter(
          (node, index) => node.label !== before.nodes[index]?.label,
        ).length,
        initializedWeights: result.graph.edges.filter(
          (edge, index) => edge.weight !== before.edges[index]?.weight,
        ).length,
      };
    },
  };
}
