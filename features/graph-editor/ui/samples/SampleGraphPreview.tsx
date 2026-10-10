import { memo, useId } from "react";

import type { SampleGraphKind } from "../../samples/sample-graphs";
import type { GraphColor, GraphModel } from "../../core/graph/model";
import { hasGraphCoordinatePositions } from "../../core/graph/graph-coordinates";
import { computeEdgeRouting } from "../../core/layout/edge-routing";
import { NODE_FONT_PX, NODE_SIZE_PX } from "../../core/graph/node-size";
import { EDGE_WIDTH, NODE_BORDER_WIDTH } from "../../core/view/graph-paint";
import {
  PREVIEW_ARROW_HALF_WIDTH,
  PREVIEW_ARROW_LENGTH,
  PREVIEW_ARROW_REACH,
} from "./preview-arrow";
import { cn } from "@/lib/utils";
import {
  createPreparedPreviewEdgePath,
  preparePreviewGeometry,
  type PreparedPreviewGeometry,
} from "./preview-geometry";
export {
  createPreviewEdgePath,
  getModelBounds,
  preparePreviewGeometry,
  type PreviewGeometryWork,
} from "./preview-geometry";

type SampleGraphPreviewProps = {
  model: GraphModel;
  sampleKind?: SampleGraphKind;
  width?: number;
  height?: number;
  focus?: boolean;
  variant?: "sample" | "editor";
  className?: string;
};

export const SampleGraphPreview = memo(function SampleGraphPreview({
  model,
  sampleKind,
  width = 132,
  height = 88,
  focus = false,
  variant = "sample",
  className,
}: SampleGraphPreviewProps) {
  const markerId = `sample-arrow-${useId().replaceAll(":", "")}`;
  // Imports/commands enforce this contract too. Protect standalone previews
  // before bounds, routing or transforms can overflow on unvalidated input.
  if (!hasGraphCoordinatePositions(model.nodes)) return null;
  const edgeRouting = computeEdgeRouting(model, { mode: "simple" });
  const editorLike = variant === "editor";
  const arrowScale = editorLike ? model.settings.arrowScale : 1;
  const markerColors: Array<GraphColor> =
    editorLike && model.edges.length > 0
      ? [...new Set(model.edges.map((edge) => edge.color ?? "paper"))]
      : ["paper"];
  const geometry = preparePreviewGeometry(
    model,
    edgeRouting,
    editorLike,
    focus ? 1.1 : 1,
  );
  const nodeCount = model.nodes.length;
  const edgeCount = model.edges.length;
  const softenDenseEdges =
    sampleKind === "crown" ||
    sampleKind === "kneser" ||
    sampleKind === "paley" ||
    sampleKind === "clebsch";
  const dense = nodeCount >= 12 || edgeCount >= 30 || softenDenseEdges;
  const veryDense = nodeCount >= 16 || edgeCount >= 40;
  const galleryRadius =
    (veryDense ? 2.2 : dense ? 2.8 : Math.min(width, height) / 28) *
    (focus ? 1.1 : 1);
  const galleryNodeStroke = Math.max(1, galleryRadius * 0.55);
  const galleryEdgeStroke = Math.max(0.9, galleryRadius * 0.42);
  const nodeById = geometry.nodeById;
  const bounds = geometry.paintBounds;
  // Editor paint scales with the model; only its readable stroke floors need
  // pixel space. Gallery nodes and markers keep a fixed screen size instead.
  const fixedPaintMargin = editorLike
    ? model.settings.directed
      ? PREVIEW_ARROW_REACH * arrowScale
      : 0.5
    : Math.max(
        galleryRadius + galleryNodeStroke / 2,
        (model.settings.directed
          ? PREVIEW_ARROW_REACH * galleryEdgeStroke
          : galleryEdgeStroke / 2) +
          (model.edges.some(
            (edge) => edge.source === edge.target && nodeById.has(edge.source),
          )
            ? galleryRadius * 1.5
            : 0),
      );
  const pad = Math.max(
    Math.min(width, height) * (veryDense ? 0.07 : 0.1),
    fixedPaintMargin + 1,
  );
  const innerWidth = Math.max(1, width - pad * 2);
  const innerHeight = Math.max(1, height - pad * 2);
  const scale = Math.min(
    innerWidth / bounds.width,
    innerHeight / bounds.height,
  );
  const offsetX = pad + (innerWidth - bounds.width * scale) / 2;
  const offsetY = pad + (innerHeight - bounds.height * scale) / 2;
  const toPoint = (x: number, y: number) => ({
    x: offsetX + (x - bounds.minX) * scale,
    y: offsetY + (y - bounds.minY) * scale,
  });
  const baseRadius = editorLike ? (NODE_SIZE_PX / 2) * scale : galleryRadius;
  const radius = editorLike && focus ? baseRadius * 1.1 : baseRadius;
  const nodeStrokeWidth = editorLike
    ? Math.max(0.75, NODE_BORDER_WIDTH * scale)
    : Math.max(1, radius * 0.55);
  const edgeStrokeWidth = editorLike
    ? Math.max(1, EDGE_WIDTH * scale)
    : Math.max(0.9, radius * 0.42);
  const lastIndex = Math.max(0, model.nodes.length - 1);
  const showLabels = editorLike && model.settings.showNodeLabels;
  const context: PreviewContext = {
    model,
    markerId,
    geometry,
    toPoint,
    radius,
    scale,
    edgeStrokeWidth,
    nodeStrokeWidth,
    veryDense,
    dense,
    editorLike,
    lastIndex,
    showLabels,
  };

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className={cn("block overflow-visible", className)}
    >
      {model.settings.directed ? (
        <defs>
          {markerColors.map((color) => (
            <marker
              key={color}
              id={previewMarkerId(markerId, color)}
              markerHeight={PREVIEW_ARROW_HALF_WIDTH * 2 * arrowScale}
              markerWidth={PREVIEW_ARROW_LENGTH * arrowScale}
              markerUnits="strokeWidth"
              orient="auto"
              refX={PREVIEW_ARROW_LENGTH}
              refY={PREVIEW_ARROW_HALF_WIDTH}
              viewBox={`0 0 ${PREVIEW_ARROW_LENGTH} ${PREVIEW_ARROW_HALF_WIDTH * 2}`}
            >
              <path
                d={`M0 0L${PREVIEW_ARROW_LENGTH} ${PREVIEW_ARROW_HALF_WIDTH}L0 ${PREVIEW_ARROW_HALF_WIDTH * 2}Z`}
                fill={previewEdgeColor(color)}
              />
            </marker>
          ))}
        </defs>
      ) : null}
      {chunkPreviewItems(model.edges).map((edges) => (
        <PreviewEdges
          key={`edges-${edges[0]!.id}`}
          edges={edges}
          context={context}
        />
      ))}
      {chunkPreviewItems(model.nodes).map((nodes, index) => (
        <PreviewNodes
          key={`nodes-${nodes[0]!.id}`}
          nodes={nodes}
          startIndex={index * PREVIEW_CHUNK_SIZE}
          context={context}
        />
      ))}
    </svg>
  );
});

// Bound the work performed by each React component so concurrent preview
// updates can yield between chunks without changing the final SVG markup.
const PREVIEW_CHUNK_SIZE = 128;

function chunkPreviewItems<T>(items: readonly T[]) {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += PREVIEW_CHUNK_SIZE) {
    chunks.push(items.slice(index, index + PREVIEW_CHUNK_SIZE));
  }
  return chunks;
}

type PreviewContext = {
  model: GraphModel;
  markerId: string;
  geometry: PreparedPreviewGeometry;
  toPoint: (x: number, y: number) => { x: number; y: number };
  radius: number;
  scale: number;
  edgeStrokeWidth: number;
  nodeStrokeWidth: number;
  veryDense: boolean;
  dense: boolean;
  editorLike: boolean;
  lastIndex: number;
  showLabels: boolean;
};

function PreviewEdges({
  edges,
  context,
}: {
  edges: GraphModel["edges"];
  context: PreviewContext;
}) {
  const {
    model,
    markerId,
    geometry,
    toPoint,
    radius,
    scale,
    edgeStrokeWidth,
    editorLike,
    veryDense,
    dense,
  } = context;
  return edges.map((edge) => {
    const prepared = geometry.edgeById.get(edge.id);
    if (!prepared) return null;
    // Distinct coincident vertices have no edge direction or visible length.
    // Keep the edge in the model, without inventing a loop or protruding arrow.
    if (
      !prepared.loop &&
      prepared.source.x === prepared.target.x &&
      prepared.source.y === prepared.target.y
    )
      return null;
    const path = createPreparedPreviewEdgePath(prepared, {
      directed: model.settings.directed,
      radius,
      scale,
      toPoint,
      editorLike,
      targetWidth: editorLike
        ? geometry.nodeWidths.get(prepared.target.id)! * scale
        : radius * 2,
    });
    return (
      <path
        key={edge.id}
        d={path}
        fill="none"
        stroke={
          editorLike ? previewEdgeColor(edge.color) : "var(--canvas-edge)"
        }
        strokeLinecap="round"
        strokeWidth={edgeStrokeWidth}
        opacity={editorLike ? 1 : veryDense ? 0.56 : dense ? 0.68 : 0.78}
        markerEnd={
          model.settings.directed
            ? `url(#${previewMarkerId(markerId, editorLike ? edge.color : undefined)})`
            : undefined
        }
      />
    );
  });
}

function PreviewNodes({
  nodes,
  startIndex,
  context,
}: {
  nodes: GraphModel["nodes"];
  startIndex: number;
  context: PreviewContext;
}) {
  const {
    model,
    toPoint,
    radius,
    nodeStrokeWidth,
    editorLike,
    lastIndex,
    showLabels,
    scale,
    geometry,
  } = context;
  return nodes.map((node, offset) => {
    const index = startIndex + offset;
    const point = toPoint(node.x, node.y);
    const width = geometry.nodeWidths.get(node.id)! * scale;
    const pillRadius = Math.min(width / 2, radius);
    const paint = previewNodePaint(node.color);
    const fill = editorLike
      ? paint.fill
      : index === 0
        ? "var(--canvas-node-yellow)"
        : index === lastIndex && model.nodes.length > 2
          ? "var(--canvas-node-blue)"
          : "var(--canvas-node)";
    return (
      <g key={node.id}>
        {editorLike ? (
          <rect
            x={point.x - width / 2}
            y={point.y - radius}
            width={width}
            height={radius * 2}
            rx={pillRadius}
            ry={pillRadius}
            fill={fill}
            stroke={paint.border}
            strokeWidth={nodeStrokeWidth}
          />
        ) : (
          <circle
            cx={point.x}
            cy={point.y}
            r={radius}
            fill={fill}
            stroke="var(--canvas-node-border)"
            strokeWidth={nodeStrokeWidth}
          />
        )}
        {showLabels ? (
          <text
            x={point.x}
            y={point.y}
            fill={paint.text}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="var(--font-ui)"
            fontSize={NODE_FONT_PX * scale}
            fontWeight={600}
          >
            {node.label}
          </text>
        ) : null}
      </g>
    );
  });
}

function previewNodePaint(color: GraphColor | undefined) {
  const colored = color && color !== "paper";
  return {
    fill: colored ? `var(--canvas-node-${color})` : "var(--canvas-node)",
    border: colored
      ? color === "white" || color === "black"
        ? "var(--canvas-edge)"
        : `var(--canvas-edge-${color})`
      : "var(--canvas-node-border)",
    text:
      color === "white"
        ? "#111827"
        : color === "black"
          ? "#f8fafc"
          : "var(--canvas-node-text)",
  };
}

function previewEdgeColor(color: GraphColor | undefined) {
  return color && color !== "paper"
    ? `var(--canvas-edge-${color})`
    : "var(--canvas-edge)";
}

function previewMarkerId(id: string, color: GraphColor | undefined) {
  return color && color !== "paper" ? `${id}-${color}` : id;
}
