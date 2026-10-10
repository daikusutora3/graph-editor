import { isDeepStrictEqual } from "node:util";
import { createStore } from "jotai/vanilla";

import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { updateNodeCommand } from "../../features/graph-editor/core/graph/graph-intents";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import {
  applyGraphPatch,
  prepareGraphPatch,
} from "../../features/graph-editor/core/graph/graph-patch";
import type {
  GraphModel,
  GraphPatch,
} from "../../features/graph-editor/core/graph/model";
import {
  createGraphClipboardPayload,
  createPasteGraphCommand,
} from "../../features/graph-editor/io/clipboard";
import {
  graphClipboardAtom,
  selectionAtom,
} from "../../features/graph-editor/shell/state/editor-atoms";
import {
  copyGraphSelectionAtom,
  cutGraphSelectionAtom,
  pasteGraphClipboardAtom,
} from "../../features/graph-editor/shell/state/editor-shortcut-actions";
import {
  graphAtom,
  graphRevisionAtom,
  syncExternalGraphAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  executeCommandAtom,
  historyAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import {
  acceptStorageBaseline,
  cancelScheduledStoredGraphWrite,
  flushStoredGraphWrite,
  getStorageSnapshot,
  uninstallStorageFlushListeners,
} from "../../features/graph-editor/adapters/browser/stored-graph";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("History and clipboard");
const graph: GraphModel = {
  ...createEmptyGraphModel(),
  nodes: [
    { id: "a", label: "0", order: 0, x: 0, y: 0 },
    { id: "b", label: "1", order: 1, x: 100, y: 0 },
  ],
  edges: [{ id: "ab", source: "a", target: "b", label: "edge" }],
};
const nodePatch = {
  nodes: { put: [{ ...graph.nodes[0]!, label: "Changed" }] },
};
const prepared = prepareGraphPatch(graph, nodePatch);
expect(
  prepared.after.edges === graph.edges &&
    prepared.after.settings === graph.settings &&
    prepared.serialized === serializeGraphModel(prepared.after) &&
    isDeepStrictEqual(prepared.after, applyGraphPatch(graph, nodePatch)),
  "prepared node patch retains untouched edges and exactly the validated save document",
);
const edgeOnly = applyGraphPatch(graph, {
  edges: { put: [{ ...graph.edges[0]!, label: "Changed edge" }] },
});
expect(
  edgeOnly.nodes === graph.nodes,
  "edge-only patch preserves node identity",
);
for (const patch of [{}, { settings: { ...graph.settings, directed: true } }]) {
  const result = prepareGraphPatch(graph, patch);
  expect(
    result.after.nodes === graph.nodes && result.after.edges === graph.edges,
    "absent node and edge sections preserve both collection identities",
  );
}
expect(
  isDeepStrictEqual(
    applyGraphPatch(graph, { nodes: { order: ["b", "a"] } }).nodes,
    [graph.nodes[1], graph.nodes[0]],
  ),
  "explicit patch order still reorders IDs",
);
const inserted = { id: "c", label: "C", order: 2, x: 200, y: 0 };
expect(
  isDeepStrictEqual(
    applyGraphPatch(graph, {
      nodes: { remove: ["a"], put: [inserted], order: ["c", "b"] },
      edges: { remove: ["ab"] },
    }).nodes,
    [inserted, graph.nodes[1]],
  ),
  "remove, insert and explicit ordering retain their existing semantics",
);
for (const patch of [
  { nodes: { remove: ["a"] } },
  { nodes: { put: [{ ...graph.nodes[1]!, order: 0 }] } },
  { nodes: { put: [{ ...graph.nodes[0]!, x: Infinity }] } },
  { nodes: { put: [{ ...graph.nodes[0]!, label: "x".repeat(257) }] } },
  { nodes: { order: ["a", "a", "b"] } },
  { edges: { put: [{ id: "a", source: "a", target: "b" }] } },
] satisfies GraphPatch[]) {
  let rejected = false;
  try {
    prepareGraphPatch(graph, patch);
  } catch {
    rejected = true;
  }
  expect(rejected, "prepared patches still reject invalid restored models");
}

const sparse: GraphModel = {
  ...createEmptyGraphModel({ indexBase: 0 }),
  nodes: [1, 3, 7, 9].map((order) => ({
    id: `existing${order}`,
    label: String(order),
    order,
    x: 0,
    y: 0,
  })),
};
const copiedNodes = Array.from({ length: 6 }, (_, order) => ({
  id: `copy${order}`,
  label: order === 2 ? "custom" : String(order + 1),
  order,
  x: order * 12,
  y: order * -4,
}));
const sparsePaste = createPasteGraphCommand(
  sparse,
  {
    nodes: copiedNodes,
    edges: [
      {
        id: "copy-edge",
        source: "copy0",
        target: "copy5",
        weight: "7",
        label: "label",
        color: "blue",
        routing: { bowPx: 20, bowT: 0.4 },
      },
    ],
    indexBase: 1,
  },
  2,
);
if (sparsePaste?.command.type === "put-graph-elements") {
  const { nodes, edges } = sparsePaste.command;
  expect(
    isDeepStrictEqual(
      nodes.map((node) => node.order),
      [0, 2, 4, 5, 6, 8],
    ) &&
      isDeepStrictEqual(
        nodes.map((node) => node.label),
        ["0", "2", "custom", "5", "6", "8"],
      ),
    "sparse paste fills the smallest available orders and retains custom labels",
  );
  expect(
    nodes.every(
      (node, index) =>
        node.x === copiedNodes[index]!.x + 64 &&
        node.y === copiedNodes[index]!.y + 64,
    ) &&
      edges[0]?.source === nodes[0]?.id &&
      edges[0]?.target === nodes[5]?.id &&
      edges[0]?.weight === "7" &&
      edges[0]?.label === "label" &&
      edges[0]?.color === "blue" &&
      isDeepStrictEqual(edges[0]?.routing, { bowPx: 20, bowT: 0.4 }) &&
      isDeepStrictEqual(
        sparsePaste.selection.nodeIds,
        nodes.map((node) => node.id),
      ),
    "paste retains offsets, endpoint remapping, edge attributes and selection",
  );
} else expect(false, "sparse clipboard payload produces a paste command");
const dense: GraphModel = {
  ...createEmptyGraphModel({ indexBase: 1 }),
  nodes: Array.from({ length: 500 }, (_, order) => ({
    id: `dense${order}`,
    label: String(order + 1),
    order,
    x: 0,
    y: 0,
  })),
};
const densePaste = createPasteGraphCommand(
  dense,
  { nodes: dense.nodes, edges: [], indexBase: 1 },
  1,
);
expect(
  densePaste?.command.type === "put-graph-elements" &&
    densePaste.command.nodes.length === 500 &&
    densePaste.command.nodes.every(
      (node, index) =>
        node.order === 500 + index && node.label === String(501 + index),
    ),
  "dense paste assigns the next 500 orders and standard labels without changing output",
);

verifyMixedClipboard();

const originals = Object.fromEntries(
  ["window", "document", "navigator"].map((name) => [
    name,
    Object.getOwnPropertyDescriptor(globalThis, name),
  ]),
);
let raw: string | null = serializeGraphModel(graph);
let writes = 0;
let blocked = false;
let release: (() => void) | undefined;
Object.defineProperty(globalThis, "window", {
  configurable: true,
  value: {
    localStorage: {
      getItem: () => raw,
      setItem: (_key: string, next: string) => {
        raw = next;
        writes += 1;
      },
    },
    dispatchEvent() {},
    addEventListener() {},
    removeEventListener() {},
    setTimeout: () => 1,
    clearTimeout() {},
  },
});
Object.defineProperty(globalThis, "document", {
  configurable: true,
  value: { addEventListener() {}, removeEventListener() {} },
});
Object.defineProperty(globalThis, "navigator", {
  configurable: true,
  value: {
    locks: {
      request: async (_name: string, callback: () => void) => {
        if (blocked)
          await new Promise<void>((resolve) => {
            release = resolve;
          });
        callback();
      },
    },
  },
});
try {
  acceptStorageBaseline(raw);
  const store = createStore();
  store.set(syncExternalGraphAtom, graph);
  store.set(executeCommandAtom, updateNodeCommand("a", { label: "Edited" }));
  const edited = store.get(graphAtom);
  const revision = store.get(graphRevisionAtom);
  blocked = true;
  const staleWrite = flushStoredGraphWrite();
  store.set(undoAtom);
  expect(
    store.get(graphAtom).edges === graph.edges &&
      store.get(graphRevisionAtom) === revision - 1 &&
      isDeepStrictEqual(store.get(graphAtom), graph),
    "undo preserves untouched edges and restores graph and revision",
  );
  blocked = false;
  release!();
  await staleWrite;
  expect(
    writes === 0 && getStorageSnapshot().status === "pending",
    "queued write for superseded edit cannot overwrite an undo",
  );
  await flushStoredGraphWrite();
  expect(
    writes === 1 && raw === serializeGraphModel(graph),
    "undo saves its complete validated document",
  );
  store.set(redoAtom);
  expect(
    store.get(graphRevisionAtom) === revision &&
      isDeepStrictEqual(store.get(graphAtom), edited),
    "redo restores graph and revision",
  );
  await flushStoredGraphWrite();
  expect(
    writes === 2 && raw === serializeGraphModel(edited),
    "redo saves its complete validated document",
  );
  store.set(undoAtom);
  const external = serializeGraphModel({
    ...graph,
    settings: { ...graph.settings, directed: true },
  });
  raw = external;
  await flushStoredGraphWrite();
  expect(
    writes === 2 &&
      raw === external &&
      getStorageSnapshot().status === "conflict",
    "undo still respects a newer external storage document",
  );
} finally {
  cancelScheduledStoredGraphWrite();
  uninstallStorageFlushListeners();
  for (const [name, descriptor] of Object.entries(originals)) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else Reflect.deleteProperty(globalThis, name);
  }
}
finish();

function verifyMixedClipboard() {
  const original: GraphModel = {
    ...createEmptyGraphModel({ directed: true, weighted: true }),
    nodes: ["a", "b", "c", "d"].map((id, order) => ({
      id,
      label: String(order),
      order,
      x: order * 100,
      y: 0,
    })),
    edges: [
      { id: "ab", source: "a", target: "b", weight: "2" },
      {
        id: "bc",
        source: "b",
        target: "c",
        weight: "3",
        label: "boundary",
        color: "blue",
        routing: { bowPx: 40, bowT: 0.3 },
      },
      { id: "ca", source: "c", target: "a", weight: "4" },
      { id: "cd", source: "c", target: "d", weight: "5" },
    ],
  };
  const selection = { nodeIds: ["a", "b"], edgeIds: ["ab", "bc", "ca", "cd"] };
  const payload = createGraphClipboardPayload(original, selection);
  expect(
    payload !== null && isDeepStrictEqual(payload.edges, original.edges),
    "mixed copy retains explicit boundary and independent edges exactly once alongside internal edges",
  );
  expect(
    createGraphClipboardPayload(original, { nodeIds: ["a", "b"], edgeIds: [] })
      ?.edges.map((edge) => edge.id)
      .join(",") === "ab",
    "node-only copy still includes internal edges without adding unselected boundary edges",
  );

  for (const action of ["copy", "cut"] as const) {
    const store = createStore();
    store.set(syncExternalGraphAtom, original);
    store.set(selectionAtom, selection);
    expect(
      store.set(
        action === "cut" ? cutGraphSelectionAtom : copyGraphSelectionAtom,
      ),
      `${action} handles a mixed selection`,
    );
    expect(
      isDeepStrictEqual(store.get(graphClipboardAtom), payload),
      `${action} uses the complete mixed clipboard payload`,
    );
    const beforePaste = store.get(graphAtom);
    expect(store.set(pasteGraphClipboardAtom), `${action} selection can paste`);
    const pasted = store.get(graphAtom);
    const pastedSelection = store.get(selectionAtom);
    const [a, b] = pastedSelection.nodeIds;
    const edges = pasted.edges.filter((edge) =>
      pastedSelection.edgeIds.includes(edge.id),
    );
    expect(
      a !== undefined &&
        b !== undefined &&
        a !== "a" &&
        b !== "b" &&
        isDeepStrictEqual(
          edges.map((edge) => [edge.source, edge.target, edge.weight]),
          [
            [a, b, "2"],
            [b, "c", "3"],
            ["c", a, "4"],
            ["c", "d", "5"],
          ],
        ),
      `${action}/paste maps copied endpoints and retains both directions of boundary and independent edges`,
    );
    expect(
      edges[1]?.label === "boundary" &&
        edges[1]?.color === "blue" &&
        isDeepStrictEqual(edges[1]?.routing, { bowPx: 40, bowT: 0.3 }) &&
        store.get(historyAtom).length === (action === "cut" ? 2 : 1),
      `${action}/paste retains edge attributes and one history entry per edit`,
    );
    store.set(undoAtom);
    expect(
      isDeepStrictEqual(store.get(graphAtom), beforePaste),
      `${action}/paste undo restores its exact prior state`,
    );
    if (action === "cut") {
      store.set(undoAtom);
      expect(
        isDeepStrictEqual(store.get(graphAtom), original),
        "cut undo restores every selected node and edge",
      );
      store.set(redoAtom);
      expect(
        isDeepStrictEqual(store.get(graphAtom), beforePaste),
        "cut redo repeats the complete deletion",
      );
    }
    store.set(redoAtom);
    expect(
      isDeepStrictEqual(store.get(graphAtom), pasted),
      `${action}/paste redo restores all cloned IDs and edges`,
    );
  }

  const edgePayload = createGraphClipboardPayload(original, {
    nodeIds: [],
    edgeIds: ["bc"],
  });
  const edgePaste =
    edgePayload && createPasteGraphCommand(original, edgePayload, 1);
  expect(
    edgePaste?.command.type === "put-graph-elements" &&
      edgePaste.command.nodes.length === 0 &&
      edgePaste.command.edges[0]?.source === "b" &&
      edgePaste.command.edges[0]?.target === "c",
    "edge-only paste still references the existing endpoints",
  );
  if (edgePayload) {
    expect(
      createPasteGraphCommand(createEmptyGraphModel(), edgePayload, 1) === null,
      "edge-only paste cannot create an edge without existing endpoints",
    );
    expect(
      createPasteGraphCommand(
        {
          ...original,
          settings: { ...original.settings, allowMultiEdges: false },
        },
        edgePayload,
        1,
      ) === null,
      "edge-only paste continues to respect the parallel-edge constraint",
    );
  }
  if (payload) {
    const missingEndpoint = createPasteGraphCommand(
      {
        ...original,
        nodes: original.nodes.filter((node) => node.id !== "d"),
        edges: original.edges.filter((edge) => edge.id !== "cd"),
      },
      payload,
      1,
    );
    expect(
      missingEndpoint?.command.type === "put-graph-elements" &&
        missingEndpoint.command.nodes.length === 2 &&
        missingEndpoint.command.edges.length === 3 &&
        missingEndpoint.command.edges.every((edge) => edge.target !== "d"),
      "mixed paste preserves valid copied and existing endpoints while skipping an edge whose unselected endpoint disappeared",
    );
  }
}
