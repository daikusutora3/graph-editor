"use client";

import type { Core } from "cytoscape";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

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

type UseRenderedHitboxesOptions = {
  graph: GraphModel;
  mode: EditorMode;
  chrome: GraphCanvasChrome;
};

export function useRenderedHitboxes({
  graph,
  mode,
  chrome,
}: UseRenderedHitboxesOptions) {
  const pendingHitboxCyRef = useRef<Core | null>(null);
  const hitboxFrameRef = useRef<number | null>(null);
  const [nodeHitboxes, setNodeHitboxes] = useState<NodeHitbox[]>([]);
  const [edgeLabelHitboxes, setEdgeLabelHitboxes] = useState<EdgeLabelHitbox[]>(
    [],
  );
  const [isGraphOutOfView, setIsGraphOutOfView] = useState(false);
  // Pan is a pure translation of every hitbox, so panning moves the whole
  // layer with one CSS transform instead of rebuilding thousands of nodes.
  const hitboxLayerRef = useRef<HTMLDivElement | null>(null);
  const basePanRef = useRef({ x: 0, y: 0 });
  const readPanRef = useRef({ x: 0, y: 0 });

  const updateRenderedHitboxesNow = useCallback(
    (cy: Core) => {
      // cy.pan() returns Cytoscape's live object; snapshot it.
      const pan = cy.pan();
      readPanRef.current = { x: pan.x, y: pan.y };
      const nextNodeHitboxes = readNodeHitboxes(cy, graph);
      const nextEdgeLabelHitboxes =
        mode === "select" ? readEdgeLabelHitboxes(cy, graph) : [];
      const nextGraphOutOfView = readGraphOutOfView(cy, chrome);

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

  useLayoutEffect(() => {
    // Fresh hitboxes are already in the new pan frame; drop the transform in
    // the same commit so nothing jumps.
    basePanRef.current = readPanRef.current;

    if (hitboxLayerRef.current) {
      hitboxLayerRef.current.style.transform = "";
    }
  }, [nodeHitboxes, edgeLabelHitboxes]);

  const panRenderedHitboxes = useCallback(
    (cy: Core) => {
      const pan = cy.pan();
      const layer = hitboxLayerRef.current;

      if (layer) {
        const dx = pan.x - basePanRef.current.x;
        const dy = pan.y - basePanRef.current.y;
        layer.style.transform =
          dx === 0 && dy === 0 ? "" : `translate(${dx}px, ${dy}px)`;
      }

      if (chrome.layout === "mobile") {
        const nextGraphOutOfView = readGraphOutOfView(cy, chrome);
        setIsGraphOutOfView((current) =>
          current === nextGraphOutOfView ? current : nextGraphOutOfView,
        );
      }
    },
    [chrome],
  );

  const updateRenderedHitboxes = useCallback(
    (cy: Core) => {
      pendingHitboxCyRef.current = cy;

      if (hitboxFrameRef.current !== null) {
        return;
      }

      // Two frames: Cytoscape recomputes edge geometry (control points,
      // midpoints) during its own render frame, so reading rendered
      // positions one frame later avoids picking up stale midpoints right
      // after a routing change.
      hitboxFrameRef.current = window.requestAnimationFrame(() => {
        hitboxFrameRef.current = window.requestAnimationFrame(() => {
          hitboxFrameRef.current = null;
          const pendingCy = pendingHitboxCyRef.current;
          pendingHitboxCyRef.current = null;

          if (pendingCy && !pendingCy.destroyed()) {
            updateRenderedHitboxesNow(pendingCy);
          }
        });
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
    hitboxLayerRef,
    isGraphOutOfView,
    nodeHitboxes,
    panRenderedHitboxes,
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
        item.y === next.y &&
        item.width === next.width
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
