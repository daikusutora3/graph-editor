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
import {
  reconcileEdgeLabelHitboxes,
  reconcileNodeHitboxes,
} from "./rendered-hitbox-reconciliation";

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
        mode === "select" ? readEdgeLabelHitboxes(cy, graph) : null;
      const nextGraphOutOfView = readGraphOutOfView(cy, chrome);

      setNodeHitboxes((current) =>
        reconcileNodeHitboxes(current, nextNodeHitboxes),
      );
      // The hidden selection overlay retains its DOM between mode changes.
      // Leave its snapshot dormant until select mode needs live geometry again.
      if (nextEdgeLabelHitboxes)
        setEdgeLabelHitboxes((current) =>
          reconcileEdgeLabelHitboxes(current, nextEdgeLabelHitboxes),
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
