import { createStore } from "jotai/vanilla";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  replaceModelCommand,
  updateNodeCommand,
  updateSettingsCommand,
} from "../../features/graph-editor/core/graph/graph-intents";
import {
  createChromeGraphAtom,
  edgeDraftSourceLabelAtom,
  hasSelectionAtom,
  inactiveGraphRevisionAtom,
} from "../../features/graph-editor/shell/state/chrome-atoms";
import {
  edgeDraftAtom,
  selectionAtom,
} from "../../features/graph-editor/shell/state/editor-atoms";
import {
  graphAtom,
  graphHasEdgesAtom,
  graphHasNodesAtom,
  graphIsEmptyAtom,
  graphRevisionAtom,
  graphSettingsAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  canRedoAtom,
  canUndoAtom,
  executeCommandAtom,
  futureAtom,
  historyAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Chrome subscriptions");
const store = createStore();
const idleChromeGraph = createChromeGraphAtom(null);
const updates = {
  graph: 0,
  revision: 0,
  history: 0,
  future: 0,
  chrome: 0,
  inactiveRevision: 0,
  settings: 0,
  undo: 0,
  redo: 0,
  hasNodes: 0,
  hasEdges: 0,
  empty: 0,
  source: 0,
  selection: 0,
};
const unsubscribers = [
  store.sub(graphAtom, () => updates.graph++),
  store.sub(graphRevisionAtom, () => updates.revision++),
  store.sub(historyAtom, () => updates.history++),
  store.sub(futureAtom, () => updates.future++),
  store.sub(idleChromeGraph, () => updates.chrome++),
  store.sub(inactiveGraphRevisionAtom, () => updates.inactiveRevision++),
  store.sub(graphSettingsAtom, () => updates.settings++),
  store.sub(canUndoAtom, () => updates.undo++),
  store.sub(canRedoAtom, () => updates.redo++),
  store.sub(graphHasNodesAtom, () => updates.hasNodes++),
  store.sub(graphHasEdgesAtom, () => updates.hasEdges++),
  store.sub(graphIsEmptyAtom, () => updates.empty++),
  store.sub(edgeDraftSourceLabelAtom, () => updates.source++),
  store.sub(hasSelectionAtom, () => updates.selection++),
];

const model = {
  ...createEmptyGraphModel(),
  nodes: [
    { id: "a", label: "A", order: 0, x: 0, y: 0 },
    { id: "b", label: "B", order: 1, x: 100, y: 0 },
  ],
  edges: [{ id: "ab", source: "a", target: "b" }],
};
store.set(executeCommandAtom, replaceModelCommand(model));
for (const key of Object.keys(updates) as (keyof typeof updates)[]) {
  updates[key] = 0;
}

for (let index = 0; index < 100; index++) {
  const result = store.set(
    executeCommandAtom,
    updateNodeCommand("a", { x: index + 1 }),
  );
  expect(result.status === "applied", "move command applies");
}
expect(
  updates.graph === 100 &&
    updates.revision === 100 &&
    updates.history === 100 &&
    updates.future === 100,
  "eager subscriptions notify for every edit in the comparison workload",
);
expect(
  Object.entries(updates)
    .filter(
      ([key]) => !["graph", "revision", "history", "future"].includes(key),
    )
    .every(([, count]) => count === 0),
  "idle chrome, starter, screenshot, and hints receive no irrelevant edit notifications",
);
console.log(`100 moves: ${JSON.stringify(updates)}`);

for (const panel of ["app", "starter", "shortcuts"] as const) {
  expect(
    store.get(createChromeGraphAtom(panel)) === null,
    `${panel} panel does not subscribe to a nonempty graph`,
  );
}
for (const panel of ["layouts", "settings", "menu", "export", "png"] as const) {
  const panelGraph = createChromeGraphAtom(panel);
  let panelUpdates = 0;
  const unsubscribe = store.sub(panelGraph, () => panelUpdates++);
  store.set(executeCommandAtom, updateNodeCommand("a", { label: panel }));
  expect(panelUpdates === 1, `${panel} panel receives graph changes`);
  expect(
    store.get(panelGraph) === store.get(graphAtom),
    `${panel} panel reads the latest graph when opened or closing`,
  );
  unsubscribe();
}

store.set(executeCommandAtom, updateSettingsCommand({ weighted: true }));
expect(updates.settings === 1, "starter options receive setting changes");
expect(store.get(canUndoAtom), "undo becomes available after edits");
store.set(undoAtom);
expect(store.get(canRedoAtom), "redo becomes available after undo");
store.set(redoAtom);
expect(!store.get(canRedoAtom), "redo becomes unavailable after redo");

store.set(selectionAtom, { nodeIds: ["a"], edgeIds: [] });
store.set(selectionAtom, { nodeIds: ["b"], edgeIds: [] });
expect(updates.selection === 1, "hints subscribe to selection existence");
store.set(selectionAtom, { nodeIds: [], edgeIds: [] });
expect(updates.selection === 2, "hints detect cleared selection");

store.set(edgeDraftAtom, { sourceNodeId: "a" });
expect(
  store.get(edgeDraftSourceLabelAtom) === "png",
  "edge hints show the current source label",
);
const labelBeforeMove = store.get(edgeDraftSourceLabelAtom);
const sourceUpdates = updates.source;
store.set(syncExternalGraphAtom, {
  ...store.get(graphAtom),
  nodes: store.get(graphAtom).nodes.map((node) => ({ ...node, x: node.x + 1 })),
});
expect(
  updates.source === sourceUpdates &&
    store.get(edgeDraftSourceLabelAtom) === labelBeforeMove,
  "edge hints ignore source position changes",
);
store.set(syncExternalGraphAtom, {
  ...store.get(graphAtom),
  nodes: store
    .get(graphAtom)
    .nodes.map((node) => (node.id === "a" ? { ...node, label: "" } : node)),
});
expect(
  store.get(edgeDraftSourceLabelAtom) === "",
  "an empty source label still denotes an existing source",
);
store.set(edgeDraftAtom, { sourceNodeId: "missing" });
expect(
  store.get(edgeDraftSourceLabelAtom) === null,
  "missing source nodes are absent",
);

store.set(executeCommandAtom, replaceModelCommand(createEmptyGraphModel()));
expect(
  store.get(idleChromeGraph) === store.get(graphAtom) &&
    store.get(graphIsEmptyAtom),
  "empty state receives the graph after clearing",
);
store.set(executeCommandAtom, updateSettingsCommand({ directed: true }));
expect(
  store.get(idleChromeGraph)?.settings.directed === true,
  "empty state samples receive current settings",
);
for (const unsubscribe of unsubscribers) unsubscribe();
finish();
