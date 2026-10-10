import { memo, useId } from "react";

import type { SampleGraphKind } from "../../samples/sample-graphs";
import type { EdgeId, GraphModel } from "../../core/graph/model";
import { computeEdgeRouting } from "../../core/layout/edge-routing";
import { normalizeLoopStepSize } from "../../core/layout/edge-routing-loops";
import {
  nodeGeometryWidth,
  NODE_FONT_PX,
  NODE_SIZE_PX,
} from "../../core/graph/node-size";
import {
  edgeCurveSegments,
  edgeCurveSvgPath,
} from "../../core/layout/edge-route-geometry";
import {
  previewCurveBounds,
  type PreviewCurvePoints,
} from "./preview-curve-bounds";
import { EDGE_WIDTH, NODE_BORDER_WIDTH } from "../../core/view/graph-paint";
import { clipPreviewEdgeAtTarget } from "./preview-edge-clip";
import {
  PREVIEW_ARROW_HALF_WIDTH,
  PREVIEW_ARROW_LENGTH,
  PREVIEW_ARROW_REACH,
  previewArrowVertices,
} from "./preview-arrow";
import { cn } from "@/lib/utils";

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
  const edgeRouting = computeEdgeRouting(model, { mode: "simple" });
  const editorLike = variant === "editor";
  const modelBounds = getModelBounds(
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
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const bounds = editorLike
    ? getEditorPaintBounds(model, edgeRouting, modelBounds, focus ? 1.1 : 1)
    : modelBounds;
  // Editor paint scales with the model; only its readable stroke floors need
  // pixel space. Gallery nodes and markers keep a fixed screen size instead.
  const fixedPaintMargin = editorLike
    ? model.settings.directed
      ? PREVIEW_ARROW_REACH
      : 0.5
    : Math.max(
        galleryRadius + galleryNodeStroke / 2,
        (model.settings.directed
          ? PREVIEW_ARROW_REACH * galleryEdgeStroke
          : galleryEdgeStroke / 2) +
          (model.edges.some((edge) => {
            const source = nodeById.get(edge.source);
            const target = nodeById.get(edge.target);
            return (
              source && target && source.x === target.x && source.y === target.y
            );
          })
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
  const showLabels = editorLike && nodeCount <= 12;
  const context: PreviewContext = {
    model,
    markerId,
    nodeById,
    edgeRouting,
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
          <marker
            id={markerId}
            markerHeight={PREVIEW_ARROW_HALF_WIDTH * 2}
            markerWidth={PREVIEW_ARROW_LENGTH}
            markerUnits="strokeWidth"
            orient="auto"
            refX={PREVIEW_ARROW_LENGTH}
            refY={PREVIEW_ARROW_HALF_WIDTH}
            viewBox={`0 0 ${PREVIEW_ARROW_LENGTH} ${PREVIEW_ARROW_HALF_WIDTH * 2}`}
          >
            <path
              d={`M0 0L${PREVIEW_ARROW_LENGTH} ${PREVIEW_ARROW_HALF_WIDTH}L0 ${PREVIEW_ARROW_HALF_WIDTH * 2}Z`}
              fill="var(--canvas-edge)"
            />
          </marker>
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
  nodeById: Map<string, GraphModel["nodes"][number]>;
  edgeRouting: ReturnType<typeof computeEdgeRouting>;
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
    nodeById,
    edgeRouting,
    toPoint,
    radius,
    scale,
    edgeStrokeWidth,
    editorLike,
    veryDense,
    dense,
  } = context;
  return edges.map((edge) => {
    const source = nodeById.get(edge.source);
    const target = nodeById.get(edge.target);
    if (!source || !target) return null;
    const a = toPoint(source.x, source.y);
    const b = toPoint(target.x, target.y);
    const path = createPreviewEdgePath({
      directed: model.settings.directed,
      radius,
      routing:
        edgeRouting.get(edge.id) ??
        edgeRouting.get(edge.id as EdgeId) ??
        undefined,
      scale,
      source: a,
      target: b,
      targetWidth: editorLike ? nodeGeometryWidth(target) * scale : radius * 2,
    });
    return (
      <path
        key={edge.id}
        d={path}
        fill="none"
        stroke="var(--canvas-edge)"
        strokeLinecap="round"
        strokeWidth={edgeStrokeWidth}
        opacity={veryDense ? 0.56 : dense ? 0.68 : 0.78}
        markerEnd={model.settings.directed ? `url(#${markerId})` : undefined}
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
  } = context;
  return nodes.map((node, offset) => {
    const index = startIndex + offset;
    const point = toPoint(node.x, node.y);
    const pillRadius = Math.min((nodeGeometryWidth(node) * scale) / 2, radius);
    const fill = editorLike
      ? "var(--canvas-node)"
      : index === 0
        ? "var(--canvas-node-yellow)"
        : index === lastIndex && model.nodes.length > 2
          ? "var(--canvas-node-blue)"
          : "var(--canvas-node)";
    return (
      <g key={node.id}>
        {editorLike ? (
          <rect
            x={point.x - (nodeGeometryWidth(node) * scale) / 2}
            y={point.y - radius}
            width={nodeGeometryWidth(node) * scale}
            height={radius * 2}
            rx={pillRadius}
            ry={pillRadius}
            fill={fill}
            stroke="var(--canvas-node-border)"
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
            fill="var(--canvas-node-text)"
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

export function createPreviewEdgePath({
  directed,
  radius,
  routing,
  scale,
  source,
  target,
  targetWidth = radius * 2,
}: {
  directed: boolean;
  radius: number;
  routing?: {
    bowPx: number;
    controlPointDistancesPx?: readonly number[];
    controlPointWeights?: readonly number[];
    loopDirectionDeg: number;
    loopSweepDeg: number;
    loopStepSizePx?: number;
  };
  scale: number;
  source: { x: number; y: number };
  target: { x: number; y: number };
  targetWidth?: number;
}) {
  if (source.x === target.x && source.y === target.y) {
    return createLoopPath(source, radius, scale, routing);
  }

  const curve = {
    controlPointDistancesPx: (
      routing?.controlPointDistancesPx ?? [routing?.bowPx ?? 0]
    ).map((distance) => distance * scale),
    controlPointWeights: routing?.controlPointWeights ?? [0.5],
  };
  if (!directed) return edgeCurveSvgPath(source, target, curve);
  const segments = clippedPreviewSegments(
    source,
    target,
    curve,
    targetWidth,
    radius,
  );
  return [
    `M${round(source.x)} ${round(source.y)}`,
    ...segments.map(
      ({ control, end }) =>
        `Q${round(control.x)} ${round(control.y)} ${round(end.x)} ${round(end.y)}`,
    ),
  ].join("");
}

function clippedPreviewSegments(
  source: { x: number; y: number },
  target: { x: number; y: number },
  curve: {
    controlPointDistancesPx: readonly number[];
    controlPointWeights: readonly number[];
  },
  targetWidth: number,
  radius: number,
) {
  const original = edgeCurveSegments(source, target, curve);
  return clipPreviewEdgeAtTarget(
    original.length > 0
      ? original
      : [
          {
            start: source,
            control: {
              x: (source.x + target.x) / 2,
              y: (source.y + target.y) / 2,
            },
            end: target,
          },
        ],
    { centre: target, width: targetWidth, height: radius * 2 },
  );
}

function createLoopPath(
  source: { x: number; y: number },
  radius: number,
  scale: number,
  routing:
    | {
        loopDirectionDeg: number;
        loopSweepDeg: number;
        loopStepSizePx?: number;
      }
    | undefined,
) {
  const { start, end, controlA, controlB } = createLoopGeometry(
    source,
    radius,
    scale,
    routing,
  );
  return [
    `M${round(start.x)} ${round(start.y)}`,
    `C${round(controlA.x)} ${round(controlA.y)}`,
    `${round(controlB.x)} ${round(controlB.y)}`,
    `${round(end.x)} ${round(end.y)}`,
  ].join(" ");
}

function createLoopGeometry(
  source: { x: number; y: number },
  radius: number,
  scale: number,
  routing:
    | {
        loopDirectionDeg: number;
        loopSweepDeg: number;
        loopStepSizePx?: number;
      }
    | undefined,
) {
  const direction = (((routing?.loopDirectionDeg ?? -45) - 90) * Math.PI) / 180;
  const sweep = ((routing?.loopSweepDeg ?? 70) * Math.PI) / 180;
  const stepSize = normalizeLoopStepSize(routing?.loopStepSizePx);
  // Keep gallery icons readable while larger loops fit their reserved bounds.
  const loopRadius = Math.max(
    radius * 1.5,
    Math.min(radius * 3 * (stepSize / 40), 1.4 * stepSize * scale),
  );
  const startAngle = direction - sweep / 2;
  const endAngle = direction + sweep / 2;
  const start = {
    x: source.x + Math.cos(startAngle) * radius,
    y: source.y + Math.sin(startAngle) * radius,
  };
  const end = {
    x: source.x + Math.cos(endAngle) * radius,
    y: source.y + Math.sin(endAngle) * radius,
  };
  const controlA = {
    x: source.x + Math.cos(startAngle) * loopRadius,
    y: source.y + Math.sin(startAngle) * loopRadius,
  };
  const controlB = {
    x: source.x + Math.cos(endAngle) * loopRadius,
    y: source.y + Math.sin(endAngle) * loopRadius,
  };

  return { start, end, controlA, controlB };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function getEditorPaintBounds(
  model: GraphModel,
  routes: ReturnType<typeof computeEdgeRouting>,
  bounds: ReturnType<typeof getModelBounds>,
  radiusScale: number,
) {
  let minX = bounds.minX;
  let maxX = bounds.minX + bounds.width;
  let minY = bounds.minY;
  let maxY = bounds.minY + bounds.height;
  if (model.settings.directed) {
    const nodes = new Map(model.nodes.map((node) => [node.id, node]));
    const radius = (NODE_SIZE_PX / 2) * radiusScale;
    for (const edge of model.edges) {
      const source = nodes.get(edge.source);
      const target = nodes.get(edge.target);
      if (!source || !target) continue;
      const routing = routes.get(edge.id);
      let tip, control;
      if (source.x === target.x && source.y === target.y) {
        const loop = createLoopGeometry(source, radius, 1, routing);
        tip = loop.end;
        control = loop.controlB;
      } else {
        const segment = clippedPreviewSegments(
          source,
          target,
          {
            controlPointDistancesPx: routing?.controlPointDistancesPx ?? [
              routing?.bowPx ?? 0,
            ],
            controlPointWeights: routing?.controlPointWeights ?? [0.5],
          },
          nodeGeometryWidth(target),
          radius,
        ).at(-1)!;
        tip = segment.end;
        control = segment.control;
      }
      for (const point of previewArrowVertices(tip, control, EDGE_WIDTH)) {
        minX = Math.min(minX, point.x);
        maxX = Math.max(maxX, point.x);
        minY = Math.min(minY, point.y);
        maxY = Math.max(maxY, point.y);
      }
    }
  }
  const strokeMargin = Math.max(NODE_BORDER_WIDTH, EDGE_WIDTH) / 2;
  return {
    minX: minX - strokeMargin,
    minY: minY - strokeMargin,
    width: maxX - minX + strokeMargin * 2,
    height: maxY - minY + strokeMargin * 2,
  };
}

export function getModelBounds(
  model: GraphModel,
  routes: ReturnType<typeof computeEdgeRouting>,
  editorLike: boolean,
  radiusScale = 1,
) {
  if (model.nodes.length === 0) {
    return { minX: -1, minY: -1, width: 2, height: 2 };
  }

  // The paste preview includes labels, so fit the whole pill and scale its
  // text with it. Fitting only node centres clips long labels at the frame.
  const xs = model.nodes.flatMap((node) =>
    editorLike
      ? [
          node.x - nodeGeometryWidth(node) / 2,
          node.x + nodeGeometryWidth(node) / 2,
        ]
      : [node.x],
  );
  const ys = model.nodes.flatMap((node) =>
    editorLike
      ? [
          node.y - (NODE_SIZE_PX / 2) * radiusScale,
          node.y + (NODE_SIZE_PX / 2) * radiusScale,
        ]
      : [node.y],
  );
  const radius = (NODE_SIZE_PX / 2) * (editorLike ? radiusScale : 1);
  const nodes = new Map(model.nodes.map((node) => [node.id, node]));
  for (const edge of model.edges) {
    const node = nodes.get(edge.source);
    const target = nodes.get(edge.target);
    const route = routes.get(edge.id);
    if (!node || !target) continue;
    if (node.x === target.x && node.y === target.y) {
      const loop = createLoopGeometry(node, radius, 1, route);
      includeCurve([loop.start, loop.controlA, loop.controlB, loop.end]);
      if (!editorLike) {
        // Gallery nodes stay a fixed screen size. Keep the existing roomy loop
        // reservation; their radius is independent of the graph fit scale.
        xs.push(
          node.x - nodeGeometryWidth(node) / 2,
          node.x + nodeGeometryWidth(node) / 2,
          loop.controlA.x,
          loop.controlB.x,
        );
        ys.push(
          node.y - NODE_SIZE_PX / 2,
          node.y + NODE_SIZE_PX / 2,
          loop.controlA.y,
          loop.controlB.y,
        );
      }
      continue;
    }
    const distances = route?.controlPointDistancesPx ?? [route?.bowPx ?? 0];
    const segments = edgeCurveSegments(node, target, {
      controlPointDistancesPx: distances,
      controlPointWeights: route?.controlPointWeights ?? [0.5],
    });
    for (const { start, control, end: segmentEnd } of segments) {
      includeCurve([start, control, segmentEnd]);
    }
  }
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    minX,
    minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };

  function includeCurve(points: PreviewCurvePoints) {
    const curveBounds = previewCurveBounds(points);
    xs.push(curveBounds.minX, curveBounds.maxX);
    ys.push(curveBounds.minY, curveBounds.maxY);
  }
}
