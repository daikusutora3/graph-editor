import assert from "node:assert/strict";
import { createStore } from "jotai/vanilla";

import {
  CYTOSCAPE_ID_ESCAPE_PREFIX,
  decodeCytoscapeId,
  encodeCytoscapeId,
  getCytoscapeElement,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-ids";
import {
  applyCytoscapeRoutingMeta,
  graphModelToCytoscapeElements,
  syncCytoscapeEdgeRoutingData,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { syncCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-elements-sync";
import { refreshCytoscapeGeometry } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-geometry-refresh";
import {
  readEdgeLabelHitboxes,
  readInlineEditPosition,
  readNodeHitboxes,
  readRenderedEdgeLabelPosition,
  readRenderedNodePosition,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";
import { createRenderedHitboxReader } from "../../features/graph-editor/adapters/cytoscape/rendered-hitbox-reader";
import { syncCytoscapeSelection } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-viewport";
import { readCytoscapeSelection } from "../../features/graph-editor/canvas/graph-canvas-interaction-events";
import { readRangeSelectionPreview } from "../../features/graph-editor/canvas/range-selection-preview-geometry";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  parseGraphModelJson,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import type {
  GraphIntent,
  GraphModel,
} from "../../features/graph-editor/core/graph/model";
import { computeEdgeRouting } from "../../features/graph-editor/core/layout/edge-routing";
import { graphAtom } from "../../features/graph-editor/shell/state/graph-atoms";
import { clearGraphAtom } from "../../features/graph-editor/shell/state/editor-actions";
import {
  executeCommandAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import { layoutGrid } from "../../features/graph-editor/layouts/layout-algorithms";
import { createCalculationCanvas } from "../fixtures/calculation-canvas";

verifyCodec();
verifyEveryPrototypeName();
verifyEditorLifecycle();
console.log(
  "Cytoscape ID verification passed (reserved IDs and prefix collisions retain domain identity through editing, routing, selection, deletion and history)",
);

function verifyCodec() {
  const ids = [
    ...Object.getOwnPropertyNames(Object.prototype),
    "normal",
    "a",
    "A:B",
    "日本語",
    "",
    "__proto__suffix",
    CYTOSCAPE_ID_ESCAPE_PREFIX,
    `${CYTOSCAPE_ID_ESCAPE_PREFIX}__proto__`,
    `${CYTOSCAPE_ID_ESCAPE_PREFIX}${CYTOSCAPE_ID_ESCAPE_PREFIX}constructor`,
  ];
  const encoded = ids.map(encodeCytoscapeId);
  assert.equal(
    new Set(encoded).size,
    ids.length,
    "distinct IDs never collide at the renderer boundary",
  );
  for (const [index, id] of ids.entries()) {
    assert.equal(
      decodeCytoscapeId(encoded[index]!),
      id,
      "one decode restores the exact domain ID",
    );
    if (
      !Object.hasOwn(Object.prototype, id) &&
      !id.startsWith(CYTOSCAPE_ID_ESCAPE_PREFIX)
    )
      assert.equal(encoded[index], id, "ordinary IDs are unchanged");
    assert.equal(
      Object.hasOwn(Object.prototype, encoded[index]!),
      false,
      "no encoded ID is a removal visited-set inherited key",
    );
  }
}

function verifyEveryPrototypeName() {
  const graph: GraphModel = {
    ...createEmptyGraphModel(),
    nodes: Object.getOwnPropertyNames(Object.prototype).map((id, index) => ({
      id,
      label: id,
      order: index,
      x: index * 100,
      y: 0,
    })),
    edges: [],
  };
  const { cy } = createCalculationCanvas(graph);
  try {
    for (const node of graph.nodes) {
      assert.equal(
        getCytoscapeElement(cy, node.id).id(),
        encodeCytoscapeId(node.id),
      );
      assert.equal(
        getCytoscapeElement(cy, node.id).remove().length,
        1,
        `${node.id} is removable by installed Cytoscape`,
      );
    }
    assert.equal(
      cy.elements().length,
      0,
      "every Object.prototype-name element was actually removed",
    );
  } finally {
    cy.destroy();
  }
}

function verifyEditorLifecycle() {
  const prefixNode = `${CYTOSCAPE_ID_ESCAPE_PREFIX}__proto__`;
  const prefixEdge = `${CYTOSCAPE_ID_ESCAPE_PREFIX}toString`;
  const saved: GraphModel = {
    ...createEmptyGraphModel({
      weighted: true,
      allowSelfLoops: true,
      allowMultiEdges: true,
    }),
    nodes: [
      { id: "__proto__", label: "A", order: 0, x: 0, y: 0 },
      { id: "constructor", label: "B", order: 1, x: 220, y: 60 },
      { id: prefixNode, label: "C", order: 2, x: 100, y: 220 },
    ],
    edges: [
      {
        id: "toString",
        source: "__proto__",
        target: "constructor",
        weight: "1",
      },
      {
        id: "hasOwnProperty",
        source: "__proto__",
        target: "__proto__",
        weight: "2",
      },
      {
        id: prefixEdge,
        source: "constructor",
        target: prefixNode,
        weight: "3",
      },
    ],
  };
  const canonical = parseGraphModelJson(serializeGraphModel(saved))!;
  assert.deepEqual(
    canonical,
    saved,
    "JSON preserves reserved and prefix-looking IDs",
  );
  const store = createStore();
  assert.equal(
    store.set(executeCommandAtom, {
      type: "replace-model",
      label: "Load saved fixture",
      model: canonical,
    }).status,
    "applied",
  );
  const { cy, renderer } = createCalculationCanvas(createEmptyGraphModel());
  const reader = createRenderedHitboxReader(cy);
  const check = (
    message: string,
    skipNodePositionIds?: ReadonlySet<string>,
  ) => {
    const graph = store.get(graphAtom);
    const routes = computeEdgeRouting(graph);
    const sync = syncCytoscapeElements(
      cy,
      graphModelToCytoscapeElements(graph, { edgeRoutingMeta: routes }),
      { skipNodePositionIds },
    );
    refreshCytoscapeGeometry(sync.changedElements);
    renderer.flushRenderedStyleQueue();
    assert.deepEqual(
      cy
        .nodes()
        .map((node) => decodeCytoscapeId(node.id()))
        .sort(),
      graph.nodes.map((node) => node.id).sort(),
      `${message}: no stale or missing canvas nodes`,
    );
    assert.deepEqual(
      cy
        .edges()
        .map((edge) => decodeCytoscapeId(edge.id()))
        .sort(),
      graph.edges.map((edge) => edge.id).sort(),
      `${message}: no stale or missing canvas edges`,
    );
    for (const edge of graph.edges) {
      const element = getCytoscapeElement(cy, edge.id);
      assert.equal(decodeCytoscapeId(element.source().id()), edge.source);
      assert.equal(decodeCytoscapeId(element.target().id()), edge.target);
    }
    const hitboxes = reader.read(graph, true);
    assert.deepEqual(
      hitboxes,
      {
        nodes: readNodeHitboxes(cy, graph),
        edges: readEdgeLabelHitboxes(cy, graph),
      },
      `${message}: incremental and full reads preserve domain IDs and geometry`,
    );
    assert.deepEqual(
      new Set(hitboxes.nodes.map((node) => node.id)),
      new Set(graph.nodes.map((node) => node.id)),
    );
    assert.deepEqual(
      new Set(hitboxes.edges!.map((edge) => edge.id)),
      new Set(graph.edges.map((edge) => edge.id)),
    );
    assert.deepEqual(
      parseGraphModelJson(serializeGraphModel(graph)),
      graph,
      `${message}: all changes remain valid saved graphs`,
    );
    return { graph, sync, hitboxes };
  };
  const command = (intent: GraphIntent) => {
    assert.equal(store.set(executeCommandAtom, intent).status, "applied");
    return check(intent.type);
  };
  try {
    check("initial load");
    syncCytoscapeSelection(cy, {
      nodeIds: ["__proto__", prefixNode],
      edgeIds: ["toString", prefixEdge],
    });
    assert.deepEqual(readCytoscapeSelection(cy), {
      nodeIds: ["__proto__", prefixNode],
      edgeIds: ["toString", prefixEdge],
    });
    syncCytoscapeSelection(cy, {
      nodeIds: ["constructor"],
      edgeIds: ["hasOwnProperty"],
    });
    assert.deepEqual(
      readCytoscapeSelection(cy),
      { nodeIds: ["constructor"], edgeIds: ["hasOwnProperty"] },
      "selection updates decode and unselect previous domain IDs",
    );
    const range = readRangeSelectionPreview(
      cy,
      { x1: -1000, y1: -1000, x2: 1000, y2: 1000 },
      "all",
    );
    assert.deepEqual(
      range.nodeIds,
      new Set(saved.nodes.map((node) => node.id)),
    );
    assert.deepEqual(
      range.edgeIds,
      new Set(saved.edges.map((edge) => edge.id)),
    );
    assert.deepEqual(
      readRenderedNodePosition(cy, "__proto__"),
      getCytoscapeElement(cy, "__proto__").renderedPosition(),
    );
    const nodes = readNodeHitboxes(cy, saved);
    const edges = readEdgeLabelHitboxes(cy, saved);
    assert.equal(
      readInlineEditPosition(
        {
          kind: "node-label",
          nodeId: prefixNode,
          value: "C",
          fallbackPosition: { x: -1, y: -1 },
        },
        nodes,
        edges,
      ),
      nodes.find((node) => node.id === prefixNode),
    );
    assert.equal(
      readInlineEditPosition(
        {
          kind: "edge-weight",
          edgeId: prefixEdge,
          value: "3",
          fallbackPosition: { x: -1, y: -1 },
        },
        nodes,
        edges,
      ),
      edges.find((edge) => edge.id === prefixEdge),
    );
    assert.deepEqual(
      readRenderedEdgeLabelPosition(cy, prefixEdge),
      getCytoscapeElement(cy, prefixEdge).renderedMidpoint(),
    );
    const labelEdit = command({
      type: "update-edge",
      edgeId: "toString",
      patch: { weight: "99" },
    });
    assert.equal(
      labelEdit.sync.updated,
      1,
      "only the edited reserved-ID element updates",
    );
    assert.equal(
      labelEdit.hitboxes.edges!.find((edge) => edge.id === "toString")!.label,
      "99",
    );
    command({
      type: "update-node",
      nodeId: "__proto__",
      patch: { label: "A edited", color: "red" },
    });
    getCytoscapeElement(cy, "__proto__").position({ x: 40, y: 55 });
    check("active drag position is retained", new Set(["__proto__"]));
    assert.deepEqual(getCytoscapeElement(cy, "__proto__").position(), {
      x: 40,
      y: 55,
    });
    const interactive = syncCytoscapeEdgeRoutingData(cy, store.get(graphAtom), {
      mode: "simple",
    });
    assert.deepEqual(
      new Set(interactive.keys()),
      new Set(saved.edges.map((edge) => edge.id)),
      "live position routing returns domain edge IDs",
    );
    const custom = new Map(interactive);
    custom.set("toString", {
      ...custom.get("toString")!,
      bowPx: 74,
      controlPointDistancesPx: [74],
    });
    assert.equal(
      applyCytoscapeRoutingMeta(cy, custom).length,
      1,
      "domain route maps update just the encoded edge",
    );
    assert.deepEqual(
      getCytoscapeElement(cy, "toString").data("controlPointDistances"),
      [74],
    );
    command({
      type: "move-nodes",
      label: "Grid layout",
      after: layoutGrid(saved.nodes.map((node) => node.id)),
    });
    const beforeDelete = serializeGraphModel(store.get(graphAtom));
    command({
      type: "delete-selection",
      selection: { nodeIds: ["__proto__"], edgeIds: [prefixEdge] },
    });
    assert(
      getCytoscapeElement(cy, "__proto__").empty(),
      "deleted reserved node is absent from the renderer",
    );
    assert(
      getCytoscapeElement(cy, "toString").empty(),
      "incident reserved edge is removed too",
    );
    store.set(undoAtom);
    check("undo reserved-ID deletion");
    assert.equal(serializeGraphModel(store.get(graphAtom)), beforeDelete);
    store.set(redoAtom);
    check("redo reserved-ID deletion");
    store.set(undoAtom);
    check("restore before replacement");
    const normal: GraphModel = {
      ...createEmptyGraphModel(),
      nodes: [{ id: "a", label: "Alpha", order: 0, x: 0, y: 0 }],
      edges: [],
    };
    command({
      type: "replace-model",
      label: "Normal replacement",
      model: normal,
    });
    assert.deepEqual(
      cy.nodes().map((node) => node.id()),
      ["a"],
      "normal replacement cannot retain reserved or escaped IDs",
    );
    store.set(undoAtom);
    check("undo replacement restores exact original IDs");
    assert.equal(serializeGraphModel(store.get(graphAtom)), beforeDelete);
    store.set(redoAtom);
    check("redo normal replacement");
    store.set(undoAtom);
    check("restore before clearing");
    store.set(clearGraphAtom);
    check("clear reserved and prefix IDs");
    assert.equal(
      cy.elements().length,
      0,
      "clear empties actual installed Cytoscape",
    );
    store.set(undoAtom);
    check("undo clear restores reserved model");
    assert.equal(serializeGraphModel(store.get(graphAtom)), beforeDelete);
    store.set(redoAtom);
    check("redo clear");
    assert.equal(cy.elements().length, 0);
  } finally {
    reader.dispose();
    cy.destroy();
  }
}
