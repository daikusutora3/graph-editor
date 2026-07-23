import { atom } from "jotai";

import { createEmptyGraphModel } from "../../core/graph/graph-factory";
import type { GraphModel } from "../../core/graph/model";
import {
  cancelScheduledStoredGraphWrite,
  readStoredGraph,
  scheduleStoredGraphWrite,
} from "../../adapters/browser/stored-graph";

export { GRAPH_STORAGE_KEY } from "../../adapters/browser/stored-graph";

export const initialGraph: GraphModel = createEmptyGraphModel();

type GraphStorageState = {
  graph: GraphModel;
  status: "pending" | "ready";
};

const storedGraphAtom = atom<GraphStorageState>({
  graph: initialGraph,
  status: "pending",
});
export const graphRevisionAtom = atom(0);

storedGraphAtom.onMount = (setGraph) => {
  const storedGraph = readStoredGraph();

  setGraph({
    graph: storedGraph ?? initialGraph,
    status: "ready",
  });
};

export const graphStorageReadyAtom = atom(
  (get) => get(storedGraphAtom).status === "ready",
);

export const graphIsEmptyAtom = atom((get) => {
  const graph = get(storedGraphAtom).graph;
  return graph.nodes.length === 0 && graph.edges.length === 0;
});

export const graphAtom = atom(
  (get) => get(storedGraphAtom).graph,
  (_get, set, graph: GraphModel) => {
    set(storedGraphAtom, { graph, status: "ready" });
    scheduleStoredGraphWrite(graph);
  },
);

export const syncExternalGraphAtom = atom(
  null,
  (get, set, graph: GraphModel) => {
    cancelScheduledStoredGraphWrite();
    set(storedGraphAtom, { graph, status: "ready" });
    set(graphRevisionAtom, get(graphRevisionAtom) + 1);
  },
);
