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
  type EdgeLabelHitbox,
  type NodeHitbox,
} from "../adapters/cytoscape/graph-canvas-hitboxes";
import { createRenderedHitboxReader } from "../adapters/cytoscape/rendered-hitbox-reader";
import { readGraphOutOfView } from "../adapters/cytoscape/graph-canvas-viewport";
import { readCytoscapeCoordinateOrigin } from "../adapters/cytoscape/cytoscape-coordinates";

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

  const hitboxLayerRef = useRef<HTMLDivElement | null>(null);
  const basePanRef = useRef({ x: 0, y: 0, originX: 0, originY: 0 });
  const [hitboxPan, setHitboxPan] = useState({
    x: 0,
    y: 0,
    originX: 0,
    originY: 0,
  });
  const readerRef = useRef<{
    cy: Core;
    reader: ReturnType<typeof createRenderedHitboxReader>;
  } | null>(null);

  const updateRenderedHitboxesNow = useCallback(
    (cy: Core) => {
      const pan = cy.pan();
      const origin = readCytoscapeCoordinateOrigin(cy);
      const nextPan = {
        x: pan.x,
        y: pan.y,
        originX: origin.x,
        originY: origin.y,
      };
      if (readerRef.current?.cy !== cy) {
        readerRef.current?.reader.dispose();
        readerRef.current = { cy, reader: createRenderedHitboxReader(cy) };
      }
      const { nodes: nextNodeHitboxes, edges: nextEdgeLabelHitboxes } =
        readerRef.current.reader.read(graph, mode === "select");
      const nextGraphOutOfView = readGraphOutOfView(cy, chrome);

      setNodeHitboxes(nextNodeHitboxes);

      if (nextEdgeLabelHitboxes) setEdgeLabelHitboxes(nextEdgeLabelHitboxes);

      setHitboxPan((current) =>
        current.x === nextPan.x &&
        current.y === nextPan.y &&
        current.originX === nextPan.originX &&
        current.originY === nextPan.originY
          ? current
          : nextPan,
      );
      setIsGraphOutOfView((current) =>
        current === nextGraphOutOfView ? current : nextGraphOutOfView,
      );
    },
    [chrome, graph, mode],
  );

  useLayoutEffect(() => {
    basePanRef.current = hitboxPan;

    if (hitboxLayerRef.current) {
      hitboxLayerRef.current.style.transform = "";
    }
  }, [nodeHitboxes, edgeLabelHitboxes, hitboxPan]);

  const panRenderedHitboxes = useCallback(
    (cy: Core) => {
      const pan = cy.pan();
      const origin = readCytoscapeCoordinateOrigin(cy);
      const layer = hitboxLayerRef.current;

      if (layer) {
        const base = basePanRef.current;
        const dx = pan.x - base.x - (origin.x - base.originX) * cy.zoom();
        const dy = pan.y - base.y - (origin.y - base.originY) * cy.zoom();
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

  useEffect(
    () => () => {
      readerRef.current?.reader.dispose();
      readerRef.current = null;
    },
    [],
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
