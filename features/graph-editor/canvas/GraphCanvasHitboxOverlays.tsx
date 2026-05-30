"use client";

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from "react";

import type { EdgeId, NodeId } from "../core/graph/model";
import { useI18n } from "../i18n/I18nProvider";

import {
  edgeLabelHitboxWidth,
  type EdgeLabelHitbox,
  type NodeHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";
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
            className="group absolute z-20 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none"
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
          <line
            key={`${edge.id}:line-hitbox`}
            x1={edge.sourceX}
            y1={edge.sourceY}
            x2={edge.targetX}
            y2={edge.targetY}
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
          className="absolute z-20 size-12 -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none rounded-full focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:outline-none active:cursor-grabbing"
          inert={rangeSelectionActive}
          style={{
            left: node.x,
            pointerEvents: rangeSelectionActive ? "none" : undefined,
            top: node.y,
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
