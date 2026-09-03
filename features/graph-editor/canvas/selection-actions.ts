import {
  CornerLeftUp,
  CornerRightUp,
  ArrowLeftRight,
  Pencil,
  Trash2,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

import type { Messages } from "../i18n/messages";
import type { GraphModel } from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";

export type SelectionActionId =
  | "edit"
  | "reverse"
  | "bend-left"
  | "bend-right"
  | "reset-curve"
  | "delete";

export type SelectionActionDefinition = {
  id: SelectionActionId;
  icon: LucideIcon;
  label: string;
  kbd?: string;
  danger?: boolean;
  /** Shown in the context menu but not in the selection bar. */
  menuOnly?: boolean;
};

export function describeSelection(
  graph: GraphModel,
  selection: SelectionState,
  messages: Messages,
) {
  const nodeCount = selection.nodeIds.length;
  const edgeCount = selection.edgeIds.length;
  const chrome = messages.chrome.selection;

  if (nodeCount === 1 && edgeCount === 0) {
    const node = graph.nodes.find((item) => item.id === selection.nodeIds[0]);
    return chrome.node(node?.label ?? "");
  }

  if (edgeCount === 1 && nodeCount === 0) {
    const edge = graph.edges.find((item) => item.id === selection.edgeIds[0]);
    const source = graph.nodes.find((item) => item.id === edge?.source);
    const target = graph.nodes.find((item) => item.id === edge?.target);
    return chrome.edge(source?.label ?? "", target?.label ?? "");
  }

  if (nodeCount > 0 && edgeCount > 0) {
    return chrome.mixed(nodeCount, edgeCount);
  }

  return nodeCount > 0 ? chrome.nodes(nodeCount) : chrome.edges(edgeCount);
}

export function resolveSelectionActions(
  graph: GraphModel,
  selection: SelectionState,
  messages: Messages,
): SelectionActionDefinition[] {
  const selectedEdges = graph.edges.filter((edge) =>
    selection.edgeIds.includes(edge.id),
  );
  const canEditNode =
    selection.nodeIds.length === 1 && selection.edgeIds.length === 0;
  const canEditEdge =
    selection.edgeIds.length === 1 && selection.nodeIds.length === 0;
  const canReverse =
    graph.settings.directed &&
    selectedEdges.some((edge) => edge.source !== edge.target);
  const manuallyRouted =
    canEditEdge && selectedEdges[0]?.routing?.bowPx != null;
  const actions: SelectionActionDefinition[] = [];

  if (canReverse) {
    actions.push({
      id: "reverse",
      icon: ArrowLeftRight,
      label: messages.canvas.reverseEdges,
    });
  }

  if (canEditNode || canEditEdge) {
    actions.push({
      id: "edit",
      icon: Pencil,
      label:
        !canEditNode && graph.settings.weighted
          ? messages.chrome.selection.weight
          : messages.chrome.selection.label,
      kbd: "↵",
    });
  }

  if (canEditEdge && selectedEdges[0]?.source !== selectedEdges[0]?.target) {
    // Keyboard/menu alternative to dragging the edge; menu only to keep the
    // selection bar short.
    actions.push(
      {
        id: "bend-left",
        icon: CornerLeftUp,
        label: messages.canvas.bendEdgeLeft,
        menuOnly: true,
      },
      {
        id: "bend-right",
        icon: CornerRightUp,
        label: messages.canvas.bendEdgeRight,
        menuOnly: true,
      },
    );
  }

  if (manuallyRouted) {
    actions.push({
      id: "reset-curve",
      icon: RotateCcw,
      label: messages.canvas.resetEdgeCurve,
    });
  }

  actions.push({
    id: "delete",
    icon: Trash2,
    label: messages.common.delete,
    kbd: "⌫",
    danger: true,
  });

  return actions;
}
