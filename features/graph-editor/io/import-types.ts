import type { GraphModel } from "../core/graph/model";

export type ImportFormatKind =
  | "contest-edge-list"
  | "tree-edge-list"
  | "parent-list"
  | "weighted-parent-list"
  | "edge-pairs"
  | "adjacency-list"
  | "adjacency-matrix";

export type ImportResult = {
  model: GraphModel;
  warnings: string[];
  formatKind?: ImportFormatKind;
  format?: string;
};

export type ImportDiagnosticSeverity = "info" | "warning" | "error";

export type ImportDiagnostic = {
  code:
    | "ambiguous-format"
    | "empty-input"
    | "input-limit"
    | "invalid-format"
    | "partial-import";
  severity: ImportDiagnosticSeverity;
  message: string;
};

export type ImportMatchStrength = "exact" | "strong" | "fallback";

export type ImportDetectionEvidence =
  | "adjacency-syntax"
  | "square-numeric-matrix"
  | "structured-header"
  | "parent-row"
  | "weighted-parent-rows"
  | "tree-edge-rows"
  | "edge-rows";

export type ImportCandidate = {
  formatKind: ImportFormatKind;
  strength: ImportMatchStrength;
  evidence: ImportDetectionEvidence[];
  nodeCount?: number;
  edgeCount?: number;
};

export type ImportAnalysis = {
  status: "detected" | "ambiguous" | "invalid" | "limit";
  recommendedFormat?: ImportFormatKind;
  candidates: ImportCandidate[];
  diagnostics: ImportDiagnostic[];
};

export type ImportEvaluation = {
  analysis: ImportAnalysis;
  result: ImportResult;
};
