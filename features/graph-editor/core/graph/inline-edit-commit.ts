import {
  normalizeEdgeLabelInput,
  normalizeEdgeWeightInput,
  normalizeNodeLabelInput,
} from "./edit-values";
import { updateEdgeCommand, updateNodeCommand } from "./graph-intents";
import type { EdgeId, GraphIntent, GraphModel, NodeId } from "./model";

export type InlineEditCommitInput =
  | {
      kind: "node-label";
      nodeId: NodeId;
      value: string;
      fallbackPosition: { x: number; y: number };
      error?: string;
    }
  | {
      kind: "edge-weight" | "edge-label";
      edgeId: EdgeId;
      value: string;
      fallbackPosition: { x: number; y: number };
      error?: string;
    };

export type InlineEditCommitResult =
  | { kind: "close"; command?: GraphIntent }
  | { kind: "error"; edit: InlineEditCommitInput };

export function resolveInlineEditCommit(
  edit: InlineEditCommitInput,
  graph: GraphModel,
): InlineEditCommitResult {
  if (edit.kind === "node-label") {
    const node = graph.nodes.find((item) => item.id === edit.nodeId);
    const nextLabel = normalizeNodeLabelInput(edit.value);

    if (node && nextLabel != null && nextLabel !== node.label) {
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
    const normalized = normalizeEdgeWeightInput(
      edit.value,
      graph.settings.weightKind,
    );

    if (normalized.error) {
      return { kind: "error", edit: { ...edit, error: normalized.error } };
    }

    if (normalized.value !== (edge.weight ?? "1")) {
      return {
        kind: "close",
        command: updateEdgeCommand(edge.id, { weight: normalized.value }),
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
