import type { EdgeId, NodeId } from "../graph/model";

/**
 * View-level types shared by the shell, the canvas and the Cytoscape adapter.
 * They live in core so the adapter never has to import from layers above it.
 */
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
  /** Outcome of the last edge-mode action; only the kind is consumed. */
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
  scope: "full" | "viewport";
  background: "white" | "black" | "transparent";
  maxWidth?: number;
  maxHeight?: number;
  includeSelection: boolean;
};
