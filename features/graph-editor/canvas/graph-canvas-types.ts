import type { EdgeId, NodeId } from "../core/graph/model";

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
      sourceX: number;
      sourceY: number;
      targetX: number;
      targetY: number;
      x: number;
      y: number;
    };

export type RenderedPoint = {
  x: number;
  y: number;
};

export type GraphCanvasChrome = {
  sidebarCollapsed: boolean;
};

export type GraphCanvasExportOptions = {
  scope: "full" | "viewport";
  background: "white" | "black" | "transparent";
  maxWidth?: number;
  maxHeight?: number;
  includeSelection: boolean;
};

export type InlineEditTarget =
  | {
      kind: "node-label";
      nodeId: NodeId;
      value: string;
      fallbackPosition: RenderedPoint;
      error?: string;
    }
  | {
      kind: "edge-weight" | "edge-label";
      edgeId: EdgeId;
      value: string;
      fallbackPosition: RenderedPoint;
      error?: string;
    };
