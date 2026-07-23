import cytoscape, { type Core } from "cytoscape";

import {
  graphModelToCytoscapeElements,
  syncCytoscapeEdgeRoutingData,
  type CytoscapeElementOptions,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import { syncCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-elements-sync";
import {
  MAX_CANVAS_ZOOM,
  MIN_CANVAS_ZOOM,
  nextCanvasButtonZoomLevel,
  renderedPointInsideViewport,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-viewport";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { createEdgeHitboxPath } from "../../features/graph-editor/canvas/GraphCanvasHitboxOverlays";
import { snapPositionToNodeDragGrid } from "../../features/graph-editor/canvas/graph-canvas-html-node-drag";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Cytoscape adapter");

verifyElementMapping();
verifyNodeMappingDoesNotUseIsolatedState();
verifyDiffSyncPreservesTransientClasses();
verifyDiffSyncCanSkipDraggedNodePositions();
verifyEdgeTopologyChangesAreRecreated();
verifyEdgeRoutingCanFollowDraggedNodePositions();
verifySelfLoopRoutingCanFollowDraggedNodePositions();
verifyEdgeRoutingSyncPreservesModelData();
verifyEdgeRoutingSyncCanRestorePreviewData();
verifyViewportRescuePointDetection();
verifyButtonZoomLevels();
verifyEdgeHitboxPaths();
verifyNodeDragGridSnapping();

finish();

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
  expect(
    Array.isArray(edgeAb?.data?.controlPointDistances) &&
      Array.isArray(edgeAb.data.controlPointWeights),
    "edge routing should map control-point arrays into Cytoscape data",
  );
}

function verifyNodeDragGridSnapping() {
  expect(
    JSON.stringify(snapPositionToNodeDragGrid({ x: 13, y: 35 })) ===
      JSON.stringify({ x: 24, y: 24 }),
    "node drag snapping should align positions to the 24px canvas grid",
  );
  expect(
    JSON.stringify(snapPositionToNodeDragGrid({ x: -13, y: -35 })) ===
      JSON.stringify({ x: -24, y: -24 }),
    "node drag snapping should handle negative coordinates",
  );
}

function verifyNodeMappingDoesNotUseIsolatedState() {
  const graph: GraphModel = {
    ...createEmptyGraphModel(),
    nodes: [
      { id: "isolated", label: "I", order: 0, x: 0, y: 0 },
      { id: "connected-a", label: "A", order: 1, x: 120, y: 0 },
      { id: "connected-b", label: "B", order: 2, x: 240, y: 0 },
    ],
    edges: [{ id: "ab", source: "connected-a", target: "connected-b" }],
  };
  const elements = graphModelToCytoscapeElements(graph);
  const isolatedNode = elements.find(
    (element) => element.data?.id === "isolated",
  );
  const connectedNode = elements.find(
    (element) => element.data?.id === "connected-a",
  );

  expect(
    !String(isolatedNode?.classes ?? "").includes("isolated") &&
      !("isolated" in (isolatedNode?.data ?? {})),
    "isolated nodes should not emit a no-op isolated class or data flag",
  );
  expect(
    !String(connectedNode?.classes ?? "").includes("isolated") &&
      !("isolated" in (connectedNode?.data ?? {})),
    "connected nodes should not emit isolated state either",
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

function verifyEdgeRoutingCanFollowDraggedNodePositions() {
  const graph = edgeRoutingFixture();
  const cy = createCy(graph);

  try {
    const edge = cy.getElementById("ab");
    const initialBow = edge.data("bow");

    cy.getElementById("c").position({ x: 60, y: 140 });
    syncCytoscapeEdgeRoutingData(cy, graph, { avoidNodes: true });

    expect(
      initialBow !== edge.data("bow") && edge.data("bow") === 0,
      "edge routing preview should use current Cytoscape node positions during drag",
    );
  } finally {
    cy.destroy();
  }
}

function verifySelfLoopRoutingCanFollowDraggedNodePositions() {
  const graph = selfLoopRoutingFixture();
  const cy = createCy(graph);

  try {
    const edge = cy.getElementById("aa");
    const initialLoopDirection = edge.data("loopDirection");

    cy.getElementById("b").position({ x: 30, y: -30 });
    syncCytoscapeEdgeRoutingData(cy, graph, { avoidNodes: true });

    expect(
      initialLoopDirection !== edge.data("loopDirection"),
      "self-loop routing preview should use current Cytoscape node positions during drag",
    );
  } finally {
    cy.destroy();
  }
}

function verifyEdgeRoutingSyncPreservesModelData() {
  const graph = edgeRoutingFixture();
  const cy = createCy(graph);

  try {
    const edge = cy.getElementById("ab");

    cy.getElementById("c").position({ x: 60, y: 140 });
    syncCytoscapeEdgeRoutingData(cy, graph, { avoidNodes: true });

    expect(edge.data("source") === "a", "routing sync should keep source");
    expect(edge.data("target") === "b", "routing sync should keep target");
    expect(edge.data("label") === "1", "routing sync should keep label");
    expect(edge.data("weight") === "1", "routing sync should keep weight");
    expect(edge.data("color") === "blue", "routing sync should keep color");
  } finally {
    cy.destroy();
  }
}

function verifyEdgeRoutingSyncCanRestorePreviewData() {
  const graph = edgeRoutingFixture();
  const cy = createCy(graph);

  try {
    const edge = cy.getElementById("ab");
    const initialBow = edge.data("bow");

    cy.getElementById("c").position({ x: 60, y: 140 });
    syncCytoscapeEdgeRoutingData(cy, graph, { avoidNodes: true });
    cy.getElementById("c").position({ x: 60, y: 5 });
    syncCytoscapeEdgeRoutingData(cy, graph, { avoidNodes: true });

    expect(
      edge.data("bow") === initialBow,
      "routing sync should be reversible when preview positions are restored",
    );
  } finally {
    cy.destroy();
  }
}

function verifyViewportRescuePointDetection() {
  const viewport = { x1: 280, y1: 0, x2: 1200, y2: 800 };

  expect(
    renderedPointInsideViewport({ x: 300, y: 40 }, viewport),
    "node centers inside the usable viewport should be treated as visible",
  );
  expect(
    renderedPointInsideViewport({ x: 275, y: 40 }, viewport),
    "node centers just outside the usable viewport should use a small tolerance",
  );
  expect(
    !renderedPointInsideViewport({ x: 260, y: 40 }, viewport),
    "node centers hidden well under the sidebar should not be treated as visible",
  );
  expect(
    !renderedPointInsideViewport({ x: 1220, y: 40 }, viewport),
    "node centers hidden well beyond the right rail should not be treated as visible",
  );
}

function verifyButtonZoomLevels() {
  expect(
    nextCanvasButtonZoomLevel(1.1, -1) === 1,
    "zoom-out from 110% should return to 100%",
  );
  expect(
    nextCanvasButtonZoomLevel(1.0000000000000002, 1) === 1.1,
    "zoom-in should tolerate tiny floating-point noise around 100%",
  );
  expect(
    nextCanvasButtonZoomLevel(MIN_CANVAS_ZOOM, -1) === MIN_CANVAS_ZOOM,
    "zoom-out should clamp to minimum zoom",
  );
  expect(
    nextCanvasButtonZoomLevel(MAX_CANVAS_ZOOM, 1) === MAX_CANVAS_ZOOM,
    "zoom-in should clamp to maximum zoom",
  );
}

function verifyEdgeHitboxPaths() {
  const curvedPath = createEdgeHitboxPath({
    id: "curved",
    label: "",
    sourceX: 0,
    sourceY: 0,
    targetX: 100,
    targetY: 0,
    x: 50,
    y: 20,
    bowPx: 32,
    controlPointDistancesPx: [32, 48],
    controlPointWeights: [0.3, 0.7],
    loopDirectionDeg: -45,
    loopSweepDeg: 70,
  });

  expect(
    curvedPath.match(/Q/g)?.length === 2,
    "curved edge hitboxes should follow every quadratic segment",
  );

  const loopPath = createEdgeHitboxPath({
    id: "loop",
    label: "",
    sourceX: 20,
    sourceY: 20,
    targetX: 20,
    targetY: 20,
    x: 40,
    y: 0,
    bowPx: 0,
    loopDirectionDeg: -45,
    loopSweepDeg: 70,
  });

  expect(loopPath.includes("C"), "loop edge hitboxes should be curved paths");
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

function edgeRoutingFixture(): GraphModel {
  return {
    ...createEmptyGraphModel({
      weighted: true,
    }),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 120, y: 0 },
      { id: "c", label: "C", order: 2, x: 60, y: 5 },
    ],
    edges: [
      {
        id: "ab",
        source: "a",
        target: "b",
        weight: "1",
        color: "blue",
      },
    ],
  };
}

function selfLoopRoutingFixture(): GraphModel {
  return {
    ...createEmptyGraphModel(),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 120, y: 0 },
    ],
    edges: [{ id: "aa", source: "a", target: "a" }],
  };
}
