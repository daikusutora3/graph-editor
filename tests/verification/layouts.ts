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

const routingBase = graphFixture({
  directed: false,
  edges: [
    ["a", "b"],
    ["b", "c"],
  ],
});
const routingBaseKey = createEdgeRoutingCacheKey(routingBase, {
  avoidNodes: true,
});
expect(
  createEdgeRoutingCacheKey(
    {
      ...routingBase,
      nodes: routingBase.nodes.map((node) =>
        node.id === "a" ? { ...node, label: "renamed" } : node,
      ),
    },
    { avoidNodes: true },
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
    { avoidNodes: true },
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
    { avoidNodes: true },
  ) !== routingBaseKey,
  "routing cache key should include edge routing overrides",
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
