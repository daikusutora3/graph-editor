"use client";

import { useMemo, useRef } from "react";

import { computeCytoscapeEdgeRoutingMeta } from "../adapters/cytoscape/cytoscape-adapter";
import type { GraphModel } from "../core/graph/model";
import { createEdgeRoutingCacheKey } from "../core/layout/edge-routing";
import {
  emptyEdgeRoutingContinuitySnapshot,
  readPreviousAutomaticRoutingMeta,
  updateAutomaticRoutingSnapshot,
} from "../core/layout/edge-routing-continuity";

export function useEdgeRoutingMeta(graph: GraphModel) {
  // Edges stay straight unless the setting is on; then parallel edges fan
  // out and edges bend just enough to clear nodes sitting on their path.
  const mode = graph.settings.autoEdgeRouting;
  const edgeRoutingOptions = useMemo(
    () => ({
      mode: mode ? ("quality" as const) : ("simple" as const),
    }),
    [mode],
  );
  const cacheKey = useMemo(
    () => createEdgeRoutingCacheKey(graph, edgeRoutingOptions),
    [edgeRoutingOptions, graph],
  );
  const cacheRef = useRef<{
    key: string;
    meta: ReturnType<typeof computeCytoscapeEdgeRoutingMeta>;
  } | null>(null);
  const routingSnapshotRef = useRef(emptyEdgeRoutingContinuitySnapshot());
  const edgeRoutingMeta = useMemo(() => {
    const cached = cacheRef.current;

    if (cached?.key === cacheKey) {
      return cached.meta;
    }

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
  }, [cacheKey, edgeRoutingOptions, graph]);

  return { edgeRoutingMeta, edgeRoutingOptions };
}
