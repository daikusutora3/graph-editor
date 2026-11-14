import { isGraphText } from "./graph-limits";
import {
  type InlineEditErrorCode,
  normalizeEdgeLabelInput,
  normalizeEdgeWeightInput,
  normalizeNodeLabelInput,
} from "./edit-values";
import { updateEdgeCommand, updateNodeCommand } from "./graph-intents";
import type { EdgeId, GraphIntent, GraphModel, NodeId } from "./model";

export type InlineEditTarget =
  | {
      kind: "node-label";
      nodeId: NodeId;
      value: string;
      fallbackPosition: { x: number; y: number };
      error?: InlineEditErrorCode;
    }
  | {
      kind: "edge-weight" | "edge-label";
      edgeId: EdgeId;
      value: string;
      fallbackPosition: { x: number; y: number };
      error?: InlineEditErrorCode;
    };

export type InlineEditCommitResult =
  | { kind: "close"; command?: GraphIntent }
  | { kind: "error"; edit: InlineEditTarget };

export function resolveInlineEditCommit(
  edit: InlineEditTarget,
  graph: GraphModel,
): InlineEditCommitResult {
  if (!isGraphText(edit.value.trim()))
    return { kind: "error", edit: { ...edit, error: "invalid-graph" } };
  if (edit.kind === "node-label") {
    const node = graph.nodes.find((item) => item.id === edit.nodeId);
    const nextLabel = normalizeNodeLabelInput(edit.value);

    if (node && nextLabel !== node.label) {
      return {
        kind: "close",
        command: updateNodeCommand(node.id, { label: nextLabel }),
      };
    }

    return { kind: "close" };
  }

  const edge = graph.edges.find((item) => item.id === edit.edgeId);

  if (!edge) {
    return { kind: "close" };
  }

  if (edit.kind === "edge-weight") {
    const normalized = normalizeEdgeWeightInput(edit.value);

    if (normalized !== (edge.weight ?? "1")) {
      return {
        kind: "close",
        command: updateEdgeCommand(edge.id, { weight: normalized }),
      };
    }

    return { kind: "close" };
  }

  const nextLabel = normalizeEdgeLabelInput(edit.value);

  if ((nextLabel ?? "") !== (edge.label ?? "")) {
    return {
      kind: "close",
      command: updateEdgeCommand(edge.id, { label: nextLabel }),
    };
  }

  return { kind: "close" };
}
