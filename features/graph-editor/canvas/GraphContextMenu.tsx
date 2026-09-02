"use client";

import type React from "react";
import { useLayoutEffect, useMemo, useRef, useState } from "react";

import { useI18n } from "../i18n/I18nProvider";
import type { EdgeId, GraphModel, NodeId } from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";
import { cn } from "@/lib/utils";

import type {
  GraphContextMenuTarget,
  RenderedPoint,
} from "./graph-canvas-types";
import { resolveSelectionActions } from "./selection-actions";

export type { GraphContextMenuTarget } from "./graph-canvas-types";

export type GraphContextMenuProps = {
  target: GraphContextMenuTarget;
  graph: GraphModel;
  panelState?: "open" | "closing";
  selection: SelectionState;
  onClose: () => void;
  onEditNodeLabel: (nodeId: NodeId, position: RenderedPoint) => void;
  onEditEdgeValue: (edgeId: EdgeId, position: RenderedPoint) => void;
  onDeleteSelection: (selection: SelectionState) => void;
  onReverseEdges: (edgeIds: EdgeId[]) => void;
  onResetEdgeCurve: (edgeId: EdgeId) => void;
};

export function GraphContextMenu({
  target,
  graph,
  panelState = "open",
  selection,
  onClose,
  onEditNodeLabel,
  onEditEdgeValue,
  onDeleteSelection,
  onReverseEdges,
  onResetEdgeCurve,
}: GraphContextMenuProps) {
  const { messages } = useI18n();
  const node =
    target.kind === "node"
      ? graph.nodes.find((item) => item.id === target.nodeId)
      : null;
  const edge =
    target.kind === "edge"
      ? graph.edges.find((item) => item.id === target.edgeId)
      : null;
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [menuPosition, setMenuPosition] = useState(() =>
    getContextMenuPosition(target, DEFAULT_MENU_SIZE, DEFAULT_CANVAS_SIZE),
  );

  useLayoutEffect(() => {
    const menu = menuRef.current;
    const canvas = menu?.parentElement;

    if (!menu || !canvas) {
      return;
    }

    const nextPosition = getContextMenuPosition(
      target,
      {
        width: menu.offsetWidth || DEFAULT_MENU_SIZE.width,
        height: menu.offsetHeight || DEFAULT_MENU_SIZE.height,
      },
      {
        width: canvas.clientWidth || DEFAULT_CANVAS_SIZE.width,
        height: canvas.clientHeight || DEFAULT_CANVAS_SIZE.height,
        leftInset: MENU_PADDING,
      },
    );

    setMenuPosition((current) =>
      current.left === nextPosition.left && current.top === nextPosition.top
        ? current
        : nextPosition,
    );
  }, [target]);

  const deleteSelection = useMemo(
    () => selectionForTarget(target, selection),
    [target, selection],
  );
  const actions = resolveSelectionActions(graph, deleteSelection, messages);
  const runAction = (id: (typeof actions)[number]["id"]) => {
    switch (id) {
      case "edit":
        if (target.kind === "node" && node) {
          onEditNodeLabel(node.id, { x: target.x, y: target.y });
        } else if (target.kind === "edge" && edge) {
          onEditEdgeValue(edge.id, { x: target.x, y: target.y });
        }
        return;
      case "reverse":
        onReverseEdges(deleteSelection.edgeIds);
        onClose();
        return;
      case "reset-curve":
        if (deleteSelection.edgeIds[0]) {
          onResetEdgeCurve(deleteSelection.edgeIds[0]);
        }
        onClose();
        return;
      case "delete":
        onDeleteSelection(deleteSelection);
        onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      data-panel-state={panelState}
      className="ge-panel ge-context-menu pointer-events-auto absolute z-40 flex max-h-[calc(100%-1rem)] w-[min(14rem,calc(100%-1rem))] flex-col gap-0.5 overflow-y-auto rounded-xl p-1.5 text-[13px] text-[var(--text)] backdrop-blur-[12px]"
      style={{
        left: menuPosition.left,
        top: menuPosition.top,
      }}
      role="menu"
      aria-label={
        target.kind === "node"
          ? messages.contextMenu.nodeMenu
          : messages.contextMenu.edgeMenu
      }
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          onClose();
        }
      }}
    >
      {(target.kind === "node" && node) || (target.kind === "edge" && edge)
        ? actions.map(({ id, icon: Icon, label, kbd, danger }, index) => (
            <MenuButton
              key={id}
              danger={danger}
              divider={danger && index > 0}
              icon={<Icon className="size-[15px]" aria-hidden="true" />}
              kbd={kbd}
              label={label}
              onClick={() => runAction(id)}
            />
          ))
        : null}
    </div>
  );
}

const DEFAULT_MENU_SIZE = { width: 240, height: 112 };
const DEFAULT_CANVAS_SIZE = { width: 1058, height: 994, leftInset: 8 };
const HITBOX_MENU_GAP = 8;
const MENU_PADDING = 8;
const POINTER_MENU_OFFSET = 10;

function getContextMenuPosition(
  target: GraphContextMenuTarget,
  menu: { width: number; height: number },
  canvas: { width: number; height: number; leftInset: number },
) {
  if (target.anchorRect) {
    return getAnchorRectContextMenuPosition(target.anchorRect, menu, canvas);
  }

  return getPointerContextMenuPosition(target, menu, canvas);
}

function getAnchorRectContextMenuPosition(
  anchor: { height: number; left: number; top: number; width: number },
  menu: { width: number; height: number },
  canvas: { width: number; height: number; leftInset: number },
) {
  const right = anchor.left + anchor.width;
  const preferredRight = right + HITBOX_MENU_GAP;
  const preferredLeft = anchor.left - HITBOX_MENU_GAP - menu.width;
  const fitsRight = preferredRight + menu.width <= canvas.width - MENU_PADDING;
  const fitsLeft = preferredLeft >= canvas.leftInset;

  return {
    left: clamp(
      fitsRight || !fitsLeft ? preferredRight : preferredLeft,
      canvas.leftInset,
      canvas.width - menu.width - MENU_PADDING,
    ),
    top: clamp(
      anchor.top,
      MENU_PADDING,
      canvas.height - menu.height - MENU_PADDING,
    ),
  };
}

function getPointerContextMenuPosition(
  target: RenderedPoint,
  menu: { width: number; height: number },
  canvas: { width: number; height: number; leftInset: number },
) {
  const rawLeft =
    target.x + POINTER_MENU_OFFSET + menu.width <= canvas.width - MENU_PADDING
      ? target.x + POINTER_MENU_OFFSET
      : target.x - POINTER_MENU_OFFSET - menu.width;
  const rawTop =
    target.y + POINTER_MENU_OFFSET + menu.height <= canvas.height - MENU_PADDING
      ? target.y + POINTER_MENU_OFFSET
      : target.y - POINTER_MENU_OFFSET - menu.height;

  return {
    left: clamp(
      rawLeft,
      canvas.leftInset,
      canvas.width - menu.width - MENU_PADDING,
    ),
    top: clamp(
      rawTop,
      MENU_PADDING,
      canvas.height - menu.height - MENU_PADDING,
    ),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function MenuButton({
  icon,
  label,
  kbd,
  danger,
  divider,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  kbd?: string;
  danger?: boolean;
  divider?: boolean;
  onClick: () => void;
}) {
  return (
    <>
      {divider ? (
        <div className="my-1 h-px bg-[var(--hair)]" aria-hidden="true" />
      ) : null}
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        className={cn(
          "flex min-h-9 items-center gap-2.5 rounded-lg px-2.5 text-left font-semibold transition-colors focus-visible:ring-[3px] focus-visible:ring-[var(--accent-ring)] focus-visible:outline-none",
          danger
            ? "text-[var(--danger)] hover:bg-[var(--danger-fill)]"
            : "text-[var(--text-2)] hover:bg-[var(--fill)]",
        )}
      >
        <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
        <span className="min-w-0 flex-1 leading-tight break-words whitespace-normal">
          {label}
        </span>
        {kbd ? (
          <kbd
            aria-hidden="true"
            className={cn(
              "grid h-5 min-w-[22px] place-items-center rounded-[5px] px-[5px] font-mono text-xs font-semibold",
              danger
                ? "bg-[var(--danger-fill)]"
                : "bg-[var(--fill)] text-[var(--muted)]",
            )}
          >
            {kbd}
          </kbd>
        ) : null}
      </button>
    </>
  );
}

function selectionForTarget(
  target: GraphContextMenuTarget,
  selection: SelectionState,
): SelectionState {
  if (target.kind === "node" && selection.nodeIds.includes(target.nodeId)) {
    return selection;
  }

  if (target.kind === "edge" && selection.edgeIds.includes(target.edgeId)) {
    return selection;
  }

  return target.kind === "node"
    ? { nodeIds: [target.nodeId], edgeIds: [] }
    : { nodeIds: [], edgeIds: [target.edgeId] };
}
