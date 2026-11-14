import { graphAtom } from "../shell/state/graph-atoms";
import {
  canRedoAtom,
  canUndoAtom,
  redoAtom,
  undoAtom,
} from "../shell/state/history-atoms";
import type { WebMcpTool, WebMcpToolContext } from "./webmcp-types";

export function createHistoryTool({
  store,
  revision,
}: WebMcpToolContext): WebMcpTool {
  return {
    name: "edit_history",
    description:
      "Undo or redo the most recent editor change, including a change made by the user. Read the current revision before acting. History is available only during the current editor session.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["undo", "redo"],
          description:
            "Undo the most recent change or redo the last undone change.",
        },
        expectedRevision: {
          type: "string",
          description:
            "Current graph revision obtained from a graph read tool.",
        },
      },
      required: ["action", "expectedRevision"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, untrustedContentHint: false },
    execute: async (input, options) => {
      if (
        input === null ||
        typeof input !== "object" ||
        Array.isArray(input) ||
        Object.keys(input).some(
          (key) => !["action", "expectedRevision"].includes(key),
        )
      ) {
        return {
          ok: false,
          code: "invalid-input",
          message: "Provide undo or redo and the current graph revision.",
        };
      }
      const args = input as Record<string, unknown>;
      if (
        (args.action !== "undo" && args.action !== "redo") ||
        typeof args.expectedRevision !== "string"
      ) {
        return {
          ok: false,
          code: "invalid-input",
          message: "Provide undo or redo and the current graph revision.",
        };
      }
      if (args.expectedRevision !== revision()) {
        return {
          ok: false,
          code: "stale-revision",
          message: "The graph changed. Read it again before changing history.",
        };
      }
      if (options?.signal.aborted) {
        return {
          ok: false,
          code: "cancelled",
          message: "The operation was cancelled before the graph changed.",
        };
      }
      const available = store.get(
        args.action === "undo" ? canUndoAtom : canRedoAtom,
      );
      if (!available) {
        return {
          ok: false,
          code: "history-unavailable",
          message: `There is no change to ${args.action} in this editor session.`,
        };
      }
      const before = store.get(graphAtom);
      try {
        store.set(args.action === "undo" ? undoAtom : redoAtom);
      } catch {
        return {
          ok: false,
          code: "history-failed",
          message:
            "History could not be applied. Read the graph before retrying.",
        };
      }
      if (store.get(graphAtom) === before) {
        return {
          ok: false,
          code: "history-unavailable",
          message:
            "History no longer matches the current graph. Read it again before editing.",
        };
      }
      return { ok: true, action: args.action, revision: revision() };
    },
  };
}
