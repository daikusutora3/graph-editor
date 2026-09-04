"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { computeCytoscapeEdgeRoutingMeta } from "../adapters/cytoscape/cytoscape-adapter";
import type { GraphModel } from "../core/graph/model";
import { createEdgeRoutingCacheKey } from "../core/layout/edge-routing";
import {
  emptyEdgeRoutingContinuitySnapshot,
  readPreviousAutomaticRoutingMeta,
  updateAutomaticRoutingSnapshot,
} from "../core/layout/edge-routing-continuity";

type RoutingMeta = ReturnType<typeof computeCytoscapeEdgeRoutingMeta>;

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
  const [asyncMeta, setAsyncMeta] = useState<RoutingMeta | null>(null);
  const cached = cacheRef.current;
  const edgeRoutingMeta =
    cached?.key === cacheKey
      ? cached.meta
      : cached === null
        ? compute()
        : (asyncMeta ?? cached.meta);

  useEffect(() => {
    if (cacheRef.current?.key === cacheKey) {
      return;
    }

    setAsyncMeta(compute());
    // compute closes over the latest graph/options; cacheKey changes with them.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return { edgeRoutingMeta, edgeRoutingOptions };
}
