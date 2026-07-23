import { createEmptyGraphModel } from "../../features/graph-editor/core/graph/graph-factory";
import type { GraphModel } from "../../features/graph-editor/core/graph/model";
import { createEdgeRoutingCacheKey } from "../../features/graph-editor/core/layout/edge-routing";
import {
  createManualLayoutCommand,
  layoutDefinitions,
  manualLayoutDisabledReasonCode,
} from "../../features/graph-editor/layouts";
import { createVerification } from "./harness";

const { expect, fail, finish } = createVerification("Layout");
const kinds = layoutDefinitions.map((definition) => definition.kind);
const kindSet = new Set(kinds);

if (kindSet.size !== kinds.length) {
  fail("layout registry contains duplicate kinds");
}

for (const definition of layoutDefinitions) {
  manualLayoutDisabledReasonCode(definition.kind, createEmptyGraphModel());
  createManualLayoutCommand(createEmptyGraphModel(), definition.kind);
}

const undirectedPath = graphFixture({
  directed: false,
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
});
const directedDag = graphFixture({
  directed: true,
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
});
const directedCycle = graphFixture({
  directed: true,
  edges: [
    ["a", "b"],
    ["b", "c"],
    ["c", "a"],
  ],
});
const triangle = graphFixture({
  directed: false,
  edges: [
    ["a", "b"],
    ["b", "c"],
    ["c", "a"],
  ],
});
const disconnectedBipartite = graphFixture({
  directed: false,
  edges: [
    ["0", "4"],
    ["1", "5"],
    ["2", "4"],
    ["2", "6"],
    ["3", "5"],
    ["3", "7"],
  ],
});
const unorderedTree = {
  ...graphFixture({
    directed: false,
    edges: [
      ["root", "left"],
      ["root", "right"],
      ["left", "leaf"],
    ],
  }),
  nodes: [
    { id: "root", label: "0", order: 0, x: 0, y: 0 },
    { id: "left", label: "1", order: 1, x: 0, y: 0 },
    { id: "right", label: "2", order: 2, x: 0, y: 0 },
    { id: "leaf", label: "3", order: 3, x: 0, y: 0 },
  ],
};

expect(
  manualLayoutDisabledReasonCode("tree", undirectedPath) === null,
  "tree layout should be enabled for forests",
);
expect(
  manualLayoutDisabledReasonCode("tree", triangle) !== null,
  "tree layout should be disabled for cyclic graphs",
);
expect(
  manualLayoutDisabledReasonCode("dagLayer", directedDag) === null,
  "DAG layout should be enabled for directed acyclic graphs",
);
expect(
  manualLayoutDisabledReasonCode("dagLayer", directedCycle) !== null,
  "DAG layout should be disabled for directed cycles",
);
expect(
  manualLayoutDisabledReasonCode("bipartite", triangle) !== null,
  "bipartite layout should be disabled for non-bipartite graphs",
);
expect(
  manualLayoutDisabledReasonCode("force", largeGraphFixture()) ===
    "tooLargeGraph",
  "force layout should be disabled for large graphs",
);

expect(
  JSON.stringify(createManualLayoutCommand(undirectedPath, "force")) ===
    JSON.stringify(createManualLayoutCommand(undirectedPath, "force")),
  "force layout should remain deterministic for the same graph",
);

const routingBase = graphFixture({
  directed: false,
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
});
const routingBaseKey = createEdgeRoutingCacheKey(routingBase, {
  mode: "quality",
});
expect(
  createEdgeRoutingCacheKey(
    {
      ...routingBase,
      nodes: routingBase.nodes.map((node) =>
        node.id === "a" ? { ...node, label: "renamed" } : node,
      ),
    },
    { mode: "quality" },
  ) === routingBaseKey,
  "routing cache key should ignore node labels",
);
expect(
  createEdgeRoutingCacheKey(
    {
      ...routingBase,
      nodes: routingBase.nodes.map((node) =>
        node.id === "a" ? { ...node, x: node.x + 10 } : node,
      ),
    },
    { mode: "quality" },
  ) !== routingBaseKey,
  "routing cache key should include node positions when node avoidance is enabled",
);
expect(
  createEdgeRoutingCacheKey(
    {
      ...routingBase,
      edges: routingBase.edges.map((edge) =>
        edge.id === "e0" ? { ...edge, routing: { bowPx: 20 } } : edge,
      ),
    },
    { mode: "quality" },
  ) !== routingBaseKey,
  "routing cache key should include edge routing overrides",
);

const lineCommand = createManualLayoutCommand(unorderedTree, "line");
expect(
  lineCommand.type === "move-nodes" &&
    lineCommand.after.root.x < lineCommand.after.left.x &&
    lineCommand.after.left.x < lineCommand.after.right.x &&
    lineCommand.after.right.x < lineCommand.after.leaf.x,
  "line layout should preserve node order instead of path traversal order",
);

const treeCommand = createManualLayoutCommand(unorderedTree, "tree");
expect(
  treeCommand.type === "move-nodes" &&
    treeCommand.after.root.y < treeCommand.after.left.y &&
    treeCommand.after.root.y < treeCommand.after.right.y,
  "tree layout should use the smallest ordered node as the default root",
);

const bipartiteCommand = createManualLayoutCommand(
  disconnectedBipartite,
  "bipartite",
);
const oddComponentY =
  bipartiteCommand.type === "move-nodes"
    ? ["1", "3", "5", "7"].map((nodeId) => bipartiteCommand.after[nodeId].y)
    : [];
const evenComponentY =
  bipartiteCommand.type === "move-nodes"
    ? ["0", "2", "4", "6"].map((nodeId) => bipartiteCommand.after[nodeId].y)
    : [];
const oddRange = [Math.min(...oddComponentY), Math.max(...oddComponentY)];
const evenRange = [Math.min(...evenComponentY), Math.max(...evenComponentY)];

expect(
  bipartiteCommand.type === "move-nodes" &&
    (oddRange[1] < evenRange[0] || evenRange[1] < oddRange[0]),
  "bipartite layout should pack disconnected components into separate bands",
);

const treeBipartiteCommand = createManualLayoutCommand(
  graphFixture({
    directed: false,
    edges: [
      ["0", "1"],
      ["0", "2"],
      ["1", "3"],
      ["1", "4"],
      ["2", "5"],
      ["2", "6"],
    ],
  }),
  "bipartite",
);

expect(
  treeBipartiteCommand.type === "move-nodes" &&
    treeBipartiteCommand.after["0"].y < treeBipartiteCommand.after["3"].y &&
    treeBipartiteCommand.after["3"].y < treeBipartiteCommand.after["4"].y &&
    treeBipartiteCommand.after["4"].y < treeBipartiteCommand.after["5"].y &&
    treeBipartiteCommand.after["5"].y < treeBipartiteCommand.after["6"].y &&
    treeBipartiteCommand.after["1"].y < treeBipartiteCommand.after["2"].y,
  "bipartite layout should keep each side in natural node order",
);

finish(`Layout verification passed (${layoutDefinitions.length} kinds)`);

function graphFixture({
  directed,
  edges,
}: {
  directed: boolean;
  edges: Array<readonly [string, string]>;
}): GraphModel {
  const ids = [...new Set(edges.flat())];

  return {
    ...createEmptyGraphModel({ directed }),
    nodes: ids.map((id, index) => ({
      id,
      label: id,
      order: index,
      x: index * 120,
      y: 0,
    })),
    edges: edges.map(([source, target], index) => ({
      id: `e${index}`,
      source,
      target,
    })),
  };
}

function largeGraphFixture(): GraphModel {
  return {
    ...createEmptyGraphModel(),
    nodes: Array.from({ length: 301 }, (_, index) => ({
      id: `n${index}`,
      label: String(index),
      order: index,
      x: 0,
      y: 0,
    })),
    edges: [],
  };
}
