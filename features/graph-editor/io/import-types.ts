import type { GraphModel } from "../core/graph/model";

export type ImportFormatKind =
  | "contest-edge-list"
  | "tree-edge-list"
  | "parent-list"
  | "weighted-parent-list"
  | "edge-pairs"
  | "adjacency-list"
  | "adjacency-matrix"
  | "json";

/**
 * Import warnings are structured so the UI can translate them; the English
 * rendering lives in i18n/import-warning-messages.ts.
 */
export type ImportWarning =
  | { code: "empty-input" }
  | {
      code: "too-large";
      kind: "input" | "nodes" | "edges";
      count: number;
      limit: number;
    }
  | { code: "invalid-format"; formatKind: ImportFormatKind }
  | { code: "unsupported-format" }
  | { code: "ambiguous-formats" }
  | { code: "maybe-weighted-parent-list" }
  | { code: "missing-edges"; expected: number; found: number }
  | { code: "extra-edge-lines"; count: number }
  | {
      code: "expected-integers";
      line: number;
      expected: number;
      shape: string;
      got: number;
    }
  | {
      code: "node-out-of-range";
      line: number;
      source: string;
      target: string;
      min: number;
      max: number;
    }
  | { code: "weight-not-numeric"; line: number }
  | { code: "missing-source"; line: number }
  | { code: "missing-target"; line: number }
  | { code: "expected-header"; line: number; got: string }
  | { code: "invalid-node-count"; line: number }
  | { code: "invalid-edge-count"; line: number };

export type ImportResult = {
  model: GraphModel;
  warnings: ImportWarning[];
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
  | "edge-rows"
  | "json-document";

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
