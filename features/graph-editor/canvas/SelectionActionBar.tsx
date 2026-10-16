"use client";

import { ChevronDown, Palette } from "lucide-react";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useI18n } from "../i18n/I18nProvider";
import type { GraphCanvasChrome } from "./graph-canvas-types";
import { rovingFocusKeyDown } from "@/components/ui/use-roving-focus";
import {
  SELECTABLE_EDGE_COLORS,
  SELECTABLE_NODE_COLORS,
} from "../core/graph/colors";
import type {
  EdgeId,
  GraphColor,
  GraphModel,
  NodeId,
} from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";
import { Button, IconButton, Kbd, focusRing } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

import {
  describeSelection,
  resolveSelectionActions,
  type SelectionActionId,
} from "./selection-actions";
import { pickSelectionColor } from "./selection-color-actions";

type SelectionActionBarProps = {
  graph: GraphModel;
  selection: SelectionState;
  chrome: GraphCanvasChrome;
  onSetNodeColor: (nodeIds: NodeId[], color: GraphColor) => void;
  onSetEdgeColor: (edgeIds: EdgeId[], color: GraphColor) => void;
  onSetSelectionColors: (selection: SelectionState, color: GraphColor) => void;
  onReverseEdges: (edgeIds: EdgeId[]) => void;
  onResetEdgeCurve: (edgeId: EdgeId) => void;
  onEditSelectedNode: () => void;
  onEditSelectedEdge: () => void;
  onDeleteSelection: () => void;
};

export function SelectionActionBar({
  graph,
  selection,
  chrome,
  onSetNodeColor,
  onSetEdgeColor,
  onSetSelectionColors,
  onReverseEdges,
  onResetEdgeCurve,
  onEditSelectedNode,
  onEditSelectedEdge,
  onDeleteSelection,
}: SelectionActionBarProps) {
  const { messages } = useI18n();
  const selectedNodeIds = new Set(selection.nodeIds);
  const selectedEdgeIds = new Set(selection.edgeIds);
  const selectedNodes = graph.nodes.filter((node) =>
    selectedNodeIds.has(node.id),
  );
  const selectedEdges = graph.edges.filter((edge) =>
    selectedEdgeIds.has(edge.id),
  );
  const nodeColors = new Set(
    selectedNodes.map((node) => node.color ?? "paper"),
  );
  const edgeColors = new Set(
    selectedEdges.map((edge) => edge.color ?? "paper"),
  );
  const mixedSelection = selectedNodes.length > 0 && selectedEdges.length > 0;
  const swatchKind =
    mixedSelection || selectedNodes.length > 0 ? "node" : "edge";
  const selectableColors =
    swatchKind === "node" ? SELECTABLE_NODE_COLORS : SELECTABLE_EDGE_COLORS;
  const activeColor = (() => {
    const colors = mixedSelection
      ? new Set([...nodeColors, ...edgeColors])
      : swatchKind === "node"
        ? nodeColors
        : edgeColors;
    return colors.size === 1 ? ([...colors][0] as GraphColor) : null;
  })();
  const description = describeSelection(graph, selection, messages);
  const actions = resolveSelectionActions(graph, selection, messages).filter(
    (action) => !action.menuOnly,
  );
  const mobile = chrome.layout === "mobile";
  const colorLabel =
    swatchKind === "node"
      ? messages.canvas.nodeColor
      : messages.canvas.edgeColor;
  const pickColor = (color: GraphColor) => {
    pickSelectionColor(
      selection,
      mixedSelection ? "mixed" : swatchKind,
      color,
      {
        onSetNodeColor,
        onSetEdgeColor,
        onSetSelectionColors,
      },
    );
  };
  const runAction = (id: SelectionActionId) => {
    switch (id) {
      case "edit":
        if (selection.nodeIds.length === 1 && selection.edgeIds.length === 0) {
          onEditSelectedNode();
        } else {
          onEditSelectedEdge();
        }
        return;
      case "reverse":
        onReverseEdges(selection.edgeIds);
        return;
      case "reset-curve":
        if (selection.edgeIds[0]) {
          onResetEdgeCurve(selection.edgeIds[0]);
        }
        return;
      case "delete":
        onDeleteSelection();
    }
  };

  return (
    <div className="pointer-events-none relative z-30 flex max-w-full justify-center">
      <div
        role="toolbar"
        aria-label={description}
        className={cn(
          "ge-panel ge-pop pointer-events-auto relative flex min-h-12 max-w-full items-center gap-1 backdrop-blur-[12px]",
          mobile
            ? "flex-nowrap rounded-2xl p-1 pl-3"
            : "flex-wrap rounded-xl py-1 pr-1.5 pl-3",
        )}
      >
        <span
          className={cn(
            "ge-selection-summary min-w-0 truncate text-xs font-semibold text-[var(--muted)]",
            mobile ? "max-w-40 pr-1" : "max-w-full pr-2.5",
          )}
          title={description}
        >
          {description}
        </span>
        <SelectionColorPalette
          key={JSON.stringify([selection.nodeIds, selection.edgeIds, mobile])}
          activeColor={activeColor}
          kind={swatchKind}
          label={colorLabel}
          mobile={mobile}
        >
          <span
            role="radiogroup"
            aria-label={colorLabel}
            onKeyDown={rovingFocusKeyDown}
            className={cn(
              "items-center",
              mobile
                ? cn(
                    "grid grid-cols-[repeat(4,44px)]",
                    swatchKind === "node"
                      ? "min-[360px]:grid-cols-[repeat(7,44px)]"
                      : "min-[360px]:grid-cols-[repeat(6,44px)]",
                  )
                : "flex gap-0 border-x border-[var(--line)] px-1.5 py-1",
            )}
          >
            {selectableColors.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                kind={swatchKind}
                large={mobile}
                active={activeColor === color}
                tabIndex={
                  activeColor === color ||
                  ((activeColor == null ||
                    !selectableColors.includes(activeColor)) &&
                    color === selectableColors[0])
                    ? 0
                    : -1
                }
                label={messages.canvas.colorFor(
                  swatchKind,
                  messages.canvas.colors[color],
                )}
                onPick={() => pickColor(color)}
              />
            ))}
          </span>
        </SelectionColorPalette>
        {mobile ? (
          <span
            aria-hidden="true"
            className="h-6 shrink-0 border-l border-[var(--line)]"
          />
        ) : null}
        {actions.map(({ id, icon: Icon, label, kbd, danger }) =>
          mobile ? (
            <IconButton
              key={id}
              label={label}
              tooltipSide="top"
              variant={danger ? "danger" : "ghost"}
              className="size-11 rounded-xl"
              onClick={() => runAction(id)}
            >
              <Icon
                className="size-icon-lg"
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </IconButton>
          ) : (
            <Button
              key={id}
              aria-label={label}
              variant={danger ? "danger" : "ghost"}
              className="rounded-lg"
              onClick={() => runAction(id)}
            >
              <Icon className="size-icon-sm" aria-hidden="true" />
              {label}
              {kbd ? (
                <Kbd size="md" tone={danger ? "danger" : "neutral"}>
                  {kbd}
                </Kbd>
              ) : null}
            </Button>
          ),
        )}
      </div>
    </div>
  );
}

function SelectionColorPalette({
  activeColor,
  children,
  kind,
  label,
  mobile,
}: {
  activeColor: GraphColor | null;
  children: ReactNode;
  kind: "node" | "edge";
  label: string;
  mobile: boolean;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapper = useRef<HTMLDivElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const close = (restoreFocus = false) => {
    setOpen(false);
    if (restoreFocus)
      wrapper.current
        ?.querySelector<HTMLButtonElement>("button")
        ?.focus({ preventScroll: true });
  };

  useLayoutEffect(() => {
    if (open) {
      (
        palette.current?.querySelector<HTMLElement>("[aria-checked='true']") ??
        palette.current?.querySelector<HTMLElement>("[role='radio']")
      )?.focus({ preventScroll: true });
    }
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !wrapper.current?.contains(event.target)
      )
        close();
    };
    const blur = () => close();
    window.addEventListener("pointerdown", dismiss, true);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointerdown", dismiss, true);
      window.removeEventListener("blur", blur);
    };
  }, [open]);

  if (!mobile) return children;

  return (
    <div
      ref={wrapper}
      className="flex shrink-0"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (open && event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          close(true);
        }
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        data-tooltip={label}
        data-tooltip-side="top"
        className={cn(
          focusRing,
          "flex h-11 w-14 shrink-0 items-center justify-center gap-1 rounded-xl px-2 transition-colors",
          open
            ? "bg-[var(--accent-fill)] text-[var(--accent-text)]"
            : "text-[var(--text-2)] hover:bg-[var(--fill)]",
        )}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
          }
        }}
      >
        {activeColor ? (
          <span
            aria-hidden="true"
            className="size-5 shrink-0 rounded-full"
            style={{
              background:
                kind === "node"
                  ? swatchFill(activeColor)
                  : swatchStroke(activeColor),
              border: `1.5px solid ${swatchStroke(activeColor)}`,
            }}
          />
        ) : (
          <Palette
            className="size-icon-lg"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
        <ChevronDown
          className="size-3 shrink-0"
          strokeWidth={1.75}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          ref={palette}
          id={id}
          className="ge-panel ge-pop absolute bottom-full left-1/2 z-50 mb-2 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl p-1.5 backdrop-blur-[12px]"
          onClick={(event) => {
            // Roving focus activates radios with .click() (detail=0). Keep
            // keyboard navigation open; a pointer pick returns to the canvas.
            if (event.detail > 0) close(true);
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ColorSwatch({
  active,
  color,
  kind,
  label,
  large,
  onPick,
  tabIndex,
}: {
  active: boolean;
  color: GraphColor;
  kind: "node" | "edge";
  label: string;
  large: boolean;
  onPick: () => void;
  tabIndex: number;
}) {
  const fill = kind === "node" ? swatchFill(color) : swatchStroke(color);
  const stroke = swatchStroke(color);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      tabIndex={tabIndex}
      aria-label={label}
      data-tooltip={label}
      data-tooltip-side="top"
      onClick={onPick}
      className={cn(
        "group grid shrink-0 place-items-center rounded-full bg-transparent p-0 focus-visible:outline-none",
        large ? "h-11 w-full min-w-0" : "size-[30px]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "block size-[22px] rounded-full transition-shadow",
          active
            ? "shadow-[0_0_0_2px_var(--panel-solid),0_0_0_3.5px_var(--accent)]"
            : "shadow-[0_0_0_1px_var(--hair)] group-hover:shadow-[0_0_0_2px_var(--panel-solid),0_0_0_3.5px_var(--fill-2)] group-focus-visible:shadow-[0_0_0_2px_var(--panel-solid),0_0_0_3.5px_var(--accent-ring)]",
        )}
        style={{ background: fill, border: `1.5px solid ${stroke}` }}
      />
    </button>
  );
}

export function swatchFill(color: GraphColor) {
  switch (color) {
    case "white":
      return "var(--canvas-node-white)";
    case "black":
      return "var(--canvas-node-black)";
    case "red":
      return "var(--canvas-node-red)";
    case "yellow":
      return "var(--canvas-node-yellow)";
    case "blue":
      return "var(--canvas-node-blue)";
    case "green":
      return "var(--canvas-node-green)";
    case "pink":
      return "var(--canvas-node-pink)";
    default:
      return "var(--canvas-node)";
  }
}

export function swatchStroke(color: GraphColor) {
  switch (color) {
    case "white":
      return "var(--canvas-node-black)";
    case "black":
      return "var(--canvas-edge-black)";
    case "red":
      return "var(--canvas-edge-red)";
    case "yellow":
      return "var(--canvas-edge-yellow)";
    case "blue":
      return "var(--canvas-edge-blue)";
    case "green":
      return "var(--canvas-edge-green)";
    case "pink":
      return "var(--canvas-edge-pink)";
    default:
      return "var(--canvas-node-border)";
  }
}
