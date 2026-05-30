"use client";

import type { Core, Position } from "cytoscape";
import type {
  MutableRefObject,
  PointerEvent as ReactPointerEvent,
} from "react";
import { useCallback, useEffect, useRef } from "react";

import { createMoveNodesCommand } from "../core/graph/graph-intents";
import type { GraphIntent, GraphModel, NodeId } from "../core/graph/model";
import type { EdgeRoutingOptions } from "../core/layout/edge-routing";
import type { SelectionState } from "../shell/state/editor-state";

import { syncCytoscapeEdgeRoutingData } from "../adapters/cytoscape/cytoscape-adapter";
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
  draggingNodeIdsRef: MutableRefObject<ReadonlySet<NodeId>>;
  edgeRoutingOptions: EdgeRoutingOptions;
  executeCommand: (command: GraphIntent) => void;
  graph: GraphModel;
  selectionRef: MutableRefObject<SelectionState>;
  setSelection: AtomSetter<SelectionState>;
  updateRenderedHitboxes: (cy: Core) => void;
};

export function useHtmlNodeDrag({
  cyRef,
  draggingNodeIdsRef,
  edgeRoutingOptions,
  executeCommand,
  graph,
  selectionRef,
  setSelection,
  updateRenderedHitboxes,
}: UseHtmlNodeDragOptions) {
  const htmlNodeDragRef = useRef<HtmlNodeDragState | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const postRoutingHitboxFrameRef = useRef<number | null>(null);
  const lastMovedAtRef = useRef(0);
  const suppressClickRef = useRef(false);

  const cancelScheduledDragFrame = useCallback(() => {
    if (dragFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(dragFrameRef.current);
    dragFrameRef.current = null;
  }, []);

  const cancelScheduledPostRoutingHitboxes = useCallback(() => {
    if (postRoutingHitboxFrameRef.current === null) {
      return;
    }

    window.cancelAnimationFrame(postRoutingHitboxFrameRef.current);
    postRoutingHitboxFrameRef.current = null;
  }, []);

  const schedulePostRoutingHitboxes = useCallback(
    (cy: Core) => {
      if (postRoutingHitboxFrameRef.current !== null) {
        return;
      }

      // Edge label hitboxes depend on Cytoscape's rendered edge geometry.
      // Read them after routing data has had a frame to settle.
      postRoutingHitboxFrameRef.current = window.requestAnimationFrame(() => {
        postRoutingHitboxFrameRef.current = null;

        if (!cy.destroyed()) {
          updateRenderedHitboxes(cy);
        }
      });
    },
    [updateRenderedHitboxes],
  );

  const syncDragPreview = useCallback(
    (cy: Core) => {
      if (cy.destroyed()) {
        return;
      }

      if (edgeRoutingOptions.avoidNodes) {
        withCytoscapeBatch(cy, () => {
          syncCytoscapeEdgeRoutingData(cy, graph, edgeRoutingOptions);
        });
      }

      schedulePostRoutingHitboxes(cy);
    },
    [edgeRoutingOptions, graph, schedulePostRoutingHitboxes],
  );

  const flushDragPreview = useCallback(
    (cy: Core) => {
      cancelScheduledDragFrame();
      syncDragPreview(cy);
    },
    [cancelScheduledDragFrame, syncDragPreview],
  );

  const scheduleDragPreview = useCallback(
    (cy: Core) => {
      if (dragFrameRef.current !== null) {
        return;
      }

      dragFrameRef.current = window.requestAnimationFrame(() => {
        dragFrameRef.current = null;
        syncDragPreview(cy);
      });
    },
    [syncDragPreview],
  );

  const cancel = useCallback(() => {
    const state = htmlNodeDragRef.current;
    const cy = cyRef.current;

    htmlNodeDragRef.current = null;
    draggingNodeIdsRef.current = new Set();
    cancelScheduledDragFrame();
    cancelScheduledPostRoutingHitboxes();

    if (!state || !cy || cy.destroyed()) {
      return;
    }

    withCytoscapeBatch(cy, () => {
      restoreDragSnapshot(cy, state);
    });
    flushDragPreview(cy);
  }, [
    cancelScheduledDragFrame,
    cancelScheduledPostRoutingHitboxes,
    cyRef,
    draggingNodeIdsRef,
    flushDragPreview,
  ]);

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
    draggingNodeIdsRef.current = new Set(selectedNodeIds);

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
    scheduleDragPreview(cy);
  };

  const finish = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const state = htmlNodeDragRef.current;
    const cy = cyRef.current;

    if (!state || !cy || state.pointerId !== event.pointerId) {
      return;
    }

    event.currentTarget.releasePointerCapture(event.pointerId);
    htmlNodeDragRef.current = null;
    draggingNodeIdsRef.current = new Set();

    if (!state.moved) {
      cancelScheduledDragFrame();
      withCytoscapeBatch(cy, () => {
        restoreDragSnapshot(cy, state);
      });
      flushDragPreview(cy);
      return;
    }

    suppressClickRef.current = true;
    lastMovedAtRef.current = Date.now();
    flushDragPreview(cy);
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

function restoreDragSnapshot(cy: Core, state: HtmlNodeDragState) {
  state.nodeIds.forEach((id) => {
    const startPosition = state.before[id];
    const node = cy.getElementById(id);

    if (!startPosition || node.empty() || !node.isNode()) {
      return;
    }

    node.position(startPosition);
  });
}
