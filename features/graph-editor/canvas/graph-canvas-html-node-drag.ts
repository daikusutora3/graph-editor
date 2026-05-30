"use client";

import type { Core, Position } from "cytoscape";
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useRef } from "react";

import { createMoveNodesCommand } from "../core/graph/graph-intents";
import type { GraphIntent, NodeId } from "../core/graph/model";
import type { SelectionState } from "../shell/state/editor-state";

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
        .map(
          (id) =>
            [id, clonePosition(cy.getElementById(id).position())] as const,
        )
        .filter(([, position]) => position != null),
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

    cy.batch(() => {
      state.nodeIds.forEach((id) => {
        const startPosition = state.before[id];

        if (!startPosition) {
          return;
        }

        cy.getElementById(id).position({
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
      state.nodeIds.map((id) => [
        id,
        clonePosition(cy.getElementById(id).position()),
      ]),
    );

    executeCommand(createMoveNodesCommand("Move node", after));
    setSelection({ nodeIds: state.nodeIds, edgeIds: [] });
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
    finish,
    start,
    update,
  };
}
