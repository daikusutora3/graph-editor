import type { EdgeId, NodeId } from "../core/graph/model";
export type { InlineEditTarget } from "../core/graph/inline-edit-commit";
export type {
  GraphCanvasExportOptions,
  RenderedPoint,
} from "../core/view/types";

export type ContextMenuAnchorRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export type SyncContextSelectionTarget =
  { kind: "node"; nodeId: NodeId } | { kind: "edge"; edgeId: EdgeId };

export type GraphContextMenuTarget = SyncContextSelectionTarget & {
  anchorRect?: ContextMenuAnchorRect;
  x: number;
  y: number;
};
