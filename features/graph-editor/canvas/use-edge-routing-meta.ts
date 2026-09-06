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
  createEdgeRoutingTask,
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
  const [, setAsyncMeta] = useState<RoutingMeta | null>(null);
  // A cheap provisional route lets React mount the canvas and start its timeout.
  if (!cacheRef.current) {
    cacheRef.current = {
      key: mode ? "" : cacheKey,
      meta: computeCytoscapeEdgeRoutingMeta(graph, {
        mode: mode ? "parallel" : "simple",
      }),
    };
  }
  const cached = cacheRef.current;
  const edgeRoutingMeta = cached.meta;

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
    let sourceCache = cacheRef.current;
    let task: ReturnType<typeof createEdgeRoutingTask> | null = null;
    const refine = () => {
      if (cancelled || cacheRef.current !== sourceCache) return;
      if (!task) {
        const current = cacheRef.current;
        const pending =
          current?.key === cacheKey
            ? edgeRoutingProgress(current.meta).pendingEdgeIds
            : null;
        if (pending && !pending.length) return;
        task = createEdgeRoutingTask(withMeasuredNodeGeometry(graph), {
          ...edgeRoutingOptions,
          previousMeta: pending
            ? current!.meta
            : readPreviousAutomaticRoutingMeta(
                graph,
                routingSnapshotRef.current,
              ),
          rerouteEdgeIds: pending ? new Set(pending) : null,
        });
      }
      const deadline = performance.now() + 4;
      let step = task.next();
      while (!step.done && performance.now() < deadline) step = task.next();
      if (step.done) {
        const meta = step.value;
        acceptRoutingMeta(graph, meta);
        sourceCache = cacheRef.current;
        setAsyncMeta(meta);
        task = null;
        if (!edgeRoutingProgress(meta).pendingEdgeIds.length) return;
      }
      frame = requestAnimationFrame(refine);
    };
    frame = requestAnimationFrame(refine);
    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [cacheKey, graph, edgeRoutingOptions, acceptRoutingMeta]);

  return {
    edgeRoutingMeta,
    edgeRoutingOptions,
    acceptRoutingMeta,
    routingReady:
      cached.key === cacheKey &&
      edgeRoutingProgress(edgeRoutingMeta).pendingEdgeIds.length === 0,
  };
}
