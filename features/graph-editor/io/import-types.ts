import type { GraphModel } from "../core/graph/model";

export type ImportFormatKind =
  | "contest-edge-list"
  | "tree-edge-list"
  | "parent-list"
  | "edge-pairs"
  | "adjacency-list"
  | "adjacency-matrix";

export type ImportResult = {
  model: GraphModel;
  warnings: string[];
  formatKind?: ImportFormatKind;
  format?: string;
};
