import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createStore } from "jotai/vanilla";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  parseGraphModelJson,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import { isGraphCoordinate } from "../../features/graph-editor/core/graph/graph-coordinates";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  createManualLayoutCommand,
  layoutDefinitions,
  manualLayoutDisabledReasonCode,
} from "../../features/graph-editor/layouts";
import {
  graphAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import { selectionAtom } from "../../features/graph-editor/shell/state/editor-atoms";
import { nudgeSelectedNodesAtom } from "../../features/graph-editor/shell/state/editor-shortcut-actions";
import {
  executeCommandAtom,
  historyAtom,
  undoAtom,
  redoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { RUST_KERNEL_URL } from "../../features/graph-editor/compute/kernel-asset";
import {
  initializeRustKernelFromBytes,
  resetRustKernelForTests,
} from "../../features/graph-editor/compute/rust-kernel";
import { computeLayoutInWorker } from "../../features/graph-editor/compute/worker-client";
import {
  installRealComputeWorkers,
  bounded,
} from "../fixtures/real-compute-workers";
import {
  binaryTreePositions,
  withNodePositions,
} from "../../features/graph-editor/samples/basic-samples";

const ids = [
  "__proto__",
  "constructor",
  "toString",
  "hasOwnProperty",
  "__defineGetter__",
  "ordinary",
  "頂点",
];
const model: GraphModel = {
  ...createEmptyGraphModel(),
  nodes: ids.map((id, order) => ({
    id,
    order,
    label: String(order),
    x: order * 120,
    y: 0,
  })),

  edges: [
    [0, 1],
    [0, 2],
    [3, 4],
    [4, 5],
  ].map(([source, target], index) => ({
    id: `e${index}`,
    source: ids[source!]!,
    target: ids[target!]!,
  })),
  settings: { ...createEmptyGraphModel().settings, directed: true },
};
const input = serializeGraphModel(model);
assert.deepEqual(parseGraphModelJson(input), model);
const samplePositions = binaryTreePositions(ids);
assert.deepEqual(new Set(Object.keys(samplePositions)), new Set(ids));
assert(
  parseGraphModelJson(
    serializeGraphModel(withNodePositions(model, samplePositions)),
  ),
);
const partialSample = withNodePositions(model, { ordinary: { x: 12, y: 24 } });
assert.deepEqual(
  partialSample.nodes,
  model.nodes.map((node) =>
    node.id === "ordinary" ? { ...node, x: 12, y: 24 } : node,
  ),
);

const store = createStore();
store.set(syncExternalGraphAtom, model);
for (const id of ids) {
  const before = store.get(graphAtom);
  const moved = before.nodes.find((node) => node.id === id)!;
  const after = Object.fromEntries([[id, { x: moved.x + 1, y: moved.y + 2 }]]);
  assert.equal(
    store.set(executeCommandAtom, {
      type: "move-nodes",
      label: "Move one",
      after,
    }).status,
    "applied",
  );
  assert.deepEqual(
    store.get(graphAtom).nodes,
    before.nodes.map((node) =>
      node.id === id ? { ...node, x: moved.x + 1, y: moved.y + 2 } : node,
    ),
  );
  const committed = serializeGraphModel(store.get(graphAtom));
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), before);
  store.set(redoAtom);
  assert.equal(serializeGraphModel(store.get(graphAtom)), committed);
}
const beforeInherited = store.get(graphAtom);
const historyBeforeInherited = store.get(historyAtom);
const inherited = Object.create(
  Object.fromEntries(ids.map((id) => [id, { x: 900, y: 900 }])),
) as Record<string, { x: number; y: number }>;
assert.equal(
  store.set(executeCommandAtom, {
    type: "move-nodes",
    label: "Inherited positions",
    after: inherited,
  }).status,
  "noop",
);
assert.equal(store.get(graphAtom), beforeInherited);
assert.equal(store.get(historyAtom), historyBeforeInherited);
store.set(selectionAtom, { nodeIds: ids, edgeIds: [] });
assert(store.set(nudgeSelectedNodesAtom, { dx: 12, dy: -6 }));
assert.deepEqual(
  store.get(graphAtom).nodes,
  beforeInherited.nodes.map((node) => ({
    ...node,
    x: node.x + 12,
    y: node.y - 6,
  })),
);

function verifyLayouts(engine: string) {
  for (const { kind } of layoutDefinitions) {
    assert.equal(manualLayoutDisabledReasonCode(kind, model), null, kind);
    const command = createManualLayoutCommand(model, kind, "__proto__");
    assert.equal(command.type, "move-nodes");
    assert.deepEqual(
      new Set(Object.keys(command.after)),
      new Set(ids),
      `${engine}/${kind}: every ID has its own position`,
    );
    for (const id of ids) {
      assert(Object.hasOwn(command.after, id));
      assert(
        isGraphCoordinate(command.after[id]!.x) &&
          isGraphCoordinate(command.after[id]!.y),
      );
    }
    const layoutStore = createStore();
    layoutStore.set(syncExternalGraphAtom, model);
    assert.notEqual(
      layoutStore.set(executeCommandAtom, command).status,
      "rejected",
    );
    assert(
      parseGraphModelJson(serializeGraphModel(layoutStore.get(graphAtom))),
    );
    assert.equal(
      serializeGraphModel(model),
      input,
      "layout preserves its input",
    );
  }
}
resetRustKernelForTests();
verifyLayouts("JS");
await initializeRustKernelFromBytes(readFileSync(`public${RUST_KERNEL_URL}`));
verifyLayouts("Rust");
resetRustKernelForTests();

const workers = installRealComputeWorkers();
try {
  const results = await Promise.all(
    (["force", "tree", "bfs", "radial"] as const).map((layout) =>
      bounded(computeLayoutInWorker(model, layout, "__proto__"), layout),
    ),
  );
  for (const result of results) {
    assert(result && result.type === "move-nodes");
    assert.deepEqual(new Set(Object.keys(result.after)), new Set(ids));
    for (const id of ids) assert(Object.hasOwn(result.after, id));
  }
} finally {
  workers.restore();
}
assert.equal(serializeGraphModel(model), input);
console.log(
  "Node ID contracts passed (partial move, inherited properties, nudge, Undo/Redo, all 12 JS/Rust layouts and real Worker transport)",
);
