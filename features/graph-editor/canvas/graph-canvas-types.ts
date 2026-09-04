import type { InlineEditErrorCode } from "../core/graph/edit-values";
import type { EdgeId, NodeId } from "../core/graph/model";
export type {
  GraphCanvasChrome,
  GraphCanvasExportOptions,
  RenderedPoint,
} from "../core/view/types";
import type { RenderedPoint } from "../core/view/types";

export type ContextMenuAnchorRect = {
  height: number;
  left: number;
  top: number;
  width: number;
};

export type GraphContextMenuTarget =
  | {
      anchorRect?: ContextMenuAnchorRect;
      kind: "node";
      nodeId: NodeId;
      x: number;
      y: number;
    }
  | {
      anchorRect?: ContextMenuAnchorRect;
      kind: "edge";
      edgeId: EdgeId;
      x: number;
      y: number;
    };

export type InlineEditTarget =
  | {
      kind: "node-label";
      nodeId: NodeId;
      value: string;
      fallbackPosition: RenderedPoint;
      error?: InlineEditErrorCode;
    }
  | {
      kind: "edge-weight" | "edge-label";
      edgeId: EdgeId;
      value: string;
      fallbackPosition: RenderedPoint;
      error?: InlineEditErrorCode;
    };
