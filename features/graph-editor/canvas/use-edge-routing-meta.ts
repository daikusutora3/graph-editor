"use client";

import { useMemo, useRef } from "react";

import { computeCytoscapeEdgeRoutingMeta } from "../adapters/cytoscape/cytoscape-adapter";
import type { GraphModel } from "../core/graph/model";
import {
  createEdgeRoutingCacheKey,
  shouldAvoidNodesForEdgeRouting,
} from "../core/layout/edge-routing";

export function useEdgeRoutingMeta(graph: GraphModel) {
  const mode =
    graph.settings.autoEdgeRouting && shouldAvoidNodesForEdgeRouting(graph);
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
  const edgeRoutingMeta = useMemo(() => {
    const cached = cacheRef.current;

    if (cached?.key === cacheKey) {
      return cached.meta;
    }

    const meta = computeCytoscapeEdgeRoutingMeta(graph, edgeRoutingOptions);
    cacheRef.current = { key: cacheKey, meta };

    return meta;
  }, [cacheKey, edgeRoutingOptions, graph]);

  return { edgeRoutingMeta, edgeRoutingOptions };
}
