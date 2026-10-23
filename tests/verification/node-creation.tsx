import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";

import {
  createGraphNodeAtPosition,
  findNodeCreationPosition,
} from "../../features/graph-editor/canvas/graph-canvas-node-creation";
import { GRAPH_MAX_ABS_COORDINATE } from "../../features/graph-editor/core/graph/graph-coordinates";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { replaceModelCommand } from "../../features/graph-editor/core/graph/graph-intents";
import { estimateNodeWidth } from "../../features/graph-editor/core/graph/node-size";
import {
  parseGraphModelJson,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import { graphAtom } from "../../features/graph-editor/shell/state/graph-atoms";
import {
  clearHistoryAtom,
  executeCommandAtom,
  historyAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";

const desktop = { width: 1200, height: 800, pan: { x: 600, y: 408 }, zoom: 1 };
const empty = createEmptyGraphModel();
assert.deepEqual(
  findNodeCreationPosition(empty, desktop, { layout: "desktop" }),
  { x: 0, y: 0 },
);
for (const layout of ["mobile", "compact", "desktop"] as const) {
  const viewport = {
    width: 390,
    height: 844,
    pan: { x: -130, y: 240 },
    zoom: 0.75,
  };
  const position = findNodeCreationPosition(empty, viewport, { layout });
  assert(position);
  assert.equal(position.x * viewport.zoom + viewport.pan.x, 195);
  assert.equal(
    position.y * viewport.zoom + viewport.pan.y,
    layout === "mobile" ? 382 : 430,
  );
}

// The camera pan already includes Cytoscape's local-coordinate origin. A
// distant graph must receive nearby domain coordinates, not a node at zero.
for (const direction of [-1, 1]) {
  const domainCenter = direction * (GRAPH_MAX_ABS_COORDINATE - 1000);
  const viewport = {
    ...desktop,
    zoom: 0.75,
    pan: { x: 600 - domainCenter * 0.75, y: 408 - domainCenter * 0.75 },
  };
  assert.deepEqual(
    findNodeCreationPosition(empty, viewport, { layout: "desktop" }),
    { x: domainCenter, y: domainCenter },
  );
}

const store = createStore();
const execute = (command: Parameters<typeof executeCommandAtom.write>[2]) =>
  store.set(executeCommandAtom, command);
const created = [];
for (let index = 0; index < 20; index += 1) {
  const before = store.get(graphAtom);
  const position = findNodeCreationPosition(before, desktop, {
    layout: "desktop",
  });
  assert(position);
  const node = createGraphNodeAtPosition(execute, position);
  assert(node);
  assert.equal(node.label, String(index));
  assert.equal(store.get(historyAtom).length, index + 1);
  for (const previous of created)
    assert(
      Math.abs(node.x - previous.x) >= 60 ||
        Math.abs(node.y - previous.y) >= 60,
      "repeated activation keeps new nodes separate",
    );
  assert(node.x + desktop.pan.x >= 52 && node.x + desktop.pan.x <= 1148);
  assert(node.y + desktop.pan.y >= 112 && node.y + desktop.pan.y <= 704);
  assert.equal(
    before.nodes.length,
    index,
    "placement does not mutate earlier graph snapshots",
  );
  created.push(node);
}
const after = store.get(graphAtom);
const restored = parseGraphModelJson(serializeGraphModel(after));
assert.deepEqual(
  restored,
  after,
  "new positions survive the graph persistence format",
);
store.set(undoAtom);
assert.equal(
  store.get(graphAtom).nodes.length,
  19,
  "one undo removes one created node",
);
store.set(redoAtom);
assert.deepEqual(
  store.get(graphAtom),
  after,
  "redo restores the same ID and position",
);

// Wide pills must reserve their label width, not just their 48px height.
const wide = {
  ...empty,
  nodes: [
    {
      id: "wide",
      label: "A very wide existing node label",
      order: 0,
      x: 0,
      y: 0,
    },
  ],
};
const aroundWide = findNodeCreationPosition(wide, desktop, {
  layout: "desktop",
});
assert(aroundWide);
assert(Math.abs(aroundWide.y) >= 60 || Math.abs(aroundWide.x) > 160);

// Short mobile view: the old symmetric whole-step grid repeated the center
// from the fourth activation, despite space near the top and bottom bounds.
const smallStore = createStore();
const smallViewport = {
  width: 320,
  height: 390,
  zoom: 1,
  pan: { x: 0, y: 0 },
};
for (let index = 0; index < 11; index += 1) {
  const graph = smallStore.get(graphAtom);
  const position = findNodeCreationPosition(graph, smallViewport, {
    layout: "mobile",
  });
  assert(position);
  const node = createGraphNodeAtPosition(
    (command) => smallStore.set(executeCommandAtom, command),
    position,
  );
  assert(node);
  const halfWidth = estimateNodeWidth(node.label) / 2;
  assert(node.x >= 12 + halfWidth + 12);
  assert(node.x <= 320 - 12 - halfWidth - 12);
  assert(
    node.y >= 100 && node.y <= 210,
    "placement keeps the toolbar and creation action clear",
  );
  for (const previous of graph.nodes) {
    const segmentGap = Math.max(
      0,
      Math.abs(node.x - previous.x) -
        (halfWidth - 24) -
        (estimateNodeWidth(previous.label) / 2 - 24),
    );
    assert(
      Math.hypot(segmentGap, node.y - previous.y) >= 60,
      `short mobile activation ${index + 1} preserves pill clearance`,
    );
  }
}

assert(
  findNodeCreationPosition(
    empty,
    { ...desktop, width: 1_000_000, height: 1_000_000 },
    { layout: "desktop" },
  ),
  "very large finite viewport sizes keep a bounded candidate search",
);

// The CSS node diameter is in rem. Preferred font enlargement therefore
// changes the real geometry, including the creation action's wrapped height.
const enlarged = createEmptyGraphModel();
for (let index = 0; index < 3; index += 1) {
  const position = findNodeCreationPosition(
    enlarged,
    smallViewport,
    { layout: "mobile" },
    { nodeSize: 72, newNodeWidth: 72, actionHeight: 44 },
  );
  assert(position);
  assert(position.x >= 60 && position.x <= 260);
  assert(position.y >= 112 && position.y <= 198);
  for (const previous of enlarged.nodes)
    assert(
      Math.hypot(position.x - previous.x, position.y - previous.y) >= 84,
      "enlarged round nodes keep their actual diameter plus clearance",
    );
  enlarged.nodes.push({
    id: `large-${index}`,
    label: String(index),
    order: index,
    ...position,
  });
}
const wrappedActionPosition = findNodeCreationPosition(
  empty,
  { ...smallViewport, height: 600 },
  { layout: "mobile" },
  { nodeSize: 72, newNodeWidth: 72, actionHeight: 96 },
);
assert(wrappedActionPosition);
assert(
  wrappedActionPosition.y + 36 + 12 <= 600 - 88 - 96 - 12,
  "wrapped action height remains outside the node placement region",
);

// A view too small for a complete node must not add it behind the chrome.
assert.equal(
  findNodeCreationPosition(
    after,
    { ...desktop, width: 80, height: 80 },
    { layout: "mobile" },
  ),
  null,
);
for (const viewport of [
  { ...desktop, width: 0 },
  { ...desktop, height: NaN },
  { ...desktop, zoom: 0 },
  { ...desktop, pan: { x: Infinity, y: 0 } },
  { ...desktop, pan: { x: -GRAPH_MAX_ABS_COORDINATE * 2, y: 0 } },
])
  assert.equal(
    findNodeCreationPosition(empty, viewport, { layout: "desktop" }),
    null,
  );

const limitModel = {
  ...empty,
  nodes: Array.from({ length: 1000 }, (_, index) => ({
    id: `limit-${index}`,
    label: String(index),
    order: index,
    x: 0,
    y: 0,
  })),
};
store.set(executeCommandAtom, replaceModelCommand(limitModel));
store.set(clearHistoryAtom);
assert.equal(
  createGraphNodeAtPosition(execute, { x: 0, y: 0 }),
  null,
  "creation respects the existing graph limits",
);
assert.equal(store.get(graphAtom), limitModel);
assert.equal(
  store.get(historyAtom).length,
  0,
  "rejected placement adds no undo entry",
);

console.log(
  "Node creation passed (viewport transforms, repeated placement, wide labels, limits, persistence and undo/redo)",
);
