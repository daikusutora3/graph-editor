import { normalizeEdgeRoutingOverride } from "../graph/edge-routing-overrides";
import type { EdgeId, GraphModel } from "../graph/model";

import type { EdgeRoutingMeta } from "./edge-routing";

export type EdgeRoutingContinuitySnapshot = {
  topologyByEdgeId: ReadonlyMap<EdgeId, string>;
  automaticMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>;
};

export const emptyEdgeRoutingContinuitySnapshot =
  (): EdgeRoutingContinuitySnapshot => ({
    topologyByEdgeId: new Map(),
    automaticMeta: new Map(),
  });

export function readPreviousAutomaticRoutingMeta(
  graph: GraphModel,
  snapshot: EdgeRoutingContinuitySnapshot,
) {
  const previousMeta = new Map<EdgeId, EdgeRoutingMeta>();

  for (const edge of graph.edges) {
    if (snapshot.topologyByEdgeId.get(edge.id) !== edgeRoutingTopology(edge)) {
      continue;
    }

    const previous = snapshot.automaticMeta.get(edge.id);

    if (previous) {
      previousMeta.set(edge.id, previous);
    }
  }

  return previousMeta;
}

export function updateAutomaticRoutingSnapshot(
  graph: GraphModel,
  previousSnapshot: EdgeRoutingContinuitySnapshot,
  renderedMeta: ReadonlyMap<EdgeId, EdgeRoutingMeta>,
): EdgeRoutingContinuitySnapshot {
  const topologyByEdgeId = new Map<EdgeId, string>();
  const automaticMeta = new Map<EdgeId, EdgeRoutingMeta>();

  for (const edge of graph.edges) {
    const topology = edgeRoutingTopology(edge);
    topologyByEdgeId.set(edge.id, topology);

    if (!normalizeEdgeRoutingOverride(edge.routing)) {
      const rendered = renderedMeta.get(edge.id);

      if (rendered) {
        automaticMeta.set(edge.id, rendered);
      }
      continue;
    }

    if (previousSnapshot.topologyByEdgeId.get(edge.id) !== topology) {
      continue;
    }

    const previousAutomatic = previousSnapshot.automaticMeta.get(edge.id);

    if (previousAutomatic) {
      automaticMeta.set(edge.id, previousAutomatic);
    }
  }

  return { topologyByEdgeId, automaticMeta };
}

function edgeRoutingTopology(edge: GraphModel["edges"][number]) {
  return `${edge.source}\0${edge.target}`;
}
