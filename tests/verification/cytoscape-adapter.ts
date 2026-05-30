import cytoscape, { type Core } from "cytoscape";

import {
  graphModelToCytoscapeElements,
  type CytoscapeElementOptions,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { syncCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-elements-sync";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";

const failures: string[] = [];

function expect(condition: boolean, message: string) {
  if (!condition) {
    failures.push(message);
  }
}

verifyElementMapping();
verifyDiffSyncPreservesTransientClasses();
verifyDiffSyncCanSkipDraggedNodePositions();
verifyEdgeTopologyChangesAreRecreated();

if (failures.length > 0) {
  console.error(`Cytoscape adapter verification failed (${failures.length})`);
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Cytoscape adapter verification passed");

function verifyElementMapping() {
  const elements = graphModelToCytoscapeElements(graphFixture());
  const nodeA = elements.find((element) => element.data?.id === "a");
  const edgeAb = elements.find((element) => element.data?.id === "ab");

  expect(nodeA?.group === "nodes", "node should map to a Cytoscape node");
  expect(
    String(nodeA?.classes).includes("color-yellow"),
    "node color should map to a class",
  );
  expect(
    nodeA?.position?.x === 0 && nodeA.position.y === 0,
    "node position should be preserved",
  );
  expect(edgeAb?.group === "edges", "edge should map to a Cytoscape edge");
  expect(
    String(edgeAb?.classes).includes("directed"),
    "directed setting should map to edge class",
  );
  expect(
    edgeAb?.data?.label === "7",
    "weighted edge should use weight as label",
  );
  expect(
    String(edgeAb?.classes).includes("color-blue"),
    "edge color should map to a class",
  );
}

function verifyDiffSyncPreservesTransientClasses() {
  const cy = createCy(graphFixture());

  try {
    cy.getElementById("a").addClass("edge-source label-editing range-preview");
    cy.getElementById("ab").addClass("label-editing range-preview");

    const nextGraph = {
      ...graphFixture(),
      nodes: [
        { ...graphFixture().nodes[0], label: "A2", color: "green" as const },
        graphFixture().nodes[1],
      ],
      edges: [{ ...graphFixture().edges[0], color: "pink" as const }],
    };
    const result = syncCytoscapeElements(
      cy,
      graphModelToCytoscapeElements(nextGraph),
    );
    const nodeA = cy.getElementById("a");
    const edgeAb = cy.getElementById("ab");

    expect(result.updated >= 2, "sync should update changed elements");
    expect(
      nodeA.hasClass("color-green") && !nodeA.hasClass("color-yellow"),
      "sync should replace model-owned node color classes",
    );
    expect(
      nodeA.hasClass("edge-source") &&
        nodeA.hasClass("label-editing") &&
        nodeA.hasClass("range-preview"),
      "sync should preserve transient node classes",
    );
    expect(
      edgeAb.hasClass("color-pink") && !edgeAb.hasClass("color-blue"),
      "sync should replace model-owned edge color classes",
    );
    expect(
      edgeAb.hasClass("label-editing") && edgeAb.hasClass("range-preview"),
      "sync should preserve transient edge classes",
    );
  } finally {
    cy.destroy();
  }
}

function verifyDiffSyncCanSkipDraggedNodePositions() {
  const cy = createCy(graphFixture());

  try {
    cy.getElementById("a").position({ x: 99, y: 101 });

    const nextGraph = {
      ...graphFixture(),
      nodes: [
        { ...graphFixture().nodes[0], x: 240, y: 260 },
        { ...graphFixture().nodes[1], x: 300, y: 320 },
      ],
    };
    syncCytoscapeElements(cy, graphModelToCytoscapeElements(nextGraph), {
      skipNodePositionIds: new Set(["a"]),
    });
    const skippedPosition = cy.getElementById("a").position();
    const syncedPosition = cy.getElementById("b").position();

    expect(
      skippedPosition.x === 99 && skippedPosition.y === 101,
      "sync should not overwrite the active drag preview position",
    );
    expect(
      syncedPosition.x === 300 && syncedPosition.y === 320,
      "sync should continue updating non-dragged node positions",
    );
  } finally {
    cy.destroy();
  }
}

function verifyEdgeTopologyChangesAreRecreated() {
  const cy = createCy(graphFixture());

  try {
    const nextGraph = {
      ...graphFixture(),
      edges: [{ ...graphFixture().edges[0], source: "b", target: "a" }],
    };
    const result = syncCytoscapeElements(
      cy,
      graphModelToCytoscapeElements(nextGraph),
    );
    const edge = cy.getElementById("ab");

    expect(
      result.recreated === 1,
      "source/target changes should recreate edge",
    );
    expect(edge.data("source") === "b", "recreated edge should use new source");
    expect(edge.data("target") === "a", "recreated edge should use new target");
  } finally {
    cy.destroy();
  }
}

function createCy(
  graph: GraphModel,
  options: CytoscapeElementOptions = {},
): Core {
  return cytoscape({
    elements: graphModelToCytoscapeElements(graph, options),
    headless: true,
    layout: { name: "preset", fit: false },
  });
}

function graphFixture(): GraphModel {
  return {
    ...createEmptyGraphModel({
      directed: true,
      weighted: true,
    }),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0, color: "yellow" },
      { id: "b", label: "B", order: 1, x: 120, y: 0 },
    ],
    edges: [
      {
        id: "ab",
        source: "a",
        target: "b",
        weight: "7",
        color: "blue",
      },
    ],
  };
}
