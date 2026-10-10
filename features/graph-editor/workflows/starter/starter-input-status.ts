import type {
  ImportAnalysis,
  ImportResult,
  ImportWarning,
} from "../../io/import-types";
import type { StarterFileReadState } from "./starter-file-read";

export type StarterInputStatus =
  "empty" | "reading" | "checking" | "review" | "ready" | "warning";

export function getStarterInputStatus({
  inputText,
  fileReadState,
  previewPending,
  analysis,
  preview,
  visibleIssues,
}: {
  inputText: string;
  fileReadState: StarterFileReadState;
  previewPending: boolean;
  analysis: ImportAnalysis | null;
  preview: ImportResult | null;
  visibleIssues: readonly ImportWarning[];
}): StarterInputStatus {
  if (fileReadState.status === "reading") return "reading";
  if (!inputText.trim()) return "empty";
  if (previewPending || !analysis) return "checking";
  if (analysis.status !== "detected" || !preview) return "review";
  const { model } = preview;
  if (
    model.nodes.length === 0 &&
    model.edges.length === 0 &&
    preview.warnings.length > 0
  ) {
    return "review";
  }
  return visibleIssues.length > 0 ? "warning" : "ready";
}

export function canApplyStarterInput(status: StarterInputStatus) {
  return status === "ready" || status === "warning";
}
