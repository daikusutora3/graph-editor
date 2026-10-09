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
  const bounds = getModelBounds(
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
  const pad = Math.min(width, height) * (veryDense ? 0.07 : 0.1);
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
  const nodeById = new Map(model.nodes.map((node) => [node.id, node]));
  const baseRadius = editorLike
    ? (NODE_SIZE_PX / 2) * scale
    : veryDense
      ? 2.2
      : dense
        ? 2.8
        : Math.min(width, height) / 28;
  const radius = focus ? baseRadius * 1.1 : baseRadius;
  const nodeStrokeWidth = editorLike
    ? Math.max(1.5, radius * 0.2)
    : Math.max(1, radius * 0.55);
  const edgeStrokeWidth = editorLike
    ? Math.max(2, radius * 0.26)
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
            markerHeight="4.5"
            markerWidth="5.25"
            orient="auto"
            refX="5"
            refY="2.25"
            viewBox="0 0 5.25 4.5"
          >
            <path d="M0 0L5.25 2.25L0 4.5Z" fill="var(--canvas-edge)" />
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
            rx={radius}
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
}) {
  if (source.x === target.x && source.y === target.y) {
    return createLoopPath(source, radius, scale, routing);
  }

  const end = previewEdgeEndpoint(source, target, directed, radius);
  return edgeCurveSvgPath(source, end, {
    controlPointDistancesPx: (
      routing?.controlPointDistancesPx ?? [routing?.bowPx ?? 0]
    ).map((distance) => distance * scale),
    controlPointWeights: routing?.controlPointWeights ?? [0.5],
  });
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

function previewEdgeEndpoint(
  source: { x: number; y: number },
  target: { x: number; y: number },
  directed: boolean,
  radius: number,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const length = Math.hypot(dx, dy);
  const shrink = directed && length > 0 ? radius * 1.9 : 0;
  // A 1px denominator floor changes the arrow direction when the same short
  // chord is evaluated before and after fitting. Normalize every nonzero chord.
  const denominator = length || 1;
  return {
    x: target.x - (dx / denominator) * shrink,
    y: target.y - (dy / denominator) * shrink,
  };
}

function round(value: number) {
  return Math.round(value * 100) / 100;
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
    const end = previewEdgeEndpoint(
      node,
      target,
      model.settings.directed,
      editorLike ? radius : 0,
    );
    const distances = route?.controlPointDistancesPx ?? [route?.bowPx ?? 0];
    // Gallery arrowheads use a fixed screen radius. Shortening a very short
    // chord can reverse its normal as the graph scales, so reserve both sides.
    const curveDistances =
      !editorLike && model.settings.directed
        ? [distances, distances.map((distance) => -distance)]
        : [distances];
    for (const controlPointDistancesPx of curveDistances) {
      const segments = edgeCurveSegments(node, end, {
        controlPointDistancesPx,
        controlPointWeights: route?.controlPointWeights ?? [0.5],
      });
      for (const { start, control, end: segmentEnd } of segments) {
        includeCurve([start, control, segmentEnd]);
      }
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
