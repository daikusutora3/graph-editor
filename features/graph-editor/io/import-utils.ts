import { createEmptyGraphModel, createNode } from "../core/graph/graph-factory";
import type {
  GraphModel,
  GraphNode,
  GraphSettings,
  NodeId,
} from "../core/graph/model";
import type { ImportFormatKind, ImportResult } from "./import-types";

export type ImportFormat =
  | "auto"
  | "contest-edge-list"
  | "tree-edge-list"
  | "parent-list"
  | "edge-pairs"
  | "adjacency-list"
  | "adjacency-matrix";

export type ImportOptions = Partial<GraphSettings> & {
  format?: ImportFormat;
};

export type ParsedLine = {
  number: number;
  text: string;
};

export const MAX_IMPORT_INPUT_CHARS = 1_000_000;
export const MAX_IMPORT_NODES = 1_000;
export const MAX_IMPORT_EDGES = 5_000;

export function readLines(input: string): ParsedLine[] {
  return input
    .split(/\r?\n/)
    .map((line, index) => ({
      number: index + 1,
      text: stripComment(line).trim(),
    }))
    .filter((line) => line.text.length > 0);
}

export function splitTokens(text: string) {
  return text
    .split(/[\s,]+/)
    .map((token) => token.trim())
    .filter(Boolean);
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

export function readImportSettings(
  options: ImportOptions,
  overrides: Partial<Pick<GraphSettings, "directed" | "weighted">> = {},
): GraphSettings {
  return {
    directed: overrides.directed ?? options.directed ?? false,
    weighted: overrides.weighted ?? options.weighted ?? false,
    indexBase: options.indexBase ?? 1,
    allowSelfLoops: options.allowSelfLoops ?? true,
    allowMultiEdges: options.allowMultiEdges ?? true,
    autoEdgeRouting: options.autoEdgeRouting ?? true,
    snapToGrid: options.snapToGrid ?? false,
    weightKind: options.weightKind ?? "number",
  };
}

export function importFailure(
  message: string,
  options: ImportOptions,
  format?: string,
  formatKind?: ImportFormatKind,
): ImportResult {
  return {
    model: createEmptyGraphModel(readImportSettings(options)),
    warnings: [message],
    format,
    formatKind,
  };
}

export function importLimitFailure(
  kind: "input" | "nodes" | "edges",
  count: number,
  limit: number,
  options: ImportOptions,
  format?: string,
  formatKind?: ImportFormatKind,
) {
  const label =
    kind === "input"
      ? "input characters"
      : kind === "nodes"
        ? "nodes"
        : "edges";

  return importFailure(
    `Import is too large: ${count.toLocaleString()} ${label}, maximum is ${limit.toLocaleString()}.`,
    options,
    format,
    formatKind,
  );
}

export function detectIndexBase(labels: string[], fallback: 0 | 1 | undefined) {
  return labels.every((label) => /^-?\d+$/.test(label)) && labels.includes("0")
    ? 0
    : fallback;
}

export function ensureNodeByLabel(
  model: GraphModel,
  idByLabel: Map<string, NodeId>,
  label: string,
  position: Partial<GraphNode> = {},
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
      x: position.x,
      y: position.y,
    }),
  );
  idByLabel.set(label, id);
  return id;
}

export function shouldRequireNumericWeights(
  settings: Pick<GraphSettings, "weighted" | "weightKind">,
) {
  return settings.weighted && settings.weightKind === "number";
}

function stripComment(line: string): string {
  const hashIndex = line.indexOf("#");
  const slashIndex = line.indexOf("//");
  const cutIndex = [hashIndex, slashIndex]
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];

  return cutIndex == null ? line : line.slice(0, cutIndex);
}
