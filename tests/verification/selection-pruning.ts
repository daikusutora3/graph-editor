import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { deleteSelectionCommand } from "../../features/graph-editor/core/graph/graph-intents";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { selectionAtom } from "../../features/graph-editor/shell/state/editor-atoms";
import { pruneSelectionForGraph } from "../../features/graph-editor/shell/state/editor-selection";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  executeCommandAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";

const graph: GraphModel = {
  ...createEmptyGraphModel({ allowMultiEdges: true }),
  nodes: ["n0", "n1", "n2", "__proto__", "constructor", "toString"].map(
    (id, order) => ({ id, label: id, order, x: order * 100, y: 0 }),
  ),
  edges: [
    { id: "e0", source: "n0", target: "n1" },
    { id: "e1", source: "n1", target: "n2" },
    { id: "__proto__", source: "n0", target: "n1" },
  ],
};
let nodeReads = 0,
  edgeReads = 0;
const observed = {
  ...graph,
  get nodes() {
    nodeReads++;
    return graph.nodes;
  },
  get edges() {
    edgeReads++;
    return graph.edges;
  },
};
const empty = { nodeIds: [], edgeIds: [] };
assert.equal(pruneSelectionForGraph(empty, observed), empty);
assert.equal(nodeReads, 0);
assert.equal(edgeReads, 0);
const nodes = { nodeIds: ["n1", "n0", "n1"], edgeIds: [] };
assert.equal(pruneSelectionForGraph(nodes, observed), nodes);
assert.equal(nodeReads, 1);
assert.equal(edgeReads, 0);
const edges = { nodeIds: [], edgeIds: ["e1", "e0", "e1"] };
assert.equal(pruneSelectionForGraph(edges, observed), edges);
assert.equal(nodeReads, 1);
assert.equal(edgeReads, 1);

for (const selection of [
  { nodeIds: ["n1", "missing", "n0", "n1"], edgeIds: [] },
  { nodeIds: [], edgeIds: ["e1", "missing", "e0", "e1"] },
  {
    nodeIds: ["e0", "__proto__", "constructor", "toString", "n0"],
    edgeIds: ["n0", "__proto__", "e0", "e0"],
  },
]) {
  const next = pruneSelectionForGraph(selection, graph);
  assert.deepEqual(next, {
    nodeIds: selection.nodeIds.filter((id) =>
      graph.nodes.some((node) => node.id === id),
    ),
    edgeIds: selection.edgeIds.filter((id) =>
      graph.edges.some((edge) => edge.id === id),
    ),
  });
  assert.notEqual(next, selection);
  assert.notEqual(next.nodeIds, selection.nodeIds);
  assert.notEqual(next.edgeIds, selection.edgeIds);
}

const mutable = { ...graph, nodes: [...graph.nodes], edges: [...graph.edges] };
const selected = { nodeIds: ["n0"], edgeIds: ["e0"] };
assert.equal(pruneSelectionForGraph(selected, mutable), selected);
mutable.nodes.shift();
assert.deepEqual(pruneSelectionForGraph(selected, mutable), {
  nodeIds: [],
  edgeIds: ["e0"],
});
mutable.edges.shift();
assert.deepEqual(pruneSelectionForGraph(selected, mutable), empty);

const store = createStore();
store.set(syncExternalGraphAtom, { ...graph, edges: graph.edges.slice(0, 2) });
store.set(selectionAtom, {
  nodeIds: ["n0", "missing", "n2"],
  edgeIds: ["e0", "e1", "missing"],
});
const deleted = store.set(
  executeCommandAtom,
  deleteSelectionCommand({ nodeIds: ["n2"], edgeIds: [] }),
);
assert.equal(deleted.status, "applied", JSON.stringify(deleted));
const retained = store.get(selectionAtom);
assert.deepEqual(retained, { nodeIds: ["n0"], edgeIds: ["e0"] });
store.set(undoAtom);
assert.ok(store.get(graphAtom).nodes.some((node) => node.id === "n2"));
assert.equal(store.get(selectionAtom), retained);
store.set(redoAtom);
assert.ok(!store.get(graphAtom).nodes.some((node) => node.id === "n2"));
assert.equal(store.get(selectionAtom), retained);
console.log(
  "Selection pruning: identity, ordering, mutation, and history passed",
);
