import type { EdgeId, NodeId } from "../graph/model";

export type EditorLayout = "desktop" | "compact" | "mobile";

export type SelectionState = {
  nodeIds: NodeId[];
  edgeIds: EdgeId[];
};

export type EdgeDraft = NodeId | null;

export type RenderedPoint = {
  x: number;
  y: number;
};

export type GraphCanvasExportOptions = {
  scope: "full" | "viewport" | "natural" | "natural-fixed";
  background: "white" | "black" | "transparent";
  maxWidth?: number;
  maxHeight?: number;
  includeSelection: boolean;

  signal?: AbortSignal;
};
