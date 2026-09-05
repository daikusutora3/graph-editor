"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { computeCytoscapeEdgeRoutingMeta } from "../adapters/cytoscape/cytoscape-adapter";
import type { GraphModel } from "../core/graph/model";
import {
  withMeasuredNodeGeometry,
  clearNodeMeasurements,
} from "../adapters/browser/node-geometry";
import {
  edgeRoutingProgress,
  createEdgeRoutingCacheKey,
} from "../core/layout/edge-routing";
import {
  emptyEdgeRoutingContinuitySnapshot,
  readPreviousAutomaticRoutingMeta,
  updateAutomaticRoutingSnapshot,
} from "../core/layout/edge-routing-continuity";

type RoutingMeta = ReturnType<typeof computeCytoscapeEdgeRoutingMeta>;

export function useEdgeRoutingMeta(graph: GraphModel) {
  // Edges stay straight unless the setting is on; then parallel edges fan
  // out and edges bend just enough to clear nodes sitting on their path.
  const [fontRevision, setFontRevision] = useState(0);
  useEffect(() => {
    const onFonts = () => {
      clearNodeMeasurements();
      setFontRevision((value) => value + 1);
    };
    document.fonts?.addEventListener("loadingdone", onFonts);
    return () => document.fonts?.removeEventListener("loadingdone", onFonts);
  }, []);
  const mode = graph.settings.autoEdgeRouting;
  const edgeRoutingOptions = useMemo(
    () => ({
      mode: mode ? ("quality" as const) : ("simple" as const),
    }),
    [mode],
  );
  const cacheKey = useMemo(
    () =>
      `${fontRevision}:${createEdgeRoutingCacheKey(withMeasuredNodeGeometry(graph), edgeRoutingOptions)}`,
    [edgeRoutingOptions, graph, fontRevision],
  );
  const cacheRef = useRef<{ key: string; meta: RoutingMeta } | null>(null);
  const routingSnapshotRef = useRef(emptyEdgeRoutingContinuitySnapshot());
  const compute = () => {
    const previousSnapshot = routingSnapshotRef.current;
    const previousMeta = readPreviousAutomaticRoutingMeta(
      graph,
      previousSnapshot,
    );
    const meta = computeCytoscapeEdgeRoutingMeta(graph, {
      ...edgeRoutingOptions,
      previousMeta,
    });
    cacheRef.current = { key: cacheKey, meta };
    routingSnapshotRef.current = updateAutomaticRoutingSnapshot(
      graph,
      previousSnapshot,
      meta,
    );

    return meta;
  };

  // The very first routing is computed synchronously so the initial paint
  // already shows curves. Later changes render the previous routes first and
  // refine after commit, so a large graph never blocks the frame that shows
  // the user's edit.
  const [, setAsyncMeta] = useState<RoutingMeta | null>(null);
  const cached = cacheRef.current;
  const edgeRoutingMeta =
    cached?.key === cacheKey
      ? cached.meta
      : cached === null
        ? compute()
        : cached.meta;

  const acceptRoutingMeta = useCallback(
    (model: GraphModel, meta: RoutingMeta) => {
      cacheRef.current = {
        key: `${fontRevision}:${createEdgeRoutingCacheKey(withMeasuredNodeGeometry(model), { mode: model.settings.autoEdgeRouting ? "quality" : "simple" })}`,
        meta,
      };
      routingSnapshotRef.current = updateAutomaticRoutingSnapshot(
        model,
        routingSnapshotRef.current,
        meta,
      );
    },
    [fontRevision],
  );

  useEffect(() => {
    let frame: number | null = null;
    let cancelled = false;
    const refine = () => {
      if (cancelled) return;
      let meta: RoutingMeta;
      if (cacheRef.current?.key !== cacheKey) meta = compute();
      else {
        const previous = cacheRef.current.meta;
        const { pendingEdgeIds } = edgeRoutingProgress(previous);
        if (!pendingEdgeIds.length) return;
        meta = computeCytoscapeEdgeRoutingMeta(graph, {
          ...edgeRoutingOptions,
          previousMeta: previous,
          rerouteEdgeIds: new Set(pendingEdgeIds),
        });
        acceptRoutingMeta(graph, meta);
      }
      setAsyncMeta(meta);
      if (edgeRoutingProgress(meta).pendingEdgeIds.length)
        frame = requestAnimationFrame(refine);
    };
    frame = requestAnimationFrame(refine);
    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
    };
    // Each request owns its continuation; undo revisions are not request identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return {
    edgeRoutingMeta,
    edgeRoutingOptions,
    acceptRoutingMeta,
    routingReady:
      (cached?.key === cacheKey || cached === null) &&
      edgeRoutingProgress(edgeRoutingMeta).pendingEdgeIds.length === 0,
  };
}
