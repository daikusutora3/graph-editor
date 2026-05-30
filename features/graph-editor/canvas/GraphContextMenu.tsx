"use client";

import { Pencil, Trash2 } from "lucide-react";
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

export type { GraphContextMenuTarget } from "./graph-canvas-types";

export type GraphContextMenuProps = {
  target: GraphContextMenuTarget;
  graph: GraphModel;
  panelState?: "open" | "closing";
  sidebarCollapsed: boolean;
  selection: SelectionState;
  onClose: () => void;
  onEditNodeLabel: (nodeId: NodeId, position: RenderedPoint) => void;
  onEditEdgeValue: (edgeId: EdgeId, position: RenderedPoint) => void;
  onDeleteSelection: (selection: SelectionState) => void;
};

export function GraphContextMenu({
  target,
  graph,
  panelState = "open",
  sidebarCollapsed,
  selection,
  onClose,
  onEditNodeLabel,
  onEditEdgeValue,
  onDeleteSelection,
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
    getContextMenuPosition(target, DEFAULT_MENU_SIZE, {
      ...DEFAULT_CANVAS_SIZE,
      leftInset: defaultLeftInset(sidebarCollapsed),
    }),
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
        leftInset: readSidebarLeftInset(sidebarCollapsed),
      },
    );

    setMenuPosition((current) =>
      current.left === nextPosition.left && current.top === nextPosition.top
        ? current
        : nextPosition,
    );
  }, [sidebarCollapsed, target]);

  const deleteSelection = useMemo(
    () => selectionForTarget(target, selection),
    [target, selection],
  );

  return (
    <div
      ref={menuRef}
      data-panel-state={panelState}
      className="gv-context-menu pointer-events-auto absolute z-40 max-h-[calc(100%-1rem)] w-[min(15rem,calc(100%-1rem))] overflow-y-auto rounded-[var(--app-radius-md)] border border-[var(--divider)] bg-[var(--canvas-overlay-bg)] p-[var(--app-space-2)] text-[length:var(--app-text-xs)] text-[var(--text)] backdrop-blur-md"
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
      {target.kind === "node" && node ? (
        <div className="flex flex-col gap-[var(--app-space-2)]">
          <MenuButton
            icon={<Pencil className="size-4" />}
            label={messages.contextMenu.editNodeLabel}
            onClick={() =>
              onEditNodeLabel(node.id, { x: target.x, y: target.y })
            }
          />
          <MenuButton
            danger
            icon={<Trash2 className="size-4" />}
            label={messages.common.delete}
            onClick={() => {
              onDeleteSelection(deleteSelection);
              onClose();
            }}
          />
        </div>
      ) : null}

      {target.kind === "edge" && edge ? (
        <div className="flex flex-col gap-[var(--app-space-2)]">
          <MenuButton
            icon={<Pencil className="size-4" />}
            label={
              graph.settings.weighted
                ? messages.contextMenu.editWeight
                : messages.contextMenu.editEdgeLabel
            }
            onClick={() =>
              onEditEdgeValue(edge.id, { x: target.x, y: target.y })
            }
          />
          <Divider />
          <MenuButton
            danger
            icon={<Trash2 className="size-4" />}
            label={messages.common.delete}
            onClick={() => {
              onDeleteSelection(deleteSelection);
              onClose();
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

const DEFAULT_MENU_SIZE = { width: 240, height: 112 };
const DEFAULT_CANVAS_SIZE = { width: 1058, height: 994, leftInset: 308 };
const HITBOX_MENU_GAP = 8;
const MENU_PADDING = 8;
const POINTER_MENU_OFFSET = 10;
const COMPACT_TOOLBAR_WIDTH = 56;

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

function readSidebarLeftInset(sidebarCollapsed: boolean) {
  const styles = getComputedStyle(document.documentElement);
  const space3 = cssPx(styles, "--app-space-3", 12);
  const space5 = cssPx(styles, "--app-space-5", 24);
  const toolbarWidth = cssPx(styles, "--app-toolbar-width", 272);
  const sidebarWidth = sidebarCollapsed ? COMPACT_TOOLBAR_WIDTH : toolbarWidth;

  return space3 + sidebarWidth + space5;
}

function defaultLeftInset(sidebarCollapsed: boolean) {
  return sidebarCollapsed ? 12 + COMPACT_TOOLBAR_WIDTH + 24 : 308;
}

function cssPx(styles: CSSStyleDeclaration, name: string, fallback: number) {
  const value = styles.getPropertyValue(name).trim();

  if (!value) {
    return fallback;
  }

  if (value.endsWith("rem")) {
    return Number.parseFloat(value) * 16;
  }

  if (value.endsWith("px")) {
    return Number.parseFloat(value);
  }

  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function MenuButton({
  icon,
  label,
  danger,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "gv-menu-item",
        danger ? "text-[var(--err)]" : "text-[var(--text)]",
      )}
    >
      <span className="grid size-5 shrink-0 place-items-center">{icon}</span>
      <span className="min-w-0 flex-1 leading-tight break-words whitespace-normal">
        {label}
      </span>
    </button>
  );
}

function Divider() {
  return <div className="h-px bg-[var(--divider)]" />;
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
