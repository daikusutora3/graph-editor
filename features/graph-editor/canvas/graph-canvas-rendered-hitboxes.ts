"use client";

import type { Core } from "cytoscape";
import { useCallback, useEffect, useRef, useState } from "react";

import type { GraphModel } from "../core/graph/model";
import type { EditorMode } from "../shell/state/editor-state";

import type { GraphCanvasChrome } from "./graph-canvas-types";
import {
  readEdgeLabelHitboxes,
  readNodeHitboxes,
  type EdgeLabelHitbox,
  type NodeHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";
import { readGraphOutOfView } from "../adapters/cytoscape/graph-canvas-viewport";
import { recordTimedEvent } from "../diagnostics/graph-performance-events";

type UseRenderedHitboxesOptions = {
  chrome: GraphCanvasChrome;
  graph: GraphModel;
  mode: EditorMode;
};

export function useRenderedHitboxes({
  chrome,
  graph,
  mode,
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
      const { nextEdgeLabelHitboxes, nextGraphOutOfView, nextNodeHitboxes } =
        recordTimedEvent(
          "hitbox-read",
          () => {
            const nextNodeHitboxes = readNodeHitboxes(cy, graph);
            const nextEdgeLabelHitboxes =
              mode === "select" ? readEdgeLabelHitboxes(cy, graph) : [];
            const nextGraphOutOfView = readGraphOutOfView(cy, chrome);

            return {
              nextEdgeLabelHitboxes,
              nextGraphOutOfView,
              nextNodeHitboxes,
            };
          },
          {
            edges: graph.edges.length,
            edgeHitboxes: mode === "select" ? graph.edges.length : 0,
            nodes: graph.nodes.length,
          },
        );

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
    [chrome, graph, mode],
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

        if (pendingCy) {
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
        item.y === next.y
      );
    })
  );
}
