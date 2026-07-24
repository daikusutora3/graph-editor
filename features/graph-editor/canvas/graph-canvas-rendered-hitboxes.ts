"use client";

import type { Core } from "cytoscape";
import { useCallback, useEffect, useRef, useState } from "react";

import type { GraphModel } from "../core/graph/model";
import type { EditorMode } from "../shell/state/editor-state";

import {
  readEdgeLabelHitboxes,
  readNodeHitboxes,
  type EdgeLabelHitbox,
  type NodeHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";
import { readGraphOutOfView } from "../adapters/cytoscape/graph-canvas-viewport";

type UseRenderedHitboxesOptions = {
  graph: GraphModel;
  mode: EditorMode;
  sidebarCollapsed: boolean;
};

export function useRenderedHitboxes({
  graph,
  mode,
  sidebarCollapsed,
}: UseRenderedHitboxesOptions) {
  const pendingHitboxCyRef = useRef<Core | null>(null);
  const hitboxFrameRef = useRef<number | null>(null);
  const [nodeHitboxes, setNodeHitboxes] = useState<NodeHitbox[]>([]);
  const [edgeLabelHitboxes, setEdgeLabelHitboxes] = useState<EdgeLabelHitbox[]>(
    [],
  );
  const [isGraphOutOfView, setIsGraphOutOfView] = useState(false);

  const updateRenderedHitboxesNow = useCallback(
    (cy: Core) => {
      const nextNodeHitboxes = readNodeHitboxes(cy, graph);
      const nextEdgeLabelHitboxes =
        mode === "select" ? readEdgeLabelHitboxes(cy, graph) : [];
      const nextGraphOutOfView = readGraphOutOfView(cy, {
        sidebarCollapsed,
      });

      setNodeHitboxes((current) =>
        sameNodeHitboxes(current, nextNodeHitboxes)
          ? current
          : nextNodeHitboxes,
      );
      setEdgeLabelHitboxes((current) =>
        sameEdgeLabelHitboxes(current, nextEdgeLabelHitboxes)
          ? current
          : nextEdgeLabelHitboxes,
      );
      setIsGraphOutOfView((current) =>
        current === nextGraphOutOfView ? current : nextGraphOutOfView,
      );
    },
    [graph, mode, sidebarCollapsed],
  );

  const updateRenderedHitboxes = useCallback(
    (cy: Core) => {
      pendingHitboxCyRef.current = cy;

      if (hitboxFrameRef.current !== null) {
        return;
      }

      hitboxFrameRef.current = window.requestAnimationFrame(() => {
        hitboxFrameRef.current = null;
        const pendingCy = pendingHitboxCyRef.current;
        pendingHitboxCyRef.current = null;

        if (pendingCy && !pendingCy.destroyed()) {
          updateRenderedHitboxesNow(pendingCy);
        }
      });
    },
    [updateRenderedHitboxesNow],
  );

  const flushRenderedHitboxes = useCallback(
    (cy: Core) => {
      if (hitboxFrameRef.current !== null) {
        window.cancelAnimationFrame(hitboxFrameRef.current);
        hitboxFrameRef.current = null;
      }

      pendingHitboxCyRef.current = null;
      updateRenderedHitboxesNow(cy);
    },
    [updateRenderedHitboxesNow],
  );

  useEffect(
    () => () => {
      if (hitboxFrameRef.current !== null) {
        window.cancelAnimationFrame(hitboxFrameRef.current);
        hitboxFrameRef.current = null;
      }

      pendingHitboxCyRef.current = null;
    },
    [updateRenderedHitboxesNow],
  );

  return {
    edgeLabelHitboxes,
    flushRenderedHitboxes,
    isGraphOutOfView,
    nodeHitboxes,
    updateRenderedHitboxes,
  };
}

function sameNodeHitboxes(a: NodeHitbox[], b: NodeHitbox[]) {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const next = b[index];

      return (
        next &&
        item.id === next.id &&
        item.label === next.label &&
        item.x === next.x &&
        item.y === next.y
      );
    })
  );
}

function sameEdgeLabelHitboxes(a: EdgeLabelHitbox[], b: EdgeLabelHitbox[]) {
  return (
    a.length === b.length &&
    a.every((item, index) => {
      const next = b[index];

      return (
        next &&
        item.id === next.id &&
        item.label === next.label &&
        item.sourceX === next.sourceX &&
        item.sourceY === next.sourceY &&
        item.targetX === next.targetX &&
        item.targetY === next.targetY &&
        item.x === next.x &&
        item.y === next.y &&
        item.bowPx === next.bowPx &&
        sameNumbers(
          item.controlPointDistancesPx,
          next.controlPointDistancesPx,
        ) &&
        sameNumbers(item.controlPointWeights, next.controlPointWeights)
      );
    })
  );
}

function sameNumbers(
  a: readonly number[] | undefined,
  b: readonly number[] | undefined,
) {
  if (a === b) {
    return true;
  }

  return (
    a?.length === b?.length && a?.every((value, index) => value === b?.[index])
  );
}
