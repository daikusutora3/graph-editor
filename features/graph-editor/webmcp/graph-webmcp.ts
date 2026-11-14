import type { createStore } from "jotai/vanilla";

import type { GraphModel } from "../core/graph/model";
import {
  GRAPH_MAX_INPUT_CHARS,
  GRAPH_MAX_JSON_CHARS,
} from "../core/graph/graph-limits";
import { evaluateGraphInput } from "../io/import-graph";
import type { ImportFormat } from "../io/import-utils";
import { exportGraph, type GraphExportFormat } from "../io/export-graph";
import { replaceGraphModelAtom } from "../shell/state/editor-actions";
import { graphAtom } from "../shell/state/graph-atoms";
import { selectionAtom } from "../shell/state/editor-atoms";
import { historyAtom, futureAtom } from "../shell/state/history-atoms";
import { getStorageSnapshot } from "../adapters/browser/stored-graph";
import { getGraphStorageContext } from "../adapters/browser/graph-storage-context";
import { getExportNodeEntries } from "../io/export-node-labels";
import { createAddNodeTool } from "./add-node-tool";
import { createAddElementsTool } from "./add-elements-tool";
import { createBatchEditTool } from "./batch-edit-tool";
import { createBatchDeleteTool } from "./batch-delete-tool";
import { createEditTools } from "./edit-tools";
import { createHistoryTool } from "./history-tool";
import { createFindElementsTool } from "./find-elements-tool";
import { createIncidentEdgesTool } from "./incident-edges-tool";
import { createFilterSelectionTool } from "./filter-selection-tool";
import { createRelativeLayoutTool } from "./relative-layout-tool";
import { createReverseEdgesTool } from "./reverse-edges-tool";
import { createLayoutTool } from "./layout-tool";
import { createSettingsTool } from "./settings-tool";
import type { WebMcpTool } from "./webmcp-types";

type Store = ReturnType<typeof createStore>;
export type GraphModelContext = {
  registerTool: (
    tool: WebMcpTool,
    options: { signal: AbortSignal },
  ) => Promise<unknown>;
};

const exportFormats = [
  "json",
  "edge-list",
  "adjacency-list",
  "adjacency-matrix",
  "tikz",
] as const;
const importFormats = [
  "json",
  "contest-edge-list",
  "tree-edge-list",
  "parent-list",
  "weighted-parent-list",
  "edge-pairs",
  "adjacency-list",
  "adjacency-matrix",
] as const;
type ExplicitImportFormat = Exclude<ImportFormat, "auto">;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every((key) => keys.includes(key));
}

function failure(code: string, message: string) {
  return { ok: false, code, message };
}

const OUTPUT_LIMIT = 16_000;
const SELECTION_ID_LIMIT = 1_000;

function boundedSelectionIds(ids: string[]) {
  const result: string[] = [];
  for (const id of ids.slice(0, 10)) {
    if (JSON.stringify([...result, id]).length > SELECTION_ID_LIMIT) break;
    result.push(id);
  }
  return { ids: result, truncated: result.length < ids.length };
}

/** Register tools for one mounted editor. The returned function removes them. */
export function registerGraphWebMcp(
  modelContext: GraphModelContext,
  store: Store,
  requestFit: (graph: GraphModel) => void,
) {
  const controller = new AbortController();
  const session = crypto.randomUUID();
  let sequence = 0;
  let selectionSequence = 0;
  const revision = () => `${session}:${sequence}`;
  const selectionRevision = () => `${session}:selection:${selectionSequence}`;
  const unsubscribeGraph = store.sub(graphAtom, () => {
    sequence += 1;
  });
  const unsubscribeSelection = store.sub(selectionAtom, () => {
    selectionSequence += 1;
  });
  const unsubscribe = () => {
    unsubscribeGraph();
    unsubscribeSelection();
  };

  const tools: WebMcpTool[] = [
    {
      name: "get_graph_summary",
      description:
        "Inspect the graph before editing: obtain revision, counts, settings, selection, history and save status. Browse pages, or use find_graph_elements for specific nodes and edges. Pass expectedRevision to keep pages consistent. Selection has its own revision, independent of the graph revision.",
      inputSchema: {
        type: "object",
        properties: {
          section: {
            type: "string",
            enum: ["summary", "nodes", "edges"],
            description: "Summary by default; nodes or edges lists elements.",
          },
          offset: {
            type: "integer",
            minimum: 0,
            description: "Zero-based offset for nodes or edges; defaults to 0.",
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "Maximum elements per page; defaults to 10.",
          },
          expectedRevision: {
            type: "string",
            description:
              "Revision from the first page; prevents mixing pages after edits.",
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, [
            "section",
            "offset",
            "limit",
            "expectedRevision",
          ]) ||
          (input.expectedRevision !== undefined &&
            typeof input.expectedRevision !== "string") ||
          (input.section !== undefined &&
            !["summary", "nodes", "edges"].includes(input.section as string)) ||
          (input.offset !== undefined &&
            (!Number.isSafeInteger(input.offset) ||
              (input.offset as number) < 0)) ||
          (input.limit !== undefined &&
            (!Number.isSafeInteger(input.limit) ||
              (input.limit as number) < 1 ||
              (input.limit as number) > 10))
        ) {
          return failure(
            "invalid-input",
            "Choose summary, nodes, or edges, an offset of at least 0, and a limit from 1 to 10.",
          );
        }
        if (
          input.expectedRevision !== undefined &&
          input.expectedRevision !== revision()
        ) {
          return failure(
            "stale-revision",
            "The graph changed. Read the first page again before continuing.",
          );
        }
        const graph = store.get(graphAtom);
        const selection = store.get(selectionAtom);
        const selectedNodes = boundedSelectionIds(selection.nodeIds);
        const selectedEdges = boundedSelectionIds(selection.edgeIds);
        const history = store.get(historyAtom);
        const future = store.get(futureAtom);
        const section = input.section ?? "summary";
        const base = {
          ok: true,
          revision: revision(),
          nodeCount: graph.nodes.length,
          edgeCount: graph.edges.length,
          settings: graph.settings,
          selection: {
            revision: selectionRevision(),
            nodeCount: selection.nodeIds.length,
            edgeCount: selection.edgeIds.length,
            nodeIds: selectedNodes.ids,
            edgeIds: selectedEdges.ids,
            nodeIdsTruncated: selectedNodes.truncated,
            edgeIdsTruncated: selectedEdges.truncated,
          },
          storage: {
            status: getStorageSnapshot().status,
            scope: getGraphStorageContext().kind,
          },
          history: {
            canUndo: history.length > 0,
            canRedo: future.length > 0,
            undoLabel: history.at(-1)?.label ?? null,
            redoLabel: future[0]?.label ?? null,
          },
        };
        if (section === "summary") return base;
        const offset = (input.offset ?? 0) as number;
        const limit = (input.limit ?? 10) as number;
        const all = section === "nodes" ? graph.nodes : graph.edges;
        const items: Array<
          GraphModel["nodes"][number] | GraphModel["edges"][number]
        > = [];
        const page = () => ({
          ...base,
          section,
          offset,
          items,
          nextOffset:
            offset + items.length < all.length ? offset + items.length : null,
        });
        for (const item of all.slice(offset, offset + limit)) {
          items.push(item);
          if (JSON.stringify(page()).length > OUTPUT_LIMIT) {
            items.pop();
            if (items.length === 0)
              return {
                ...failure(
                  "output-too-large",
                  "One element exceeds the response limit. Use an explicit full export if its complete contents are needed.",
                ),
                revision: revision(),
              };
            break;
          }
        }
        return page();
      },
    },
    {
      name: "get_graph",
      description:
        "Export the complete graph as text. For editing, use get_graph_summary or find_graph_elements. Large exports are limited unless allowLargeOutput is explicitly true; use it only when the complete export is needed. JSON preserves all fields. Numeric formats may renumber node labels.",
      inputSchema: {
        type: "object",
        properties: {
          format: {
            type: "string",
            enum: exportFormats,
            description: "Output format; defaults to json.",
          },
          allowLargeOutput: {
            type: "boolean",
            description:
              "Allow a full response over 16,000 characters when a complete export is needed. Defaults to false.",
          },
        },
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: async (input) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, ["format", "allowLargeOutput"]) ||
          (input.allowLargeOutput !== undefined &&
            typeof input.allowLargeOutput !== "boolean") ||
          (input.format !== undefined &&
            (typeof input.format !== "string" ||
              !exportFormats.includes(input.format as GraphExportFormat)))
        ) {
          return failure("invalid-input", "Choose a supported export format.");
        }
        try {
          const format = (input.format ?? "json") as GraphExportFormat;
          const graph = store.get(graphAtom);
          const numericFormat = [
            "edge-list",
            "adjacency-list",
            "adjacency-matrix",
          ].includes(format);
          const output = {
            ok: true,
            revision: revision(),
            format,
            graph: exportGraph(graph, format),
            ...(numericFormat
              ? {
                  nodeLabelsRenumbered: getExportNodeEntries(graph).some(
                    ({ node, label }) => node.label !== String(label),
                  ),
                }
              : {}),
          };
          const outputChars = JSON.stringify(output).length;
          if (outputChars > OUTPUT_LIMIT && input.allowLargeOutput !== true)
            return {
              ...failure(
                "output-too-large",
                "The complete export exceeds the response limit. Use get_graph_summary or find_graph_elements to inspect only what you need; set allowLargeOutput to true only when the full export is needed.",
              ),
              revision: revision(),
              outputChars,
            };
          return output;
        } catch {
          return failure(
            "export-failed",
            "The graph cannot be exported in this format without losing information or exceeding the export limit. Try JSON.",
          );
        }
      },
    },
    {
      name: "replace_graph",
      description:
        "Replace the entire graph from explicitly formatted input, preserving current settings for text input. Read the revision with get_graph_summary first. Changes affect the editor, can be undone in this session, and save asynchronously; incomplete imports are rejected.",
      inputSchema: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "Complete graph data in the specified format.",
          },
          format: {
            type: "string",
            enum: importFormats,
            description:
              "The input format; json accepts the JSON from get_graph.",
          },
          expectedRevision: {
            type: "string",
            description: "Revision from the latest graph read.",
          },
          directed: {
            type: "boolean",
            description: "Use directed edges for text formats.",
          },
          weighted: {
            type: "boolean",
            description: "Use edge weights for text formats.",
          },
          indexBase: {
            type: "integer",
            enum: [0, 1],
            description: "Default node numbering base for text formats.",
          },
        },
        required: ["input", "format", "expectedRevision"],
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: false,
        untrustedContentHint: true,
        consequentialHint: true,
      },
      execute: async (input, options) => {
        if (
          !isRecord(input) ||
          !hasOnlyKeys(input, [
            "input",
            "format",
            "expectedRevision",
            "directed",
            "weighted",
            "indexBase",
          ]) ||
          typeof input.input !== "string" ||
          typeof input.format !== "string" ||
          !importFormats.includes(input.format as ExplicitImportFormat) ||
          typeof input.expectedRevision !== "string" ||
          (input.directed !== undefined &&
            typeof input.directed !== "boolean") ||
          (input.weighted !== undefined &&
            typeof input.weighted !== "boolean") ||
          (input.indexBase !== undefined &&
            input.indexBase !== 0 &&
            input.indexBase !== 1) ||
          (input.format === "json" &&
            (input.directed !== undefined ||
              input.weighted !== undefined ||
              input.indexBase !== undefined))
        ) {
          return failure(
            "invalid-input",
            "Provide input, an explicit supported format, and the current revision. Text-format settings cannot be used with JSON.",
          );
        }
        if (
          input.input.length >
          (input.format === "json"
            ? GRAPH_MAX_JSON_CHARS
            : GRAPH_MAX_INPUT_CHARS)
        ) {
          return failure(
            "input-limit",
            "The input exceeds the graph size limit.",
          );
        }
        if (input.expectedRevision !== revision()) {
          return failure(
            "stale-revision",
            "The graph has changed. Read it again before replacing it.",
          );
        }
        let result;
        try {
          result = evaluateGraphInput(input.input, {
            ...(input.format === "json" ? {} : store.get(graphAtom).settings),
            format: input.format as ExplicitImportFormat,
            ...(input.directed === undefined
              ? {}
              : { directed: input.directed as boolean }),
            ...(input.weighted === undefined
              ? {}
              : { weighted: input.weighted as boolean }),
            ...(input.indexBase === undefined
              ? {}
              : { indexBase: input.indexBase as 0 | 1 }),
          }).result;
        } catch {
          return failure(
            "import-failed",
            "The input could not be imported. The graph was not changed.",
          );
        }
        if (
          result.status !== "success" &&
          !(result.status === "empty" && input.format === "json")
        ) {
          return {
            ...failure(
              "import-failed",
              "The input could not be imported completely. The graph was not changed.",
            ),
            warnings: result.warnings,
          };
        }
        if (options?.signal.aborted)
          return failure(
            "cancelled",
            "The operation was cancelled before the graph changed.",
          );
        try {
          const outcome = store.set(replaceGraphModelAtom, result.model);
          if (outcome.status === "rejected")
            return failure(outcome.reason, outcome.message);
          let fitRequested = false;
          if (outcome.status === "applied") {
            try {
              requestFit(outcome.graph);
              fitRequested = true;
            } catch {
              // The graph was already committed, even if the viewport could not be adjusted.
            }
          }
          return {
            ok: true,
            status: outcome.status,
            revision: revision(),
            nodeCount: outcome.graph.nodes.length,
            edgeCount: outcome.graph.edges.length,
            fitRequested,
          };
        } catch {
          return failure(
            "operation-failed",
            "The operation failed. Read the current graph before retrying.",
          );
        }
      },
    },
  ];

  const toolContext = { store, revision, selectionRevision, requestFit };
  tools.push(
    createAddNodeTool(toolContext),
    createAddElementsTool(toolContext),
    ...createEditTools(toolContext).filter((tool) => tool.name === "add_edge"),
    createLayoutTool(toolContext),
    createSettingsTool(toolContext),
    createHistoryTool(toolContext),
    createFindElementsTool(toolContext),
    createIncidentEdgesTool(toolContext),
    createFilterSelectionTool(toolContext),
    createRelativeLayoutTool(toolContext),
    createReverseEdgesTool(toolContext),
    createBatchEditTool(toolContext),
    createBatchDeleteTool(toolContext),
  );

  for (const tool of tools) {
    const tracksGraphStorage =
      !tool.annotations.readOnlyHint && tool.name !== "select_graph_elements";
    const registeredTool: WebMcpTool = {
      ...tool,
      description: tracksGraphStorage
        ? `${tool.description} Saving is asynchronous; check storage.status.`
        : tool.description,
      execute: async (input, options) => {
        const signal = options?.signal
          ? AbortSignal.any([controller.signal, options.signal])
          : controller.signal;
        if (signal.aborted)
          return failure("cancelled", "The operation was cancelled.");
        const result = await tool.execute(input, { signal });
        if (tracksGraphStorage && isRecord(result) && result.ok === true) {
          const storage = {
            status: getStorageSnapshot().status,
            scope: getGraphStorageContext().kind,
          };
          const output = { ...result, storage };
          if (JSON.stringify(output).length > OUTPUT_LIMIT) {
            return {
              ok: true,
              ...(typeof result.status === "string"
                ? { status: result.status }
                : {}),
              revision: revision(),
              storage,
              outputTruncated: true,
              message:
                "The operation completed, but its result exceeded the response limit. Inspect the graph for details.",
            };
          }
          return output;
        }
        if (
          !tool.annotations.readOnlyHint &&
          isRecord(result) &&
          JSON.stringify(result).length > OUTPUT_LIMIT
        )
          return failure(
            "operation-failed",
            "The operation failed and the error details exceeded the response limit. Inspect the graph and input before retrying.",
          );
        return result;
      },
    };
    Promise.resolve()
      .then(() => {
        if (!controller.signal.aborted)
          return modelContext.registerTool(registeredTool, {
            signal: controller.signal,
          });
      })
      .catch(() => {
        controller.abort();
        unsubscribe();
      });
  }
  return () => {
    controller.abort();
    unsubscribe();
  };
}
