"use client";

import { nanoid } from "nanoid";
import { useCallback } from "react";

import { addEdgeCommand, addNodeCommand } from "../core/graph/graph-intents";
import type { GraphIntent, GraphModel, NodeId } from "../core/graph/model";
import type { EdgeDraft } from "../core/view/types";
import { resolveEdgeCreation } from "./graph-canvas-edge-creation";

type Position = { x: number; y: number };

/** Node placement and edge drawing, shared by canvas taps and hitboxes. */
export function useGraphEditingActions({
  edgeDraft,
  executeCommand,
  graph,
  setEdgeDraft,
  showEditFeedback,
}: {
  edgeDraft: EdgeDraft;
  executeCommand: (command: GraphIntent) => void;
  graph: GraphModel;
  setEdgeDraft: (draft: EdgeDraft) => void;
  showEditFeedback: (nodeIds: NodeId[]) => void;
}) {
  const addNodeAtGraphPosition = useCallback(
    (position: Position) => {
      const nodeId = nanoid();

      executeCommand(
        addNodeCommand({
          id: nodeId,
          x: position.x,
          y: position.y,
        }),
      );
      showEditFeedback([nodeId]);
    },
    [executeCommand, showEditFeedback],
  );

  const drawEdgeFromNode = useCallback(
    (targetNodeId: NodeId, continueFromTarget = false) => {
      const result = resolveEdgeCreation({
        model: graph,
        draft: edgeDraft,
        targetNodeId,
        continueFromTarget,
      });

      if (result.kind === "create-edge") {
        const edgeId = nanoid();

        executeCommand(
          addEdgeCommand({
            id: edgeId,
            source: result.source,
            target: result.target,
            weight: graph.settings.weighted ? "1" : undefined,
          }),
        );
        showEditFeedback([result.source, result.target]);
      }

      setEdgeDraft(result.nextDraft);
    },
    [edgeDraft, executeCommand, graph, setEdgeDraft, showEditFeedback],
  );

  return { addNodeAtGraphPosition, drawEdgeFromNode };
}
