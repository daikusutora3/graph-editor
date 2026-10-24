import assert from "node:assert/strict";
import { mock } from "bun:test";
import { createStore } from "jotai/vanilla";

import { createGraphNodeAtPosition } from "../../features/graph-editor/canvas/graph-canvas-node-creation";
import { resolveEdgeCreation } from "../../features/graph-editor/canvas/graph-canvas-edge-creation";
import { addEdgeCommand } from "../../features/graph-editor/core/graph/graph-intents";
import { messagesByLocale } from "../../features/graph-editor/i18n/messages";
import {
  edgeDraftAtom,
  selectionAtom,
} from "../../features/graph-editor/shell/state/editor-atoms";
import { resolveGraphEditorShortcut } from "../../features/graph-editor/shell/state/editor-shortcuts";
import { graphAtom } from "../../features/graph-editor/shell/state/graph-atoms";
import { executeCommandAtom } from "../../features/graph-editor/shell/state/history-atoms";

const provider = new URL(
  "../../features/graph-editor/i18n/I18nProvider.tsx",
  import.meta.url,
).pathname;
mock.module(provider, () => ({
  useI18n: () => ({ messages: messagesByLocale.en }),
}));
const { EdgeNodeHitboxes } =
  await import("../../features/graph-editor/canvas/GraphCanvasHitboxOverlays.tsx");

for (const key of ["Enter", " "]) {
  const store = createStore();
  const execute = (command) => store.set(executeCommandAtom, command);
  const first = createGraphNodeAtPosition(execute, { x: 0, y: 0 });
  const second = createGraphNodeAtPosition(execute, { x: 72, y: 0 });
  assert(first && second);
  store.set(selectionAtom, { nodeIds: [second.id], edgeIds: [] });
  let inlineEdits = 0;
  const windowShortcut = (event) => {
    if (
      resolveGraphEditorShortcut(event)?.type === "edit-selection" &&
      store.get(selectionAtom).nodeIds.length === 1
    ) {
      inlineEdits += 1;
      event.preventDefault();
    }
  };
  const onConnect = (nodeId, continueFromTarget) => {
    const result = resolveEdgeCreation({
      model: store.get(graphAtom),
      draft: store.get(edgeDraftAtom),
      targetNodeId: nodeId,
      continueFromTarget,
    });
    if (result.kind === "create-edge")
      execute(
        addEdgeCommand({
          id: "keyboard-edge",
          source: result.source,
          target: result.target,
        }),
      );
    store.set(edgeDraftAtom, result.nextDraft);
  };
  const buttons = () =>
    EdgeNodeHitboxes.type({
      nodes: store.get(graphAtom).nodes.map((node) => ({ ...node, width: 72 })),
      sourceNodeId: store.get(edgeDraftAtom).sourceNodeId,
      onConnect,
      onContextMenu() {},
      onPointerEnter() {},
      onPointerLeave() {},
    }).props.children;

  for (const [index, id] of [
    [0, first.id],
    [1, second.id],
  ]) {
    const button = buttons()[index];
    const event = {
      key,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
      shiftKey: false,
      isComposing: false,
      defaultPrevented: false,
      propagationStopped: false,
      preventDefault() {
        this.defaultPrevented = true;
      },
      stopPropagation() {
        this.propagationStopped = true;
      },
    };
    button.props.onKeyDown(event);
    if (!event.propagationStopped) windowShortcut(event);
    assert(
      !event.defaultPrevented,
      `${key}: preserves native button activation`,
    );
    button.props.onClick(event);
    if (index === 0)
      assert.equal(
        store.get(edgeDraftAtom).sourceNodeId,
        id,
        `${key}: activates the focused source node despite an older selected node`,
      );
  }
  assert.equal(
    inlineEdits,
    0,
    `${key}: node hitboxes do not open selection editing`,
  );
  assert.equal(store.get(graphAtom).edges.length, 1);
  assert.equal(store.get(graphAtom).edges[0].source, first.id);
  assert.equal(store.get(graphAtom).edges[0].target, second.id);
}

console.log(
  "Edge native activation passed (selected node, Enter/Space, source selection and keyboard edge creation)",
);
