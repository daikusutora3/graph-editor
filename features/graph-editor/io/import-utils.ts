import {
  GRAPH_MAX_INPUT_CHARS,
  GRAPH_MAX_NODES,
  GRAPH_MAX_EDGES,
} from "../core/graph/graph-limits";
import {
  createEmptyGraphModel,
  createNode,
  defaultGraphSettings,
} from "../core/graph/graph-factory";
import type { GraphModel, GraphSettings, NodeId } from "../core/graph/model";
import type {
  ImportFormatKind,
  ImportResult,
  ImportWarning,
} from "./import-types";

export type ImportFormat = "auto" | ImportFormatKind;

export type ImportOptions = Partial<GraphSettings> & {
  format?: ImportFormat;
};

export type ParsedLine = {
  number: number;
  text: string;
};

export const MAX_IMPORT_INPUT_CHARS = GRAPH_MAX_INPUT_CHARS;
export const MAX_IMPORT_NODES = GRAPH_MAX_NODES;
export const MAX_IMPORT_EDGES = GRAPH_MAX_EDGES;

export const MAX_IMPORT_ADJACENCY_ENTRIES = MAX_IMPORT_EDGES * 2;

export function readLines(input: string): ParsedLine[] {
  const lines: ParsedLine[] = [];
  let start = 0;
  let number = 1;
  while (start <= input.length) {
    const newline = input.indexOf("\n", start);
    const end = newline < 0 ? input.length : newline;
    const text = stripComment(input.slice(start, end)).trim();
    if (text) lines.push({ number, text });
    if (newline < 0) break;
    start = newline + 1;
    number += 1;
  }
  return lines;
}

export function splitTokens(text: string) {
  return text.match(/[^\s,]+/g) ?? [];
}

export function createIndexedNodes(nodeCount: number, indexBase: 0 | 1) {
  return Array.from({ length: nodeCount }, (_, index) =>
    createNode({
      id: `n${index}`,
      label: String(index + indexBase),
      order: index,
    }),
  );
}

export function arrangeNodes(model: GraphModel) {
  const count = model.nodes.length;
  const radius = Math.max(170, count * 26);

  model.nodes = model.nodes.map((node, index) => {
    if (node.x !== 0 || node.y !== 0) {
      return node;
    }

    const angle = count <= 1 ? 0 : (Math.PI * 2 * index) / count;
    return {
      ...node,
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
    };
  });
}

export function readImportSettings(options: ImportOptions): GraphSettings {
  return {
    directed: options.directed ?? defaultGraphSettings.directed,
    weighted: options.weighted ?? defaultGraphSettings.weighted,
    indexBase: options.indexBase ?? 1,
    allowSelfLoops:
      options.allowSelfLoops ?? defaultGraphSettings.allowSelfLoops,
    allowMultiEdges:
      options.allowMultiEdges ?? defaultGraphSettings.allowMultiEdges,
    autoEdgeRouting:
      options.autoEdgeRouting ?? defaultGraphSettings.autoEdgeRouting,
    snapToGrid: options.snapToGrid ?? defaultGraphSettings.snapToGrid,
    showNodeLabels:
      options.showNodeLabels ?? defaultGraphSettings.showNodeLabels,
    arrowScale: options.arrowScale ?? defaultGraphSettings.arrowScale,
    weightKind: options.weightKind ?? defaultGraphSettings.weightKind,
  };
}

export function importFailure(
  warning: ImportWarning,
  options: ImportOptions,
  format?: string,
  formatKind?: ImportFormatKind,
): ImportResult {
  return {
    model: createEmptyGraphModel(readImportSettings(options)),
    warnings: [warning],
    format,
    formatKind,
  };
}

export function importLimitFailure(
  kind: "input" | "nodes" | "edges" | "adjacency-entries",
  count: number,
  limit: number,
  options: ImportOptions,
  format?: string,
  formatKind?: ImportFormatKind,
) {
  return importFailure(
    { code: "too-large", kind, count, limit },
    options,
    format,
    formatKind,
  );
}

export function detectIndexBase(
  labels: ReadonlySet<string>,
  fallback: 0 | 1 | undefined,
) {
  if (!labels.has("0")) return fallback;
  for (const label of labels) if (!/^-?\d+$/.test(label)) return fallback;
  return 0;
}

export function ensureNodeByLabel(
  model: GraphModel,
  idByLabel: Map<string, NodeId>,
  label: string,
) {
  const existing = idByLabel.get(label);
  if (existing) {
    return existing;
  }

  const id = `n${model.nodes.length}`;
  model.nodes.push(
    createNode({
      id,
      label,
      order: model.nodes.length,
    }),
  );
  idByLabel.set(label, id);
  return id;
}

function stripComment(line: string): string {
  const hashIndex = line.indexOf("#");
  const slashIndex = line.indexOf("//");
  const cutIndex =
    hashIndex < 0
      ? slashIndex
      : slashIndex < 0
        ? hashIndex
        : Math.min(hashIndex, slashIndex);
  return cutIndex < 0 ? line : line.slice(0, cutIndex);
}
