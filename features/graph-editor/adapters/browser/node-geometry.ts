import {
  estimateLabelWidth,
  NODE_SIZE_PX,
  NODE_FONT_PX,
  NODE_LABEL_PADDING_PX,
} from "../../core/graph/node-size";
import type { GraphModel } from "../../core/graph/model";
import { readCanvasPalette } from "../cytoscape/graph-canvas-viewport";

let context: CanvasRenderingContext2D | null = null;
const widths = new Map<string, number>();
export function measureNodeWidth(
  label: string,
  palette: { nodeSize: number; nodeFontSize: number; fontFamily: string },
) {
  if (!label) return palette.nodeSize;
  const font = `600 ${palette.nodeFontSize}px ${palette.fontFamily}`;
  const key = JSON.stringify([font, palette.nodeSize, label]);
  const cached = widths.get(key);
  if (cached !== undefined) return cached;
  if (typeof document !== "undefined")
    context ??= document.createElement("canvas").getContext("2d");
  if (context) context.font = font;
  const width = Math.max(
    palette.nodeSize,
    Math.ceil(
      (context?.measureText(label).width ??
        estimateLabelWidth(label, palette.nodeFontSize)) +
        NODE_LABEL_PADDING_PX * 2,
    ),
  );
  if (widths.size > 4096) widths.clear();
  widths.set(key, width);
  return width;
}
export function clearNodeMeasurements() {
  widths.clear();
}
/** Transient geometry; never commit this model to history or storage. */
export function withMeasuredNodeGeometry(model: GraphModel): GraphModel {
  const palette =
    typeof document === "undefined"
      ? {
          nodeSize: NODE_SIZE_PX,
          nodeFontSize: NODE_FONT_PX,
          fontFamily: "sans-serif",
        }
      : readCanvasPalette();
  return {
    ...model,
    nodes: model.nodes.map((node) => ({
      ...node,
      measuredWidth: measureNodeWidth(
        model.settings.showNodeLabels ? node.label : "",
        palette,
      ),
    })),
  };
}
