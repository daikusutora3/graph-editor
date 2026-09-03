"use client";

import { useI18n } from "../i18n/I18nProvider";
import type { GraphCanvasChrome } from "./graph-canvas-types";
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
import { Button, Kbd } from "../ui/primitives";
import { cn } from "@/lib/utils";

import {
  describeSelection,
  resolveSelectionActions,
  type SelectionActionId,
} from "./selection-actions";

type SelectionActionBarProps = {
  graph: GraphModel;
  selection: SelectionState;
  chrome: GraphCanvasChrome;
  onSetNodeColor: (nodeIds: NodeId[], color: GraphColor) => void;
  onSetEdgeColor: (edgeIds: EdgeId[], color: GraphColor) => void;
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
  onReverseEdges,
  onResetEdgeCurve,
  onEditSelectedNode,
  onEditSelectedEdge,
  onDeleteSelection,
}: SelectionActionBarProps) {
  const { messages } = useI18n();
  const selectedNodes = graph.nodes.filter((node) =>
    selection.nodeIds.includes(node.id),
  );
  const selectedEdges = graph.edges.filter((edge) =>
    selection.edgeIds.includes(edge.id),
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
  const activeColor = (() => {
    const colors = mixedSelection
      ? new Set([...nodeColors, ...edgeColors])
      : swatchKind === "node"
        ? nodeColors
        : edgeColors;
    return colors.size === 1 ? ([...colors][0] as GraphColor) : null;
  })();
  const description = describeSelection(graph, selection, messages);
  const actions = resolveSelectionActions(graph, selection, messages);
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
        className="ge-panel ge-pop touch:rounded-2xl touch:py-1.5 pointer-events-auto flex min-h-12 max-w-full flex-wrap items-center gap-1 rounded-xl py-1 pr-1.5 pl-3 backdrop-blur-[12px]"
      >
        <span className="pr-2.5 text-xs font-semibold whitespace-nowrap text-[var(--muted)]">
          {description}
        </span>
        <span
          role="radiogroup"
          aria-label={
            swatchKind === "node"
              ? messages.canvas.nodeColor
              : messages.canvas.edgeColor
          }
          className={cn(
            "flex items-center border-x border-[var(--line)] px-2.5 py-1",
            chrome.layout === "mobile" ? "gap-0 px-1" : "gap-0 px-1.5",
          )}
        >
          {(swatchKind === "node"
            ? SELECTABLE_NODE_COLORS
            : SELECTABLE_EDGE_COLORS
          ).map((color) => (
            <ColorSwatch
              key={color}
              color={color}
              kind={swatchKind}
              large={chrome.layout === "mobile"}
              active={activeColor === color}
              label={messages.canvas.colorFor(
                swatchKind,
                messages.canvas.colors[color],
              )}
              onPick={() => {
                if (mixedSelection) {
                  onSetNodeColor(selection.nodeIds, color);
                  onSetEdgeColor(selection.edgeIds, color);
                } else if (swatchKind === "node") {
                  onSetNodeColor(selection.nodeIds, color);
                } else {
                  onSetEdgeColor(selection.edgeIds, color);
                }
              }}
            />
          ))}
        </span>
        {actions.map(({ id, icon: Icon, label, kbd, danger }) => (
          <Button
            key={id}
            aria-label={label}
            variant={danger ? "danger" : "ghost"}
            className="rounded-lg"
            onClick={() => runAction(id)}
          >
            <Icon className="size-[15px]" aria-hidden="true" />
            {label}
            {kbd ? (
              <Kbd size="md" tone={danger ? "danger" : "neutral"}>
                {kbd}
              </Kbd>
            ) : null}
          </Button>
        ))}
      </div>
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
}: {
  active: boolean;
  color: GraphColor;
  kind: "node" | "edge";
  label: string;
  large: boolean;
  onPick: () => void;
}) {
  const fill = kind === "node" ? swatchFill(color) : swatchStroke(color);
  const stroke = swatchStroke(color);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      data-tooltip={label}
      data-tooltip-side="top"
      onClick={onPick}
      className={cn(
        "group grid shrink-0 place-items-center rounded-full bg-transparent p-0 focus-visible:outline-none",
        large ? "size-11" : "size-[30px]",
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
