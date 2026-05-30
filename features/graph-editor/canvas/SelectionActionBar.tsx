"use client";

import { ArrowLeftRight } from "lucide-react";

import { useI18n } from "../i18n/I18nProvider";
import type { GraphCanvasChrome } from "./graph-canvas-types";
import { GRAPH_COLORS } from "../core/graph/colors";
import type {
  EdgeId,
  GraphColor,
  GraphModel,
  NodeId,
} from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";

type SelectionActionBarProps = {
  graph: GraphModel;
  selection: SelectionState;
  chrome: GraphCanvasChrome;
  onSetNodeColor: (nodeIds: NodeId[], color: GraphColor) => void;
  onSetEdgeColor: (edgeIds: EdgeId[], color: GraphColor) => void;
  onReverseEdges: (edgeIds: EdgeId[]) => void;
};

export function SelectionActionBar({
  graph,
  selection,
  chrome,
  onSetNodeColor,
  onSetEdgeColor,
  onReverseEdges,
}: SelectionActionBarProps) {
  const { messages } = useI18n();
  const selectedNodes = graph.nodes.filter((node) =>
    selection.nodeIds.includes(node.id),
  );
  const selectedEdges = graph.edges.filter((edge) =>
    selection.edgeIds.includes(edge.id),
  );
  const selectedNodeColors = new Set(
    selectedNodes.map((node) => node.color ?? "paper"),
  );
  const selectedEdgeColors = new Set(
    selectedEdges.map((edge) => edge.color ?? "paper"),
  );
  const selectedNodeColor =
    selectedNodes.length > 0 && selectedNodeColors.size === 1
      ? ([...selectedNodeColors][0] as GraphColor)
      : null;
  const selectedEdgeColor =
    selectedEdges.length > 0 && selectedEdgeColors.size === 1
      ? ([...selectedEdgeColors][0] as GraphColor)
      : null;

  return (
    <div
      className={[
        "pointer-events-none absolute right-[calc(var(--app-space-3)+3.5rem+var(--app-space-5))] bottom-[var(--app-space-5)] z-30 flex justify-center px-[var(--app-space-4)] transition-[left,right] duration-[var(--app-duration-base)] ease-[var(--app-ease)] motion-reduce:transition-none",
        chrome.sidebarCollapsed
          ? "left-[calc(var(--app-space-3)+3.5rem+var(--app-space-5))]"
          : "left-[calc(var(--app-space-3)+var(--app-toolbar-width)+var(--app-space-5))]",
      ].join(" ")}
    >
      <div className="pointer-events-auto flex h-12 items-center gap-[var(--app-space-2)] rounded-[var(--app-radius-md)] border border-[var(--divider)] bg-[var(--canvas-overlay-bg)] px-[var(--app-space-3)] backdrop-blur-md">
        {selection.nodeIds.length > 0 ? (
          <GraphColorPicker
            kind="node"
            selectedColor={selectedNodeColor}
            onPick={(color) => onSetNodeColor(selection.nodeIds, color)}
          />
        ) : null}
        {selection.nodeIds.length > 0 && selection.edgeIds.length > 0 ? (
          <div className="h-5 w-px bg-[var(--divider)]" />
        ) : null}
        {selection.edgeIds.length > 0 ? (
          <GraphColorPicker
            kind="edge"
            selectedColor={selectedEdgeColor}
            onPick={(color) => onSetEdgeColor(selection.edgeIds, color)}
          />
        ) : null}
        {graph.settings.directed && selection.edgeIds.length > 0 ? (
          <>
            <div className="h-5 w-px bg-[var(--divider)]" />
            <button
              type="button"
              aria-label={messages.canvas.reverseEdgesTitle}
              title={messages.canvas.reverseEdgesTitle}
              onClick={() => onReverseEdges(selection.edgeIds)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[var(--app-radius-sm)] bg-transparent px-2.5 text-[length:var(--app-text-sm)] leading-none font-bold whitespace-nowrap text-[var(--text-dim)] transition-colors hover:bg-[var(--state-hover-bg)] hover:text-[var(--state-hover-text)] focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none"
            >
              <ArrowLeftRight className="size-4" />
              <span>{messages.canvas.reverseEdges}</span>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}

function GraphColorPicker({
  kind,
  selectedColor,
  onPick,
}: {
  kind: "node" | "edge";
  selectedColor: GraphColor | null;
  onPick: (color: GraphColor) => void;
}) {
  const { messages } = useI18n();

  return (
    <div
      role="radiogroup"
      aria-label={
        kind === "node" ? messages.canvas.nodeColor : messages.canvas.edgeColor
      }
      className="flex items-center gap-1.5 px-1"
      title={
        kind === "node"
          ? messages.canvas.nodeColorTitle
          : messages.canvas.edgeColorTitle
      }
    >
      {GRAPH_COLORS.map((color) => {
        const active = selectedColor === color;

        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={messages.canvas.colorFor(
              kind,
              messages.canvas.colors[color],
            )}
            title={messages.canvas.colors[color]}
            onClick={() => onPick(color)}
            className={[
              [
                "grid size-8 place-items-center bg-transparent transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[var(--state-focus-ring)] focus-visible:outline-none",
                kind === "node"
                  ? "rounded-full border border-[var(--canvas-node-border)]"
                  : "rounded-[var(--app-radius-sm)]",
              ].join(" "),
              active && kind === "node"
                ? "shadow-[0_0_0_2px_var(--bg),0_0_0_3.5px_var(--accent-ring)]"
                : "",
              active && kind === "edge" ? "bg-[var(--state-selected-bg)]" : "",
            ].join(" ")}
            style={
              kind === "node"
                ? { backgroundColor: graphColorFill(color) }
                : undefined
            }
          >
            {kind === "edge" ? (
              <svg
                width="26"
                height="14"
                viewBox="0 0 26 14"
                aria-hidden="true"
              >
                <line
                  x1="4"
                  y1="7"
                  x2="22"
                  y2="7"
                  stroke={edgeColorStroke(color)}
                  strokeWidth={active ? 5 : 4}
                  strokeLinecap="round"
                />
              </svg>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function graphColorFill(color: GraphColor) {
  switch (color) {
    case "yellow":
      return "var(--graph-swatch-yellow)";
    case "blue":
      return "var(--graph-swatch-blue)";
    case "green":
      return "var(--graph-swatch-green)";
    case "pink":
      return "var(--graph-swatch-pink)";
    default:
      return "var(--graph-swatch-paper)";
  }
}

function edgeColorStroke(color: GraphColor) {
  switch (color) {
    case "yellow":
      return "var(--graph-swatch-yellow)";
    case "blue":
      return "var(--graph-swatch-blue)";
    case "green":
      return "var(--graph-swatch-green)";
    case "pink":
      return "var(--graph-swatch-pink)";
    default:
      return "var(--graph-swatch-edge)";
  }
}
