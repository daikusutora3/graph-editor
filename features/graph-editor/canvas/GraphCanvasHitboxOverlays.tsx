"use client";

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import { useRef } from "react";

import type { EdgeId, NodeId } from "../core/graph/model";
import { useI18n } from "../i18n/I18nProvider";
import type { Locale } from "../i18n/locale";

import {
  edgeLabelHitboxWidth,
  NODE_HITBOX_SIZE,
  type EdgeLabelHitbox,
  type NodeHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";
import {
  edgeCurveMidpoint,
  edgeCurveSvgPath,
} from "../core/layout/edge-route-geometry";
import type { RenderedPoint } from "./graph-canvas-types";

type CanvasPointer = {
  clientX: number;
  clientY: number;
};

type EdgeNodeHitboxesProps = {
  nodes: NodeHitbox[];
  sourceNodeId: NodeId | null;
  onConnect: (nodeId: NodeId, continueFromTarget: boolean) => void;
  onContextMenu: (node: NodeHitbox, event: CanvasPointer) => void;
  onPointerEnter: (node: NodeHitbox) => void;
  onPointerLeave: (nodeId: NodeId) => void;
};

export function EdgeNodeHitboxes({
  nodes,
  sourceNodeId,
  onConnect,
  onContextMenu,
  onPointerEnter,
  onPointerLeave,
}: EdgeNodeHitboxesProps) {
  const { locale } = useI18n();

  return (
    <>
      {nodes.map((node) => {
        const isSource = sourceNodeId === node.id;
        const nodeName = accessibleNodeName(node.label, locale);

        return (
          <button
            key={node.id}
            type="button"
            data-edge-node-hitbox="true"
            data-graph-shortcut-target="true"
            aria-label={
              isSource
                ? locale === "ja"
                  ? `${nodeName}を始点に選択中`
                  : locale === "zh-Hans"
                    ? `${nodeName}已选为起点`
                    : `${nodeName} selected as source`
                : locale === "ja"
                  ? `${nodeName}に辺を接続`
                  : locale === "zh-Hans"
                    ? `连接到${nodeName}`
                    : `Connect edge to ${nodeName}`
            }
            className="group absolute z-20 size-14 -translate-x-1/2 -translate-y-1/2 cursor-crosshair rounded-full focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
            style={{ left: node.x, top: node.y }}
            onPointerEnter={() => onPointerEnter(node)}
            onPointerLeave={() => onPointerLeave(node.id)}
            onClick={(event) => {
              event.stopPropagation();
              onConnect(node.id, event.shiftKey);
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(node, event);
            }}
          >
            {isSource ? (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-1px] rounded-full border-[1.5px] border-dashed border-[var(--accent)]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-[-1px] rounded-full border-[1.5px] border-[var(--accent)] opacity-0 transition-opacity duration-150 group-hover:opacity-60"
              />
            )}
          </button>
        );
      })}
    </>
  );
}

type SelectEdgeHitboxesProps = {
  edges: EdgeLabelHitbox[];
  rangeSelectionActive: boolean;
  weighted: boolean;
  onContextMenu: (edge: EdgeLabelHitbox, event: CanvasPointer) => void;
  /** Drag-to-bend: preview while dragging, commit on release, cancel on
   * escape/pointer cancel. `zoom` converts rendered px to graph px. */
  zoom: number;
  onBendPreview: (edgeId: EdgeId, bowPx: number) => RenderedPoint | null;
  onBendCommit: (edgeId: EdgeId, bowPx: number) => void;
  onBendCancel: (edgeId: EdgeId) => void;
  onEdit: (edgeId: EdgeId, position: RenderedPoint) => void;
  onRangeSelectionPointerDown: (event: ReactPointerEvent<Element>) => boolean;
  onSelect: (edgeId: EdgeId, additive: boolean) => void;
};

export function SelectEdgeHitboxes({
  edges,
  rangeSelectionActive,
  weighted,
  onContextMenu,
  onEdit,
  onBendCancel,
  onBendCommit,
  onBendPreview,
  onRangeSelectionPointerDown,
  onSelect,
  zoom,
}: SelectEdgeHitboxesProps) {
  const { messages, locale } = useI18n();
  const bendRef = useRef<{
    edge: EdgeLabelHitbox;
    pointerId: number;
    startX: number;
    startY: number;
    moved: boolean;
    bowPx: number | null;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const containerBounds = (element: Element) =>
    (
      element.closest("svg") ?? element
    ).parentElement?.getBoundingClientRect() ?? null;

  const bendFromPointer = (
    edge: EdgeLabelHitbox,
    element: Element,
    clientX: number,
    clientY: number,
  ) => {
    const bounds = containerBounds(element);

    return edgeBowPxFromRenderedPointer(
      edge,
      { x: clientX - (bounds?.left ?? 0), y: clientY - (bounds?.top ?? 0) },
      zoom,
    );
  };

  const bendHandlers = (edge: EdgeLabelHitbox) => ({
    onPointerDown: (event: ReactPointerEvent<Element>) => {
      if (
        event.button !== 0 ||
        event.shiftKey ||
        event.metaKey ||
        event.ctrlKey ||
        rangeSelectionActive
      ) {
        return;
      }

      bendRef.current = {
        edge,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        bowPx: null,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Synthetic or already-released pointers cannot be captured; the
        // drag still works while the pointer stays over the element.
      }
    },
    onPointerMove: (event: ReactPointerEvent<Element>) => {
      const bend = bendRef.current;

      if (!bend || bend.pointerId !== event.pointerId) {
        return;
      }

      if (
        !bend.moved &&
        Math.hypot(event.clientX - bend.startX, event.clientY - bend.startY) < 4
      ) {
        return;
      }

      if (!bend.moved) {
        bend.moved = true;
        onSelect(edge.id, false);
      }

      bend.bowPx = bendFromPointer(
        edge,
        event.currentTarget,
        event.clientX,
        event.clientY,
      );
      onBendPreview(edge.id, bend.bowPx);
    },
    onPointerUp: (event: ReactPointerEvent<Element>) => {
      const bend = bendRef.current;

      if (!bend || bend.pointerId !== event.pointerId) {
        return;
      }

      bendRef.current = null;
      try {
        event.currentTarget.releasePointerCapture(event.pointerId);
      } catch {
        // Capture may already be gone.
      }

      if (bend.moved && bend.bowPx !== null) {
        suppressClickRef.current = true;
        onBendCommit(edge.id, bend.bowPx);
      }
    },
    onPointerCancel: (event: ReactPointerEvent<Element>) => {
      const bend = bendRef.current;

      if (!bend || bend.pointerId !== event.pointerId) {
        return;
      }

      bendRef.current = null;

      if (bend.moved) {
        suppressClickRef.current = true;
        onBendCancel(edge.id);
      }
    },
  });

  return (
    <>
      <svg
        className="pointer-events-none absolute inset-0 z-[18] h-full w-full"
        aria-hidden="true"
      >
        {edges.map((edge) => (
          <path
            key={`${edge.id}:path-hitbox`}
            d={createEdgeHitboxPath(edge)}
            fill="none"
            pointerEvents={rangeSelectionActive ? "none" : "stroke"}
            className="cursor-pointer touch-none stroke-transparent"
            strokeWidth="18"
            strokeLinecap="round"
            onPointerDownCapture={(event) => {
              onRangeSelectionPointerDown(event);
            }}
            {...bendHandlers(edge)}
            onClick={(event) => {
              event.stopPropagation();
              if (suppressClickRef.current) {
                suppressClickRef.current = false;
                return;
              }
              if (event.detail >= 2) {
                onEdit(edge.id, { x: edge.x, y: edge.y });
                return;
              }

              onSelect(edge.id, event.shiftKey);
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onEdit(edge.id, { x: edge.x, y: edge.y });
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onContextMenu(edge, event);
            }}
          />
        ))}
      </svg>
      {edges.map((edge) => (
        <button
          key={edge.id}
          type="button"
          data-graph-shortcut-target="true"
          aria-label={
            weighted
              ? locale === "ja"
                ? `辺の重み ${edge.label} を編集`
                : locale === "zh-Hans"
                  ? `编辑边权重 ${edge.label}`
                  : `Edit edge weight ${edge.label}`
              : edge.label
                ? locale === "ja"
                  ? `辺ラベル ${edge.label} を編集`
                  : locale === "zh-Hans"
                    ? `编辑边标签 ${edge.label}`
                    : `Edit edge label ${edge.label}`
                : messages.canvas.editEdgeLabel
          }
          className="touch:h-11 absolute z-[19] h-8 -translate-x-1/2 -translate-y-1/2 cursor-pointer touch-none rounded-md focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          inert={rangeSelectionActive}
          style={{
            left: edge.x,
            pointerEvents: rangeSelectionActive ? "none" : undefined,
            top: edge.y,
            width: edgeLabelHitboxWidth(edge.label),
          }}
          {...bendHandlers(edge)}
          onClick={(event) => {
            event.stopPropagation();
            if (suppressClickRef.current) {
              suppressClickRef.current = false;
              return;
            }
            if (event.detail >= 2) {
              onEdit(edge.id, { x: edge.x, y: edge.y });
              return;
            }

            onSelect(edge.id, event.shiftKey);
          }}
          onPointerDownCapture={(event) => {
            onRangeSelectionPointerDown(event);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEdit(edge.id, { x: edge.x, y: edge.y });
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onContextMenu(edge, event);
          }}
        />
      ))}
    </>
  );
}

export function edgeBowPxFromRenderedPointer(
  edge: Pick<EdgeLabelHitbox, "sourceX" | "sourceY" | "targetX" | "targetY">,
  pointer: RenderedPoint,
  zoom: number,
) {
  const sourceX = edge.sourceX;
  const sourceY = edge.sourceY;
  const targetX = edge.targetX;
  const targetY = edge.targetY;
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const length = Math.hypot(dx, dy);

  if (length === 0 || zoom <= 0) {
    return 0;
  }

  const midpointX = (sourceX + targetX) / 2;
  const midpointY = (sourceY + targetY) / 2;
  const renderedBowPx =
    (pointer.x - midpointX) * (-dy / length) +
    (pointer.y - midpointY) * (dx / length);

  return Math.round(Math.max(-180, Math.min(180, (renderedBowPx * 2) / zoom)));
}

export function edgeBendHandlePosition(
  edge: EdgeLabelHitbox,
  previewBowPx: number | null,
  zoom: number,
) {
  if (previewBowPx == null) {
    return { x: edge.x, y: edge.y };
  }

  return edgeCurveMidpoint(
    { x: edge.sourceX, y: edge.sourceY },
    { x: edge.targetX, y: edge.targetY },
    {
      controlPointDistancesPx: [previewBowPx * zoom],
      controlPointWeights: [0.5],
    },
  );
}

export function createEdgeHitboxPath(edge: EdgeLabelHitbox) {
  if (edge.sourceX === edge.targetX && edge.sourceY === edge.targetY) {
    return createLoopHitboxPath(edge);
  }

  return edgeCurveSvgPath(
    { x: edge.sourceX, y: edge.sourceY },
    { x: edge.targetX, y: edge.targetY },
    {
      controlPointDistancesPx: edge.controlPointDistancesPx ?? [edge.bowPx],
      controlPointWeights: edge.controlPointWeights ?? [0.5],
    },
  );
}

function createLoopHitboxPath(edge: EdgeLabelHitbox) {
  const direction = (edge.loopDirectionDeg * Math.PI) / 180;
  const sweep = (edge.loopSweepDeg * Math.PI) / 180;
  const nodeRadius = 24;
  const loopRadius = 72;
  const startAngle = direction - sweep / 2;
  const endAngle = direction + sweep / 2;
  const start = {
    x: edge.sourceX + Math.cos(startAngle) * nodeRadius,
    y: edge.sourceY + Math.sin(startAngle) * nodeRadius,
  };
  const end = {
    x: edge.sourceX + Math.cos(endAngle) * nodeRadius,
    y: edge.sourceY + Math.sin(endAngle) * nodeRadius,
  };
  const controlA = {
    x: edge.sourceX + Math.cos(startAngle) * loopRadius,
    y: edge.sourceY + Math.sin(startAngle) * loopRadius,
  };
  const controlB = {
    x: edge.sourceX + Math.cos(endAngle) * loopRadius,
    y: edge.sourceY + Math.sin(endAngle) * loopRadius,
  };

  return [
    `M${round(start.x)} ${round(start.y)}`,
    `C${round(controlA.x)} ${round(controlA.y)}`,
    `${round(controlB.x)} ${round(controlB.y)}`,
    `${round(end.x)} ${round(end.y)}`,
  ].join(" ");
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

type SelectNodeHitboxesProps = {
  nodes: NodeHitbox[];
  rangeSelectionActive: boolean;
  onClick: (
    node: NodeHitbox,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onContextMenu: (node: NodeHitbox, event: CanvasPointer) => void;
  onDoubleClick: (
    node: NodeHitbox,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
  onPointerCancel: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onPointerDown: (
    nodeId: NodeId,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLButtonElement>) => void;
  onRangeSelectionPointerDown: (event: ReactPointerEvent<Element>) => boolean;
  onPointerUp: (event: ReactPointerEvent<HTMLButtonElement>) => void;
};

export function SelectNodeHitboxes({
  nodes,
  rangeSelectionActive,
  onClick,
  onContextMenu,
  onDoubleClick,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onRangeSelectionPointerDown,
  onPointerUp,
}: SelectNodeHitboxesProps) {
  const { locale } = useI18n();

  return (
    <>
      {nodes.map((node) => (
        <button
          key={node.id}
          type="button"
          data-graph-shortcut-target="true"
          aria-label={
            locale === "ja"
              ? `${accessibleNodeName(node.label, locale)}を選択`
              : locale === "zh-Hans"
                ? `选择${accessibleNodeName(node.label, locale)}`
                : `Select ${accessibleNodeName(node.label, locale)}`
          }
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none active:cursor-grabbing"
          inert={rangeSelectionActive}
          style={{
            height: NODE_HITBOX_SIZE,
            left: node.x,
            pointerEvents: rangeSelectionActive ? "none" : undefined,
            top: node.y,
            width: NODE_HITBOX_SIZE,
          }}
          onPointerDown={(event) => {
            if (onRangeSelectionPointerDown(event)) {
              return;
            }

            event.stopPropagation();
            onPointerDown(node.id, event);
          }}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onClick={(event) => {
            event.stopPropagation();
            onClick(node, event);
          }}
          onDoubleClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onDoubleClick(node, event);
          }}
          onContextMenu={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onContextMenu(node, event);
          }}
        />
      ))}
    </>
  );
}

function accessibleNodeName(label: string, locale: Locale) {
  if (label) {
    return locale === "ja"
      ? `頂点 ${label} `
      : locale === "zh-Hans"
        ? `顶点 ${label}`
        : `node ${label}`;
  }

  return locale === "ja"
    ? "ラベルなしの頂点"
    : locale === "zh-Hans"
      ? "无标签顶点"
      : "unlabeled node";
}
