"use client";

import type { Core, Position } from "cytoscape";
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useRef } from "react";

import { createMoveNodesCommand } from "../core/graph/graph-intents";
import type { GraphIntent, NodeId } from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";

import { withCytoscapeBatch } from "../adapters/cytoscape/cytoscape-batch";
import { clonePosition } from "../adapters/cytoscape/graph-canvas-viewport";

type DragSnapshot = Record<NodeId, Position>;
type HtmlNodeDragState = {
  pointerId: number;
  before: DragSnapshot;
  nodeIds: NodeId[];
  startClientX: number;
  startClientY: number;
  moved: boolean;
};
type AtomSetter<T> = (value: T | ((current: T) => T)) => void;

type UseHtmlNodeDragOptions = {
  cyRef: MutableRefObject<Core | null>;
  executeCommand: (command: GraphIntent) => void;
  flushRenderedHitboxes: (cy: Core) => void;
  selectionRef: MutableRefObject<SelectionState>;
  setSelection: AtomSetter<SelectionState>;
  updateRenderedHitboxes: (cy: Core) => void;
};

export function useHtmlNodeDrag({
  cyRef,
  executeCommand,
  flushRenderedHitboxes,
  selectionRef,
  setSelection,
  updateRenderedHitboxes,
}: UseHtmlNodeDragOptions) {
  const htmlNodeDragRef = useRef<HtmlNodeDragState | null>(null);
  const lastMovedAtRef = useRef(0);
  const suppressClickRef = useRef(false);

  const cancel = useCallback(() => {
    const state = htmlNodeDragRef.current;
    const cy = cyRef.current;

    htmlNodeDragRef.current = null;

    if (!state || !cy || cy.destroyed()) {
      return;
    }

    withCytoscapeBatch(cy, () => {
      state.nodeIds.forEach((id) => {
        const startPosition = state.before[id];
        const node = cy.getElementById(id);

        if (!startPosition || node.empty() || !node.isNode()) {
          return;
        }

        node.position(startPosition);
      });
    });
    flushRenderedHitboxes(cy);
  }, [cyRef, flushRenderedHitboxes]);

  useEffect(() => cancel, [cancel]);

  const start = (
    event: ReactPointerEvent<HTMLButtonElement>,
    nodeId: NodeId,
  ) => {
    if (event.button !== 0) {
      return;
    }

    const cy = cyRef.current;

    if (!cy) {
      return;
    }

    const selectedNodeIds = selectionRef.current.nodeIds.includes(nodeId)
      ? selectionRef.current.nodeIds
      : [nodeId];
    const before = Object.fromEntries(
      selectedNodeIds
        .map((id) => {
          const node = cy.getElementById(id);

          if (node.empty() || !node.isNode()) {
            return null;
          }

          return [id, clonePosition(node.position())] as const;
        })
        .filter((entry): entry is readonly [NodeId, Position] =>
          Boolean(entry),
        ),
    );

    if (Object.keys(before).length === 0) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    htmlNodeDragRef.current = {
      pointerId: event.pointerId,
      before,
      nodeIds: selectedNodeIds,
      startClientX: event.clientX,
      startClientY: event.clientY,
      moved: false,
    };

    setSelection({ nodeIds: selectedNodeIds, edgeIds: [] });
  };

  const update = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = htmlNodeDragRef.current;
    const cy = cyRef.current;

    if (!state || !cy || state.pointerId !== event.pointerId) {
      return;
    }

    event.preventDefault();

    const renderedDx = event.clientX - state.startClientX;
    const renderedDy = event.clientY - state.startClientY;
    const dx = renderedDx / cy.zoom();
    const dy = renderedDy / cy.zoom();

    if (Math.abs(renderedDx) > 2 || Math.abs(renderedDy) > 2) {
      state.moved = true;
    }

    withCytoscapeBatch(cy, () => {
      state.nodeIds.forEach((id) => {
        const startPosition = state.before[id];

        if (!startPosition) {
          return;
        }

        const node = cy.getElementById(id);

        if (node.empty() || !node.isNode()) {
          return;
        }

        node.position({
          x: startPosition.x + dx,
          y: startPosition.y + dy,
        });
      });
    });
    updateRenderedHitboxes(cy);
  };

  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = htmlNodeDragRef.current;
    const cy = cyRef.current;

    if (!state || !cy || state.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    htmlNodeDragRef.current = null;

    if (!state.moved) {
      return;
    }

    suppressClickRef.current = true;
    lastMovedAtRef.current = Date.now();
    flushRenderedHitboxes(cy);
    const after = Object.fromEntries(
      state.nodeIds
        .map((id) => {
          const node = cy.getElementById(id);

          if (node.empty() || !node.isNode()) {
            return null;
          }

          return [id, clonePosition(node.position())] as const;
        })
        .filter((entry): entry is readonly [NodeId, Position] =>
          Boolean(entry),
        ),
    );

    if (Object.keys(after).length === 0) {
      return;
    }

    executeCommand(createMoveNodesCommand("Move node", after));
    setSelection({ nodeIds: Object.keys(after) as NodeId[], edgeIds: [] });
  };

  const consumeSuppressedClick = () => {
    if (!suppressClickRef.current) {
      return false;
    }

    suppressClickRef.current = false;
    return true;
  };

  const canOpenInlineEdit = () => Date.now() - lastMovedAtRef.current >= 250;

  return {
    canOpenInlineEdit,
    consumeSuppressedClick,
    cancel,
    finish,
    start,
    update,
  };
}
