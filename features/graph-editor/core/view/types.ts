import type { EdgeId, NodeId } from "../graph/model";

export type EditorLayout = "desktop" | "compact" | "mobile";

export type SelectionState = {
  nodeIds: NodeId[];
  edgeIds: EdgeId[];
};

export type EdgeDraftMessageCode =
  | "target-missing"
  | "source-missing"
  | "source-selected"
  | "self-loop"
  | "duplicate-edge"
  | "edge-created";

export type EdgeDraft = {
  sourceNodeId: NodeId | null;

  message?: {
    kind: "info" | "success" | "error";
    code: EdgeDraftMessageCode;
  } | null;
};

export type RenderedPoint = {
  x: number;
  y: number;
};

export type GraphCanvasChrome = {
  layout: EditorLayout;
};

export type GraphCanvasExportOptions = {
  scope: "full" | "viewport" | "natural" | "natural-fixed";
  background: "white" | "black" | "transparent";
  maxWidth?: number;
  maxHeight?: number;
  includeSelection: boolean;

  signal?: AbortSignal;
};
