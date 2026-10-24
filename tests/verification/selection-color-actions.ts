import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";

import { pickSelectionColor } from "../../features/graph-editor/canvas/selection-color-actions";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  replaceModelCommand,
  setEdgesColorCommand,
  setNodesColorCommand,
  setSelectionColorsCommand,
} from "../../features/graph-editor/core/graph/graph-intents";
import type {
  GraphColor,
  GraphIntent,
  GraphModel,
} from "../../features/graph-editor/core/graph/model";
import { graphAtom } from "../../features/graph-editor/shell/state/graph-atoms";
import {
  clearHistoryAtom,
  commandErrorAtom,
  executeCommandAtom,
  futureAtom,
  historyAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import type { SelectionState } from "../../features/graph-editor/shell/state/editor-state";

function fixture(): GraphModel {
  return {
    ...createEmptyGraphModel(),
    nodes: [
      { id: "a", order: 0, label: "A", x: 0, y: 0 },
      { id: "b", order: 1, label: "B", x: 100, y: 0, color: "red" },
      { id: "c", order: 2, label: "C", x: 200, y: 0, color: "yellow" },
    ],
    edges: [
      { id: "ab", source: "a", target: "b", color: "pink" },
      { id: "bc", source: "b", target: "c", color: "blue" },
    ],
  };
}

function harness(model = fixture()) {
  const store = createStore();
  assert.equal(
    store.set(executeCommandAtom, replaceModelCommand(model)).status,
    "applied",
  );
  store.set(clearHistoryAtom);
  const commands: GraphIntent[] = [];
  const execute = (command: GraphIntent) => {
    commands.push(command);
    return store.set(executeCommandAtom, command);
  };
  const actions = {
    onSetNodeColor: (nodeIds: string[], color: GraphColor) =>
      execute(setNodesColorCommand(nodeIds, color)),
    onSetEdgeColor: (edgeIds: string[], color: GraphColor) =>
      execute(setEdgesColorCommand(edgeIds, color)),
    onSetSelectionColors: (selection: SelectionState, color: GraphColor) =>
      execute(
        setSelectionColorsCommand({
          nodeIds: selection.nodeIds,
          edgeIds: selection.edgeIds,
          nodeColor: color,
          edgeColor: color,
        }),
      ),
  };
  const pick = (selection: SelectionState, color: GraphColor) => {
    const graph = store.get(graphAtom);
    const nodeIds = new Set(selection.nodeIds);
    const edgeIds = new Set(selection.edgeIds);
    const nodes = graph.nodes.filter((node) => nodeIds.has(node.id));
    const edges = graph.edges.filter((edge) => edgeIds.has(edge.id));
    return pickSelectionColor(
      selection,
      nodes.length > 0 && edges.length > 0
        ? "mixed"
        : nodes.length > 0
          ? "node"
          : "edge",
      color,
      actions,
    );
  };
  return { store, commands, pick, actions };
}

const mixed = { nodeIds: ["a", "b"], edgeIds: ["ab"] };
const current = harness();
const before = current.store.get(graphAtom);
current.pick(mixed, "green");
const after = current.store.get(graphAtom);
assert.equal(
  current.commands.length,
  1,
  "one mixed swatch dispatches one command",
);
assert.equal(current.commands[0]?.type, "set-selection-colors");
assert.equal(current.store.get(historyAtom).length, 1);
assert(after.nodes.slice(0, 2).every((node) => node.color === "green"));
assert.equal(after.edges[0]?.color, "green");
assert.equal(
  after.nodes[2],
  before.nodes[2],
  "unselected node identity is retained",
);
assert.equal(
  after.edges[1],
  before.edges[1],
  "unselected edge identity is retained",
);
current.store.set(undoAtom);
assert.deepEqual(
  current.store.get(graphAtom),
  before,
  "one Undo restores both kinds",
);
current.store.set(redoAtom);
assert.deepEqual(
  current.store.get(graphAtom),
  after,
  "one Redo restores both kinds",
);

const unchanged = current.store.get(graphAtom);
const history = current.store.get(historyAtom);
const future = current.store.get(futureAtom);
current.store.set(commandErrorAtom, {
  message: "Previous rejection",
  reason: "operation",
});
current.pick(mixed, "green");
assert.equal(
  current.commands.length,
  2,
  "uniform active color retains command feedback processing",
);
assert.equal(current.store.get(graphAtom), unchanged);
assert.equal(current.store.get(historyAtom), history);
assert.equal(current.store.get(futureAtom), future);
assert.equal(
  current.store.get(commandErrorAtom),
  null,
  "unchanged picks still clear old command feedback",
);

for (const [selection, type] of [
  [{ nodeIds: ["a"], edgeIds: [] }, "set-nodes-color"],
  [{ nodeIds: [], edgeIds: ["ab"] }, "set-edges-color"],
] as const) {
  const single = harness();
  single.pick(
    { nodeIds: [...selection.nodeIds], edgeIds: [...selection.edgeIds] },
    "green",
  );
  assert.equal(
    single.commands[0]?.type,
    type,
    "single-kind palettes retain their command",
  );
}

const paperModel = fixture();
paperModel.nodes[0]!.color = "paper";
paperModel.edges[0]!.color = "paper";
const paper = harness(paperModel);
const paperSelection = { nodeIds: ["a"], edgeIds: ["ab"] };
paper.pick(paperSelection, "paper");
assert.equal(paper.commands.length, 1);
assert(!Object.hasOwn(paper.store.get(graphAtom).nodes[0]!, "color"));
assert(!Object.hasOwn(paper.store.get(graphAtom).edges[0]!, "color"));
paper.pick(paperSelection, "paper");
assert.equal(
  paper.commands.length,
  2,
  "implicit paper retains the normal no-op command path",
);
paper.store.set(undoAtom);
assert.deepEqual(
  paper.store.get(graphAtom),
  paperModel,
  "Undo restores explicit paper fields",
);

const rejected = harness();
const rejectedBefore = rejected.store.get(graphAtom);
rejected.pick(mixed, "unsupported" as GraphColor);
assert.equal(rejected.commands.length, 1);
assert.equal(
  rejected.store.get(graphAtom),
  rejectedBefore,
  "rejected mixed color changes neither kind",
);
assert.equal(rejected.store.get(historyAtom).length, 0);
assert(rejected.store.get(commandErrorAtom));

const large: GraphModel = {
  ...createEmptyGraphModel({ autoEdgeRouting: false }),
  nodes: Array.from({ length: 1000 }, (_, index) => ({
    id: `n${index}`,
    order: index,
    label: String(index),
    x: index,
    y: 0,
  })),
  edges: Array.from({ length: 5000 }, (_, index) => ({
    id: `e${index}`,
    source: `n${index % 1000}`,
    target: `n${(index + 1) % 1000}`,
  })),
};
const largeSelection = {
  nodeIds: large.nodes.map((node) => node.id),
  edgeIds: large.edges.map((edge) => edge.id),
};
const previous = harness(large);
const optimized = harness(large);
const previousCounts = countSerialization(() => {
  previous.actions.onSetNodeColor(largeSelection.nodeIds, "green");
  previous.actions.onSetEdgeColor(largeSelection.edgeIds, "green");
});
const currentCounts = countSerialization(() =>
  optimized.pick(largeSelection, "green"),
);
assert.deepEqual(optimized.store.get(graphAtom), previous.store.get(graphAtom));
assert.equal(previousCounts, 2);
assert.equal(currentCounts, 1);
assert.equal(previous.store.get(historyAtom).length, 2);
assert.equal(optimized.store.get(historyAtom).length, 1);
assert.equal(
  countSerialization(() => optimized.pick(largeSelection, "green")),
  1,
);
console.log(
  "Selection palette verification passed: mixed swatch 2→1 transactions and 2→1 full-graph serializations; no-op feedback retained",
);

function countSerialization(run: () => unknown) {
  const original = JSON.stringify;
  let count = 0;
  JSON.stringify = ((value: unknown, ...options: unknown[]) => {
    if (
      value &&
      typeof value === "object" &&
      "nodes" in value &&
      "edges" in value &&
      "settings" in value
    )
      count++;
    return Reflect.apply(original, JSON, [value, ...options]);
  }) as typeof JSON.stringify;
  try {
    run();
    return count;
  } finally {
    JSON.stringify = original;
  }
}
