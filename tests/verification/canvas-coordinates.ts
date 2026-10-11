import assert from "node:assert/strict";
import {
  graphModelToCytoscapeElements,
  syncCytoscapeEdgeRoutingData,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import {
  readCytoscapeCoordinateOrigin,
  toCytoscapePosition,
  toGraphPosition,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-coordinates";
import { getCytoscapeElement } from "../../features/graph-editor/adapters/cytoscape/cytoscape-ids";
import { syncCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-elements-sync";
import { withCytoscapeBatch } from "../../features/graph-editor/adapters/cytoscape/cytoscape-batch";
import { refreshCytoscapeGeometry } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-geometry-refresh";
import {
  readNodeHitboxes,
  readEdgeLabelHitboxes,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import { serializeGraphModel } from "../../features/graph-editor/core/graph/graph-json";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  computeEdgeRouting,
  defaultEdgeRoutingMeta,
} from "../../features/graph-editor/core/layout/edge-routing";
import { createCalculationCanvas } from "../fixtures/calculation-canvas";

const normal: GraphModel = {
  ...createEmptyGraphModel({
    weighted: true,
    showNodeLabels: true,
    allowSelfLoops: true,
  }),
  nodes: [
    { id: "__proto__", label: "A", order: 0, x: 0, y: -60.001 },
    { id: "constructor", label: "B", order: 1, x: 120, y: 0 },
  ],
  edges: [
    {
      id: "toString",
      source: "__proto__",
      target: "constructor",
      weight: "label",
    },
    { id: "loop", source: "constructor", target: "constructor", weight: "7" },
  ],
};

for (const offset of [1e9 - 120, -1e9 + 120]) verifyTranslation(offset);
verifyRebase();
console.log(
  "Canvas coordinates passed (local renderer origin, domain roundtrip, camera preservation, routing, active drag, reset and immutability)",
);

function definitions(graph: GraphModel) {
  return graphModelToCytoscapeElements(graph, {
    edgeRoutingMeta: new Map(
      graph.edges.map((edge) => [edge.id, defaultEdgeRoutingMeta]),
    ),
  });
}

function translate(graph: GraphModel, offset: number): GraphModel {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      x: node.x + offset,
      y: node.y + offset,
    })),
  };
}

function verifyTranslation(offset: number) {
  const graph = translate(normal, offset);
  const before = serializeGraphModel(graph);
  const { cy, renderer } = createCalculationCanvas(createEmptyGraphModel());
  const reference = createCalculationCanvas(normal);
  try {
    const input = definitions(graph);
    const initial = JSON.stringify(input);
    const result = withCytoscapeBatch(cy, () =>
      syncCytoscapeElements(cy, input),
    );
    refreshCytoscapeGeometry(result.changedElements);
    renderer.flushRenderedStyleQueue();
    const origin = readCytoscapeCoordinateOrigin(cy);
    assert.ok(Math.abs(origin.x) > 1e8);
    assert.ok(
      cy
        .nodes()
        .map(
          (node) =>
            Math.abs(node.position().x) < 200 &&
            Math.abs(node.position().y) < 200,
        )
        .every(Boolean),
    );
    for (const node of graph.nodes) {
      assert.deepEqual(
        toGraphPosition(cy, getCytoscapeElement(cy, node.id).position()),
        { x: node.x, y: node.y },
      );
      assert.deepEqual(
        toCytoscapePosition(cy, { x: node.x, y: node.y }),
        getCytoscapeElement(cy, node.id).position(),
      );
    }
    assert.equal(
      JSON.stringify(input),
      initial,
      "projection does not mutate definitions",
    );
    assert.equal(
      serializeGraphModel(graph),
      before,
      "rendering never changes saved positions",
    );

    cy.zoom(1.5);
    cy.pan({
      x: 360 + (origin.x - offset) * 1.5,
      y: 480 + (origin.y - offset) * 1.5,
    });
    reference.cy.zoom(1.5);
    reference.cy.pan({ x: 360, y: 480 });
    compareGeometry(
      readNodeHitboxes(cy, graph),
      readNodeHitboxes(reference.cy, normal),
    );
    compareGeometry(
      readEdgeLabelHitboxes(cy, graph),
      readEdgeLabelHitboxes(reference.cy, normal),
    );
    const live = syncCytoscapeEdgeRoutingData(cy, graph, { mode: "simple" });
    assert.deepEqual(
      live,
      computeEdgeRouting(graph, { mode: "simple" }),
      "live routing uses domain positions",
    );
  } finally {
    cy.destroy();
    reference.cy.destroy();
  }
}

function verifyRebase() {
  const { cy } = createCalculationCanvas(normal);
  try {
    cy.zoom(0.75);
    cy.pan({ x: 240, y: 340 });
    const start = cy
      .nodes()
      .map((node) => ({ id: node.id(), position: node.renderedPosition() }));
    const distant = translate(normal, 1e9 - 120);
    const input = definitions(distant);
    withCytoscapeBatch(cy, () => syncCytoscapeElements(cy, input));
    // The graph moved in domain space; compare the old positions under the new
    // origin without allowing fit to hide an incorrect camera conversion.
    for (const node of normal.nodes) {
      getCytoscapeElement(cy, node.id).position(toCytoscapePosition(cy, node));
    }
    compareGeometry(
      cy
        .nodes()
        .map((node) => ({ id: node.id(), position: node.renderedPosition() })),
      start,
    );

    withCytoscapeBatch(cy, () => syncCytoscapeElements(cy, input));
    const origin = readCytoscapeCoordinateOrigin(cy);
    const node = getCytoscapeElement(cy, "__proto__");
    const graphPosition = toGraphPosition(cy, node.position());
    const dragged = { x: graphPosition.x + 24, y: graphPosition.y - 24 };
    node.position(toCytoscapePosition(cy, dragged));
    const skip = new Set(["__proto__"]);
    withCytoscapeBatch(cy, () =>
      syncCytoscapeElements(cy, definitions(normal), {
        skipNodePositionIds: skip,
      }),
    );
    assert.equal(
      readCytoscapeCoordinateOrigin(cy),
      origin,
      "do not rebase active drag snapshots",
    );
    assert.deepEqual(
      toGraphPosition(cy, node.position()),
      dragged,
      "active drag is preserved in domain coordinates",
    );

    withCytoscapeBatch(cy, () =>
      syncCytoscapeElements(cy, definitions(normal)),
    );
    assert.deepEqual(readCytoscapeCoordinateOrigin(cy), { x: 0, y: 0 });
    for (const item of normal.nodes)
      assert.deepEqual(getCytoscapeElement(cy, item.id).position(), {
        x: item.x,
        y: item.y,
      });
    syncCytoscapeElements(cy, input);
    syncCytoscapeElements(cy, []);
    assert.deepEqual(
      readCytoscapeCoordinateOrigin(cy),
      { x: 0, y: 0 },
      "empty canvas restores the domain origin",
    );
    assert.equal(cy.elements().length, 0);
  } finally {
    cy.destroy();
  }
}

function compareGeometry(actual: unknown, expected: unknown) {
  if (typeof actual === "number" && typeof expected === "number") {
    assert.ok(Math.abs(actual - expected) < 1e-5, `${actual} ≈ ${expected}`);
    return;
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    assert.equal(actual.length, expected.length);
    actual.forEach((value, index) => compareGeometry(value, expected[index]));
    return;
  }
  if (
    actual &&
    expected &&
    typeof actual === "object" &&
    typeof expected === "object"
  ) {
    assert.deepEqual(Object.keys(actual), Object.keys(expected));
    for (const key of Object.keys(actual))
      compareGeometry(
        (actual as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
      );
    return;
  }
  assert.deepEqual(actual, expected);
}
