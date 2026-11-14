import { graphAtom } from "../shell/state/graph-atoms";
import { selectionAtom } from "../shell/state/editor-atoms";
import { fail, hasOnly, isRecord } from "./batch-edit-tool";
import {
  edgeFilterSchema,
  nodeFilterSchema,
  resolveFilterTargets,
} from "./filter-edit-tool";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

export function createFilterSelectionTool({
  store,
  revision,
  selectionRevision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "select_graph_elements",
    description:
      "Select matching nodes and/or edges on screen, replacing the previous selection. Selection is not undoable. To edit matching elements without changing selection, pass filters directly to the editing tool. Report any nonNumericWeights excluded from a weight filter.",
    inputSchema: {
      type: "object",
      properties: {
        nodeFilter: nodeFilterSchema,
        edgeFilter: edgeFilterSchema,
        expectedRevision: {
          type: "string",
          description: "Current graph revision from get_graph_summary.",
        },
        expectedSelectionRevision: {
          type: "string",
          description: "Current selection.revision from get_graph_summary.",
        },
      },
      required: ["expectedRevision", "expectedSelectionRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute: async (input, options) => {
      if (
        !isRecord(input) ||
        !hasOnly(input, [
          "nodeFilter",
          "edgeFilter",
          "expectedRevision",
          "expectedSelectionRevision",
        ]) ||
        typeof input.expectedRevision !== "string" ||
        typeof input.expectedSelectionRevision !== "string" ||
        (input.nodeFilter === undefined && input.edgeFilter === undefined)
      )
        return fail(
          "invalid-input",
          "Provide at least one nonempty filter and current graph and selection revisions.",
        );
      if (input.expectedRevision !== revision())
        return fail(
          "stale-revision",
          "The graph changed. Read it again before selecting.",
        );
      if (input.expectedSelectionRevision !== selectionRevision())
        return fail(
          "stale-selection",
          "The selection changed. Read it again before selecting.",
        );
      const resolved = resolveFilterTargets(
        store.get(graphAtom),
        input.nodeFilter,
        input.edgeFilter,
      );
      if (!("nodeIds" in resolved) || !resolved.nodeIds || !resolved.edgeIds)
        return resolved;
      if (options?.signal.aborted)
        return fail(
          "cancelled",
          "The operation was cancelled before selection changed.",
        );
      const nodeIds = [...resolved.nodeIds];
      const edgeIds = [...resolved.edgeIds];
      const current = store.get(selectionAtom);
      const unchanged =
        current.nodeIds.length === nodeIds.length &&
        current.edgeIds.length === edgeIds.length &&
        current.nodeIds.every((id, index) => id === nodeIds[index]) &&
        current.edgeIds.every((id, index) => id === edgeIds[index]);
      if (!unchanged) store.set(selectionAtom, { nodeIds, edgeIds });
      return {
        ok: true,
        status: unchanged ? "unchanged" : "selected",
        revision: revision(),
        selectionRevision: selectionRevision(),
        nodeCount: nodeIds.length,
        edgeCount: edgeIds.length,
        nonNumericWeights: resolved.nonNumericWeights,
      };
    },
  };
}
