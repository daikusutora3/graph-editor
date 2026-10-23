"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  initializeRustKernel,
  getRustKernelReady,
  subscribeRustKernel,
} from "../compute/rust-kernel";
import { computeRoutingInWorker } from "../compute/worker-client";

import type { GraphModel } from "../core/graph/model";
import { withMeasuredNodeGeometry } from "../adapters/browser/node-geometry";
import { observeCanvasTypography } from "../adapters/browser/canvas-typography";
import {
  edgeRoutingProgress,
  computeEdgeRouting,
  createEdgeRoutingTask,
  createEdgeRoutingCacheKey,
} from "../core/layout/edge-routing";
import {
  emptyEdgeRoutingContinuitySnapshot,
  readPreviousAutomaticRoutingMeta,
  updateAutomaticRoutingSnapshot,
} from "../core/layout/edge-routing-continuity";

type RoutingMeta = ReturnType<typeof computeEdgeRouting>;

export function useEdgeRoutingMeta(graph: GraphModel) {
  const kernelReady = useSyncExternalStore(
    subscribeRustKernel,
    getRustKernelReady,
    () => false,
  );
  useEffect(() => {
    if (graph.nodes.length) void initializeRustKernel().catch(() => {});
  }, [graph.nodes.length]);
  // Edges stay straight unless the setting is on; then parallel edges fan
  // out and edges bend just enough to clear nodes sitting on their path.
  const [fontRevision, setFontRevision] = useState(0);
  useEffect(
    () => observeCanvasTypography(() => setFontRevision((value) => value + 1)),
    [],
  );
  const mode = graph.settings.autoEdgeRouting;
  const edgeRoutingOptions = useMemo(
    () => ({
      mode: mode ? ("quality" as const) : ("simple" as const),
    }),
    [mode],
  );
  // Font loading invalidates the browser's label measurements. All routing
  // stages for this render share one transient snapshot of the same geometry.
  const measured = useMemo(
    () => ({ graph: withMeasuredNodeGeometry(graph), fontRevision }),
    [graph, fontRevision],
  );
  const measuredGraph = measured.graph;
  const cacheKey = useMemo(
    () =>
      `${measured.fontRevision}:${createEdgeRoutingCacheKey(measured.graph, edgeRoutingOptions)}`,
    [edgeRoutingOptions, measured],
  );
  const cacheRef = useRef<{ key: string; meta: RoutingMeta } | null>(null);
  const routingSnapshotRef = useRef(emptyEdgeRoutingContinuitySnapshot());
  const [, setAsyncMeta] = useState<RoutingMeta | null>(null);
  // A cheap provisional route lets React mount the canvas and start its timeout.
  if (!cacheRef.current) {
    cacheRef.current = {
      key: mode ? "" : cacheKey,
      meta: computeEdgeRouting(measuredGraph, {
        mode: mode ? "parallel" : "simple",
      }),
    };
  }
  const cached = cacheRef.current;
  const edgeRoutingMeta = cached.meta;

  const acceptRoutingMeta = useCallback(
    (model: GraphModel, meta: RoutingMeta) => {
      cacheRef.current = {
        key:
          model === graph
            ? cacheKey
            : `${measured.fontRevision}:${createEdgeRoutingCacheKey(withMeasuredNodeGeometry(model), { mode: model.settings.autoEdgeRouting ? "quality" : "simple" })}`,
        meta,
      };
      routingSnapshotRef.current = updateAutomaticRoutingSnapshot(
        model,
        routingSnapshotRef.current,
        meta,
      );
    },
    [cacheKey, measured, graph],
  );

  const restartFallbackRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    // The Worker initializes its own kernel. Main-thread readiness only
    // upgrades an active JS fallback, without cancelling a healthy Worker job.
    if (kernelReady) restartFallbackRef.current?.();
  }, [kernelReady]);

  useEffect(() => {
    let frame: number | null = null;
    let cancelled = false;
    const controller = new AbortController();
    let sourceCache = cacheRef.current;
    let task: ReturnType<typeof createEdgeRoutingTask> | null = null;
    const restartFallback = () => {
      if (cancelled || cacheRef.current !== sourceCache || !task) return;
      task = null;
    };
    restartFallbackRef.current = restartFallback;
    const refine = () => {
      if (cancelled || cacheRef.current !== sourceCache) return;
      if (!task) {
        const current = cacheRef.current;
        const pending =
          current?.key === cacheKey
            ? edgeRoutingProgress(current.meta).pendingEdgeIds
            : null;
        if (pending && !pending.length) return;
        task = createEdgeRoutingTask(measuredGraph, {
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
    const start = async () => {
      const current = cacheRef.current;
      const pending =
        current?.key === cacheKey
          ? edgeRoutingProgress(current.meta).pendingEdgeIds
          : null;
      if (pending && !pending.length) return;
      const result = await computeRoutingInWorker(
        measuredGraph,
        {
          ...edgeRoutingOptions,
          previousMeta: pending
            ? current!.meta
            : readPreviousAutomaticRoutingMeta(
                graph,
                routingSnapshotRef.current,
              ),
          rerouteEdgeIds: pending ? new Set(pending) : null,
        },
        controller.signal,
      );
      if (cancelled || cacheRef.current !== sourceCache) return;
      if (result) {
        acceptRoutingMeta(graph, result);
        setAsyncMeta(result);
      } else {
        frame = requestAnimationFrame(refine);
      }
    };
    void start();
    return () => {
      cancelled = true;
      if (restartFallbackRef.current === restartFallback)
        restartFallbackRef.current = null;
      controller.abort();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [cacheKey, graph, measuredGraph, edgeRoutingOptions, acceptRoutingMeta]);

  return {
    edgeRoutingMeta,
    edgeRoutingOptions,
    acceptRoutingMeta,
    routingReady:
      cached.key === cacheKey &&
      edgeRoutingProgress(edgeRoutingMeta).pendingEdgeIds.length === 0,
  };
}
