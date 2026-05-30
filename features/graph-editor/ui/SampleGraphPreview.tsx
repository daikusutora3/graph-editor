import { useId } from "react";

import type { SampleGraphKind } from "../samples/sample-graphs";
import type { GraphModel } from "../core/graph/model";
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

export function SampleGraphPreview({
  model,
  sampleKind,
  width = 132,
  height = 88,
  focus = false,
  variant = "sample",
  className,
}: SampleGraphPreviewProps) {
  const markerId = `sample-arrow-${useId().replaceAll(":", "")}`;
  const bounds = getModelBounds(model);
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
  const editorLike = variant === "editor";
  const baseRadius = editorLike
    ? Math.min(width, height) / (dense ? 21 : 16)
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
      {model.edges.map((edge) => {
        const source = nodeById.get(edge.source);
        const target = nodeById.get(edge.target);

        if (!source || !target) {
          return null;
        }

        const a = toPoint(source.x, source.y);
        const b = toPoint(target.x, target.y);
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const length = Math.hypot(dx, dy);
        const shrink = model.settings.directed && length > 0 ? radius * 1.9 : 0;
        const end = {
          x: b.x - (dx / Math.max(length, 1)) * shrink,
          y: b.y - (dy / Math.max(length, 1)) * shrink,
        };

        return (
          <line
            key={edge.id}
            x1={a.x}
            y1={a.y}
            x2={end.x}
            y2={end.y}
            stroke="var(--canvas-edge)"
            strokeLinecap="round"
            strokeWidth={edgeStrokeWidth}
            opacity={veryDense ? 0.56 : dense ? 0.68 : 0.78}
            markerEnd={
              model.settings.directed ? `url(#${markerId})` : undefined
            }
          />
        );
      })}
      {model.nodes.map((node, index) => {
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
            <circle
              cx={point.x}
              cy={point.y}
              r={radius}
              fill={fill}
              stroke="var(--canvas-node-border)"
              strokeWidth={nodeStrokeWidth}
            />
            {showLabels ? (
              <text
                x={point.x}
                y={point.y}
                fill="var(--canvas-node-text)"
                textAnchor="middle"
                dominantBaseline="central"
                fontFamily="var(--app-font-ui)"
                fontSize={Math.max(8, radius * 0.92)}
                fontWeight={800}
              >
                {node.label}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

function getModelBounds(model: GraphModel) {
  if (model.nodes.length === 0) {
    return { minX: -1, minY: -1, width: 2, height: 2 };
  }

  const xs = model.nodes.map((node) => node.x);
  const ys = model.nodes.map((node) => node.y);
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
}
