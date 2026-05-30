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

const storedGraphAtom = atom<GraphModel>(initialGraph);
export const graphRevisionAtom = atom(0);

storedGraphAtom.onMount = (setGraph) => {
  const storedGraph = readStoredGraph();

  if (storedGraph) {
    setGraph(storedGraph);
  }
};

export const graphAtom = atom(
  (get) => get(storedGraphAtom),
  (_get, set, graph: GraphModel) => {
    set(storedGraphAtom, graph);
    scheduleStoredGraphWrite(graph);
  },
);

export const syncExternalGraphAtom = atom(
  null,
  (get, set, graph: GraphModel) => {
    cancelScheduledStoredGraphWrite();
    set(storedGraphAtom, graph);
    set(graphRevisionAtom, get(graphRevisionAtom) + 1);
  },
);
