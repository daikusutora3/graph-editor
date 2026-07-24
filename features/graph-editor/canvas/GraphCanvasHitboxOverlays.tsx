"use client";

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useEffect, useRef, useState } from "react";

import type { EdgeId, NodeId } from "../core/graph/model";
import { useI18n } from "../i18n/I18nProvider";

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

        return (
          <button
            key={node.id}
            type="button"
            data-edge-node-hitbox="true"
            data-graph-shortcut-target="true"
            aria-label={
              isSource
                ? locale === "ja"
                  ? `${node.label} を始点に選択中`
                  : locale === "zh-Hans"
                    ? `${node.label} 已选为起点`
                    : `${node.label} selected as source`
                : locale === "ja"
                  ? `${node.label} に辺を接続`
                  : locale === "zh-Hans"
                    ? `连接到 ${node.label}`
                    : `Connect edge to ${node.label}`
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
          />
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
  onRangeSelectionPointerDown,
  onSelect,
}: SelectEdgeHitboxesProps) {
  const { messages, locale } = useI18n();

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
            className="cursor-pointer stroke-transparent"
            strokeWidth="18"
            strokeLinecap="round"
            onPointerDownCapture={(event) => {
              onRangeSelectionPointerDown(event);
            }}
            onClick={(event) => {
              event.stopPropagation();
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
          className="absolute z-[19] h-8 -translate-x-1/2 -translate-y-1/2 cursor-text rounded-[var(--app-radius-sm)] focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
          inert={rangeSelectionActive}
          style={{
            left: edge.x,
            pointerEvents: rangeSelectionActive ? "none" : undefined,
            top: edge.y,
            width: edgeLabelHitboxWidth(edge.label),
          }}
          onClick={(event) => {
            event.stopPropagation();
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

type EdgeBendHandleProps = {
  canReset: boolean;
  edge: EdgeLabelHitbox;
  zoom: number;
  onCancel: () => void;
  onCommit: (bowPx: number) => void;
  onPreview: (bowPx: number) => RenderedPoint | null;
  onReset: () => void;
};

export function EdgeBendHandle({
  canReset,
  edge,
  zoom,
  onCancel,
  onCommit,
  onPreview,
  onReset,
}: EdgeBendHandleProps) {
  const { messages } = useI18n();
  const [preview, setPreview] = useState<{
    bowPx: number;
    position: RenderedPoint;
  } | null>(null);
  const pendingBowRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  const cancelDragRef = useRef<(() => void) | null>(null);
  const draggingRef = useRef(false);
  const suppressResetClickUntilRef = useRef(0);
  const showsManualRouting = canReset || preview != null;
  const position = preview?.position ?? { x: edge.x, y: edge.y };
  const handleLabel = canReset
    ? `${messages.canvas.adjustEdgeCurve} / ${messages.canvas.resetEdgeCurve}`
    : messages.canvas.adjustEdgeCurve;

  useEffect(() => {
    return () => {
      cancelDragRef.current?.();

      if (frameRef.current != null) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (
      canReset &&
      !draggingRef.current &&
      preview != null &&
      Math.abs(edge.bowPx - preview.bowPx) < 0.01
    ) {
      setPreview(null);
    }
  }, [canReset, edge.bowPx, preview]);

  const applyPreview = (bowPx: number) => {
    setPreview({
      bowPx,
      position: onPreview(bowPx) ?? edgeBendHandlePosition(edge, bowPx, zoom),
    });
  };

  const flushPreview = () => {
    if (frameRef.current != null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    const pendingBow = pendingBowRef.current;
    pendingBowRef.current = null;

    if (pendingBow != null) {
      applyPreview(pendingBow);
    }
  };

  const updateFromPointer = (
    button: HTMLButtonElement,
    clientX: number,
    clientY: number,
  ) => {
    const bounds = button.offsetParent?.getBoundingClientRect();
    const nextBowPx = edgeBowPxFromRenderedPointer(
      edge,
      {
        x: clientX - (bounds?.left ?? 0),
        y: clientY - (bounds?.top ?? 0),
      },
      zoom,
    );
    pendingBowRef.current = nextBowPx;

    if (frameRef.current == null) {
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const pendingBow = pendingBowRef.current;
        pendingBowRef.current = null;

        if (pendingBow != null) {
          applyPreview(pendingBow);
        }
      });
    }

    return nextBowPx;
  };

  return (
    <button
      type="button"
      data-edge-bend-handle="true"
      data-edge-routing-mode={showsManualRouting ? "manual" : "automatic"}
      aria-label={handleLabel}
      title={handleLabel}
      className={[
        "absolute z-[24] size-5 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full border-2 shadow-[var(--app-shadow-card)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none active:cursor-grabbing",
        showsManualRouting
          ? "border-[var(--canvas-overlay-bg)] bg-[var(--accent)]"
          : "border-[var(--accent)] bg-white",
      ].join(" ")}
      style={{ left: position.x, top: position.y }}
      onClick={(event) => {
        event.stopPropagation();

        if (
          canReset &&
          performance.now() >= suppressResetClickUntilRef.current
        ) {
          onReset();
        }
      }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        cancelDragRef.current?.();

        const button = event.currentTarget;
        const pointerId = event.pointerId;
        const startClientX = event.clientX;
        const startClientY = event.clientY;
        let active = true;
        let moved = false;
        draggingRef.current = true;

        const cleanup = () => {
          if (!active) {
            return;
          }

          active = false;
          draggingRef.current = false;
          window.removeEventListener("pointermove", handlePointerMove, true);
          window.removeEventListener("pointerup", handlePointerUp, true);
          window.removeEventListener(
            "pointercancel",
            handlePointerCancel,
            true,
          );
          window.removeEventListener("blur", handleWindowBlur);
          cancelDragRef.current = null;
        };
        const releasePointerCapture = () => {
          if (button.hasPointerCapture(pointerId)) {
            button.releasePointerCapture(pointerId);
          }
        };
        const cancelDrag = () => {
          if (!active) {
            return;
          }

          cleanup();
          releasePointerCapture();

          if (frameRef.current != null) {
            cancelAnimationFrame(frameRef.current);
            frameRef.current = null;
          }

          pendingBowRef.current = null;
          setPreview(null);
          onCancel();
        };
        function handlePointerMove(pointerEvent: PointerEvent) {
          if (!active || pointerEvent.pointerId !== pointerId) {
            return;
          }

          pointerEvent.preventDefault();
          moved ||= pointerMoved(
            startClientX,
            startClientY,
            pointerEvent.clientX,
            pointerEvent.clientY,
          );

          if (!moved) {
            return;
          }

          updateFromPointer(button, pointerEvent.clientX, pointerEvent.clientY);
        }
        function handlePointerUp(pointerEvent: PointerEvent) {
          if (!active || pointerEvent.pointerId !== pointerId) {
            return;
          }

          pointerEvent.preventDefault();
          moved ||= pointerMoved(
            startClientX,
            startClientY,
            pointerEvent.clientX,
            pointerEvent.clientY,
          );

          if (!moved) {
            cancelDrag();
            return;
          }

          const nextBowPx = updateFromPointer(
            button,
            pointerEvent.clientX,
            pointerEvent.clientY,
          );
          flushPreview();
          cleanup();
          releasePointerCapture();
          suppressResetClickUntilRef.current = performance.now() + 300;
          onCommit(nextBowPx);
        }
        function handlePointerCancel(pointerEvent: PointerEvent) {
          if (pointerEvent.pointerId === pointerId) {
            cancelDrag();
          }
        }
        function handleWindowBlur() {
          cancelDrag();
        }

        cancelDragRef.current = cancelDrag;
        window.addEventListener("pointermove", handlePointerMove, true);
        window.addEventListener("pointerup", handlePointerUp, true);
        window.addEventListener("pointercancel", handlePointerCancel, true);
        window.addEventListener("blur", handleWindowBlur);
        button.setPointerCapture(pointerId);
      }}
    />
  );
}

function pointerMoved(
  startClientX: number,
  startClientY: number,
  clientX: number,
  clientY: number,
) {
  return Math.hypot(clientX - startClientX, clientY - startClientY) > 2;
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
              ? `頂点 ${node.label} を選択`
              : locale === "zh-Hans"
                ? `选择顶点 ${node.label}`
                : `Select node ${node.label}`
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
