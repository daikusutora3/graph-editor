import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createStore } from "jotai/vanilla";
import cytoscape from "cytoscape";

import {
  GRAPH_MAX_ABS_COORDINATE,
  hasGraphCoordinatePositions,
  isGraphCoordinate,
} from "../../features/graph-editor/core/graph/graph-coordinates";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  normalizeGraphModel,
  parseGraphModelJson,
  serializeGraphModel,
} from "../../features/graph-editor/core/graph/graph-json";
import {
  MAX_BOW_PX,
  normalizeEdgeRoutingOverride,
} from "../../features/graph-editor/core/graph/edge-routing-overrides";
import type {
  GraphIntent,
  GraphModel,
} from "../../features/graph-editor/core/graph/model";
import {
  defaultEdgeRoutingMeta,
  computeEdgeRouting,
} from "../../features/graph-editor/core/layout/edge-routing";
import { isComputeResult } from "../../features/graph-editor/compute/worker-result";
import { canRustCountCurveNodeCollisions } from "../../features/graph-editor/compute/wasm-routing";
import { canRustSelectInteractiveRoute } from "../../features/graph-editor/compute/wasm-interactive-routing";
import {
  graphAtom,
  graphRevisionAtom,
} from "../../features/graph-editor/shell/state/graph-atoms";
import {
  executeCommandAtom,
  futureAtom,
  historyAtom,
  redoAtom,
  undoAtom,
} from "../../features/graph-editor/shell/state/history-atoms";
import {
  cancelScheduledStoredGraphWrite,
  flushStoredGraphWrite,
  getStorageSnapshot,
  GRAPH_STORAGE_KEY,
  parseStoredGraph,
  readStoredGraph,
  scheduleStoredGraphWrite,
  uninstallStorageFlushListeners,
} from "../../features/graph-editor/adapters/browser/stored-graph";
import { graphModelToCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { SampleGraphPreview } from "../../features/graph-editor/ui/samples/SampleGraphPreview";
import { preparePreviewGeometry } from "../../features/graph-editor/ui/samples/preview-geometry";

const limit = GRAPH_MAX_ABS_COORDINATE;
const inside = limit - 0.000001;
const outside = limit + 0.000001;
function graphAt(x: number, y = -x): GraphModel {
  return {
    ...createEmptyGraphModel(),
    nodes: [
      { id: "a", label: "A", order: 0, x, y },
      { id: "b", label: "B", order: 1, x: -x, y: -y },
    ],
    edges: [{ id: "ab", source: "a", target: "b" }],
  };
}

for (const coordinate of [0, -0, 0.125, 1e8, inside, limit, -inside, -limit]) {
  const graph = graphAt(coordinate);
  const before = JSON.stringify(graph);
  assert(isGraphCoordinate(coordinate));
  assert(hasGraphCoordinatePositions(graph.nodes));
  // JSON canonicalizes signed zero; both import paths preserve its document.
  assert.deepEqual(
    parseGraphModelJson(serializeGraphModel(graph)),
    JSON.parse(before),
  );
  assert.deepEqual(parseStoredGraph(before), JSON.parse(before));
  assert.equal(JSON.stringify(graph), before);
  for (const variant of ["editor", "sample"] as const) {
    const markup = renderToStaticMarkup(
      createElement(SampleGraphPreview, { model: graph, variant }),
    );
    assert.match(markup, /<svg/);
    assert.doesNotMatch(markup, /NaN|Infinity/);
  }
}

const invalidCoordinates = [
  outside,
  -outside,
  1e308,
  -1e308,
  Number.MAX_VALUE,
  -Number.MAX_VALUE,
  Infinity,
  -Infinity,
  NaN,
];
for (const coordinate of invalidCoordinates) {
  const graph = graphAt(coordinate);
  const before = JSON.stringify(graph);
  assert(!isGraphCoordinate(coordinate));
  assert(!hasGraphCoordinatePositions(graph.nodes));
  assert.equal(normalizeGraphModel(graph), null);
  assert.equal(parseGraphModelJson(before), null);
  assert.equal(parseStoredGraph(before), null);
  assert.throws(() => serializeGraphModel(graph), /JSON contract/);
  assert.equal(
    renderToStaticMarkup(createElement(SampleGraphPreview, { model: graph })),
    "",
    "standalone invalid previews cannot emit overflowing geometry",
  );
  assert.equal(JSON.stringify(graph), before, "rejection never clamps input");
}
assert(!isGraphCoordinate("100"));
assert(!hasGraphCoordinatePositions([null]));
const sparseControls: number[] = [];
sparseControls.length = 1;
assert(!hasGraphCoordinatePositions(sparseControls));

verifyEditingBoundary();
verifyWorkerGeometryBoundary();
verifyLoopIdentity();
await verifyStorageBoundary();

console.log(
  "Geometry contracts passed (coordinate/route boundaries, non-destructive import/edit/storage/Worker rejection, endpoint loop identity and finite previews)",
);

function verifyEditingBoundary() {
  const store = createStore();
  const initial = graphAt(100_000_000.125);
  assert.equal(
    store.set(executeCommandAtom, {
      type: "replace-model",
      label: "Initial graph",
      model: initial,
    }).status,
    "applied",
  );
  for (const coordinate of invalidCoordinates) {
    const invalidNode = { ...initial.nodes[0]!, x: coordinate };
    const intents: GraphIntent[] = [
      { type: "replace-model", label: "Invalid", model: graphAt(coordinate) },
      { type: "update-node", nodeId: "a", patch: { x: coordinate } },
      { type: "add-node", input: { id: "c", x: coordinate, y: 0 } },
      {
        type: "move-nodes",
        label: "Invalid move",
        after: { a: { x: coordinate, y: 0 } },
      },
      {
        type: "put-graph-elements",
        label: "Invalid paste",
        nodes: [invalidNode],
        edges: [],
      },
    ];
    for (const intent of intents) {
      const graph = store.get(graphAtom);
      const revision = store.get(graphRevisionAtom);
      const history = store.get(historyAtom);
      const future = store.get(futureAtom);
      const input = JSON.stringify(intent);
      assert.equal(store.set(executeCommandAtom, intent).status, "rejected");
      assert.equal(store.get(graphAtom), graph);
      assert.equal(store.get(graphRevisionAtom), revision);
      assert.equal(store.get(historyAtom), history);
      assert.equal(store.get(futureAtom), future);
      assert.equal(JSON.stringify(intent), input);
    }
  }
  const validMove: GraphIntent = {
    type: "move-nodes",
    label: "Boundary move",
    after: { a: { x: limit, y: -inside } },
  };
  assert.equal(store.set(executeCommandAtom, validMove).status, "applied");
  const moved = store.get(graphAtom);
  assert.equal(moved.nodes[0]!.x, limit);
  assert.equal(moved.nodes[0]!.y, -inside);
  store.set(undoAtom);
  assert.deepEqual(store.get(graphAtom), initial);
  const future = store.get(futureAtom);
  assert.equal(
    store.set(executeCommandAtom, {
      type: "update-node",
      nodeId: "a",
      patch: { x: outside },
    }).status,
    "rejected",
  );
  assert.equal(store.get(futureAtom), future, "invalid edits preserve Redo");
  store.set(redoAtom);
  assert.deepEqual(store.get(graphAtom), moved);

  const excessiveRoute = {
    ...initial,
    edges: [{ ...initial.edges[0]!, routing: { bowPx: 1e308 } }],
  };
  assert.deepEqual(normalizeEdgeRoutingOverride({ bowPx: 1e308 }), {
    bowPx: MAX_BOW_PX,
  });
  assert.equal(parseGraphModelJson(JSON.stringify(excessiveRoute)), null);
  assert.throws(() => serializeGraphModel(excessiveRoute), /JSON contract/);
  const graph = store.get(graphAtom);
  assert.equal(
    store.set(executeCommandAtom, {
      type: "update-edge",
      edgeId: "ab",
      patch: { routing: { bowPx: 1e308 } },
    }).status,
    "rejected",
    "the document gate rejects raw routing overrides instead of saving a clamp",
  );
  assert.equal(store.get(graphAtom), graph);
  assert.equal(excessiveRoute.edges[0]!.routing.bowPx, 1e308);
}

function verifyWorkerGeometryBoundary() {
  for (const coordinate of [
    inside,
    limit,
    -inside,
    -limit,
    ...invalidCoordinates,
  ]) {
    const expected = isGraphCoordinate(coordinate);
    const positions = { a: { x: coordinate, y: 0 } };
    assert.equal(
      isComputeResult("layout", {
        type: "move-nodes",
        label: "Layout",
        after: positions,
      }),
      expected,
    );
    assert.equal(
      isComputeResult("overlap", {
        status: "resolved",
        remainingPairs: 0,
        positions,
      }),
      expected,
    );
    const route = {
      ...defaultEdgeRoutingMeta,
      bowPx: coordinate,
      controlPointDistancesPx: [coordinate],
      controlPointWeights: [0.5],
    };
    const before = JSON.stringify(route);
    assert.equal(
      isComputeResult("routing", new Map([["ab", route]])),
      expected,
    );
    assert.equal(JSON.stringify(route), before);
    const graph = graphAt(coordinate, 0);
    const curve = { controlPointDistancesPx: [0], controlPointWeights: [0.5] };
    assert.equal(
      canRustCountCurveNodeCollisions(curve, graph.nodes[0]!, graph.nodes[1]!),
      expected,
    );
    assert.equal(
      canRustSelectInteractiveRoute({
        source: graph.nodes[0]!,
        target: graph.nodes[1]!,
        curve,
      }),
      expected,
    );
  }
  for (const field of [
    "bowPx",
    "loopDirectionDeg",
    "loopSweepDeg",
    "loopStepSizePx",
  ]) {
    const route = { ...defaultEdgeRoutingMeta, [field]: 1e308 };
    assert(!isComputeResult("routing", new Map([["ab", route]])), field);
    assert.equal(route[field as keyof typeof route], 1e308);
  }
  const source = graphAt(100).nodes[0]!;
  const target = graphAt(100).nodes[1]!;
  for (const distance of [
    0,
    inside,
    limit,
    -inside,
    -limit,
    ...invalidCoordinates,
  ]) {
    const expected = isGraphCoordinate(distance);
    const curve = {
      controlPointDistancesPx: [distance],
      controlPointWeights: [0.5],
    };
    const before = JSON.stringify(curve);
    assert.equal(
      isComputeResult(
        "routing",
        new Map([["ab", { ...defaultEdgeRoutingMeta, ...curve }]]),
      ),
      expected,
      "control distances have their own boundary with ordinary node coordinates",
    );
    assert.equal(
      canRustCountCurveNodeCollisions(curve, source, target),
      expected,
    );
    assert.equal(
      canRustSelectInteractiveRoute({ source, target, curve }),
      distance === 0,
      "the interactive backend additionally accepts only straight curves",
    );
    assert.equal(JSON.stringify(curve), before);
  }
  for (const distances of [[], sparseControls, [0, 1]]) {
    assert(
      !isComputeResult(
        "routing",
        new Map([
          [
            "ab",
            { ...defaultEdgeRoutingMeta, controlPointDistancesPx: distances },
          ],
        ]),
      ),
      "empty, sparse and mismatched controls are rejected",
    );
  }
  for (const weight of [-0.001, 1.001, 1e308, NaN, Infinity])
    assert(
      !isComputeResult(
        "routing",
        new Map([
          ["ab", { ...defaultEdgeRoutingMeta, controlPointWeights: [weight] }],
        ]),
      ),
    );
  for (const weight of [0, 0.5, 1])
    assert(
      isComputeResult(
        "routing",
        new Map([
          ["ab", { ...defaultEdgeRoutingMeta, controlPointWeights: [weight] }],
        ]),
      ),
    );
}

function verifyLoopIdentity() {
  for (const directed of [false, true]) {
    for (const actualLoop of [false, true]) {
      const model = graphAt(0, 0);
      model.settings = {
        ...model.settings,
        directed,
        allowSelfLoops: actualLoop,
      };
      if (actualLoop) model.edges[0]!.target = "a";
      const before = serializeGraphModel(model);
      const cy = cytoscape({
        headless: true,
        elements: graphModelToCytoscapeElements(model),
        layout: { name: "preset" },
      });
      try {
        assert.equal(cy.$id("ab").isLoop(), actualLoop);
        for (const variant of ["editor", "sample"] as const) {
          const geometry = preparePreviewGeometry(
            model,
            computeEdgeRouting(model, { mode: "simple" }),
            variant === "editor",
          );
          assert.equal(Boolean(geometry.edgeById.get("ab")!.loop), actualLoop);
          const markup = renderToStaticMarkup(
            createElement(SampleGraphPreview, { model, variant }),
          );
          const paths = [
            ...markup.matchAll(/<path\b[^>]*d="([^"]+)"[^>]*stroke=/g),
          ];
          assert.equal(paths.length, actualLoop ? 1 : 0);
          if (actualLoop) assert.match(paths[0]![1]!, /C/);
          assert.doesNotMatch(markup, /NaN|Infinity/);
        }
      } finally {
        cy.destroy();
      }
      assert.equal(serializeGraphModel(model), before);
      if (!actualLoop) {
        const separated = {
          ...model,
          nodes: model.nodes.map((node) => ({
            ...node,
            x: node.id === "b" ? 100 : node.x,
          })),
        };
        const markup = renderToStaticMarkup(
          createElement(SampleGraphPreview, {
            model: separated,
            variant: "editor",
          }),
        );
        assert.match(markup, /<path\b[^>]*d="[^"]*Q[^"]*"[^>]*stroke=/);
        assert.doesNotMatch(markup, /<path\b[^>]*d="[^"]*C[^"]*"[^>]*stroke=/);
      }
    }
  }
}

async function verifyStorageBoundary() {
  const descriptors = Object.fromEntries(
    ["window", "document", "navigator"].map((name) => [
      name,
      Object.getOwnPropertyDescriptor(globalThis, name),
    ]),
  );
  const invalid = graphAt(1e308);
  let raw = JSON.stringify(invalid);
  const originalRaw = raw;
  let writes = 0;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem(key: string) {
          assert.equal(key, GRAPH_STORAGE_KEY);
          return raw;
        },
        setItem(key: string, value: string) {
          assert.equal(key, GRAPH_STORAGE_KEY);
          writes++;
          raw = value;
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
      locks: { request: async (_key: string, work: () => void) => work() },
    },
  });
  try {
    assert.equal(readStoredGraph(), null);
    assert.deepEqual(getStorageSnapshot(), {
      status: "invalid",
      raw: originalRaw,
    });
    scheduleStoredGraphWrite(graphAt(1e8));
    await flushStoredGraphWrite();
    assert.equal(writes, 0);
    assert.equal(
      raw,
      originalRaw,
      "invalid saved data remains recoverable verbatim",
    );
    const valid = graphAt(inside);
    raw = serializeGraphModel(valid);
    assert.deepEqual(readStoredGraph(), valid);
    assert.equal(getStorageSnapshot().status, "saved");
    const validRaw = raw;
    scheduleStoredGraphWrite(invalid);
    await flushStoredGraphWrite();
    assert.equal(getStorageSnapshot().status, "failed");
    assert.equal(
      writes,
      0,
      "an invalid direct write preserves the stored graph",
    );
    assert.equal(raw, validRaw);
    scheduleStoredGraphWrite(graphAt(limit));
    await flushStoredGraphWrite();
    assert.equal(writes, 1);
    assert.equal(raw, serializeGraphModel(graphAt(limit)));
  } finally {
    cancelScheduledStoredGraphWrite();
    uninstallStorageFlushListeners();
    for (const [name, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor);
      else Reflect.deleteProperty(globalThis, name);
    }
  }
}
