import { createCalculationCanvas } from "../fixtures/calculation-canvas";
import cytoscape from "cytoscape";
import type { Core, EventObject } from "cytoscape";

import { refreshCytoscapeGeometry } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-geometry-refresh";
import { syncCytoscapeElements } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-elements-sync";
import { afterCytoscapeRender } from "../../features/graph-editor/adapters/cytoscape/graph-canvas-render-request";
import { startVisibleTimeout } from "../../features/graph-editor/adapters/browser/visible-timeout";
import {
  readNodeHitboxes,
  readEdgeLabelHitboxes,
} from "../../features/graph-editor/adapters/cytoscape/graph-canvas-hitboxes";
import { reconcileEdgeLabelHitboxes } from "../../features/graph-editor/adapters/cytoscape/hitbox-reconciliation";
import {
  applyCytoscapeRoutingMeta,
  graphModelToCytoscapeElements,
} from "../../features/graph-editor/adapters/cytoscape/cytoscape-adapter";
import {
  defaultEdgeRoutingMeta,
  type EdgeRoutingMeta,
} from "../../features/graph-editor/core/layout/edge-routing";
import { createEdgeHitboxPath } from "../../features/graph-editor/canvas/GraphCanvasHitboxOverlays";
import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { createVerification } from "./harness";

import { createRenderedHitboxReader } from "../../features/graph-editor/adapters/cytoscape/rendered-hitbox-reader";

const { expect, finish } = createVerification("Canvas rendering");

verifyIncrementalHitboxes();
verifyHitboxInvalidationDeduplication();
verifyRepeatedHitboxGeometry();
verifyEqualGeometryAfterPan();
verifyCachedRouteBounds();
verifyAffectedGeometry();
verifyLabelDimensions();
verifySizedLoopGeometry();
verifyVisibleDeadline();
verifyRenderRequestCancellation();
finish();

function fixture(): GraphModel {
  return {
    ...createEmptyGraphModel(),
    nodes: [
      { id: "a", label: "A", order: 0, x: 0, y: 0 },
      { id: "b", label: "B", order: 1, x: 300, y: 0 },
      { id: "c", label: "C", order: 2, x: 150, y: 250 },
      { id: "d", label: "D", order: 3, x: 700, y: 0 },
      { id: "e", label: "E", order: 4, x: 1000, y: 0 },
    ],
    edges: [
      { id: "ab", source: "a", target: "b", label: "1" },
      { id: "ac", source: "a", target: "c", label: "abcdefghij" },
      { id: "de", source: "d", target: "e", label: "1" },
    ],
  };
}

function definitions(
  graph: GraphModel,
  edgeRoutingMeta?: ReadonlyMap<string, EdgeRoutingMeta>,
) {
  return graphModelToCytoscapeElements(graph, {
    edgeRoutingMeta:
      edgeRoutingMeta ??
      new Map(graph.edges.map((edge) => [edge.id, defaultEdgeRoutingMeta])),
  });
}

function verifyIncrementalHitboxes() {
  let graph = fixture();
  const { cy } = createCalculationCanvas(graph);
  const reader = createRenderedHitboxReader(cy);
  const check = (message: string) => {
    const snapshot = reader.read(graph, true);
    expect(
      JSON.stringify(snapshot.nodes) ===
        JSON.stringify(readNodeHitboxes(cy, graph)),
      `${message}: node geometry equals a full read`,
    );
    expect(
      JSON.stringify(snapshot.edges) ===
        JSON.stringify(readEdgeLabelHitboxes(cy, graph)),
      `${message}: edge geometry equals a full read`,
    );
    return snapshot;
  };
  try {
    const initial = check("initial");
    const unchanged = reader.read(graph, true);
    expect(
      initial.nodes === unchanged.nodes && initial.edges === unchanged.edges,
      "idle frames reuse the geometry snapshot",
    );
    // Cytoscape may emit invalidations whose data changes do not affect any
    // rendered geometry. They must not rebuild the React selection lists.
    cy.getElementById("a").data("interactionTest", 1);
    cy.getElementById("ab").data("interactionTest", 1);
    const unchangedInvalidation = check("unrelated data invalidation");
    expect(
      initial.nodes === unchangedInvalidation.nodes &&
        initial.edges === unchangedInvalidation.edges,
      "invalidations without geometry changes preserve both arrays",
    );
    const initialJson = JSON.stringify(initial);
    cy.getElementById("a").unlock().position({ x: 60, y: 40 });
    refreshCytoscapeGeometry(cy.collection(cy.getElementById("a")));
    const moved = check("node movement");
    expect(
      initial.nodes[3] === moved.nodes[3] &&
        initial.edges![2] === moved.edges![2],
      "moving one node retains remote entries",
    );
    expect(
      JSON.stringify(initial) === initialJson &&
        moved.nodes !== initial.nodes &&
        moved.edges !== initial.edges,
      "local updates publish new arrays without mutating previous snapshots",
    );
    const sameModel = check("unchanged geometry before model replacement");
    graph = { ...graph, nodes: [...graph.nodes], edges: [...graph.edges] };
    const replacedModel = check("equivalent graph model");
    expect(
      sameModel.nodes === replacedModel.nodes &&
        sameModel.edges === replacedModel.edges,
      "full reads of equivalent geometry preserve array identity",
    );
    cy.getElementById("de").data({ bow: 70, controlPointDistances: [70] });
    refreshCytoscapeGeometry(cy.collection(cy.getElementById("de")));
    check("remote routing change");
    cy.getElementById("a").style("width", 220);
    refreshCytoscapeGeometry(cy.collection(cy.getElementById("a")));
    check("label/width style change");
    cy.zoom(1.5);
    cy.pan({ x: 100, y: 80 });
    check("zoom and pan");
    expect(
      reader.read(graph, false).edges === null,
      "drawing modes skip edge geometry",
    );
    cy.getElementById("d").unlock().position({ x: 720, y: 20 });
    refreshCytoscapeGeometry(cy.collection(cy.getElementById("d")));
    reader.read(graph, false);
    check("returning to selection reads hidden geometry");
    graph = {
      ...graph,
      edges: [
        ...graph.edges,
        { id: "ab2", source: "a", target: "b", label: "2" },
      ],
    };
    refreshCytoscapeGeometry(
      syncCytoscapeElements(cy, definitions(graph)).changedElements,
    );
    check("parallel addition");
    cy.getElementById("ab").data({ bow: -64, controlPointDistances: [-64] });
    refreshCytoscapeGeometry(cy.collection(cy.getElementById("ab")));
    check("parallel routing update");
    graph = {
      ...graph,
      edges: graph.edges.filter((edge) => edge.id !== "ab2"),
    };
    refreshCytoscapeGeometry(
      syncCytoscapeElements(cy, definitions(graph)).changedElements,
    );
    check("parallel removal");
    graph = {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === "a" ? { ...node, label: "renamed" } : node,
      ),
    };
    syncCytoscapeElements(cy, definitions(graph));
    check("model label update");
    // Removal/re-addition changes Cytoscape iteration order independently of
    // model order. The local lookup must be rebuilt against that full read.
    const detached = cy.getElementById("c").remove();
    cy.add(detached);
    refreshCytoscapeGeometry(cy.elements());
    const reordered = check("element reorder");
    const reorderedJson = JSON.stringify(reordered);
    cy.getElementById("c").unlock().position({ x: 200, y: 220 });
    refreshCytoscapeGeometry(cy.collection(cy.getElementById("c")));
    check("movement after reorder");
    expect(
      JSON.stringify(reordered) === reorderedJson,
      "reindexed updates preserve the earlier ordered snapshot",
    );
    graph = {
      ...graph,
      nodes: graph.nodes.filter((node) => node.id !== "b"),
      edges: graph.edges.filter((edge) => edge.target !== "b"),
    };
    refreshCytoscapeGeometry(
      syncCytoscapeElements(cy, definitions(graph)).changedElements,
    );
    check("node removal");
    cy.getElementById("e").unlock().position({ x: 900, y: 50 });
    refreshCytoscapeGeometry(cy.collection(cy.getElementById("e")));
    check("movement after removal");
    const beforeDormant = check("before dormant selection");
    reader.read(graph, false);
    const afterDormant = check("unchanged return to selection");
    expect(
      beforeDormant.nodes === afterDormant.nodes &&
        beforeDormant.edges === afterDormant.edges,
      "selection mode preserves unchanged dormant overlay arrays",
    );
  } finally {
    reader.dispose();
    cy.destroy();
  }
}

function verifyHitboxInvalidationDeduplication() {
  let invalidate: ((event: EventObject) => void) | null = null;
  let fullReads = 0;
  let parallelExpansions = 0;
  let connectedExpansions = 0;
  let visitedEdges = 0;
  const core = {
    on: (_events: string, listener: (event: EventObject) => void) => {
      invalidate = listener;
    },
    off: () => {
      invalidate = null;
    },
    pan: () => ({ x: 0, y: 0 }),
    zoom: () => 1,
    nodes: () => {
      fullReads++;
      return [];
    },
    edges: () => [],
  } as unknown as Core;
  const edges: {
    id(): string;
    isNode(): boolean;
    parallelEdges(): {
      forEach(visit: (edge: { id(): string }) => void): void;
    };
  }[] = Array.from({ length: 1000 }, (_, index) => ({
    id: () => `e${index}`,
    isNode: () => false,
    parallelEdges: () => {
      parallelExpansions++;
      return {
        forEach: (visit: (edge: { id(): string }) => void) => {
          for (const edge of edges) {
            visitedEdges++;
            visit(edge);
          }
        },
      };
    },
  }));
  const node = {
    id: () => "a",
    isNode: () => true,
    connectedEdges: () => {
      connectedExpansions++;
      return edges;
    },
  };
  const emit = (type: string, target: unknown) =>
    invalidate!({ type, target } as EventObject);
  const graph = createEmptyGraphModel();
  const reader = createRenderedHitboxReader(core);
  try {
    for (const edge of edges) emit("style", edge);
    expect(
      parallelExpansions === 0 && visitedEdges === 0,
      "pending full reads skip every redundant parallel-edge expansion",
    );
    reader.read(graph, true);
    for (const edge of edges) emit("style", edge);
    expect(
      parallelExpansions === 1 && visitedEdges === edges.length,
      "one thousand sibling style events expand their parallel group only once",
    );
    emit("style", core);
    reader.read(graph, true);
    for (let repeat = 0; repeat < 10; repeat++) emit("position", node);
    for (const edge of edges) emit("style", edge);
    expect(
      connectedExpansions === 1 && parallelExpansions === 1,
      "repeated node events and subsequent incident-edge events reuse dirty membership",
    );
    // Structural/Core events must still promote an already dirty snapshot to a
    // full read. Otherwise a removed/re-added ID could retain stale ordering.
    for (const boundary of ["add", "remove", "core"]) {
      const previousReads = fullReads;
      emit(
        boundary === "core" ? "style" : boundary,
        boundary === "core" ? core : edges[0],
      );
      for (const edge of edges) emit("style", edge);
      reader.read(graph, true);
      expect(
        fullReads === previousReads + 1,
        `${boundary} invalidation takes precedence over existing dirty elements`,
      );
      emit("style", edges[0]);
    }
  } finally {
    reader.dispose();
  }
  expect(invalidate === null, "disposing a hitbox reader removes its listener");
}

function verifyRepeatedHitboxGeometry() {
  const graph = {
    ...fixture(),
    edges: [
      ...fixture().edges,
      { id: "ba", source: "b", target: "a", label: "reverse" },
      { id: "loop1", source: "a", target: "a", label: "first loop" },
      { id: "loop2", source: "a", target: "a", label: "second loop" },
    ],
  };
  const { cy } = createCalculationCanvas(graph);
  const reader = createRenderedHitboxReader(cy);
  const check = (message: string) => {
    const snapshot = reader.read(graph, true);
    expect(
      JSON.stringify(snapshot.nodes) ===
        JSON.stringify(readNodeHitboxes(cy, graph)) &&
        JSON.stringify(snapshot.edges) ===
          JSON.stringify(readEdgeLabelHitboxes(cy, graph)),
      `${message}: deduplicated events preserve full-read geometry and order`,
    );
    return snapshot;
  };
  try {
    const before = check("initial reverse edges and self-loops");
    const node = cy.getElementById("a").unlock();
    node.position({ x: 20, y: 30 });
    node.position({ x: 40, y: 60 });
    node.style({ width: 220, shape: "round-rectangle" });
    cy.getElementById("ab").data({
      bow: 32,
      controlPointDistances: [32],
    });
    cy.getElementById("ab").data({
      bow: 64,
      controlPointDistances: [64],
    });
    cy.getElementById("ba").data({
      bow: -96,
      controlPointDistances: [-96],
    });
    cy.getElementById("loop1").data({
      loopDirection: "-45deg",
      loopStepSize: 90,
    });
    cy.getElementById("loop2").data({
      loopDirection: "45deg",
      loopStepSize: 130,
    });
    refreshCytoscapeGeometry(cy.collection(node));
    const changed = check("multiple moves, sizes, reverse routes and loops");
    expect(
      changed.nodes.find((entry) => entry.id === "a")?.x === 40 &&
        changed.nodes.find((entry) => entry.id === "a")?.y === 60 &&
        changed.edges!.find((entry) => entry.id === "de") ===
          before.edges!.find((entry) => entry.id === "de"),
      "a dirty element reads its latest geometry while remote entries retain identity",
    );
    node.position({ x: 50, y: 70 });
    const detached = cy.getElementById("loop1").remove();
    cy.add(detached);
    refreshCytoscapeGeometry(cy.collection(node));
    check("dirty node followed by loop removal and re-addition");
  } finally {
    reader.dispose();
    cy.destroy();
  }
}

function verifyEqualGeometryAfterPan() {
  const graph = {
    ...createEmptyGraphModel(),
    nodes: [{ id: "a", label: "A", order: 0, x: 0, y: 0 }],
  };
  const { cy } = createCalculationCanvas(graph);
  const reader = createRenderedHitboxReader(cy);
  try {
    const before = reader.read(graph, true);
    cy.pan({ x: 100, y: 0 });
    cy.getElementById("a").position({ x: -100, y: 0 });
    refreshCytoscapeGeometry(cy.collection(cy.getElementById("a")));
    const after = reader.read(graph, true);
    expect(
      before.nodes === after.nodes &&
        before.edges === after.edges &&
        cy.pan().x === 100,
      "pan and opposite node movement reuse equal geometry: viewport synchronization cannot depend on array changes alone",
    );
  } finally {
    reader.dispose();
    cy.destroy();
  }
}

function verifySizedLoopGeometry() {
  const graph = fixture();
  graph.nodes[0]!.label = "long-label-node-000000";
  graph.edges = [
    { id: "loop", source: "a", target: "a", label: "loop A" },
    { id: "loop2", source: "a", target: "a", label: "loop B" },
    {
      id: "manual",
      source: "b",
      target: "b",
      label: "manual",
      routing: { loopDirectionDeg: 225, loopSweepDeg: 65 },
    },
    graph.edges[2]!,
  ];
  const modelBefore = JSON.stringify(graph);
  const automatic = {
    ...defaultEdgeRoutingMeta,
    loopDirectionDeg: 45,
    loopSweepDeg: 65,
    loopStepSizePx: 110,
  };
  const manual = {
    ...defaultEdgeRoutingMeta,
    loopDirectionDeg: 225,
    loopSweepDeg: 65,
  };
  const routes = new Map<string, EdgeRoutingMeta>([
    ["loop", automatic],
    ["loop2", { ...automatic, loopDirectionDeg: 225 }],
    ["manual", manual],
    ["de", defaultEdgeRoutingMeta],
  ]);
  const { cy } = createCalculationCanvas(graph, routes);
  try {
    cy.getElementById("a").style({ width: 220, shape: "round-rectangle" });
    refreshCytoscapeGeometry(cy.collection(cy.getElementById("a")));
    cy.zoom(1.5);
    cy.pan({ x: 100, y: 80 });
    const hitboxes = readEdgeLabelHitboxes(cy, graph);
    for (const id of ["loop", "loop2", "manual"]) {
      const edge = cy.getElementById(id);
      const box = hitboxes.find((item) => item.id === id)!;
      const points = [
        edge.renderedSourceEndpoint(),
        edge.renderedControlPoints()[0]!,
        edge.renderedMidpoint(),
        edge.renderedControlPoints()[1]!,
        edge.renderedTargetEndpoint(),
      ];
      const path = createEdgeHitboxPath(box);
      const coordinates = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      expect(
        path.match(/Q/g)?.length === 2 &&
          points.every(
            (point, index) =>
              Math.abs(coordinates[index * 2]! - point.x) <= 0.0051 &&
              Math.abs(coordinates[index * 2 + 1]! - point.y) <= 0.0051,
          ),
        "loop pointer paths must follow the public renderer points at current zoom and pan",
      );
    }
    const loop = cy.getElementById("loop");
    const source = loop.source().position();
    const midpoint = loop.midpoint();
    const expectedRadius = 1.4 * 110 * Math.cos((65 * Math.PI) / 360);
    expect(
      Math.abs(
        Math.hypot(midpoint.x - source.x, midpoint.y - source.y) -
          expectedRadius,
      ) < 1e-8 &&
        Number.parseFloat(loop.style("control-point-step-size")) === 110 &&
        Number.parseFloat(
          cy.getElementById("manual").style("control-point-step-size"),
        ) === 40 &&
        Number.parseFloat(
          cy.getElementById("de").style("control-point-step-size"),
        ) === 40,
      "only enlarged automatic loops should change the actual bundled renderer radius",
    );
    expect(
      applyCytoscapeRoutingMeta(cy, routes).length === 0,
      "unchanged loop sizes must perform no routing data refresh",
    );
    const refreshed: string[] = [];
    cy.on("style", (event) => refreshed.push(event.target.id()));
    routes.set("loop", { ...automatic, loopStepSizePx: 140 });
    const changed = applyCytoscapeRoutingMeta(cy, routes);
    refreshed.length = 0;
    expect(
      changed.length === 1 &&
        refreshCytoscapeGeometry(changed) === 2 &&
        refreshed.sort().join(",") === "loop,loop2",
      "a loop size change must refresh its loop group and leave remote geometry alone",
    );
    const current = loop.boundingBox();
    expect(
      current.x1 <= loop.midpoint().x &&
        current.x2 >= loop.midpoint().x &&
        current.y1 <= loop.midpoint().y &&
        current.y2 >= loop.midpoint().y,
      "resized loops must retain current bounds around the renderer midpoint",
    );
    const enlarged = readEdgeLabelHitboxes(cy, graph);
    expect(
      reconcileEdgeLabelHitboxes(hitboxes, enlarged) !== hitboxes,
      "loop geometry changes must reach memoized pointer overlays",
    );
    routes.set("loop", { ...automatic, loopStepSizePx: undefined });
    cy.getElementById("a").style({ width: 48, shape: "ellipse" });
    refreshCytoscapeGeometry(applyCytoscapeRoutingMeta(cy, routes));
    expect(
      loop.data("loopStepSize") === 40 &&
        Number.parseFloat(loop.style("control-point-step-size")) === 40 &&
        JSON.stringify(graph) === modelBefore,
      "restoring default loop sizes must clear transient enlargement without changing graph data",
    );
  } finally {
    cy.destroy();
  }
}

function verifyCachedRouteBounds() {
  const { cy, renderer } = createCalculationCanvas(fixture());
  try {
    const edge = cy.getElementById("ab");
    const original = { ...edge.boundingBox() };
    edge.data("controlPointDistances", [-160]);
    // Fit reads bounds before the renderer's frame. That sequence captures an
    // obsolete box even though the subsequent frame updates the real midpoint.
    edge.boundingBox();
    renderer.flushRenderedStyleQueue();
    const bent = edge.midpoint();
    const stale = edge.boundingBox();
    expect(
      stale.y1 === original.y1 && bent.y < stale.y1,
      "the regression fixture must reproduce a current curve outside its cached box",
    );
    expect(
      refreshCytoscapeGeometry(cy.collection(edge)) === 1,
      "a single changed route must refresh one edge",
    );
    const current = edge.boundingBox();
    expect(
      current.y1 <= bent.y && current.y2 >= bent.y,
      "refresh must rebuild body and label bounds around the new route",
    );
    const graph = fixture();
    const synced = syncCytoscapeElements(cy, definitions(graph));
    refreshCytoscapeGeometry(synced.changedElements);
    renderer.flushRenderedStyleQueue();
    const restored = edge.boundingBox();
    expect(
      edge.midpoint().y === 0 &&
        restored.y1 === original.y1 &&
        restored.y2 === original.y2,
      "same-ID restoration must return both the route and bounds to straight",
    );
  } finally {
    cy.destroy();
  }
}

function verifyAffectedGeometry() {
  let graph = fixture();
  graph.edges.push({ id: "ab2", source: "a", target: "b", label: "2" });
  const { cy } = createCalculationCanvas(graph);
  try {
    const refreshed: string[] = [];
    cy.on("style", (event) => refreshed.push(event.target.id()));
    const stable = syncCytoscapeElements(cy, definitions(graph));
    expect(
      refreshCytoscapeGeometry(stable.changedElements) === 0 &&
        refreshed.length === 0,
      "an unchanged sync must perform no geometry/style refresh",
    );
    const edge = cy.getElementById("ab");
    edge.addClass("range-preview").select();
    const next = definitions(graph).map((definition) =>
      definition.data.id === "ab"
        ? {
            ...definition,
            data: { ...definition.data, controlPointDistances: [-64] },
          }
        : definition,
    );
    const synced = syncCytoscapeElements(cy, next);
    refreshed.length = 0;
    expect(
      refreshCytoscapeGeometry(synced.changedElements) === 2 &&
        refreshed.sort().join(",") === "ab,ab2",
      "an edge change must refresh its parallel group and leave remote geometry alone",
    );
    expect(
      cy.getElementById("ab") === edge &&
        edge.hasClass("range-preview") &&
        edge.selected(),
      "refresh must preserve edge identity, transient classes and selection",
    );
    const rewired = syncCytoscapeElements(
      cy,
      next.map((definition) =>
        definition.data.id === "ab"
          ? {
              ...definition,
              data: { ...definition.data, source: "d", target: "e" },
            }
          : definition,
      ),
    );
    refreshed.length = 0;
    expect(
      refreshCytoscapeGeometry(rewired.changedElements) === 3 &&
        refreshed.sort().join(",") === "ab,ab2,de",
      "a same-ID topology replacement must refresh the new edge and both parallel groups",
    );
    refreshCytoscapeGeometry(
      syncCytoscapeElements(cy, definitions(graph)).changedElements,
    );
    graph = {
      ...graph,
      nodes: graph.nodes.map((node) =>
        node.id === "a" ? { ...node, y: 30 } : node,
      ),
    };
    const moved = syncCytoscapeElements(cy, definitions(graph));
    refreshed.length = 0;
    expect(
      refreshCytoscapeGeometry(moved.changedElements) === 4 &&
        refreshed.sort().join(",") === "a,ab,ab2,ac",
      "a node change must refresh that node and incident/parallel edges only",
    );
    const endpointBeforeWidth = cy.getElementById("ab").sourceEndpoint();
    cy.getElementById("a").style("width", 96);
    refreshed.length = 0;
    expect(
      refreshCytoscapeGeometry(cy.collection(cy.getElementById("a"))) === 4 &&
        cy.getElementById("ab").sourceEndpoint().x > endpointBeforeWidth.x &&
        refreshed.sort().join(",") === "a,ab,ab2,ac",
      "node width changes must refresh incident endpoints without touching remote edges",
    );
    graph = { ...graph, edges: graph.edges.filter((item) => item.id !== "ab") };
    const removed = syncCytoscapeElements(cy, definitions(graph));
    refreshed.length = 0;
    expect(
      refreshCytoscapeGeometry(removed.changedElements) === 1 &&
        refreshed.join(",") === "ab2",
      "removing one parallel edge must refresh its surviving sibling",
    );
    graph = {
      ...graph,
      edges: [
        ...graph.edges,
        { id: "la", source: "a", target: "a" },
        { id: "la2", source: "a", target: "a" },
      ],
    };
    const loops = syncCytoscapeElements(cy, definitions(graph));
    refreshed.length = 0;
    expect(
      refreshCytoscapeGeometry(loops.changedElements) === 2 &&
        refreshed.sort().join(",") === "la,la2",
      "new self-loop geometry must refresh just its loop group",
    );
  } finally {
    cy.destroy();
  }
}

function verifyLabelDimensions() {
  const graph = fixture();
  const { cy } = createCalculationCanvas(graph);
  try {
    cy.zoom(1.5);
    const hitboxes = readEdgeLabelHitboxes(cy, graph);
    const short = hitboxes.find((hitbox) => hitbox.id === "ab")!;
    const long = hitboxes.find((hitbox) => hitbox.id === "ac")!;
    expect(
      short.labelWidth === 44 &&
        (short.labelHeight ?? 0) > 32 &&
        (long.labelWidth ?? 0) > 112 &&
        long.labelHeight === short.labelHeight,
      "zoomed label backgrounds must fit inside targets without a long-label width cap",
    );
    graph.settings.weighted = true;
    graph.edges[0]!.weight = "9";
    expect(
      readEdgeLabelHitboxes(cy, graph)[0]!.label === "1",
      "hitbox text must use the displayed explicit label before the fallback weight",
    );
    expect(
      reconcileEdgeLabelHitboxes(
        hitboxes,
        hitboxes.map((hitbox) =>
          hitbox.id === "ab" ? { ...hitbox, labelHeight: 60 } : hitbox,
        ),
      ) !== hitboxes,
      "reconciliation must propagate changes to rendered label dimensions",
    );
  } finally {
    cy.destroy();
  }
}

function verifyVisibleDeadline() {
  let now = 0;
  let nextId = 0;
  const timers = new Map<number, { at: number; callback: () => void }>();
  const listeners = new Set<() => void>();
  const visibility = {
    hidden: true,
    addEventListener: (_type: "visibilitychange", listener: () => void) =>
      listeners.add(listener),
    removeEventListener: (_type: "visibilitychange", listener: () => void) =>
      listeners.delete(listener),
  };
  const clock = {
    now: () => now,
    setTimeout: (callback: () => void, delay: number) => {
      const id = ++nextId;
      timers.set(id, { at: now + delay, callback });
      return id;
    },
    clearTimeout: (id: number) => {
      timers.delete(id);
    },
  };
  const advance = (duration: number) => {
    const end = now + duration;
    while (true) {
      const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = end;
  };
  const hidden = (value: boolean) => {
    visibility.hidden = value;
    [...listeners].forEach((listener) => listener());
  };
  let errors = 0;
  startVisibleTimeout(() => errors++, 10_000, visibility, clock);
  advance(60_000);
  expect(
    errors === 0 && timers.size === 0,
    "initial hidden time must not start a display deadline",
  );
  hidden(false);
  advance(4_000);
  hidden(true);
  advance(60_000);
  hidden(false);
  advance(5_999);
  expect(
    errors === 0,
    "hidden time must not consume the remaining visible display time",
  );
  advance(1);
  expect(
    errors === 1 && listeners.size === 0 && timers.size === 0,
    "ten visible seconds must report one error and release the listener/timer",
  );
  const stop = startVisibleTimeout(() => errors++, 10_000, visibility, clock);
  stop();
  advance(60_000);
  expect(
    errors === 1 && listeners.size === 0 && timers.size === 0,
    "a completed or unmounted canvas must cancel its old display deadline",
  );
}

function verifyRenderRequestCancellation() {
  const cy = cytoscape({ headless: true });
  const frames = new Map<number, FrameRequestCallback>();
  let nextId = 0;
  let request = 1;
  let ready = 0;
  const clock = {
    requestFrame: (callback: FrameRequestCallback) => {
      frames.set(++nextId, callback);
      return nextId;
    },
    cancelFrame: (id: number) => {
      frames.delete(id);
    },
  };
  const runFrames = () => {
    for (const [id, callback] of frames) {
      frames.delete(id);
      callback(0);
    }
  };
  try {
    const cancel = afterCytoscapeRender(
      cy,
      () => request === 1,
      () => ready++,
      clock,
    );
    cy.emit("render");
    cancel();
    runFrames();
    expect(
      ready === 0 && frames.size === 0,
      "cleanup must cancel an already scheduled reveal frame",
    );
    afterCytoscapeRender(
      cy,
      () => request === 1,
      () => ready++,
      clock,
    );
    cy.emit("render");
    request = 2;
    runFrames();
    expect(
      ready === 0,
      "an obsolete element request must not mark the current canvas ready",
    );
    afterCytoscapeRender(
      cy,
      () => request === 2,
      () => ready++,
      clock,
    );
    cy.emit("render");
    expect(
      ready === 0,
      "a renderer event must wait for the following frame before exposing hitboxes",
    );
    runFrames();
    expect(ready === 1, "the current painted request must complete once");
  } finally {
    cy.destroy();
  }
}
