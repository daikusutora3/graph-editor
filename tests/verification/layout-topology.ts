import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import {
  connectedComponents,
  isBipartite,
  isDirectedAcyclic,
  isForest,
  orderIndex,
  stronglyConnectedComponents,
} from "../../features/graph-editor/core/graph/graph-analysis";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import {
  layoutBfs,
  layoutDag,
  layoutScc,
  sortLayerByBarycenter,
} from "../../features/graph-editor/layouts/layout-algorithms";
import { createVerification } from "./harness";

const { expect, finish } = createVerification("Layout topology");

// Exhaust all directed graphs on three vertices. Independent reachability
// establishes both cycle detection and the SCC partition, including self-loops.
for (let mask = 0; mask < 1 << 9; mask += 1) {
  const edges = Array.from({ length: 9 }, (_, bit) => bit)
    .filter((bit) => mask & (1 << bit))
    .map((bit) => [Math.floor(bit / 3), bit % 3]);
  const graph = fixture(3, edges);
  const reachable = Array.from({ length: 3 }, () => [false, false, false]);
  for (const [source, target] of edges) reachable[source]![target] = true;
  for (let via = 0; via < 3; via += 1) {
    for (let source = 0; source < 3; source += 1) {
      for (let target = 0; target < 3; target += 1) {
        reachable[source]![target] ||= Boolean(
          reachable[source]![via] && reachable[via]![target],
        );
      }
    }
  }
  expect(
    isDirectedAcyclic(graph) === !reachable.some((row, index) => row[index]),
    `DAG predicate matches reachability for graph ${mask}`,
  );
  const components = stronglyConnectedComponents(graph);
  for (let first = 0; first < 3; first += 1) {
    for (let second = 0; second < 3; second += 1) {
      const sameComponent = components.some(
        (component) =>
          component.includes(`n${first}`) && component.includes(`n${second}`),
      );
      expect(
        sameComponent ===
          (first === second ||
            Boolean(reachable[first]![second] && reachable[second]![first])),
        `SCC partition matches reachability for graph ${mask}`,
      );
    }
  }
}

const readyOrderDag = fixture(6, [
  [0, 1],
  [0, 4],
  [1, 4],
  [2, 4],
  [4, 5],
]);
const readyOrderPositions = layoutDag(readyOrderDag);
expect(
  readyOrderPositions.n0!.x < readyOrderPositions.n1!.x &&
    readyOrderPositions.n1!.x < readyOrderPositions.n4!.x &&
    readyOrderPositions.n4!.x < readyOrderPositions.n5!.x,
  "DAG layers use the longest predecessor path as newly ready nodes arrive",
);
expect(
  readyOrderPositions.n0!.x === readyOrderPositions.n2!.x &&
    readyOrderPositions.n0!.x === readyOrderPositions.n3!.x,
  "all initial DAG roots share the first layer",
);

const parallel = fixture(3, [
  [0, 1],
  [0, 1],
  [1, 2],
  [100, 2],
]);
expect(isDirectedAcyclic(parallel), "parallel edges preserve DAG indegrees");
expect(isBipartite(parallel), "parallel edges preserve bipartite coloring");
expect(!isForest(parallel), "parallel edges remain cycles for forest layout");
expect(
  !isDirectedAcyclic({
    ...parallel,
    settings: { ...parallel.settings, directed: false },
  }),
  "DAG predicate requires directed settings",
);
expect(
  !isDirectedAcyclic(fixture(5, [[4, 4]])),
  "a self-loop is a cycle even after an acyclic prefix",
);

const sccGraph = fixture(5, [
  [0, 1],
  [1, 0],
  [1, 2],
  [2, 3],
  [3, 2],
]);
sccGraph.nodes = sccGraph.nodes.toReversed();
expect(
  JSON.stringify(stronglyConnectedComponents(sccGraph)) ===
    JSON.stringify([["n1", "n0"], ["n3", "n2"], ["n4"]]),
  "SCC components preserve natural order and internal Tarjan pop order",
);
const sccPositions = layoutScc(sccGraph);
expect(
  sccPositions.n0!.x < sccPositions.n2!.x &&
    sccPositions.n1!.x < sccPositions.n3!.x,
  "condensation graph keeps source components before their successors",
);

const disconnected = fixture(7, [
  [0, 1],
  [1, 2],
  [3, 4],
]);
disconnected.nodes = disconnected.nodes.toReversed();
expect(
  JSON.stringify(connectedComponents(disconnected)) ===
    JSON.stringify([["n0", "n1", "n2"], ["n3", "n4"], ["n5"], ["n6"]]),
  "FIFO traversal preserves component and neighbor order",
);
expect(
  JSON.stringify(layoutBfs(disconnected, "n3")) ===
    JSON.stringify({
      n3: { x: -450, y: 0 },
      n4: { x: -300, y: 0 },
      n0: { x: -150, y: 0 },
      n1: { x: 0, y: 0 },
      n2: { x: 150, y: 0 },
      n5: { x: 300, y: 0 },
      n6: { x: 450, y: 0 },
    }),
  "BFS root priority and disconnected-component spacing stay exact",
);
const isolated = layoutBfs(fixture(1000, []), "n777");
expect(
  Object.keys(isolated).length === 1000 &&
    isolated.n777!.x === -74925 &&
    isolated.n999!.x === 74925,
  "BFS includes every isolated vertex and honors an explicit root",
);

const reference = ["r0", "r1", "r2"];
const layer = ["a", "d", "b", "c"];
const related = new Map([
  ["a", new Set(["r0", "r2", "outside"])],
  ["b", new Set(["r1"])],
  ["c", new Set(["outside"])],
  ["d", new Set(["r2"])],
]);
expect(
  JSON.stringify(
    sortLayerByBarycenter(
      layer,
      reference,
      related,
      orderIndex(["c", "b", "a", "d"]),
    ),
  ) === JSON.stringify(["c", "b", "a", "d"]),
  "barycenter ignores outside neighbors and resolves equal means by natural order",
);
expect(
  JSON.stringify(layer) === JSON.stringify(["a", "d", "b", "c"]),
  "layer ordering leaves the caller's array unchanged",
);

finish(
  "Layout topology verification passed (512 directed graphs and layout contracts)",
);

function fixture(count: number, edges: number[][]): GraphModel {
  return {
    ...createEmptyGraphModel({ directed: true }),
    nodes: Array.from({ length: count }, (_, index) => ({
      id: `n${index}`,
      order: index,
      label: String(index),
      x: index * 100,
      y: 0,
    })),
    edges: edges.map(([source, target], index) => ({
      id: `e${index}`,
      source: `n${source}`,
      target: `n${target}`,
    })),
  };
}
