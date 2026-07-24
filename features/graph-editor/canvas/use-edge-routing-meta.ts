"use client";

import { useMemo, useRef } from "react";

import { computeCytoscapeEdgeRoutingMeta } from "../adapters/cytoscape/cytoscape-adapter";
import type { EdgeId, GraphModel } from "../core/graph/model";
import type { EdgeRoutingMeta } from "../core/layout/edge-routing";
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
  const routingSnapshotRef = useRef<{
    topologyByEdgeId: ReadonlyMap<EdgeId, string>;
    meta: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
  }>({
    topologyByEdgeId: new Map(),
    meta: new Map(),
  });
  const edgeRoutingMeta = useMemo(() => {
    const cached = cacheRef.current;

    if (cached?.key === cacheKey) {
      return cached.meta;
    }

    const previousSnapshot = routingSnapshotRef.current;
    const previousMeta = new Map<EdgeId, EdgeRoutingMeta>();
    const topologyByEdgeId = new Map<EdgeId, string>();

    for (const edge of graph.edges) {
      const topology = `${edge.source}\0${edge.target}`;
      topologyByEdgeId.set(edge.id, topology);

      if (previousSnapshot.topologyByEdgeId.get(edge.id) !== topology) {
        continue;
      }

      const previous = previousSnapshot.meta.get(edge.id);

      if (previous) {
        previousMeta.set(edge.id, previous);
      }
    }

    const meta = computeCytoscapeEdgeRoutingMeta(graph, {
      ...edgeRoutingOptions,
      previousMeta,
    });
    cacheRef.current = { key: cacheKey, meta };
    routingSnapshotRef.current = { topologyByEdgeId, meta };

    return meta;
  }, [cacheKey, edgeRoutingOptions, graph]);

  return { edgeRoutingMeta, edgeRoutingOptions };
}
