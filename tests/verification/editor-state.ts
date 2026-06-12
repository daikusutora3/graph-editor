import { createStore } from "jotai/vanilla";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  addNodeCommand,
  updateSettingsCommand,
} from "../../features/graph-editor/core/graph/graph-intents";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  resolveEdgeSelection,
  resolveNodeSelection,
} from "../../features/graph-editor/shell/state/editor-selection";
import {
  applyManualLayoutAtom,
  clearGraphAtom,
  replaceGraphModelAtom,
  resetEditorSessionAtom,
  reverseAllDirectedEdgesAtom,
  setEditorModeAtom,
} from "../../features/graph-editor/shell/state/editor-actions";
import {
  copyGraphSelectionAtom,
  cutGraphSelectionAtom,
  cycleSelectionColorAtom,
  nudgeSelectedNodesAtom,
  pasteGraphClipboardAtom,
  selectAllGraphAtom,
} from "../../features/graph-editor/shell/state/editor-shortcut-actions";
import {
  resolveGraphEditorShortcut,
  shouldPreventDefaultForGraphEditorShortcut,
} from "../../features/graph-editor/shell/state/editor-shortcuts";
import { isMacShortcutPlatformValue } from "../../features/graph-editor/ui/ModeToolbar";
import {
  edgeDraftAtom,
  editorModeAtom,
  graphClipboardAtom,
  graphPasteCountAtom,
  selectionAtom,
} from "../../features/graph-editor/shell/state/editor-atoms";
import { createEmptyEdgeDraft } from "../../features/graph-editor/shell/state/editor-state";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  executeCommandAtom,
  futureAtom,
  historyAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Editor state");

const store = createStore();
const model = graphFixture();

store.set(selectionAtom, { nodeIds: ["a"], edgeIds: ["ab"] });
store.set(edgeDraftAtom, { sourceNodeId: "a" });
store.set(editorModeAtom, "edge");
store.set(replaceGraphModelAtom, model, {
  clearEdgeDraft: true,
  clearSelection: true,
  selectMode: true,
});

expect(
  store.get(graphAtom).nodes.length === 2,
  "replace action should set graph",
);
expect(
  store.get(editorModeAtom) === "select",
  "replace action should restore select mode",
);
expect(
  store.get(selectionAtom).nodeIds.length === 0 &&
    store.get(selectionAtom).edgeIds.length === 0,
  "replace action should clear selection",
);
expect(
  store.get(edgeDraftAtom).sourceNodeId == null,
  "replace action should clear edge draft",
);

store.set(setEditorModeAtom, "node");
expect(store.get(editorModeAtom) === "node", "mode action should set mode");

store.set(applyManualLayoutAtom, "line");
expect(
  store.get(graphAtom).nodes.some((node) => node.x !== 0),
  "layout action should move nodes",
);

store.set(clearGraphAtom);
expect(
  store.get(graphAtom).nodes.length === 0,
  "clear action should clear graph",
);
expect(
  store.get(editorModeAtom) === "select",
  "clear action should restore select mode",
);

store.set(syncExternalGraphAtom, model);
store.set(executeCommandAtom, addNodeCommand({ id: "c", x: 240, y: 0 }));
expect(store.get(historyAtom).length > 0, "command should create history");
store.set(selectionAtom, { nodeIds: ["a"], edgeIds: [] });
store.set(edgeDraftAtom, { sourceNodeId: "a" });
store.set(editorModeAtom, "edge");
store.set(resetEditorSessionAtom);

expect(store.get(historyAtom).length === 0, "reset should clear history");
expect(store.get(futureAtom).length === 0, "reset should clear future");
expect(
  store.get(editorModeAtom) === "select",
  "reset should restore select mode",
);
expect(
  store.get(selectionAtom).nodeIds.length === 0 &&
    store.get(selectionAtom).edgeIds.length === 0,
  "reset should clear selection",
);
expect(
  JSON.stringify(store.get(edgeDraftAtom)) ===
    JSON.stringify(createEmptyEdgeDraft()),
  "reset should clear edge draft",
);

verifyShortcutResolver();
verifyShortcutPlatformLabels();
verifyShortcutPreventDefaultContract();
verifyCanvasSelectionActions();
verifyHistoryActions();
verifyIndexBaseRelabeling();
verifyReverseAllDirectedEdgesAction();
verifyShortcutActions();

finish();

function verifyShortcutResolver() {
  expect(
    resolveGraphEditorShortcut(shortcutEvent({ metaKey: true, key: "z" }))
      ?.type === "undo",
    "Cmd/Ctrl+Z should resolve undo",
  );
  expect(
    resolveGraphEditorShortcut(
      shortcutEvent({ metaKey: true, shiftKey: true, key: "z" }),
    )?.type === "redo",
    "Shift+Cmd/Ctrl+Z should resolve redo",
  );
  expect(
    resolveGraphEditorShortcut(shortcutEvent({ ctrlKey: true, key: "y" }))
      ?.type === "redo",
    "Ctrl+Y should resolve redo for Windows-style redo",
  );
  expect(
    resolveGraphEditorShortcut(shortcutEvent({ ctrlKey: true, key: "a" }))
      ?.type === "select-all",
    "Cmd/Ctrl+A should resolve select all",
  );
  expect(
    resolveGraphEditorShortcut(shortcutEvent({ key: "n" }))?.type ===
      "set-mode",
    "N should resolve mode change",
  );
  expect(
    JSON.stringify(
      resolveGraphEditorShortcut(
        shortcutEvent({ key: "ArrowRight", shiftKey: true }),
      ),
    ) === JSON.stringify({ type: "nudge-selection", dx: 10, dy: 0 }),
    "Shift+ArrowRight should resolve a 10px nudge",
  );
  expect(
    resolveGraphEditorShortcut(shortcutEvent({ metaKey: true, key: "q" })) ===
      null,
    "unknown modified keys should not resolve a shortcut",
  );
}

function verifyShortcutPlatformLabels() {
  expect(
    isMacShortcutPlatformValue("MacIntel", "Mozilla/5.0") &&
      !isMacShortcutPlatformValue("iPhone", "Mozilla/5.0") &&
      !isMacShortcutPlatformValue("MacIntel", "Mozilla/5.0 (iPad)") &&
      !isMacShortcutPlatformValue("Win32", "Mozilla/5.0"),
    "shortcut labels should use Mac symbols only for macOS, not iOS or Windows",
  );
}

function verifyShortcutPreventDefaultContract() {
  expect(
    shouldPreventDefaultForGraphEditorShortcut({ type: "undo" }, false) ===
      true,
    "undo shortcut should always prevent the browser default",
  );
  expect(
    shouldPreventDefaultForGraphEditorShortcut(
      { type: "copy-selection" },
      false,
    ) === false,
    "empty copy shortcut should not prevent the browser default",
  );
  expect(
    shouldPreventDefaultForGraphEditorShortcut(
      { type: "copy-selection" },
      true,
    ) === true,
    "handled copy shortcut should prevent the browser default",
  );
  expect(
    shouldPreventDefaultForGraphEditorShortcut(
      { type: "paste-clipboard" },
      true,
    ) === true,
    "consumed paste shortcut should prevent the browser default",
  );
  expect(
    shouldPreventDefaultForGraphEditorShortcut(
      { type: "set-mode", mode: "node" },
      true,
    ) === false,
    "mode shortcuts should preserve the current non-preventing behavior",
  );
  expect(
    shouldPreventDefaultForGraphEditorShortcut(
      { type: "clear-interaction" },
      true,
    ) === false,
    "Escape shortcut should preserve the current non-preventing behavior",
  );
  expect(
    shouldPreventDefaultForGraphEditorShortcut(
      { type: "delete-selection" },
      true,
    ) === false,
    "delete shortcut should preserve the current non-preventing behavior",
  );
  expect(
    shouldPreventDefaultForGraphEditorShortcut(
      { type: "nudge-selection", dx: 1, dy: 0 },
      true,
    ) === true,
    "handled nudge shortcut should prevent the browser default",
  );
}

function verifyCanvasSelectionActions() {
  expect(
    JSON.stringify(
      resolveNodeSelection({ nodeIds: ["a"], edgeIds: ["ab"] }, "b", false),
    ) === JSON.stringify({ nodeIds: ["b"], edgeIds: [] }),
    "plain node click should replace the current selection",
  );
  expect(
    JSON.stringify(
      resolveNodeSelection({ nodeIds: ["a"], edgeIds: ["ab"] }, "b", true),
    ) === JSON.stringify({ nodeIds: ["a", "b"], edgeIds: ["ab"] }),
    "Shift+node click should add the node and preserve edge selection",
  );
  expect(
    JSON.stringify(
      resolveNodeSelection({ nodeIds: ["a", "b"], edgeIds: ["ab"] }, "b", true),
    ) === JSON.stringify({ nodeIds: ["a"], edgeIds: ["ab"] }),
    "Shift+node click should toggle an already selected node off",
  );
  expect(
    JSON.stringify(
      resolveEdgeSelection({ nodeIds: ["a"], edgeIds: ["ab"] }, "bc", false),
    ) === JSON.stringify({ nodeIds: [], edgeIds: ["bc"] }),
    "plain edge click should replace the current selection",
  );
  expect(
    JSON.stringify(
      resolveEdgeSelection({ nodeIds: ["a"], edgeIds: ["ab"] }, "bc", true),
    ) === JSON.stringify({ nodeIds: ["a"], edgeIds: ["ab", "bc"] }),
    "Shift+edge click should add the edge and preserve node selection",
  );
}

function verifyHistoryActions() {
  const historyStore = createStore();
  historyStore.set(syncExternalGraphAtom, graphFixture());
  historyStore.set(
    executeCommandAtom,
    addNodeCommand({ id: "c", x: 240, y: 0 }),
  );

  expect(
    historyStore.get(graphAtom).nodes.some((node) => node.id === "c"),
    "command should apply the forward graph change",
  );
  expect(
    historyStore.get(historyAtom).length === 1,
    "command should append one history entry",
  );

  historyStore.set(undoAtom);
  expect(
    !historyStore.get(graphAtom).nodes.some((node) => node.id === "c") &&
      historyStore.get(historyAtom).length === 0 &&
      historyStore.get(futureAtom).length === 1,
    "undo should apply the backward patch and move the entry to future",
  );

  historyStore.set(redoAtom);
  expect(
    historyStore.get(graphAtom).nodes.some((node) => node.id === "c") &&
      historyStore.get(historyAtom).length === 1 &&
      historyStore.get(futureAtom).length === 0,
    "redo should reapply the forward patch and restore history",
  );

  const staleUndoStore = createStore();
  staleUndoStore.set(syncExternalGraphAtom, graphFixture());
  staleUndoStore.set(
    executeCommandAtom,
    addNodeCommand({ id: "external-stale", x: 240, y: 0 }),
  );
  staleUndoStore.set(syncExternalGraphAtom, createEmptyGraphModel());
  staleUndoStore.set(undoAtom);

  expect(
    staleUndoStore.get(graphAtom).nodes.length === 0 &&
      staleUndoStore.get(historyAtom).length === 0 &&
      staleUndoStore.get(futureAtom).length === 0,
    "undo after external sync should clear stale history without replaying patches",
  );

  const staleRedoStore = createStore();
  staleRedoStore.set(syncExternalGraphAtom, graphFixture());
  staleRedoStore.set(
    executeCommandAtom,
    addNodeCommand({ id: "redo-stale", x: 240, y: 0 }),
  );
  staleRedoStore.set(undoAtom);
  staleRedoStore.set(syncExternalGraphAtom, createEmptyGraphModel());
  staleRedoStore.set(redoAtom);

  expect(
    staleRedoStore.get(graphAtom).nodes.length === 0 &&
      staleRedoStore.get(historyAtom).length === 0 &&
      staleRedoStore.get(futureAtom).length === 0,
    "redo after external sync should clear stale future without replaying patches",
  );

  const cappedHistoryStore = createStore();
  cappedHistoryStore.set(syncExternalGraphAtom, createEmptyGraphModel());
  for (let index = 0; index < 151; index += 1) {
    cappedHistoryStore.set(
      executeCommandAtom,
      addNodeCommand({ id: `n${index}`, x: index, y: 0 }),
    );
  }

  expect(
    cappedHistoryStore.get(historyAtom).length === 150,
    "history should keep the latest 150 entries",
  );
}

function verifyIndexBaseRelabeling() {
  const indexStore = createStore();
  indexStore.set(syncExternalGraphAtom, {
    ...graphFixture(),
    settings: {
      ...graphFixture().settings,
      indexBase: 0,
    },
    nodes: [
      { id: "a", label: "0", order: 0, x: 0, y: 0 },
      { id: "b", label: "2", order: 1, x: 120, y: 0 },
      { id: "c", label: "1", order: 2, x: 240, y: 0 },
      { id: "name", label: "root", order: 3, x: 360, y: 0 },
    ],
    edges: [],
  });

  indexStore.set(executeCommandAtom, updateSettingsCommand({ indexBase: 1 }));

  expect(
    indexStore
      .get(graphAtom)
      .nodes.map((node) => node.label)
      .join(",") === "1,3,2,root",
    "index-base changes should shift numeric labels and preserve non-numeric labels",
  );

  indexStore.set(executeCommandAtom, updateSettingsCommand({ indexBase: 0 }));

  expect(
    indexStore
      .get(graphAtom)
      .nodes.map((node) => node.label)
      .join(",") === "0,2,1,root",
    "index-base changes should round-trip manually reordered numeric labels",
  );
}

function verifyReverseAllDirectedEdgesAction() {
  const reverseStore = createStore();
  reverseStore.set(syncExternalGraphAtom, {
    ...graphFixture(),
    nodes: [
      ...graphFixture().nodes,
      { id: "c", label: "C", order: 2, x: 240, y: 0 },
    ],
    edges: [
      { id: "ab", source: "a", target: "b" },
      { id: "bc", source: "b", target: "c" },
      { id: "cc", source: "c", target: "c" },
    ],
  });

  expect(
    reverseStore.set(reverseAllDirectedEdgesAtom) === true,
    "reverse-all action should run for directed non-loop edges",
  );
  expect(
    reverseStore
      .get(graphAtom)
      .edges.map((edge) => `${edge.id}:${edge.source}->${edge.target}`)
      .join(",") === "ab:b->a,bc:c->b,cc:c->c",
    "reverse-all action should reverse directed edges and leave self-loops unchanged",
  );

  const undirectedStore = createStore();
  undirectedStore.set(syncExternalGraphAtom, {
    ...graphFixture(),
    settings: { ...graphFixture().settings, directed: false },
  });

  expect(
    undirectedStore.set(reverseAllDirectedEdgesAtom) === false,
    "reverse-all action should be disabled for undirected graphs",
  );
}

function verifyShortcutActions() {
  const shortcutStore = createStore();

  shortcutStore.set(syncExternalGraphAtom, graphFixture());
  shortcutStore.set(editorModeAtom, "edge");
  shortcutStore.set(edgeDraftAtom, { sourceNodeId: "a" });
  shortcutStore.set(selectAllGraphAtom);

  expect(
    shortcutStore.get(editorModeAtom) === "select",
    "select-all action should restore select mode",
  );
  expect(
    shortcutStore.get(selectionAtom).nodeIds.join(",") === "a,b" &&
      shortcutStore.get(selectionAtom).edgeIds.join(",") === "ab",
    "select-all action should select all graph elements",
  );
  expect(
    shortcutStore.get(edgeDraftAtom).sourceNodeId == null,
    "select-all action should clear edge draft",
  );

  shortcutStore.set(selectionAtom, { nodeIds: [], edgeIds: [] });
  shortcutStore.set(graphPasteCountAtom, 7);
  expect(
    shortcutStore.set(copyGraphSelectionAtom) === false,
    "copy action should return false when selection is empty",
  );
  expect(
    shortcutStore.get(graphPasteCountAtom) === 7,
    "empty copy should not reset paste count",
  );

  shortcutStore.set(selectionAtom, { nodeIds: ["a"], edgeIds: [] });
  expect(
    shortcutStore.set(copyGraphSelectionAtom) === true,
    "copy action should return true when selection has graph content",
  );
  expect(
    shortcutStore.get(graphClipboardAtom)?.nodes.length === 1,
    "copy action should store selected nodes",
  );
  expect(
    shortcutStore.get(graphPasteCountAtom) === 0,
    "copy action should reset paste count",
  );

  expect(
    shortcutStore.set(pasteGraphClipboardAtom) === true,
    "paste action should return true when clipboard can paste",
  );
  expect(
    shortcutStore.get(graphAtom).nodes.length === 3 &&
      shortcutStore.get(selectionAtom).nodeIds.length === 1 &&
      shortcutStore.get(graphPasteCountAtom) === 1,
    "paste action should add graph elements, select them, and increment paste count",
  );

  const pastedNode = shortcutStore.get(graphAtom).nodes.at(-1);
  expect(
    pastedNode?.x === 32 && pastedNode.y === 32,
    "first paste should offset copied nodes by 32px",
  );

  expect(
    shortcutStore.set(pasteGraphClipboardAtom) === true &&
      shortcutStore.get(graphPasteCountAtom) === 2,
    "second paste should increment paste count again",
  );
  expect(
    shortcutStore.get(graphAtom).nodes.at(-1)?.x === 64,
    "second paste should use the next paste offset",
  );

  const invalidPasteStore = createStore();
  invalidPasteStore.set(syncExternalGraphAtom, graphFixture());
  invalidPasteStore.set(selectionAtom, { nodeIds: [], edgeIds: ["ab"] });
  expect(
    invalidPasteStore.set(copyGraphSelectionAtom) === true,
    "edge-only copy should return true when the selected edge exists",
  );
  invalidPasteStore.set(
    syncExternalGraphAtom,
    createEmptyGraphModel({ directed: true }),
  );
  expect(
    invalidPasteStore.set(pasteGraphClipboardAtom) === true,
    "paste should consume the shortcut when clipboard exists but cannot create elements",
  );
  expect(
    invalidPasteStore.get(graphAtom).nodes.length === 0 &&
      invalidPasteStore.get(graphAtom).edges.length === 0 &&
      invalidPasteStore.get(graphPasteCountAtom) === 0,
    "invalid paste should leave graph and paste count unchanged",
  );

  shortcutStore.set(selectionAtom, { nodeIds: ["a"], edgeIds: ["ab"] });
  const historyBeforeColor = shortcutStore.get(historyAtom).length;
  expect(
    shortcutStore.set(cycleSelectionColorAtom) === true,
    "color cycle should return true with a selection",
  );
  expect(
    shortcutStore.get(graphAtom).nodes.find((node) => node.id === "a")
      ?.color === "white",
    "color cycle should update selected node color",
  );
  expect(
    shortcutStore.get(graphAtom).edges.find((edge) => edge.id === "ab")
      ?.color === "black",
    "color cycle should update selected edge color",
  );
  expect(
    shortcutStore.get(historyAtom).length === historyBeforeColor + 2,
    "color cycle should preserve the current two-command node-and-edge behavior",
  );

  shortcutStore.set(selectionAtom, { nodeIds: ["a"], edgeIds: [] });
  expect(
    shortcutStore.set(nudgeSelectedNodesAtom, { dx: 10, dy: -1 }) === true,
    "nudge should return true with selected nodes",
  );
  expect(
    shortcutStore.get(graphAtom).nodes.find((node) => node.id === "a")?.x ===
      10,
    "nudge should move selected nodes",
  );

  shortcutStore.set(selectionAtom, { nodeIds: ["a", "b"], edgeIds: [] });
  expect(
    shortcutStore.set(nudgeSelectedNodesAtom, { dx: 5, dy: 5 }) === true,
    "nudge should return true with multiple selected nodes",
  );
  expect(
    shortcutStore.get(graphAtom).nodes.find((node) => node.id === "a")?.x ===
      15 &&
      shortcutStore.get(graphAtom).nodes.find((node) => node.id === "b")?.x ===
        125,
    "nudge should move all selected nodes",
  );

  expect(
    shortcutStore.set(cycleSelectionColorAtom) === true,
    "color cycle should return true with multiple selected nodes",
  );
  expect(
    shortcutStore
      .get(graphAtom)
      .nodes.filter((node) => node.id === "a" || node.id === "b")
      .every((node) => node.color === "black"),
    "color cycle should update all selected nodes",
  );

  const cutStore = createStore();
  cutStore.set(syncExternalGraphAtom, graphFixture());
  cutStore.set(selectionAtom, { nodeIds: ["b"], edgeIds: [] });
  expect(
    cutStore.set(cutGraphSelectionAtom) === true,
    "cut should return true with selected graph content",
  );
  expect(
    cutStore
      .get(graphAtom)
      .nodes.map((node) => node.id)
      .join(",") === "a" && cutStore.get(graphAtom).edges.length === 0,
    "cut should copy then delete selected graph content",
  );

  const emptyStore = createStore();
  emptyStore.set(syncExternalGraphAtom, graphFixture());
  expect(
    emptyStore.set(pasteGraphClipboardAtom) === false,
    "paste should return false when clipboard is empty",
  );
  expect(
    emptyStore.set(cycleSelectionColorAtom) === false,
    "color cycle should return false with an empty selection",
  );
  expect(
    emptyStore.set(nudgeSelectedNodesAtom, { dx: 1, dy: 0 }) === false,
    "nudge should return false with an empty selection",
  );
  emptyStore.set(selectionAtom, { nodeIds: ["missing"], edgeIds: [] });
  const historyBeforeStaleNudge = emptyStore.get(historyAtom).length;
  expect(
    emptyStore.set(nudgeSelectedNodesAtom, { dx: 1, dy: 0 }) === true,
    "nudge should consume the shortcut when selection contains stale node ids",
  );
  expect(
    emptyStore.get(historyAtom).length === historyBeforeStaleNudge,
    "stale nudge should not create history",
  );
}

function graphFixture(): GraphModel {
  return {
    ...createEmptyGraphModel({ directed: true }),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 120, y: 0 },
    ],
    edges: [{ id: "ab", source: "a", target: "b" }],
  };
}

function shortcutEvent({
  ctrlKey = false,
  key,
  metaKey = false,
  shiftKey = false,
}: {
  ctrlKey?: boolean;
  key: string;
  metaKey?: boolean;
  shiftKey?: boolean;
}) {
  return { ctrlKey, key, metaKey, shiftKey };
}
